export const ATTENDANCE_PATH = '/api/public/annual-conference/2026/attendance-counter';
export const ATTENDANCE_RELAY_PATH = '/api/devcon26/attendance-counter';
export const DEFAULT_API_ORIGIN = 'https://em.devcongress.org';

type Attendance = { count: number; source: 'estimate' | 'actual' };

export function publishedAttendance(value: unknown): Attendance | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;

  if (!Number.isSafeInteger(candidate.count) || (candidate.count as number) < 0) return null;
  if (candidate.source !== 'estimate' && candidate.source !== 'actual') return null;

  return { count: candidate.count as number, source: candidate.source };
}

export function attendanceEndpoint(configuredOrigin: string, websiteOrigin: string): string | null {
  try {
    const origin = new URL(configuredOrigin.trim());
    const local = origin.hostname === 'localhost' || origin.hostname === '127.0.0.1';

    if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;

    const website = new URL(websiteOrigin);

    const ownedPreview = /^https:\/\/[a-z0-9-]+-devcongress-website\.admins-a7d\.workers\.dev$/.test(website.origin);

    if (origin.origin === DEFAULT_API_ORIGIN && ownedPreview) return ATTENDANCE_RELAY_PATH;

    return new URL(ATTENDANCE_PATH, origin).href;
  } catch {
    return null;
  }
}

export async function initializeAttendanceCounter(roots: NodeListOf<HTMLElement>, configuredOrigin: string): Promise<void> {
  if (!roots.length) return;

  const endpoint = attendanceEndpoint(configuredOrigin, window.location.origin);

  if (!endpoint) return;

  try {
    const response = await fetch(endpoint, {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) return;

    const attendance = publishedAttendance(await response.json());

    if (!attendance) return;

    for (const root of roots) {
      const count = root.querySelector<HTMLElement>('[data-attendance-count]');
      const estimate = root.querySelector<HTMLElement>('[data-attendance-estimate]');

      if (!count || !estimate) continue;

      count.textContent = `${attendance.count.toLocaleString('en-GH')} ${attendance.count === 1 ? 'person is' : 'people are'} attending`;
      estimate.hidden = attendance.source !== 'estimate';
      root.hidden = false;
    }
  } catch {
    // The public counter is optional; keep it hidden when unavailable.
  }
}
