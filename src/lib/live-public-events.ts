import type { WebsiteEvent } from './events';
import { sortEventsBySoonest } from './event-order';
import {
  isPublicEventSlug,
  parsePublicEventPayload,
  parsePublicEventsPayload,
  readPublicEventJson,
} from './public-event-contract';

export const PUBLIC_EVENTS_API_URL = 'https://em.devcongress.org/api/public/events';

export async function fetchLivePublicEvents(): Promise<WebsiteEvent[]> {
  const response = await fetch(PUBLIC_EVENTS_API_URL, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error(`Public events API returned ${response.status}`);
  return sortEventsBySoonest(parsePublicEventsPayload(await readPublicEventJson(response)));
}

export async function fetchLivePublicEvent(slug: string): Promise<WebsiteEvent | null> {
  if (!isPublicEventSlug(slug)) return null;

  const response = await fetch(`${PUBLIC_EVENTS_API_URL}/${encodeURIComponent(slug)}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public event API returned ${response.status}`);
  return parsePublicEventPayload(await readPublicEventJson(response), slug);
}
