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
    if (event.streamUrl && !isMeetingUrl(event.streamUrl) && (event.streamUrl !== event.onlineUrl || event.embedStream || isStreamingUrl(event.streamUrl))) {
      return { href: event.streamUrl, label: 'Watch live' };
    }
    if (event.onlineUrl) return { href: event.onlineUrl, label: 'Join live' };
    if (event.streamUrl) return { href: event.streamUrl, label: 'Join live' };
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

function isStreamingUrl(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  return ['youtube.com', 'youtu.be', 'twitch.tv', 'vimeo.com'].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function isMeetingUrl(url: string): boolean {
  return new URL(url).hostname.toLowerCase() === 'meet.google.com';
}
