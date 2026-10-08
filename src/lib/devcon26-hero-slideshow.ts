function waitForPhoto(image: HTMLImageElement, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;

    const finish = (loaded: boolean) => {
      if (finished) return;

      finished = true;
      window.clearTimeout(timeout);
      image.removeEventListener('load', decode);
      image.removeEventListener('error', fail);
      signal.removeEventListener('abort', fail);
      resolve(loaded);
    };

    const fail = () => finish(false);
    const decode = () => {
      if (!image.naturalWidth) {
        finish(false);
        return;
      }

      if (typeof image.decode !== 'function') {
        finish(true);
        return;
      }

      image.decode().then(() => finish(true), fail);
    };

    const timeout = window.setTimeout(fail, 8000);

    image.addEventListener('load', decode);
    image.addEventListener('error', fail);
    signal.addEventListener('abort', fail, { once: true });
    image.loading = 'eager';

    if (!image.getAttribute('src') && image.dataset.heroSrc) {
      image.src = image.dataset.heroSrc;
    }

    if (signal.aborted) fail();
    else if (image.complete) decode();
  });
}

export function initDevcon26HeroSlideshow(root: HTMLElement): () => void {
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-slide]'));

  if (slides.length < 2) {
    return () => {};
  }

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bounds = root.getBoundingClientRect();
  const failed = new Set<number>();
  const listeners = new AbortController();
  const focusScope = root.closest<HTMLElement>('.hero') || root;
  let active = 0;
  let inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
  let hovered = false;
  let focused = focusScope.contains(document.activeElement);
  let suspended = false;
  let disposed = false;
  let busy = false;
  let generation = 0;
  let timer: number | undefined;
  let pending: AbortController | undefined;

  const clearTimer = () => {
    if (timer !== undefined) window.clearTimeout(timer);

    timer = undefined;
  };

  const cancelPending = () => {
    generation += 1;
    pending?.abort();
    pending = undefined;
    busy = false;
  };

  const canRotate = () => !disposed && !suspended && !motion.matches
    && !document.hidden && inView && !hovered && !focused && failed.size < slides.length - 1;

  const updatePlayback = () => {
    clearTimer();

    if (disposed) return;

    if (!canRotate() && busy) cancelPending();

    if (canRotate() && !busy) {
      timer = window.setTimeout(() => {
        timer = undefined;
        void show();
      }, 6000);
    }
  };

  const show = async () => {
    if (!canRotate()) return;

    clearTimer();
    cancelPending();
    const token = generation;
    const request = new AbortController();

    pending = request;
    busy = true;
    updatePlayback();

    for (let step = 1; step < slides.length; step += 1) {
      const index = (active + step) % slides.length;

      if (failed.has(index)) continue;

      const photos = Array.from(slides[index].querySelectorAll<HTMLImageElement>('img'));
      const loaded = photos.length === 2
        && (await Promise.all(photos.map((photo) => waitForPhoto(photo, request.signal)))).every(Boolean);

      if (disposed || token !== generation || request.signal.aborted) return;

      if (!loaded) {
        failed.add(index);
        continue;
      }

      slides[active].classList.remove('is-active');
      slides[active].setAttribute('aria-hidden', 'true');
      slides[index].classList.add('is-active');
      slides[index].removeAttribute('aria-hidden');
      active = index;
      break;
    }

    busy = false;
    pending = undefined;
    updatePlayback();
  };

  const on = (target: EventTarget, type: string, listener: EventListener) => {
    target.addEventListener(type, listener, { signal: listeners.signal });
  };

  on(focusScope, 'focusin', () => {
    focused = true;
    updatePlayback();
  });
  on(focusScope, 'focusout', (event) => {
    focused = focusScope.contains((event as FocusEvent).relatedTarget as Node | null);
    updatePlayback();
  });
  on(focusScope, 'pointerenter', (event) => {
    if ((event as PointerEvent).pointerType === 'touch') return;

    hovered = true;
    updatePlayback();
  });
  on(focusScope, 'pointerleave', () => {
    hovered = false;
    updatePlayback();
  });
  on(document, 'visibilitychange', updatePlayback);
  on(motion, 'change', updatePlayback);
  on(window, 'pagehide', () => {
    suspended = true;
    cancelPending();
    updatePlayback();
  });
  on(window, 'pageshow', () => {
    suspended = false;
    updatePlayback();
  });

  const observer = typeof IntersectionObserver === 'undefined' ? undefined
    : new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      updatePlayback();
    });

  observer?.observe(root);

  if (!observer) {
    const updateVisibility = () => {
      const currentBounds = root.getBoundingClientRect();

      inView = currentBounds.bottom > 0 && currentBounds.top < window.innerHeight;
      updatePlayback();
    };

    on(window, 'scroll', updateVisibility);
    on(window, 'resize', updateVisibility);
  }

  const dispose = () => {
    if (disposed) return;

    disposed = true;
    clearTimer();
    cancelPending();
    observer?.disconnect();
    listeners.abort();
  };

  on(document, 'astro:before-swap', dispose);
  updatePlayback();

  return dispose;
}
