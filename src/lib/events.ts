import { getMeetups } from "./meetups";
import {
  parsePublicEventsPayload,
  readPublicEventJson,
  type EventFormat,
} from "./public-event-contract";

export type { EventFormat } from "./public-event-contract";
export { sortEventsBySoonest } from "./event-order";

export const EVENTS_MANAGEMENT_ORIGIN = new URL("https://em.devcongress.org");
export const EVENT_SUBMISSIONS_API_URL = new URL(
  "/api/public/event-submissions",
  EVENTS_MANAGEMENT_ORIGIN,
).toString();
export const EVENT_SUBMISSIONS_WITH_COVER_API_URL = new URL(
  "/api/public/event-submissions/with-cover",
  EVENTS_MANAGEMENT_ORIGIN,
).toString();
export const EVENT_SUBMISSION_EMAIL_PREFLIGHT_API_URL = new URL(
  "/api/public/email-preflight",
  EVENTS_MANAGEMENT_ORIGIN,
).toString();
export const EVENT_SUBMISSION_TURNSTILE_ACTION = "event_submission";
export const EVENT_SUBMISSION_TURNSTILE_SITE_KEY = "0x4AAAAAADov8n7eB5-btoDw";

const EVENTS_API_PATH = "/api/public/events";
const EVENTS_API_TIMEOUT_MS = 8_000;
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
  streamUrl: string | null;
  embedStream: boolean;
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
  const events = parsePublicEventsPayload(await readPublicEventJson(response));

  console.info(
    `[events] Loaded ${events.length} published events from ${EVENTS_MANAGEMENT_ORIGIN.origin}.`,
  );
  return events;
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
    streamUrl: meetup.data.stream_url ?? null,
    embedStream: meetup.data.embed_stream,
    registrationUrl: meetup.data.registration_url ?? null,
    organizerName: "DevCongress",
    organizerWebsite: "https://devcongress.org",
    coverUrl: meetup.data.cover,
    detailsUrl: `/meetups/${meetup.id}/`,
    updatedAt: meetup.data.start,
  }));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `The request exceeded ${EVENTS_API_TIMEOUT_MS / 1_000} seconds.`;
  }
  return error instanceof Error ? error.message : "Unknown feed error";
}
