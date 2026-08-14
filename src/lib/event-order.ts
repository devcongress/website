export interface SchedulableEvent {
  startsAt: string;
  endsAt: string;
}

export function sortEventsBySoonest<T extends SchedulableEvent>(
  events: T[],
  now = Date.now(),
): T[] {
  return [...events].sort((left, right) => {
    const leftStart = new Date(left.startsAt).getTime();
    const rightStart = new Date(right.startsAt).getTime();
    const leftUpcoming = new Date(left.endsAt).getTime() >= now;
    const rightUpcoming = new Date(right.endsAt).getTime() >= now;

    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming ? leftStart - rightStart : rightStart - leftStart;
  });
}
