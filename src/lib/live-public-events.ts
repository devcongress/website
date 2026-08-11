import type { WebsiteEvent } from './events';

export const PUBLIC_EVENTS_API_URL = 'https://em.devcongress.org/api/public/events';

const PUBLIC_EVENT_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,239}$/;
const PUBLIC_EVENT_FORMATS = new Set(['meetup', 'conference', 'workshop', 'hackathon', 'webinar', 'other']);
const PUBLIC_EVENT_LOCATIONS = new Set(['in_person', 'online', 'hybrid']);
const PUBLIC_EVENT_OWNERS = new Set(['devcongress', 'external']);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function fetchLivePublicEvents(): Promise<WebsiteEvent[]> {
  const response = await fetch(PUBLIC_EVENTS_API_URL, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error(`Public events API returned ${response.status}`);
  const payload = await parseJsonResponse(response);
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('Public events API returned an invalid response');
  }

  return payload.data
    .map(normalizePublicEvent)
    .filter((event): event is WebsiteEvent => event !== null);
}

export async function fetchLivePublicEvent(slug: string): Promise<WebsiteEvent | null> {
  if (!PUBLIC_EVENT_SLUG.test(slug)) return null;

  const response = await fetch(`${PUBLIC_EVENTS_API_URL}/${encodeURIComponent(slug)}`, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public event API returned ${response.status}`);

  const payload = await parseJsonResponse(response);
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error('Public event API returned an invalid response');
  }

  return normalizePublicEvent(payload.data);
}

function normalizePublicEvent(value: unknown): WebsiteEvent | null {
  if (!isRecord(value)) return null;

  const id = stringValue(value.id, 300);
  const slug = stringValue(value.slug, 240);
  const title = stringValue(value.title, 500);
  const summary = stringValue(value.summary, 20_000);
  const startsAt = stringValue(value.starts_at, 100);
  const endsAt = stringValue(value.ends_at, 100);
  const timezone = stringValue(value.timezone, 100);
  const organizerName = stringValue(value.organizer_name, 300);
  const updatedAt = stringValue(value.updated_at, 100);
  const ownership = stringValue(value.ownership, 30);
  const format = stringValue(value.format, 30);
  const locationType = stringValue(value.location_type, 30);

  if (
    !id || !slug || !PUBLIC_EVENT_SLUG.test(slug) || !title || !summary
    || !startsAt || !endsAt || !timezone || !organizerName || !updatedAt
    || !PUBLIC_EVENT_OWNERS.has(ownership) || !PUBLIC_EVENT_FORMATS.has(format)
    || !PUBLIC_EVENT_LOCATIONS.has(locationType)
    || !isValidDateTime(startsAt) || !isValidDateTime(endsAt)
    || new Date(endsAt).getTime() <= new Date(startsAt).getTime()
  ) {
    return null;
  }

  const venueName = nullableString(value.venue_name, 500);
  const venueAddress = nullableString(value.venue_address, 1_000);
  const onlineUrl = safePublicUrl(value.online_url);
  const streamUrl = safePublicUrl(value.stream_url);
  const embedStream = value.embed_stream === true;
  const registrationUrl = safePublicUrl(value.registration_url);
  const organizerWebsite = safePublicUrl(value.organizer_website);
  const coverUrl = safePublicUrl(value.cover_url);

  return {
    id,
    slug,
    title,
    summary,
    ownership: ownership as WebsiteEvent['ownership'],
    format: format as WebsiteEvent['format'],
    classification: value.classification === 'community' ? 'community' : 'official',
    startsAt,
    endsAt,
    timezone,
    locationType: locationType as WebsiteEvent['locationType'],
    venueName,
    venueAddress,
    onlineUrl,
    streamUrl,
    embedStream,
    registrationUrl,
    organizerName,
    organizerWebsite,
    coverUrl,
    detailsUrl: `/events/${slug}/`,
    updatedAt,
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Public events API response exceeded the size limit');
  }

  if (!response.body) throw new Error('Public events API returned an empty response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Public events API response exceeded the size limit');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Public events API returned invalid JSON');
  }
}

function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === 'string' && value.trim().length <= maxLength ? value.trim() : '';
}

function nullableString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  const normalized = stringValue(value, maxLength);
  return normalized || null;
}

function isValidDateTime(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
