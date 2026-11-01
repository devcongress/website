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

    const localWebsite = ['localhost', '127.0.0.1', '[::1]'].includes(website.hostname);

    if (origin.origin === DEFAULT_API_ORIGIN && (ownedPreview || localWebsite)) return ATTENDANCE_RELAY_PATH;

    return new URL(ATTENDANCE_PATH, origin).href;
  } catch {
    return null;
  }
}

function initializeAnimatedCounter(root: HTMLElement, attendance: Attendance): void {
  const count = root.querySelector<HTMLElement>('[data-attendance-count]');
  const sizer = root.querySelector<HTMLElement>('[data-attendance-sizer]');
  const wording = root.querySelector<HTMLElement>('[data-attendance-wording]');
  const label = root.querySelector<HTMLElement>('[data-attendance-label]');

  if (!count || !sizer || !wording || !label) return;

  const formatted = attendance.count.toLocaleString('en-GH');
  const suffix = attendance.count === 1 ? 'person is coming' : 'people are coming';

  sizer.textContent = formatted;
  root.style.setProperty('--attendance-number-limit', `calc((100vw - 100px) / ${formatted.length * 0.7})`);
  wording.textContent = suffix;
  label.textContent = `${formatted} ${suffix}`;
  root.hidden = false;

  if (!('IntersectionObserver' in window) || !window.matchMedia || attendance.count === 0) {
    count.textContent = formatted;
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animations: Animation[] = [];
  let settled = false;

  const settle = () => {
    if (settled) return;

    settled = true;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    count.textContent = formatted;
  };

  if (reducedMotion.matches || typeof Element.prototype.animate !== 'function') {
    settle();
    return;
  }

  count.textContent = '0';
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) settle();
  });

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;

    observer.disconnect();
    if (settled) return;

    count.textContent = '';
    const strips: { element: HTMLElement; steps: number }[] = [];

    const lastDigitIndex = formatted.length - 1;

    for (const [index, character] of [...formatted].entries()) {
      if (!/\d/.test(character)) {
        const separator = document.createElement('span');
        separator.className = 'attendance-digit-leading';
        separator.textContent = character;
        count.append(separator);
        continue;
      }

      const steps = (index === lastDigitIndex ? 10 : 0) + Number(character);
      const windowElement = document.createElement('span');
      const strip = document.createElement('span');
      windowElement.className = 'attendance-digit-window';
      if (index !== lastDigitIndex) windowElement.classList.add('attendance-digit-leading');
      strip.className = 'attendance-digit-strip';

      for (let digit = steps; digit >= 0; digit--) {
        const row = document.createElement('span');
        row.textContent = String(digit % 10);
        strip.append(row);
      }

      windowElement.append(strip);
      count.append(windowElement);
      if (steps > 0) strips.push({ element: strip, steps });
    }

    const duration = 1100;
    animations = strips.map(({ element, steps }) => element.animate(
      [{ transform: `translateY(-${steps}em)` }, { transform: 'translateY(0)' }],
      { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
    ));

    if (root.dataset.attendanceVariant === 'hanging') {
      const swing = [0, 3, -2, 1, -0.35, 0].map((angle) => ({
        transform: `rotate(${angle}deg)`,
        easing: 'ease-in-out',
      }));
      animations.push(root.animate(swing, { duration }));
    }

    void Promise.all(animations.map((animation) => animation.finished)).then(settle, settle);
  });

  observer.observe(root);
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
      if (root.dataset?.attendanceVariant === 'sticker' || root.dataset?.attendanceVariant === 'hanging') {
        initializeAnimatedCounter(root, attendance);
        continue;
      }

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
