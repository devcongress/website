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
  const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-slot]')).map((slot) => ({
    photos: Array.from(slot.querySelectorAll<HTMLImageElement>('img')),
    active: 0,
    failed: new Set<number>(),
  }));
  type Candidate = { slotIndex: number; photoIndex: number };

  if (!slots.some((slot) => slot.photos.length > 1)) {
    return () => {};
  }

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bounds = root.getBoundingClientRect();
  const listeners = new AbortController();
  const focusScope = root.closest<HTMLElement>('.hero') || root;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let nextSlot = 0;
  let inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
  let hovered = false;
  let focused = focusScope.contains(document.activeElement);
  let suspended = false;
  let disposed = false;
  let advancing = false;
  let generation = 0;
  let timer: number | undefined;
  let pending: AbortController | undefined;
  let prepared: Promise<Candidate | null> | undefined;

  const clearTimer = () => {
    if (timer !== undefined) window.clearTimeout(timer);

    timer = undefined;
  };

  const cancelPending = () => {
    generation += 1;
    pending?.abort();
    pending = undefined;
    prepared = undefined;
    advancing = false;
  };

  const canRotate = () => !disposed && !suspended && !motion.matches
    && !document.hidden && inView && !hovered && !focused
    && slots.some((slot) => slot.failed.size < slot.photos.length - 1);

  // Prepare the next single photo before its turn, keeping all visible photos intact.
  const prepare = async (signal: AbortSignal, token: number): Promise<Candidate | null> => {
    for (let offset = 0; offset < slots.length; offset += 1) {
      const slotIndex = (nextSlot + offset) % slots.length;
      const slot = slots[slotIndex];

      for (let step = 1; step < slot.photos.length; step += 1) {
        const photoIndex = (slot.active + step) % slot.photos.length;

        if (slot.failed.has(photoIndex)) continue;

        const loaded = await waitForPhoto(slot.photos[photoIndex], signal);

        if (disposed || signal.aborted || token !== generation) return null;

        if (loaded) return { slotIndex, photoIndex };

        slot.failed.add(photoIndex);
      }
    }

    return null;
  };

  const prime = () => {
    if (prepared || !canRotate()) return;

    pending = new AbortController();
    prepared = prepare(pending.signal, generation);
  };

  const updatePlayback = () => {
    clearTimer();

    if (disposed) return;

    if (!canRotate()) {
      cancelPending();
      return;
    }

    prime();

    if (!advancing) {
      timer = window.setTimeout(() => {
        timer = undefined;
        void show();
      }, 3000);
    }
  };

  const show = async () => {
    if (!canRotate()) return;

    clearTimer();
    const token = generation;

    advancing = true;
    prime();
    const candidate = await prepared;

    if (token !== generation || !canRotate()) {
      if (token === generation) updatePlayback();
      return;
    }

    if (candidate) {
      const slot = slots[candidate.slotIndex];
      const outgoing = slot.photos[slot.active];
      const incoming = slot.photos[candidate.photoIndex];

      outgoing.classList.remove('is-active');
      outgoing.setAttribute('aria-hidden', 'true');
      incoming.classList.add('is-active');
      incoming.removeAttribute('aria-hidden');
      slot.active = candidate.photoIndex;
      nextSlot = (candidate.slotIndex + 1) % slots.length;
    }

    prepared = undefined;
    pending = undefined;
    advancing = false;
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
  on(root, 'pointerenter', (event) => {
    if (!finePointer.matches || (event as PointerEvent).pointerType === 'touch') return;

    hovered = true;
    updatePlayback();
  });
  on(root, 'pointerleave', () => {
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
