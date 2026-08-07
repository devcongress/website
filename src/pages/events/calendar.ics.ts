import type { APIRoute } from "astro";
import { createEventsCalendar } from "../../lib/event-calendar";
import { getEvents } from "../../lib/events";

export const prerender = true;

export const GET: APIRoute = async () => {
  const calendar = createEventsCalendar(await getEvents());

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="devcongress-events.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
};
