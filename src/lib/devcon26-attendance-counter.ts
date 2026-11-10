export const ATTENDANCE_PATH = '/api/public/annual-conference/2026/attendance-counter';
export const ATTENDANCE_RELAY_PATH = '/api/devcon26/attendance-counter';
export const DEFAULT_API_ORIGIN = 'https://em.devcongress.org';

type Attendance = { count: number; source: 'estimate' | 'actual' | 'ticket_count' };

export function publishedAttendance(value: unknown): Attendance | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;

  if (!Number.isSafeInteger(candidate.count) || (candidate.count as number) < 0) return null;
  if (candidate.source !== 'estimate' && candidate.source !== 'actual' && candidate.source !== 'ticket_count') return null;

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

function attendanceSuffix(count: number): string {
  return count === 1 ? 'person is coming. Are you?' : 'people are coming. Are you?';
}

function initializeAnimatedCounter(root: HTMLElement, attendance: Attendance): () => void {
  const count = root.querySelector<HTMLElement>('[data-attendance-count]');
  const sizer = root.querySelector<HTMLElement>('[data-attendance-sizer]');
  const wording = root.querySelector<HTMLElement>('[data-attendance-wording]');
  const label = root.querySelector<HTMLElement>('[data-attendance-label]');

  if (!count || !sizer || !wording || !label) return () => {};

  const formatted = attendance.count.toLocaleString('en-GH');
  const suffix = attendanceSuffix(attendance.count);

  sizer.textContent = formatted;
  root.style.setProperty('--attendance-number-limit', `calc((100vw - 100px) / ${formatted.length * 0.7})`);
  wording.textContent = suffix.replace(' Are you?', '\nAre you?');
  label.textContent = `${formatted} ${suffix}`;
  root.hidden = false;

  if (!('IntersectionObserver' in window) || !window.matchMedia || attendance.count === 0) {
    count.textContent = formatted;
    return () => {};
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
    return () => {};
  }

  count.textContent = '0';
  const onMotionChange = (event: MediaQueryListEvent) => {
    if (event.matches) settle();
  };
  reducedMotion.addEventListener('change', onMotionChange);

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

  return () => {
    observer.disconnect();
    reducedMotion.removeEventListener('change', onMotionChange);
    settle();
  };
}

export const TICKET_COUNTER_SIGNAL = 'devcon26-ticket-counter-refresh';

export function signalVerifiedTicketPurchase(): void {
  try {
    window.dispatchEvent(new Event(TICKET_COUNTER_SIGNAL));
  } catch {
    // A counter refresh must never interrupt payment confirmation.
  }

  try {
    localStorage.setItem(TICKET_COUNTER_SIGNAL, `${Date.now()}-${Math.random()}`);
  } catch {
    // Visibility and periodic refresh still work when storage is blocked.
  }
}

export async function initializeAttendanceCounter(roots: NodeListOf<HTMLElement>, configuredOrigin: string): Promise<void> {
  if (!roots.length) return;

  const endpoint = attendanceEndpoint(configuredOrigin, window.location.origin);

  if (!endpoint) return;

  let inFlight = false;
  let pending = false;
  let stopped = false;
  const timers: number[] = [];
  const animated = new Map<HTMLElement, () => void>();
  const rendered = new WeakSet<HTMLElement>();

  async function refresh(): Promise<void> {
    if (inFlight) {
      pending = true;
      return;
    }

    inFlight = true;

    try {
      const response = await fetch(endpoint!, {
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) throw new Error('Counter unavailable');
      const attendance = publishedAttendance(await response.json());

      if (!attendance) throw new Error('Invalid counter');
      if (stopped) return;

      for (const root of roots) {
        const count = root.querySelector<HTMLElement>('[data-attendance-count]');
        const estimate = root.querySelector<HTMLElement>('[data-attendance-estimate]');
        const isAnimated = root.dataset?.attendanceVariant === 'sticker' || root.dataset?.attendanceVariant === 'hanging';

        if (!count) continue;
        if (isAnimated && !rendered.has(root)) {
          animated.set(root, initializeAnimatedCounter(root, attendance));
          rendered.add(root);
          continue;
        }

        animated.get(root)?.();
        animated.delete(root);
        const formatted = attendance.count.toLocaleString('en-GH');

        if (isAnimated) {
          const sizer = root.querySelector<HTMLElement>('[data-attendance-sizer]');
          const wording = root.querySelector<HTMLElement>('[data-attendance-wording]');
          const label = root.querySelector<HTMLElement>('[data-attendance-label]');
          const suffix = attendanceSuffix(attendance.count);

          if (!sizer || !wording || !label) continue;
          sizer.textContent = formatted;
          root.style.setProperty('--attendance-number-limit', `calc((100vw - 100px) / ${formatted.length * 0.7})`);
          count.textContent = formatted;
          wording.textContent = suffix.replace(' Are you?', '\nAre you?');
          label.textContent = `${formatted} ${suffix}`;
        } else {
          if (!estimate) continue;
          count.textContent = `${formatted} ${attendanceSuffix(attendance.count)}`;
          estimate.hidden = attendance.source !== 'estimate';
        }

        root.hidden = false;
      }
    } catch {
      if (!stopped) {
        for (const root of roots) root.hidden = true;
      }
    } finally {
      inFlight = false;

      if (pending && !stopped) {
        pending = false;
        void refresh();
      }
    }
  }

  function recheck(): void {
    timers.splice(0).forEach((timer) => window.clearTimeout(timer));
    void refresh();

    for (const delay of [2_000, 5_000, 10_000]) {
      timers.push(window.setTimeout(() => void refresh(), delay));
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') recheck();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === TICKET_COUNTER_SIGNAL) recheck();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('storage', onStorage);
  window.addEventListener(TICKET_COUNTER_SIGNAL, recheck);
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refresh();
  }, 60_000);
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;

    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(TICKET_COUNTER_SIGNAL, recheck);
    window.clearInterval(interval);
    timers.forEach((timer) => window.clearTimeout(timer));
    animated.forEach((cleanup) => cleanup());
  });

  await refresh();
}
