import { z } from "zod";
import { getMeetups } from "./meetups";

export const EVENTS_MANAGEMENT_ORIGIN = new URL("https://em.devcongress.org");
export const EVENT_SUBMISSIONS_API_URL = new URL(
  "/api/public/event-submissions",
  EVENTS_MANAGEMENT_ORIGIN,
).toString();
export const EVENT_SUBMISSIONS_WITH_COVER_API_URL = new URL(
  "/api/public/event-submissions/with-cover",
  EVENTS_MANAGEMENT_ORIGIN,
).toString();
export const EVENT_SUBMISSION_TURNSTILE_ACTION = "event_submission";
export const EVENT_SUBMISSION_TURNSTILE_SITE_KEY = "0x4AAAAAADov8n7eB5-btoDw";

const EVENTS_API_PATH = "/api/public/events";
const EVENTS_API_TIMEOUT_MS = 8_000;
const MAX_EVENTS_RESPONSE_BYTES = 2 * 1024 * 1024;

const publicHttpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password &&
        Boolean(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Expected a public HTTP(S) URL");

const publicWebsiteUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      publicHttpUrlSchema.safeParse(value).success,
    "Expected a relative website path or public HTTP(S) URL",
  );

const eventFormatSchema = z.enum([
  "meetup",
  "conference",
  "workshop",
  "hackathon",
  "webinar",
  "other",
]);

const publicEventSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
    title: z.string().trim().min(2).max(500),
    summary: z.string().trim().min(10).max(20_000),
    ownership: z.enum(["devcongress", "external"]),
    series: z.enum(["monthly", "quarterly", "special"]).nullable(),
    format: eventFormatSchema,
    source: z.enum(["internal", "public_submission"]),
    moderation_status: z.literal("approved").nullable(),
    publication_status: z.literal("published"),
    classification: z.enum(["official", "community"]),
    starts_at: z
      .string()
      .refine(isValidDateTime, "Expected a valid start datetime"),
    ends_at: z
      .string()
      .refine(isValidDateTime, "Expected a valid end datetime"),
    timezone: z.string().trim().min(1).max(100),
    location_type: z.enum(["in_person", "online", "hybrid"]),
    venue_name: z.string().trim().min(1).max(500).nullable(),
    venue_address: z.string().trim().min(1).max(1_000).nullable(),
    online_url: publicHttpUrlSchema.nullable(),
    registration_url: publicWebsiteUrlSchema.nullable(),
    organizer_name: z.string().trim().min(1).max(300),
    organizer_website: publicHttpUrlSchema.nullable(),
    cover_url: publicWebsiteUrlSchema.nullable(),
    updated_at: z
      .string()
      .refine(isValidDateTime, "Expected a valid updated datetime"),
  })
  .refine(
    ({ starts_at, ends_at }) =>
      new Date(ends_at).getTime() > new Date(starts_at).getTime(),
    { message: "Event end must be after its start", path: ["ends_at"] },
  );

const publicEventsResponseSchema = z
  .object({
    data: z.array(publicEventSchema).max(500),
    meta: z.object({
      source: z.literal("events-management"),
      version: z.literal(1),
    }),
  })
  .superRefine(({ data }, context) => {
    const slugs = new Set<string>();
    data.forEach((event, index) => {
      if (slugs.has(event.slug)) {
        context.addIssue({
          code: "custom",
          message: "Event slugs must be unique",
          path: ["data", index, "slug"],
        });
      }
      slugs.add(event.slug);
    });
  });

type PublicEvent = z.infer<typeof publicEventSchema>;
export type EventFormat = z.infer<typeof eventFormatSchema>;
export type EventLocationType = "in_person" | "online" | "hybrid";
export type EventClassification = "official" | "community";

export interface WebsiteEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  ownership: "devcongress" | "external";
  format: EventFormat;
  classification: EventClassification;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationType: EventLocationType;
  venueName: string | null;
  venueAddress: string | null;
  onlineUrl: string | null;
  registrationUrl: string | null;
  organizerName: string;
  organizerWebsite: string | null;
  coverUrl: string | null;
  detailsUrl: string | null;
  updatedAt: string;
}

let eventsPromise: Promise<WebsiteEvent[]> | undefined;

export async function getEvents(): Promise<WebsiteEvent[]> {
  eventsPromise ??= loadEvents();
  return eventsPromise;
}

export function sortEventsBySoonest(events: WebsiteEvent[]): WebsiteEvent[] {
  const now = Date.now();
  return [...events].sort((a, b) => {
    const aTime = new Date(a.startsAt).getTime();
    const bTime = new Date(b.startsAt).getTime();
    const aUpcoming = new Date(a.endsAt).getTime() >= now;
    const bUpcoming = new Date(b.endsAt).getTime() >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? aTime - bTime : bTime - aTime;
  });
}

async function loadEvents(): Promise<WebsiteEvent[]> {
  try {
    return await fetchRemoteEvents();
  } catch (error) {
    console.warn(
      `[events] Public events feed unavailable; building an official-events fallback from meetups. ${getErrorMessage(error)}`,
    );
    return fetchMeetupFallback();
  }
}

async function fetchRemoteEvents(): Promise<WebsiteEvent[]> {
  const response = await fetch(
    new URL(EVENTS_API_PATH, EVENTS_MANAGEMENT_ORIGIN),
    {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(EVENTS_API_TIMEOUT_MS),
    },
  );

  if (!response.ok) throw new Error(`Events API returned ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Events API did not return JSON");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_EVENTS_RESPONSE_BYTES
  ) {
    throw new Error("Events API response exceeded the size limit");
  }

  const rawBody = await readResponseBody(response);
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    throw new Error("Events API returned invalid JSON");
  }

  const parsed = publicEventsResponseSchema.safeParse(decoded);
  if (!parsed.success)
    throw new Error("Events API response did not match contract version 1");

  console.info(
    `[events] Loaded ${parsed.data.data.length} published events from ${EVENTS_MANAGEMENT_ORIGIN.origin}.`,
  );
  return parsed.data.data.map(mapPublicEvent);
}

async function fetchMeetupFallback(): Promise<WebsiteEvent[]> {
  const meetups = await getMeetups();
  return meetups.map((meetup) => ({
    id: meetup.id,
    slug: meetup.id,
    title: meetup.data.name,
    summary: meetup.data.description,
    ownership: "devcongress",
    format: "meetup",
    classification: "official",
    startsAt: meetup.data.start,
    endsAt: meetup.data.end,
    timezone: "Africa/Accra",
    locationType: meetup.data.stream_url
      ? meetup.data.location.name
        ? "hybrid"
        : "online"
      : "in_person",
    venueName: meetup.data.location.name,
    venueAddress: meetup.data.location.label ?? null,
    onlineUrl: meetup.data.stream_url ?? null,
    registrationUrl: meetup.data.registration_url ?? null,
    organizerName: "DevCongress",
    organizerWebsite: "https://devcongress.org",
    coverUrl: meetup.data.cover,
    detailsUrl: `/meetups/${meetup.id}/`,
    updatedAt: meetup.data.start,
  }));
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
    onlineUrl: event.online_url,
    registrationUrl: resolveOptionalWebsiteUrl(event.registration_url),
    organizerName: event.organizer_name,
    organizerWebsite: event.organizer_website,
    coverUrl: resolveOptionalWebsiteUrl(event.cover_url),
    detailsUrl: `/events/${event.slug}/`,
    updatedAt: event.updated_at,
  };
}

function resolveOptionalWebsiteUrl(value: string | null): string | null {
  return value
    ? value.startsWith("/")
      ? new URL(value, EVENTS_MANAGEMENT_ORIGIN).toString()
      : value
    : null;
}

async function readResponseBody(response: Response): Promise<string> {
  if (!response.body) throw new Error("Events API returned an empty response");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_EVENTS_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Events API response exceeded the size limit");
      }
      rawBody += decoder.decode(value, { stream: true });
    }
    return rawBody + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function isValidDateTime(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `The request exceeded ${EVENTS_API_TIMEOUT_MS / 1_000} seconds.`;
  }
  return error instanceof Error ? error.message : "Unknown feed error";
}
