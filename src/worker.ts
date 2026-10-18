/// <reference types="@cloudflare/workers-types" />

import { renderPublicBadgePage, renderPublicBadgeSvg } from './lib/devcon26-public-badge';
import { PHYSICAL_BADGE_PATH } from './lib/devcon26-digital-badge';
import { createEventsCalendar } from './lib/event-calendar';
import {
  fetchLiveDevcon26SocialCard,
  fetchLiveDevcon26SocialCardImage,
  isDevcon26SocialCardSlug,
} from './lib/live-devcon26-social-cards';
import { fetchLivePublicEvent, fetchLivePublicEvents } from './lib/live-public-events';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const EVENT_ROUTE = /^\/events\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,239})\/?$/;
const SOCIAL_CARD_ROUTE = /^\/devcon26\/cards\/([A-Za-z0-9_-]{22,80})\/?$/;
const SOCIAL_CARD_IMAGE_ROUTE = /^\/devcon26\/cards\/([A-Za-z0-9_-]{22,80})\/image\/?$/;
const SOCIAL_CARD_PREVIEW_ROUTE = /^\/devcon26\/cards\/([A-Za-z0-9_-]{22,80})\/preview\.svg\/?$/;
const CALENDAR_PATH = '/events/calendar.ics';
const EVENT_SHELL_PATH = '/events/';
const SUPPORT_PATHS = new Set(['/support', '/support/']);
const SUPPORT_URL = 'https://pages.inttegro.com/buy/sale_eLiPUNAEjfeHZOX4VHQPuy0oJWQT6n0g7Bdof5rr';
const EVENT_READINESS_PARAM = 'readiness';
const CALENDAR_CACHE_SECONDS = 60;
const READINESS_CACHE_SECONDS = 30;
const MISSING_EVENT_CACHE_SECONDS = 15;
const READINESS_CACHE_MARKER = '1';

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (SUPPORT_PATHS.has(url.pathname)) {
      return Response.redirect(SUPPORT_URL, 307);
    }

    if (url.pathname === CALENDAR_PATH) {
      if (!isReadableMethod(request.method)) return methodNotAllowed();
      return serveLiveCalendar(request, context);
    }

    const socialCardImageMatch = url.pathname.match(SOCIAL_CARD_IMAGE_ROUTE);

    if (socialCardImageMatch) {
      if (!isReadableMethod(request.method)) return methodNotAllowed();
      return serveLiveSocialCardImage(request, socialCardImageMatch[1]);
    }

    const socialCardPreviewMatch = url.pathname.match(SOCIAL_CARD_PREVIEW_ROUTE);

    if (socialCardPreviewMatch) {
      if (!isReadableMethod(request.method)) return methodNotAllowed();
      return serveLiveSocialCardPreview(request, env, socialCardPreviewMatch[1]);
    }

    const socialCardMatch = url.pathname.match(SOCIAL_CARD_ROUTE);

    if (socialCardMatch) {
      if (!isReadableMethod(request.method)) return methodNotAllowed();
      return serveLiveSocialCardPage(request, socialCardMatch[1]);
    }

    const eventMatch = url.pathname.match(EVENT_ROUTE);
    if (eventMatch && eventMatch[1] !== 'index' && eventMatch[1] !== 'submit') {
      if (url.searchParams.get(EVENT_READINESS_PARAM) === '1') {
        if (!isReadableMethod(request.method)) return methodNotAllowed();
        return serveLiveEventReadiness(request, eventMatch[1], context);
      }
      if (!isReadableMethod(request.method)) return methodNotAllowed();
      return serveLiveEventShell(request, env, eventMatch[1]);
    }

    return env.ASSETS.fetch(request);
  },
};

async function serveLiveSocialCardPage(request: Request, slug: string): Promise<Response> {
  if (!isDevcon26SocialCardSlug(slug)) return notFound();

  try {
    const card = await fetchLiveDevcon26SocialCard(slug);

    if (!card) return notFound();
    const url = new URL(request.url);
    const pageUrl = `${url.origin}/devcon26/cards/${encodeURIComponent(slug)}`;
    const body = renderPublicBadgePage(card, pageUrl);

    return responseForMethod(new Response(body, {
      headers: {
        ...cacheHeaders(300),
        'Content-Type': 'text/html; charset=utf-8',
      },
    }), request.method);
  } catch (error) {
    console.error(JSON.stringify({ event: 'public_social_card_lookup_failed', slug, error_name: error instanceof Error ? error.name : 'Error' }));
    return serviceUnavailable('Social card temporarily unavailable');
  }
}

async function serveLiveSocialCardPreview(request: Request, env: Env, slug: string): Promise<Response> {
  if (!isDevcon26SocialCardSlug(slug)) return notFound();

  try {
    const card = await fetchLiveDevcon26SocialCard(slug);

    if (!card) return notFound();
    const logoResponse = await env.ASSETS.fetch(new Request(new URL('/images/logo.png', request.url)));
    const logo = await publicImageDataUrl(logoResponse, 512 * 1024);
    const backingResponse = await env.ASSETS.fetch(new Request(new URL(PHYSICAL_BADGE_PATH, request.url)));
    const backing = await publicImageDataUrl(backingResponse, 5 * 1024 * 1024);
    let photo = '';

    if (card.photo_available) {
      const response = await fetchLiveDevcon26SocialCardImage(slug);

      if (!response) return notFound();
      photo = await publicImageDataUrl(response, 5 * 1024 * 1024);
    }
    const svg = renderPublicBadgeSvg(card, photo, logo, backing);

    return responseForMethod(new Response(svg, {
      headers: {
        ...cacheHeaders(300),
        'Content-Type': 'image/svg+xml; charset=utf-8',
      },
    }), request.method);
  } catch (error) {
    console.error(JSON.stringify({ event: 'public_social_card_preview_lookup_failed', slug, error_name: error instanceof Error ? error.name : 'Error' }));
    return serviceUnavailable('Social card preview temporarily unavailable');
  }
}

async function serveLiveSocialCardImage(request: Request, slug: string): Promise<Response> {
  if (!isDevcon26SocialCardSlug(slug)) return notFound();

  try {
    const image = await fetchLiveDevcon26SocialCardImage(slug);

    if (!image) return notFound();
    const contentType = image.headers.get('Content-Type');

    if (!contentType?.startsWith('image/')) return serviceUnavailable('Social card image temporarily unavailable');
    return responseForMethod(new Response(image.body, {
      headers: {
        ...cacheHeaders(300),
        'Content-Type': contentType,
      },
    }), request.method);
  } catch (error) {
    console.error(JSON.stringify({ event: 'public_social_card_image_lookup_failed', slug, error_name: error instanceof Error ? error.name : 'Error' }));
    return serviceUnavailable('Social card image temporarily unavailable');
  }
}

async function publicImageDataUrl(response: Response, maxBytes: number): Promise<string> {
  const type = response.headers.get('Content-Type')?.split(';')[0];

  if (!response.ok || !type || !['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(type) || !response.body) {
    throw new Error('Public badge image unavailable');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Public badge image too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let binary = '';

  for (const chunk of chunks) {
    for (let offset = 0; offset < chunk.length; offset += 8192) {
      binary += String.fromCharCode(...chunk.subarray(offset, offset + 8192));
    }
  }

  return `data:${type};base64,${btoa(binary)}`;
}

async function serveLiveEventShell(request: Request, env: Env, slug: string): Promise<Response> {
  try {
    const shellUrl = new URL(EVENT_SHELL_PATH, request.url);
    const shellResponse = await env.ASSETS.fetch(new Request(shellUrl, request));
    if (!shellResponse.ok) return shellResponse;

    const headers = new Headers(shellResponse.headers);
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(shellResponse.body, {
      status: shellResponse.status,
      headers,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_event_route_lookup_failed',
      slug,
      error_name: error instanceof Error ? error.name : 'Error',
    }));
    return serviceUnavailable('Public event temporarily unavailable');
  }
}

async function serveLiveEventReadiness(
  request: Request,
  slug: string,
  context: ExecutionContext,
): Promise<Response> {
  const cacheKey = createCacheKey(request, `?${EVENT_READINESS_PARAM}=1`);
  const cachedResponse = await readCache(cacheKey);
  if (cachedResponse) return readinessResponseFromCache(cachedResponse, request.method);

  try {
    const event = await fetchLivePublicEvent(slug);
    if (!event) {
      const response = new Response('Event not found', {
        status: 404,
        headers: cacheHeaders(MISSING_EVENT_CACHE_SECONDS),
      });
      cacheResponse(context, cacheKey, response);
      return responseForMethod(response, request.method);
    }

    const responseHeaders = cacheHeaders(READINESS_CACHE_SECONDS);
    const response = new Response(null, {
      status: 204,
      headers: responseHeaders,
    });
    cacheResponse(context, cacheKey, new Response('ready', {
      headers: {
        ...responseHeaders,
        'X-Event-Ready': READINESS_CACHE_MARKER,
      },
    }));
    return responseForMethod(response, request.method);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_event_readiness_lookup_failed',
      slug,
      error_name: error instanceof Error ? error.name : 'Error',
    }));
    return serviceUnavailable('Public event temporarily unavailable');
  }
}

function readinessResponseFromCache(response: Response, method: string): Response {
  if (response.headers.get('X-Event-Ready') !== READINESS_CACHE_MARKER) {
    return responseForMethod(response, method);
  }

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Type');
  headers.delete('X-Event-Ready');
  return new Response(null, {
    status: 204,
    headers,
  });
}

async function serveLiveCalendar(request: Request, context: ExecutionContext): Promise<Response> {
  const cacheKey = createCacheKey(request);
  const cachedResponse = await readCache(cacheKey);
  if (cachedResponse) return responseForMethod(cachedResponse, request.method);

  try {
    const events = await fetchLivePublicEvents();
    const body = createEventsCalendar(events);
    const response = new Response(body, {
      headers: {
        ...cacheHeaders(CALENDAR_CACHE_SECONDS),
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="devcongress-events.ics"',
      },
    });
    cacheResponse(context, cacheKey, response);
    return responseForMethod(response, request.method);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_event_calendar_lookup_failed',
      error_name: error instanceof Error ? error.name : 'Error',
    }));
    return serviceUnavailable('Public event calendar temporarily unavailable');
  }
}

function createCacheKey(request: Request, search = ''): Request {
  const url = new URL(request.url);
  url.search = search;
  url.hash = '';
  return new Request(url, { method: 'GET' });
}

async function readCache(cacheKey: Request): Promise<Response | null> {
  try {
    const response = await caches.default.match(cacheKey);
    return response ? withCacheHitHeader(response) : null;
  } catch (error) {
    logCacheFailure('read', error);
    return null;
  }
}

function withCacheHitHeader(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Website-Cache', 'HIT');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cacheResponse(context: ExecutionContext, cacheKey: Request, response: Response): void {
  context.waitUntil(
    caches.default.put(cacheKey, response.clone()).catch((error) => logCacheFailure('write', error)),
  );
}

function responseForMethod(response: Response, method: string): Response {
  if (method !== 'HEAD') return response;
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function cacheHeaders(maxAgeSeconds: number): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=300`,
    'X-Content-Type-Options': 'nosniff',
  };
}

function isReadableMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function methodNotAllowed(): Response {
  return new Response('Method not allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function serviceUnavailable(message: string): Response {
  return new Response(message, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function logCacheFailure(operation: 'read' | 'write', error: unknown): void {
  console.error(JSON.stringify({
    event: 'public_event_cache_failed',
    operation,
    error_name: error instanceof Error ? error.name : 'Error',
  }));
}
