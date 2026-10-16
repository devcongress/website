/** Decorative enhancement only: HTML stays visible without this script. */
export function initDevcon26ScrollReveals(page: HTMLElement) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (motion.matches || !('IntersectionObserver' in window) || typeof page.animate !== 'function') return;

  const groups = [
    { selector: '.story-heading, .story-copy, .people-line', from: 'translateY(16px)' },
    { selector: '.programme-photo', from: 'translateX(-16px)' },
    { selector: '.day-content', from: 'translateX(16px)' },
    { selector: '.speakers-header, .speaker-card', from: 'translateY(12px) scale(0.98)' },
    { selector: '.location-place, .location-copy', from: 'translateX(-12px)' },
    { selector: '.tickets-heading, .registration-action', from: 'translateY(10px) scale(0.99)' },
    { selector: '.sponsors-story, .sponsors-community, .packages-intro, .package-plan, .custom-sponsorship', from: 'scale(0.975)' },
    { selector: '.faq-intro, .faq-item', from: '' },
    { selector: '.past-sponsors-intro, .past-sponsors-list > li', from: 'translateX(10px)' },
  ];
  const pending = new Map<HTMLElement, string>();
  const active = new Set<Animation>();
  const listeners = new AbortController();

  const stop = () => {
    observer.disconnect();
    pending.clear();
    active.forEach((animation) => animation.cancel());
    active.clear();
    listeners.abort();
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const element = entry.target as HTMLElement;
      const from = pending.get(element);

      observer.unobserve(element);
      pending.delete(element);

      if (from === undefined || motion.matches || document.hidden || element.contains(document.activeElement)) continue;

      // Preserve existing artwork rotation. No load/decode promises or timers:
      // text and links never wait for images, data, or animation completion.
      const style = getComputedStyle(element);
      const base = style.transform === 'none' ? '' : style.transform;
      const animation = element.animate([
        { opacity: 0, transform: `${base} ${from}`.trim() || 'none' },
        { opacity: style.opacity, transform: base || 'none' },
      ], {
        duration: 280,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      });

      active.add(animation);
      animation.onfinish = () => active.delete(animation);
      animation.oncancel = () => active.delete(animation);
    }
  }, { threshold: 0, rootMargin: '0px 0px 24px 0px' });

  for (const group of groups) {
    for (const element of page.querySelectorAll<HTMLElement>(group.selector)) {
      // Late JS, restored scroll positions and initial anchors must not flash
      // already-visible content back to transparent.
      if (element.getBoundingClientRect().top < window.innerHeight + 24) continue;

      pending.set(element, group.from);
      observer.observe(element);
    }
  }

  // Keyboard navigation, anchor jumps, print and page exit are immediate.
  const options = { signal: listeners.signal };

  page.addEventListener('focusin', stop, options);
  document.addEventListener('keydown', stop, options);
  window.addEventListener('hashchange', stop, options);
  window.addEventListener('beforeprint', stop, options);
  window.addEventListener('pagehide', stop, options);
  motion.addEventListener('change', () => {
    if (motion.matches) stop();
  }, options);
}
