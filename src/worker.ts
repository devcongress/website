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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === CALENDAR_PATH) {
      return serveLiveCalendar(request);
    }

    const eventMatch = url.pathname.match(EVENT_ROUTE);
    if (eventMatch && eventMatch[1] !== 'index' && eventMatch[1] !== 'submit') {
      if (url.searchParams.get(EVENT_READINESS_PARAM) === '1') {
        return serveLiveEventReadiness(eventMatch[1]);
      }
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
    return new Response('Public event temporarily unavailable', { status: 503 });
  }
}

async function serveLiveEventReadiness(slug: string): Promise<Response> {
  try {
    const event = await fetchLivePublicEvent(slug);
    if (!event) return new Response('Event not found', { status: 404 });

    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_event_readiness_lookup_failed',
      slug,
      error_name: error instanceof Error ? error.name : 'Error',
    }));
    return new Response('Public event temporarily unavailable', { status: 503 });
  }
}

async function serveLiveCalendar(request: Request): Promise<Response> {
  try {
    const events = await fetchLivePublicEvents();
    const body = createEventsCalendar(events);
    return new Response(body, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="devcongress-events.ics"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_event_calendar_lookup_failed',
      error_name: error instanceof Error ? error.name : 'Error',
    }));
    return new Response('Public event calendar temporarily unavailable', { status: 503 });
  }
}
