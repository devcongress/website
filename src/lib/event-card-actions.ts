import type { WebsiteEvent } from './events';

export type EventStatus = 'upcoming' | 'live' | 'past';

export interface EventCardAction {
  href: string;
  label: string;
}

export function getEventCardAction(
  event: WebsiteEvent,
  status: EventStatus,
): EventCardAction | null {
  if (status === 'past') {
    return event.streamUrl && !event.embedStream
      ? { href: event.streamUrl, label: 'Watch recording →' }
      : null;
  }

  if (status === 'live') {
    if (event.streamUrl) return { href: event.streamUrl, label: 'Watch live →' };
    if (event.onlineUrl) return { href: event.onlineUrl, label: 'Join online →' };
    return null;
  }

  return event.registrationUrl
    ? { href: event.registrationUrl, label: 'Register →' }
    : null;
}
