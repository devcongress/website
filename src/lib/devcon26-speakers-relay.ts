import {
  DEFAULT_EMS_API_ORIGIN,
  EMS_PUBLIC_SPEAKERS_PATH,
  isValidSpeakerId,
  parsePublicSpeakersPayload,
} from './devcon26-speakers';

const JSON_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const PHOTO_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';

function edgeCache(): Cache | null {
  try {
    return typeof caches !== 'undefined' && 'default' in caches
      ? (caches as unknown as { default: Cache }).default
      : null;
  } catch {
    return null;
  }
}

export async function serveDevcon26Speakers(request: Request, context?: ExecutionContext): Promise<Response> {
  const cache = edgeCache();
  const cacheKey = new Request(new URL('/devcon26/api/speakers', request.url).toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    const upstream = await fetch(new URL(EMS_PUBLIC_SPEAKERS_PATH, DEFAULT_EMS_API_ORIGIN), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    const parsed = parsePublicSpeakersPayload(await upstream.json(), true);

    if (!parsed) {
      return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': JSON_CACHE_CONTROL,
    });
    const etag = upstream.headers.get('etag');

    if (etag) headers.set('ETag', etag);

    const response = new Response(JSON.stringify(parsed), { status: 200, headers });

    if (cache) {
      const write = cache.put(cacheKey, response.clone());
      if (context) context.waitUntil(write);
      else await write;
    }

    return response;
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function serveDevcon26SpeakerPhoto(
  request: Request,
  sessionId: string,
  context?: ExecutionContext,
): Promise<Response> {
  if (!isValidSpeakerId(sessionId)) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const cache = edgeCache();
  const url = new URL(request.url);
  const version = url.searchParams.get('v')?.trim() ?? '';
  const cacheUrl = new URL(`/devcon26/api/speakers/${encodeURIComponent(sessionId)}/photo`, url.origin);

  if (version) cacheUrl.searchParams.set('v', version);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    const upstreamUrl = new URL(
      `${EMS_PUBLIC_SPEAKERS_PATH}/${encodeURIComponent(sessionId)}/photo`,
      DEFAULT_EMS_API_ORIGIN,
    );

    if (version) upstreamUrl.searchParams.set('v', version);
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });

    if (upstream.status === 404) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!upstream.ok) {
      return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    const contentType = upstream.headers.get('content-type') ?? '';

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType.split(';')[0]!.trim().toLowerCase())) {
      return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    const response = new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': PHOTO_CACHE_CONTROL,
        'X-Content-Type-Options': 'nosniff',
      },
    });

    if (cache) {
      const write = cache.put(cacheKey, response.clone());
      if (context) context.waitUntil(write);
      else await write;
    }

    return response;
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
