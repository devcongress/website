import { z } from 'zod';
import type { WebsiteEvent } from './events';
import { normalizePublicHttpUrl, normalizePublicWebsiteUrl } from './public-url';

const EVENTS_MANAGEMENT_ORIGIN = new URL('https://em.devcongress.org');
const MAX_EVENTS_RESPONSE_BYTES = 2 * 1024 * 1024;
const PUBLIC_EVENT_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,239}$/;

const publicHttpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => normalizePublicHttpUrl(value) !== null, 'Expected a public HTTP(S) URL');

const publicWebsiteUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) => normalizePublicWebsiteUrl(value, EVENTS_MANAGEMENT_ORIGIN) !== null,
    'Expected a public website URL',
  );

export const eventFormatSchema = z.enum([
  'meetup',
  'conference',
  'workshop',
  'hackathon',
  'webinar',
  'other',
]);

const publicEventSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    slug: z.string().trim().min(1).max(240).regex(PUBLIC_EVENT_SLUG),
    title: z.string().trim().min(2).max(500),
    summary: z.string().trim().min(10).max(20_000),
    ownership: z.enum(['devcongress', 'external']),
    series: z.enum(['monthly', 'quarterly', 'special']).nullable(),
    format: eventFormatSchema,
    source: z.enum(['internal', 'public_submission']),
    moderation_status: z.literal('approved').nullable(),
    publication_status: z.literal('published'),
    classification: z.enum(['official', 'community']),
    starts_at: z.string().refine(isValidDateTime, 'Expected a valid start datetime'),
    ends_at: z.string().refine(isValidDateTime, 'Expected a valid end datetime'),
    timezone: z.string().trim().min(1).max(100),
    location_type: z.enum(['in_person', 'online', 'hybrid']),
    venue_name: z.string().trim().min(1).max(500).nullable(),
    venue_address: z.string().trim().min(1).max(1_000).nullable(),
    online_url: publicHttpUrlSchema.nullable(),
    stream_url: publicHttpUrlSchema.nullable().optional(),
    embed_stream: z.boolean().optional().default(false),
    registration_url: publicWebsiteUrlSchema.nullable(),
    organizer_name: z.string().trim().min(1).max(300),
    organizer_website: publicHttpUrlSchema.nullable(),
    cover_url: publicWebsiteUrlSchema.nullable(),
    updated_at: z.string().refine(isValidDateTime, 'Expected a valid updated datetime'),
  })
  .superRefine((event, context) => {
    if (new Date(event.ends_at).getTime() <= new Date(event.starts_at).getTime()) {
      context.addIssue({
        code: 'custom',
        message: 'Event end must be after its start',
        path: ['ends_at'],
      });
    }
    if ((event.source === 'public_submission' || event.ownership === 'external') && event.moderation_status !== 'approved') {
      context.addIssue({
        code: 'custom',
        message: 'Public submissions and external events must be approved',
        path: ['moderation_status'],
      });
    }
    if (
      (event.ownership === 'external' && event.classification !== 'community')
      || (event.ownership === 'devcongress' && event.classification !== 'official')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Event classification must match ownership',
        path: ['classification'],
      });
    }
  });

const responseMetaSchema = z.object({
  source: z.literal('events-management'),
  version: z.literal(1),
});

const publicEventsResponseSchema = z
  .object({
    data: z.array(publicEventSchema).max(500),
    meta: responseMetaSchema,
  })
  .superRefine(({ data }, context) => {
    const slugs = new Set<string>();
    data.forEach((event, index) => {
      if (slugs.has(event.slug)) {
        context.addIssue({
          code: 'custom',
          message: 'Event slugs must be unique',
          path: ['data', index, 'slug'],
        });
      }
      slugs.add(event.slug);
    });
  });

const publicEventResponseSchema = z.object({
  data: publicEventSchema,
  meta: responseMetaSchema,
});

type PublicEvent = z.infer<typeof publicEventSchema>;
export type EventFormat = z.infer<typeof eventFormatSchema>;

export function isPublicEventSlug(value: string): boolean {
  return PUBLIC_EVENT_SLUG.test(value);
}

export function parsePublicEventsPayload(payload: unknown): WebsiteEvent[] {
  const parsed = publicEventsResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error('Events API response did not match contract version 1');
  return parsed.data.data.map(mapPublicEvent);
}

export function parsePublicEventPayload(payload: unknown, requestedSlug: string): WebsiteEvent {
  const parsed = publicEventResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data.slug !== requestedSlug) {
    throw new Error('Event API response did not match the requested contract');
  }
  return mapPublicEvent(parsed.data.data);
}

export async function readPublicEventJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|\s*$)/i.test(contentType)) {
    throw new Error('Events API did not return JSON');
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EVENTS_RESPONSE_BYTES) {
    throw new Error('Events API response exceeded the size limit');
  }
  if (!response.body) throw new Error('Events API returned an empty response');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_EVENTS_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Events API response exceeded the size limit');
      }
      rawBody += decoder.decode(value, { stream: true });
    }
    rawBody += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Events API returned invalid JSON');
  }
}

function mapPublicEvent(event: PublicEvent): WebsiteEvent {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    ownership: event.ownership,
    format: event.format,
    classification: event.classification,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    locationType: event.location_type,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    onlineUrl: normalizePublicHttpUrl(event.online_url),
    streamUrl: normalizePublicHttpUrl(event.stream_url),
    embedStream: event.embed_stream,
    registrationUrl: normalizePublicWebsiteUrl(event.registration_url, EVENTS_MANAGEMENT_ORIGIN),
    organizerName: event.organizer_name,
    organizerWebsite: normalizePublicHttpUrl(event.organizer_website),
    coverUrl: normalizePublicWebsiteUrl(event.cover_url, EVENTS_MANAGEMENT_ORIGIN),
    detailsUrl: `/events/${event.slug}/`,
    updatedAt: event.updated_at,
  };
}

function isValidDateTime(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}
