/// <reference types="@cloudflare/workers-types" />

import { createEventsCalendar } from './lib/event-calendar';
import { fetchLivePublicEvent, fetchLivePublicEvents } from './lib/live-public-events';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const EVENT_ROUTE = /^\/events\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,239})\/?$/;
const CALENDAR_PATH = '/events/calendar.ics';
const EVENT_SHELL_PATH = '/events/';
const EVENT_READINESS_PARAM = 'readiness';
const CALENDAR_CACHE_SECONDS = 60;
const READINESS_CACHE_SECONDS = 30;
const MISSING_EVENT_CACHE_SECONDS = 15;
const READINESS_CACHE_MARKER = '1';

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === CALENDAR_PATH) {
      if (!isReadableMethod(request.method)) return methodNotAllowed();
      return serveLiveCalendar(request, context);
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
