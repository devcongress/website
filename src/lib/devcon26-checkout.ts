import { DEVCON26_CHECKOUT_PATH, devcon26Amount, devcon26Quote, type Devcon26Quote } from './devcon26-checkout-contract';
import { devcon26ConfirmationUrl, devcon26TestPaymentSummary } from './devcon26-payment-confirmation';

const COUPON_MESSAGES = {
  invalid: 'That coupon code isn’t valid. Check the code and try again.',
  expired: 'That coupon has expired. Remove it to continue without a discount.',
  ineligible: 'That coupon doesn’t apply to this ticket choice.',
  unavailable: 'That coupon is unavailable or has reached its limit. Try another code or remove it.',
} as const;

class CheckoutError extends Error {
  constructor(
    public couponError?: keyof typeof COUPON_MESSAGES,
    public checkoutError?: 'finished' | 'in_progress' | 'cart_conflict',
  ) {
    super('Checkout is temporarily unavailable.');
  }
}

export function initializeDevcon26Checkout(page: HTMLElement): void {
  const dialog = page.querySelector<HTMLDialogElement>('#ticket-checkout-dialog');

  if (!dialog || typeof dialog.showModal !== 'function') return;

  const form = dialog.querySelector<HTMLFormElement>('[data-checkout-buyer-form]')!;
  const purchaserName = form.querySelector<HTMLInputElement>('[data-checkout-purchaser-name]')!;
  const purchaserEmail = form.querySelector<HTMLInputElement>('[data-checkout-purchaser-email]')!;
  const couponInput = form.querySelector<HTMLInputElement>('[data-checkout-coupon-code]')!;
  const couponDetails = form.querySelector<HTMLDetailsElement>('[data-checkout-coupon]')!;
  const couponSummary = couponDetails.querySelector<HTMLElement>('summary')!;
  const couponContent = couponDetails.querySelector<HTMLElement>('[data-checkout-coupon-content]')!;
  const afterCoupon = form.querySelector<HTMLElement>('[data-checkout-after-coupon]')!;
  const panel = dialog.querySelector<HTMLElement>('.checkout-panel')!;
  const panelContent = panel.querySelector<HTMLElement>('[data-checkout-content]')!;
  const surface = dialog.querySelector<HTMLElement>('[data-checkout-surface]')!;
  const couponApply = form.querySelector<HTMLButtonElement>('[data-checkout-coupon-apply]')!;
  const couponRemove = form.querySelector<HTMLButtonElement>('[data-checkout-coupon-remove]')!;
  const couponStatus = form.querySelector<HTMLElement>('[data-checkout-coupon-status]')!;
  const payment = form.querySelector<HTMLButtonElement>('[data-checkout-payment]')!;
  const noticeTitle = dialog.querySelector<HTMLElement>('[data-checkout-notice-title]')!;
  const noticeCopy = dialog.querySelector<HTMLElement>('[data-checkout-notice-copy]')!;
  const ticketName = dialog.querySelector<HTMLElement>('[data-checkout-ticket-name]')!;
  const ticketPrice = dialog.querySelector<HTMLElement>('[data-checkout-ticket-price]')!;
  const ticketPhoto = dialog.querySelector<HTMLImageElement>('[data-checkout-ticket-photo]')!;
  const quoteView = form.querySelector<HTMLElement>('[data-checkout-quote]')!;
  const choices = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-ticket-choice]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let tier = 'regular';
  let quote: Devcon26Quote | null = null;
  let requestKey: string | undefined;
  let reference: string | undefined;
  let action: 'availability' | 'quote' | 'initialize' | 'verify' = 'availability';
  let busy = false;
  let operation = 0;
  let revision = 0;
  let abort: AbortController | undefined;
  let closeTimer: number | undefined;
  let refreshTimer: number | undefined;
  let transition = 0;
  let catalogReady = false;
  let returningPayment = false;
  let couponExpanded = couponDetails.open;
  let couponTransition = 0;
  let couponAnimations: Animation[] = [];
  let couponScroll: { expanded: boolean; start: number; end: number } | undefined;

  couponDetails.dataset.couponOpen = String(couponExpanded);
  couponContent.inert = !couponExpanded;

  function settleCouponMotion(): void {
    couponTransition += 1;
    couponAnimations.forEach((animation) => {
      animation.onfinish = null;
      animation.cancel();
    });
    couponAnimations = [];
    couponDetails.open = couponExpanded;
    panel.style.height = '';

    if (couponScroll) {
      panel.scrollTop = couponExpanded === couponScroll.expanded ? couponScroll.end : couponScroll.start;
      couponScroll = undefined;
    }
  }

  function setCouponOpen(next: boolean): void {
    if (next === couponExpanded) return;

    couponExpanded = next;
    couponDetails.dataset.couponOpen = String(next);
    couponContent.inert = !next;

    if (couponAnimations.length) {
      couponAnimations.forEach((animation) => animation.reverse());

      return;
    }

    if (reducedMotion.matches || typeof couponContent.animate !== 'function') {
      settleCouponMotion();

      return;
    }

    const startSurface = surface.getBoundingClientRect();
    const startPanelTop = panel.getBoundingClientRect().top;
    const startContentTop = panelContent.getBoundingClientRect().top;
    const startAfterTop = afterCoupon.getBoundingClientRect().top - startContentTop;
    const startScroll = panel.scrollTop;

    // Probe the destination synchronously; the browser never paints this state.
    couponDetails.open = next;
    const endSurface = surface.getBoundingClientRect();
    const endPanelTop = panel.getBoundingClientRect().top;
    const endContentTop = panelContent.getBoundingClientRect().top;
    const endAfterTop = afterCoupon.getBoundingClientRect().top - endContentTop;
    const endScroll = panel.scrollTop;

    // Keep a stable clipping/scroll viewport and normal-flow fields until finish.
    couponDetails.open = true;
    panel.style.height = `${Math.max(startSurface.height, endSurface.height)}px`;
    panel.scrollTop = startScroll;
    couponScroll = { expanded: next, start: startScroll, end: endScroll };
    const frame = surface.getBoundingClientRect();
    const panelTop = panel.getBoundingClientRect().top;
    const startPanelOffset = startPanelTop - panelTop;
    const endPanelOffset = endPanelTop - panelTop;
    const contentTop = panelContent.getBoundingClientRect().top;
    const afterTop = afterCoupon.getBoundingClientRect().top - contentTop;
    const current = ++couponTransition;
    const options: KeyframeAnimationOptions = {
      duration: 180,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both',
    };
    const contentAnimation = couponContent.animate([
      { opacity: next ? 0 : 1, transform: next ? 'translateY(-8px)' : 'translateY(0)' },
      { opacity: next ? 1 : 0, transform: next ? 'translateY(0)' : 'translateY(-8px)' },
    ], options);

    // Move the scroll viewport for recentering; internal motion only bridges scroll clamping.
    // Scale only the decorative paper; text and controls remain unscaled.
    couponAnimations = [
      contentAnimation,
      afterCoupon.animate([
        { transform: `translateY(${startAfterTop - afterTop}px)` },
        { transform: `translateY(${endAfterTop - afterTop}px)` },
      ], options),
      panelContent.animate([
        { transform: `translateY(${startContentTop - contentTop - startPanelOffset}px)` },
        { transform: `translateY(${endContentTop - contentTop - endPanelOffset}px)` },
      ], options),
      surface.animate([
        { transform: `translateY(${startSurface.top - frame.top}px) scaleY(${startSurface.height / frame.height})` },
        { transform: `translateY(${endSurface.top - frame.top}px) scaleY(${endSurface.height / frame.height})` },
      ], options),
      panel.animate([
        { transform: `translateY(${startPanelOffset}px)` },
        { transform: `translateY(${endPanelOffset}px)` },
      ], options),
    ];

    contentAnimation.onfinish = () => {
      if (current === couponTransition) settleCouponMotion();
    };
  }

  couponSummary.addEventListener('click', (event) => {
    event.preventDefault();
    setCouponOpen(!couponExpanded);
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) settleCouponMotion();
  });
  window.addEventListener('resize', settleCouponMotion);
  panel.addEventListener('wheel', settleCouponMotion, { passive: true });
  panel.addEventListener('touchstart', settleCouponMotion, { passive: true });

  function couponCode(): string {
    return couponInput.value.trim().toUpperCase();
  }

  function message(title: string, copy: string, label: string, disabled = false): void {
    settleCouponMotion();
    noticeTitle.textContent = title;
    noticeCopy.textContent = copy;
    payment.textContent = label;
    payment.disabled = disabled;
    payment.setAttribute('aria-busy', String(busy));
    couponApply.disabled = busy || returningPayment;
    couponRemove.disabled = busy || returningPayment;
  }

  function beginOperation(): { id: number; revision: number; controller: AbortController } {
    abort?.abort();
    const controller = new AbortController();

    abort = controller;
    busy = true;

    return { id: ++operation, revision, controller };
  }

  function isCurrent(current: { id: number; revision: number }): boolean {
    return current.id === operation && current.revision === revision && dialog!.open
      && dialog!.dataset.visible !== 'closing';
  }

  async function api(path: string, controller: AbortController, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const origin = new URL(page.dataset.checkoutApiOrigin!);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);

    if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new CheckoutError();
    }

    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(new URL(DEVCON26_CHECKOUT_PATH + path, origin.origin), {
        method: body ? 'POST' : 'GET',
        credentials: 'omit',
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);

      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new CheckoutError();

      const payload = result as Record<string, unknown>;

      if (!response.ok) {
        const code = payload.coupon_error;
        const checkoutCode = payload.checkout_error;
        const couponError = typeof code === 'string' && Object.hasOwn(COUPON_MESSAGES, code)
          ? code as keyof typeof COUPON_MESSAGES : undefined;
        const checkoutError = checkoutCode === 'finished' || checkoutCode === 'in_progress' || checkoutCode === 'cart_conflict'
          ? checkoutCode : undefined;

        throw new CheckoutError(couponError, checkoutError);
      }

      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function hideQuote(): void {
    settleCouponMotion();
    quote = null;
    quoteView.hidden = true;
  }

  function showQuote(value: Devcon26Quote): void {
    settleCouponMotion();
    quote = value;
    ticketPrice.textContent = devcon26Amount(value.final_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-base]')!.textContent = devcon26Amount(value.base_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-discount]')!.textContent = '−' + devcon26Amount(value.discount_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-final]')!.textContent = devcon26Amount(value.final_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-discount-row]')!.hidden = value.discount_amount_minor === 0;
    quoteView.hidden = false;
    couponRemove.hidden = !value.coupon_applied && !couponCode();
    couponStatus.textContent = value.coupon_applied ? value.coupon_applied + ' applied. Your discount is included below.' : '';
  }

  function ready(): void {
    action = 'initialize';
    message('Ready when you are.', 'Review your total, then continue to Paystack to complete your payment securely.', 'Continue to payment');
  }

  function couponFailure(error: unknown): boolean {
    if (!(error instanceof CheckoutError) || !error.couponError) return false;

    couponInput.setAttribute('aria-invalid', 'true');
    couponStatus.textContent = COUPON_MESSAGES[error.couponError];
    couponRemove.hidden = false;
    action = 'quote';
    message('Your coupon needs another look.', 'Try another code, or remove it to refresh your total.', 'Update your coupon', true);
    setCouponOpen(true);

    return true;
  }

  async function refreshQuote(): Promise<void> {
    if (!dialog!.open || returningPayment) return;

    const code = couponCode();

    hideQuote();
    couponInput.removeAttribute('aria-invalid');

    if (code && !/^[A-Z0-9-]{3,48}$/.test(code)) {
      busy = false;
      couponFailure(new CheckoutError('invalid'));

      return;
    }

    const current = beginOperation();

    action = 'quote';
    message('Updating your total.', 'Checking your ticket price' + (code ? ' and coupon.' : '.'), 'Updating total…', true);

    try {
      const result = await api('/quote', current.controller, { tier_key: tier, ...(code ? { coupon_code: code } : {}) });

      if (!isCurrent(current)) return;

      const value = devcon26Quote(result, tier);

      if (!value || value.coupon_applied !== (code || null)) throw new CheckoutError();

      busy = false;
      showQuote(value);
      ready();
    } catch (error) {
      if (!isCurrent(current)) return;

      busy = false;

      if (couponFailure(error)) return;

      action = 'quote';
      message('We couldn’t update your total.', 'Please check again before starting payment.', 'Check total again');
    }
  }

  async function checkAvailability(): Promise<void> {
    const current = beginOperation();

    hideQuote();
    catalogReady = false;
    action = 'availability';
    message('Getting your checkout ready.', 'Checking availability for your ticket choice.', 'Checking checkout…', true);

    try {
      const result = await api('', current.controller);

      if (!isCurrent(current)) return;

      const tiers = Array.isArray(result.tiers) ? result.tiers : [];
      const selected = tiers.find((candidate) => candidate?.tier_key === tier);

      if (result.mode !== 'test' || result.accepts_coupon !== true || !selected || selected.currency !== 'GHS'
        || !Number.isSafeInteger(selected.amount_minor) || selected.amount_minor <= 0) throw new CheckoutError();

      busy = false;
      catalogReady = true;
      await refreshQuote();
    } catch {
      if (!isCurrent(current)) return;

      busy = false;
      message('We couldn’t connect to checkout.', 'Please try again. No payment has been started.', 'Check again');
    }
  }

  function invalidateInput(): void {
    settleCouponMotion();
    window.clearTimeout(refreshTimer);
    abort?.abort();
    operation += 1;
    revision += 1;
    requestKey = undefined;
    busy = false;
  }

  function selectTicket(button: HTMLButtonElement): void {
    tier = button.dataset.ticketId!.replaceAll('-', '_');
    ticketName.textContent = button.dataset.ticketName || '';
    ticketPrice.textContent = button.dataset.ticketPrice || '';
    ticketPhoto.src = button.dataset.ticketPhoto!;
    dialog!.dataset.ticketFeatured = button.dataset.ticketFeatured || 'false';
  }

  function showCheckout(): void {
    window.clearTimeout(closeTimer);
    const current = ++transition;

    if (!dialog!.open) dialog!.showModal();
    window.requestAnimationFrame(() => {
      if (current === transition && dialog!.open) dialog!.dataset.visible = 'true';
    });
  }

  function closeCheckout(): void {
    if (!dialog!.open) return;

    window.clearTimeout(closeTimer);
    settleCouponMotion();
    invalidateInput();
    transition += 1;
    dialog!.dataset.visible = 'closing';
    closeTimer = window.setTimeout(() => {
      dialog!.close();
      dialog!.removeAttribute('data-visible');
    }, reducedMotion.matches ? 0 : 180);
  }

  async function verifyPayment(value: string): Promise<void> {
    returningPayment = true;
    form.querySelector<HTMLElement>('.checkout-buyer-fields')!.hidden = true;
    couponDetails.hidden = true;
    const current = beginOperation();

    reference = value;
    action = 'verify';
    message('Confirming your payment.', 'Checking the result directly with Paystack.', 'Confirming…', true);

    try {
      const result = await api('/verify', current.controller, { reference: value });

      if (!isCurrent(current)) return;

      const summary = devcon26TestPaymentSummary(result);
      const button = choices.find((candidate) => candidate.dataset.ticketId!.replaceAll('-', '_') === result.tier_key);

      if (!summary || !button) throw new CheckoutError();

      selectTicket(button);
      ticketPrice.textContent = summary.amount;
      busy = false;

      if (summary.status === 'verified' || summary.status === 'refund_required') {
        window.location.replace(devcon26ConfirmationUrl(value));
      } else if (summary.status === 'pending') {
        message('Your payment is still pending.', 'Paystack hasn’t confirmed success yet. Check the existing payment before starting another.', 'Check payment status');
      } else {
        message('Payment wasn’t successful.', 'No successful payment was confirmed. Close this window when you’re ready to try again.', 'Check payment status');
      }
    } catch {
      if (!isCurrent(current)) return;

      busy = false;
      message('We couldn’t confirm your payment yet.', 'Please check the status again before starting another payment.', 'Check payment status');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (busy) return;
    if (action === 'verify') return void verifyPayment(reference || '');
    if (action === 'availability') return void checkAvailability();
    if (action === 'quote') return void refreshQuote();
    if (!quote || quote.coupon_applied !== (couponCode() || null)) return;

    const name = purchaserName.value.trim();
    const email = purchaserEmail.value.trim().toLowerCase();

    purchaserName.setCustomValidity(!name || /[\u0000-\u001f\u007f]/.test(name) ? 'Enter your name.' : '');
    purchaserEmail.setCustomValidity(!email || /[\u0000-\u001f\u007f]/.test(email) ? 'Enter a valid email address.' : '');

    if (!form.reportValidity()) return;

    const expected = quote;
    const current = beginOperation();

    requestKey ||= crypto.randomUUID();
    message('Taking you to Paystack.', 'Complete your payment on Paystack’s secure checkout.', 'Opening Paystack…', true);

    try {
      const result = await api('/initialize', current.controller, {
        tier_key: tier,
        checkout_request_key: requestKey,
        purchaser_name: name,
        purchaser_email: email,
        ...(expected.coupon_applied ? { coupon_code: expected.coupon_applied } : {}),
      });

      if (!isCurrent(current)) return;

      const initialized = devcon26Quote(result, tier);
      const destination = new URL(String(result.authorization_url));

      if (!initialized || initialized.coupon_applied !== expected.coupon_applied
        || destination.protocol !== 'https:' || destination.hostname !== 'checkout.paystack.com'
        || destination.username || destination.password || destination.port) throw new CheckoutError();

      if (initialized.base_amount_minor !== expected.base_amount_minor
        || initialized.discount_amount_minor !== expected.discount_amount_minor
        || initialized.final_amount_minor !== expected.final_amount_minor) {
        busy = false;
        showQuote(initialized);
        message('Your total has changed.', 'Review the updated total below before continuing to payment.', 'Continue to payment');

        return;
      }

      window.location.assign(destination.href);
    } catch (error) {
      if (!isCurrent(current)) return;

      busy = false;

      if (error instanceof CheckoutError && error.couponError) {
        hideQuote();
        couponFailure(error);

        return;
      }

      if (error instanceof CheckoutError && (error.checkoutError === 'finished' || error.checkoutError === 'cart_conflict')) {
        requestKey = undefined;
        hideQuote();
        action = 'quote';
        message(error.checkoutError === 'finished' ? 'This checkout has expired.' : 'Your checkout details changed.',
          'Check your total again before starting a fresh checkout.', 'Check total again');

        return;
      }

      if (error instanceof CheckoutError && error.checkoutError === 'in_progress') {
        message('Your checkout is getting ready.', 'Please wait a moment, then try again. We’ll continue the same checkout.', 'Try again');

        return;
      }

      message('Checkout couldn’t start.', 'No payment was confirmed. Please try again shortly.', 'Try again');
    }
  });

  purchaserName.addEventListener('input', buyerChanged);
  purchaserEmail.addEventListener('input', buyerChanged);

  function buyerChanged(): void {
    purchaserName.setCustomValidity('');
    purchaserEmail.setCustomValidity('');
    invalidateInput();

    if (returningPayment) return;
    if (quote) return ready();

    refreshTimer = window.setTimeout(() => {
      if (dialog!.open && dialog!.dataset.visible !== 'closing') {
        void (catalogReady ? refreshQuote() : checkAvailability());
      }
    }, 250);
  }

  couponInput.addEventListener('input', () => {
    invalidateInput();
    hideQuote();
    couponInput.removeAttribute('aria-invalid');
    couponRemove.hidden = !couponInput.value;
    couponStatus.textContent = couponCode() ? 'Apply your code to update the total.' : '';
    action = 'quote';
    message('Review your coupon.', 'Apply the code or remove it to refresh your total.', 'Apply coupon first', true);

    if (!couponCode()) void refreshQuote();
  });

  couponApply.addEventListener('click', () => {
    if (!busy && !returningPayment) void refreshQuote();
  });

  couponRemove.addEventListener('click', () => {
    invalidateInput();
    couponInput.value = '';
    couponInput.removeAttribute('aria-invalid');
    couponStatus.textContent = '';
    couponRemove.hidden = true;
    void refreshQuote();
  });

  choices.forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      invalidateInput();
      selectTicket(button);
      reference = undefined;
      returningPayment = false;
      form.querySelector<HTMLElement>('.checkout-buyer-fields')!.hidden = false;
      couponDetails.hidden = false;
      showCheckout();
      void checkAvailability();
    });
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeCheckout();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeCheckout();
  });
  dialog.querySelector<HTMLFormElement>('.checkout-dismiss')!.addEventListener('submit', (event) => {
    event.preventDefault();
    closeCheckout();
  });
  dialog.addEventListener('close', () => {
    settleCouponMotion();
    invalidateInput();
    dialog.removeAttribute('data-visible');
  });
  window.addEventListener('pagehide', () => {
    settleCouponMotion();
    invalidateInput();
  });

  const returnUrl = new URL(window.location.href);
  const returnedReference = returnUrl.searchParams.get('reference');

  if (returnUrl.searchParams.get('test_checkout') === 'return') {
    ['reference', 'trxref', 'test_checkout'].forEach((key) => returnUrl.searchParams.delete(key));
    window.history.replaceState(null, '', returnUrl.pathname + returnUrl.search + returnUrl.hash);
    showCheckout();
    void verifyPayment(returnedReference || '');
  }
}
