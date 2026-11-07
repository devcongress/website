import type { APIRoute } from "astro";
import { createSingleEventCalendar } from "../../../lib/event-calendar";
import { getEvents, type WebsiteEvent } from "../../../lib/events";

export const prerender = true;

export async function getStaticPaths() {
  const events = await getEvents();

  return events.filter((event) => event.onlineUrl).map((event) => ({
    params: { slug: event.slug },
    props: { event },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const event = props.event as WebsiteEvent;

  return new Response(createSingleEventCalendar(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
