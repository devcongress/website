import { ATTENDANCE_PATH, DEFAULT_API_ORIGIN, publishedAttendance } from './devcon26-attendance-counter';

export async function serveAttendanceCounter(): Promise<Response> {
  try {
    const upstream = await fetch(new URL(ATTENDANCE_PATH, DEFAULT_API_ORIGIN), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });

    if (!upstream.ok) throw new Error('Attendance unavailable');

    const attendance = publishedAttendance(await upstream.json());

    return Response.json(attendance ?? { count: null, source: null }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
