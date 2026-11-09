import { googleEventCalendarUrl } from './event-calendar';

export function initializeEventCalendarPicker(resolveEvent) {
  const calendarSubscribePanel = document.querySelector('#calendar-subscribe-panel');
  const calendarSubscribeClose = document.querySelector('.calendar-subscribe-close');
  const calendarCopyOption = document.querySelector('#calendar-copy-option');
  const calendarCopyDetails = document.querySelector('#calendar-copy-details');
  const calendarFeedInput = document.querySelector('#calendar-feed-url');
  const calendarCopyButton = document.querySelector('#calendar-copy-button');
  const calendarCopyStatus = document.querySelector('#calendar-copy-status');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const calendarFeedAddress = 'https://devcongress.org/events/calendar.ics';
  let activeCalendarTrigger = null;
  let calendarCloseTimer = null;
  let calendarCopyStateTimer = null;
  let calendarCopyRequestVersion = 0;

  function closeCalendarSubscription(restoreFocus = false, animate = false) {
    if (!(calendarSubscribePanel instanceof HTMLElement)) return;

    clearTimeout(calendarCloseTimer);
    activeCalendarTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && activeCalendarTrigger instanceof HTMLButtonElement && !activeCalendarTrigger.disabled) {
      activeCalendarTrigger.focus({ preventScroll: true });
    }
    calendarSubscribePanel.inert = true;
    calendarSubscribePanel.classList.remove('is-open');
    const finishClose = () => {
      calendarSubscribePanel.hidden = true;
      calendarSubscribePanel.classList.remove('opens-above');
      calendarSubscribePanel.style.maxHeight = '';
      resetCalendarCopyState();
      if (calendarCopyOption instanceof HTMLButtonElement && calendarCopyDetails instanceof HTMLElement) {
        calendarCopyOption.setAttribute('aria-expanded', 'false');
        calendarCopyDetails.hidden = true;
      }
      calendarSubscribePanel.dispatchEvent(new CustomEvent('calendar-picker-closed'));
    };
    if (animate && !reduceMotion.matches && !calendarSubscribePanel.hidden) {
      calendarCloseTimer = window.setTimeout(finishClose, 200);
    } else {
      finishClose();
    }
  }

  function fitCalendarSubscriptionPanel() {
    if (
      !(activeCalendarTrigger instanceof HTMLButtonElement)
      || !(calendarSubscribePanel instanceof HTMLElement)
      || calendarSubscribePanel.hidden
      || activeCalendarTrigger?.getAttribute('aria-expanded') !== 'true'
    ) return;

    const triggerBounds = activeCalendarTrigger.getBoundingClientRect();
    const availableBelow = window.innerHeight - triggerBounds.bottom - 16;
    const availableAbove = triggerBounds.top - 16;
    const previousScrollTop = calendarSubscribePanel.scrollTop;
    calendarSubscribePanel.style.maxHeight = '';
    const desiredHeight = calendarSubscribePanel.scrollHeight;
    const opensAbove = availableBelow < desiredHeight && availableAbove > availableBelow;
    const availableHeight = opensAbove ? availableAbove : availableBelow;

    calendarSubscribePanel.classList.toggle('opens-above', opensAbove);
    const panelWidth = Math.min(336, window.innerWidth - 32);
    const left = Math.max(16, Math.min(triggerBounds.right - panelWidth, window.innerWidth - panelWidth - 16));
    calendarSubscribePanel.style.left = `${left}px`;
    calendarSubscribePanel.style.top = opensAbove ? 'auto' : `${triggerBounds.bottom + 8}px`;
    calendarSubscribePanel.style.bottom = opensAbove ? `${window.innerHeight - triggerBounds.top + 8}px` : 'auto';
    calendarSubscribePanel.style.maxHeight = `${Math.max(80, availableHeight - 16)}px`;
    calendarSubscribePanel.scrollTop = previousScrollTop;
  }

  function setCalendarSubscriptionOpen() {
    if (!(calendarSubscribePanel instanceof HTMLElement) || !(activeCalendarTrigger instanceof HTMLButtonElement) || activeCalendarTrigger.disabled) return;

    clearTimeout(calendarCloseTimer);
    const wasHidden = calendarSubscribePanel.hidden;
    activeCalendarTrigger.setAttribute('aria-expanded', 'true');
    if (wasHidden) calendarSubscribePanel.style.transition = 'none';
    calendarSubscribePanel.hidden = false;
    calendarSubscribePanel.inert = false;
    fitCalendarSubscriptionPanel();
    // Establish the positioned closed state before enabling its entrance transition.
    if (wasHidden) {
      void calendarSubscribePanel.offsetHeight;
      calendarSubscribePanel.style.transition = '';
    }
    calendarSubscribePanel.classList.add('is-open');
  }

  function selectCalendarAddressForManualCopy() {
    if (!(calendarFeedInput instanceof HTMLInputElement)) return;
    calendarFeedInput.focus({ preventScroll: true });
    calendarFeedInput.select();
    calendarFeedInput.setSelectionRange(0, calendarFeedInput.value.length);
  }

  function setCalendarCopyState(state) {
    if (!(calendarCopyButton instanceof HTMLButtonElement)) return;

    const labels = {
      idle: 'Copy calendar address',
      copying: 'Copying calendar address',
      copied: 'Calendar address copied',
    };

    calendarCopyButton.dataset.copyState = state;
    calendarCopyButton.setAttribute('aria-label', labels[state]);
    calendarCopyButton.setAttribute('aria-busy', String(state === 'copying'));
    calendarCopyButton.setAttribute('aria-disabled', String(state !== 'idle'));
    calendarCopyButton.querySelectorAll('[data-copy-label]').forEach((label) => {
      label.classList.toggle('is-active', label.dataset.copyLabel === state);
    });
  }

  function resetCalendarCopyState(clearMessage = true) {
    calendarCopyRequestVersion += 1;
    window.clearTimeout(calendarCopyStateTimer);
    calendarCopyStateTimer = null;
    setCalendarCopyState('idle');
    if (clearMessage && calendarCopyStatus instanceof HTMLElement) calendarCopyStatus.textContent = '';
  }

  async function copyCalendarAddress() {
    if (
      !(calendarCopyButton instanceof HTMLButtonElement)
      || !(calendarCopyStatus instanceof HTMLElement)
      || !(calendarFeedInput instanceof HTMLInputElement)
      || calendarCopyButton.dataset.copyState !== 'idle'
    ) return;

    const requestVersion = ++calendarCopyRequestVersion;
    window.clearTimeout(calendarCopyStateTimer);
    calendarCopyStateTimer = null;
    calendarCopyStatus.textContent = '';
    setCalendarCopyState('copying');

    let copyTimeout = null;

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await Promise.race([
        navigator.clipboard.writeText(calendarFeedInput.value),
        new Promise((_, reject) => {
          copyTimeout = window.setTimeout(() => reject(new Error('Clipboard request timed out')), 5000);
        }),
      ]);
    } catch {
      if (requestVersion !== calendarCopyRequestVersion) return;

      setCalendarCopyState('idle');
      selectCalendarAddressForManualCopy();
      calendarCopyStatus.textContent = 'Copy was unavailable. The address is selected so you can copy it manually.';
      return;
    } finally {
      window.clearTimeout(copyTimeout);
    }

    if (requestVersion === calendarCopyRequestVersion) {
      setCalendarCopyState('copied');
      calendarCopyStatus.textContent = 'Calendar address copied.';
      calendarCopyStateTimer = window.setTimeout(() => {
        if (requestVersion !== calendarCopyRequestVersion) return;

        closeCalendarSubscription(true);
      }, 500);
    }
  }

  function openCalendarPicker(trigger, event) {
    if (!(calendarSubscribePanel instanceof HTMLElement) || !(calendarCopyOption instanceof HTMLButtonElement)) return;

    const wasOpen = activeCalendarTrigger === trigger && trigger.getAttribute('aria-expanded') === 'true';
    if (wasOpen) {
      closeCalendarSubscription(true, true);
      return;
    }
    if (activeCalendarTrigger === trigger && !calendarSubscribePanel.hidden) {
      setCalendarSubscriptionOpen();
      calendarSubscribePanel.querySelector('.calendar-google-option')?.focus({ preventScroll: true });
      return;
    }
    closeCalendarSubscription();

    const google = calendarSubscribePanel.querySelector('.calendar-google-option');
    const apple = calendarSubscribePanel.querySelector('.calendar-apple-option');
    const title = calendarSubscribePanel.querySelector('#calendar-subscribe-panel-title');
    const download = calendarSubscribePanel.querySelector('.calendar-feed-link');
    const googleCopy = google?.querySelector('small');
    const appleCopy = apple?.querySelector('small');
    const subscriptionNote = calendarSubscribePanel.querySelector('#calendar-event-subscription-note');
    if (!(google instanceof HTMLAnchorElement) || !(apple instanceof HTMLAnchorElement)
      || !(title instanceof HTMLElement) || !(download instanceof HTMLAnchorElement)
      || !(googleCopy instanceof HTMLElement) || !(appleCopy instanceof HTMLElement)
      || !(subscriptionNote instanceof HTMLElement) || !(calendarFeedInput instanceof HTMLInputElement)) return;

    const feedAddress = event
      ? `https://devcongress.org/events/${encodeURIComponent(event.slug)}/calendar.ics`
      : calendarFeedAddress;

    activeCalendarTrigger = trigger;
    document.body.append(calendarSubscribePanel);
    title.textContent = event ? 'Add this event' : 'Add DevCongress events';
    google.href = event ? googleEventCalendarUrl(event) : 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent('webcal://devcongress.org/events/calendar.ics');
    googleCopy.textContent = event ? 'Add this event to Google' : 'Subscribe with Google';
    apple.href = feedAddress.replace('https://', 'webcal://');
    appleCopy.textContent = event ? 'Subscribe to this event' : 'Open in your calendar app';
    calendarFeedInput.value = feedAddress;
    subscriptionNote.hidden = !event;
    download.href = event ? `/events/${encodeURIComponent(event.slug)}/calendar.ics` : '/events/calendar.ics';
    download.download = event ? `${event.slug}.ics` : 'devcongress-events.ics';
    setCalendarSubscriptionOpen();
    google.focus({ preventScroll: true });
  }

  document.addEventListener('click', (click) => {
    if (!(click.target instanceof Element)) return;
    const trigger = click.target.closest('.event-calendar-trigger, #calendar-subscribe-button');
    if (!(trigger instanceof HTMLButtonElement)) return;
    const event = trigger.dataset.eventSlug ? resolveEvent(trigger.dataset.eventSlug) : null;
    if (trigger.dataset.eventSlug && !event) return;
    openCalendarPicker(trigger, event);
  });
  calendarSubscribeClose?.addEventListener('click', () => closeCalendarSubscription(true, true));
  calendarCopyOption?.addEventListener('click', () => {
    if (!(calendarCopyDetails instanceof HTMLElement)) return;
    const isOpen = calendarCopyOption.getAttribute('aria-expanded') === 'true';
    calendarCopyOption.setAttribute('aria-expanded', String(!isOpen));
    calendarCopyDetails.hidden = isOpen;
    if (isOpen) resetCalendarCopyState();
    if (!isOpen) fitCalendarSubscriptionPanel();
    if (!isOpen && calendarCopyStatus instanceof HTMLElement) calendarCopyStatus.textContent = '';
  });
  calendarCopyButton?.addEventListener('click', () => void copyCalendarAddress());
  document.addEventListener('focusin', (event) => {
    if (activeCalendarTrigger?.getAttribute('aria-expanded') !== 'true' || calendarSubscribePanel?.contains(event.target) || activeCalendarTrigger === event.target) return;
    closeCalendarSubscription(false, true);
  });
  calendarSubscribePanel?.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('.calendar-provider-links a')) closeCalendarSubscription(true, true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (calendarSubscribePanel?.contains(event.target) || activeCalendarTrigger?.contains(event.target)) return;
    closeCalendarSubscription(false, true);
  });
  window.addEventListener('resize', fitCalendarSubscriptionPanel);
  window.addEventListener('scroll', (event) => {
    if (event.target instanceof Node && calendarSubscribePanel?.contains(event.target)) return;
    fitCalendarSubscriptionPanel();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || activeCalendarTrigger?.getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault();
    closeCalendarSubscription(true, true);
  });

  return closeCalendarSubscription;
}
