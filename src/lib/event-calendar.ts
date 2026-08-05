import type { WebsiteEvent } from "./events";

const CALENDAR_NAME = "DevCongress Events";
const CALENDAR_DESCRIPTION =
  "Published DevCongress meetups, workshops, hackathons, webinars, and conferences.";
const CALENDAR_ORIGIN = "https://devcongress.org";

export function upcomingCalendarEvents(
  events: WebsiteEvent[],
  now = new Date(),
): WebsiteEvent[] {
  const nowTime = now.getTime();
  return [...events]
    .filter((event) => new Date(event.endsAt).getTime() >= nowTime)
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
}

export function createEventsCalendar(
  events: WebsiteEvent[],
  now = new Date(),
): string {
  const calendarLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DevCongress//Events Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(CALENDAR_NAME)}`,
    `X-WR-CALDESC:${escapeIcsText(CALENDAR_DESCRIPTION)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
  ];

  for (const event of upcomingCalendarEvents(events, now)) {
    const eventUrl = resolveEventUrl(event);
    const description = [event.summary, eventUrl ? `More details: ${eventUrl}` : null]
      .filter(Boolean)
      .join("\n\n");

    calendarLines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${event.id}@events.devcongress.org`)}`,
      `DTSTAMP:${formatIcsDate(event.updatedAt)}`,
      `DTSTART:${formatIcsDate(event.startsAt)}`,
      `DTEND:${formatIcsDate(event.endsAt)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(eventLocation(event))}`,
      ...(eventUrl ? [`URL:${eventUrl}`] : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  calendarLines.push("END:VCALENDAR");
  return calendarLines.map(foldIcsLine).join("\r\n") + "\r\n";
}

function resolveEventUrl(event: WebsiteEvent): string | null {
  if (event.detailsUrl) return new URL(event.detailsUrl, CALENDAR_ORIGIN).toString();
  return event.registrationUrl ?? event.onlineUrl;
}

function eventLocation(event: WebsiteEvent): string {
  if (event.locationType === "online") return "Online";
  const physicalLocation = [event.venueName, event.venueAddress]
    .filter(Boolean)
    .join(", ");
  if (event.locationType === "hybrid") {
    return physicalLocation ? `${physicalLocation} + online` : "Hybrid";
  }
  return physicalLocation || "In person";
}

function formatIcsDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid calendar date");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = "";
  let byteLength = 0;

  for (const character of line) {
    const characterBytes = encoder.encode(character).byteLength;
    const limit = chunks.length === 0 ? 75 : 74;
    if (byteLength + characterBytes > limit && chunk) {
      chunks.push(chunk);
      chunk = character;
      byteLength = characterBytes;
    } else {
      chunk += character;
      byteLength += characterBytes;
    }
  }
  if (chunk || chunks.length === 0) chunks.push(chunk);

  return chunks.join("\r\n ");
}
