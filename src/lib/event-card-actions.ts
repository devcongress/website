import type { WebsiteEvent } from './events';

export type EventStatus = 'upcoming' | 'live' | 'past';

export interface EventCardAction {
  href: string;
  label: string;
}

export function getEventPrimaryAction(
  event: WebsiteEvent,
  status: EventStatus,
): EventCardAction | null {
  if (event.primaryAction) {
    return {
      href: event.primaryAction.url,
      label: event.primaryAction.label,
    };
  }

  if (status === 'past') {
    return event.streamUrl && !event.embedStream
      ? { href: event.streamUrl, label: 'Watch recording' }
      : null;
  }

  if (status === 'live') {
    if (event.streamUrl) return { href: event.streamUrl, label: 'Watch live' };
    if (event.onlineUrl) return { href: event.onlineUrl, label: 'Join online' };
    return null;
  }

  return event.registrationUrl
    ? { href: event.registrationUrl, label: 'Register' }
    : null;
}

export function getEventCardAction(
  event: WebsiteEvent,
  status: EventStatus,
): EventCardAction | null {
  const action = getEventPrimaryAction(event, status);
  return action ? { ...action, label: `${action.label} →` } : null;
}
