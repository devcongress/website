import { DEVCON26_CHECKOUT_PATH, devcon26Amount, devcon26Quote, type Devcon26Quote } from './devcon26-checkout-contract';
import { DEVCON26_TICKETS, devcon26CheckoutTier } from './devcon26-checkout-navigation';

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
  const form = page.querySelector<HTMLFormElement>('[data-checkout-buyer-form]')!;
  const fields = form.querySelector<HTMLFieldSetElement>('[data-checkout-fields]')!;
  const purchaserName = form.querySelector<HTMLInputElement>('[data-checkout-purchaser-name]')!;
  const purchaserEmail = form.querySelector<HTMLInputElement>('[data-checkout-purchaser-email]')!;
  const couponInput = form.querySelector<HTMLInputElement>('[data-checkout-coupon-code]')!;
  const couponDetails = form.querySelector<HTMLDetailsElement>('[data-checkout-coupon]')!;
  const couponSummary = couponDetails.querySelector<HTMLElement>('summary')!;
  const couponContent = couponDetails.querySelector<HTMLElement>('[data-checkout-coupon-content]')!;
  const couponLabel = couponSummary.querySelector<HTMLElement>('[data-checkout-coupon-label]')!;
  const couponAction = couponSummary.querySelector<HTMLElement>('[data-checkout-coupon-action]')!;
  const couponApply = form.querySelector<HTMLButtonElement>('[data-checkout-coupon-apply]')!;
  const couponRemove = form.querySelector<HTMLButtonElement>('[data-checkout-coupon-remove]')!;
  const couponStatus = form.querySelector<HTMLElement>('[data-checkout-coupon-status]')!;
  const payment = form.querySelector<HTMLButtonElement>('[data-checkout-payment]')!;
  const paymentLabel = payment.querySelector<HTMLElement>('[data-checkout-payment-label]')!;
  const notice = form.querySelector<HTMLElement>('[data-checkout-notice]')!;
  const noticeTitle = notice.querySelector<HTMLElement>('[data-checkout-notice-title]')!;
  const noticeCopy = notice.querySelector<HTMLElement>('[data-checkout-notice-copy]')!;
  const quoteView = form.querySelector<HTMLElement>('[data-checkout-quote]')!;
  const tier = devcon26CheckoutTier(window.location.search);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let quote: Devcon26Quote | null = null;
  let requestKey: string | undefined;
  let action: 'availability' | 'quote' | 'initialize' = 'availability';
  let busy = false;
  let active = true;
  let operation = 0;
  let revision = 0;
  let abort: AbortController | undefined;
  let refreshTimer: number | undefined;

  if (!tier) {
    form.hidden = true;
    page.querySelector<HTMLElement>('[data-checkout-invalid]')!.hidden = false;

    return;
  }

  const ticket = DEVCON26_TICKETS[tier];
  const photo = page.querySelector<HTMLImageElement>('[data-checkout-photo]')!;

  page.querySelector<HTMLElement>('[data-checkout-ticket-name]')!.textContent = ticket.name;
  page.querySelector<HTMLElement>('[data-checkout-ticket-quantity]')!.textContent = ticket.quantity + (ticket.quantity === 1 ? ' person' : ' people');
  photo.src = ticket.photo;
  photo.hidden = false;
  fields.disabled = false;

  let catalogReady = false;

  function couponCode(): string {
    return couponInput.value.trim().toUpperCase();
  }

  function renderCoupon(): void {
    const applied = quote?.coupon_applied;

    couponContent.inert = !couponDetails.open;
    couponLabel.textContent = applied && !couponDetails.open ? applied + ' applied' : 'Have a coupon?';
    couponAction.textContent = couponDetails.open ? 'Close' : applied ? 'Change' : '';
    couponRemove.hidden = !couponCode();
  }

  function setCouponOpen(open: boolean): void {
    if (!open && couponContent.contains(document.activeElement)) couponSummary.focus({ preventScroll: true });

    couponDetails.open = open;
    renderCoupon();
  }

  couponDetails.addEventListener('toggle', () => {
    renderCoupon();

    if (couponDetails.open && !reducedMotion.matches && typeof couponContent.animate === 'function') {
      couponContent.animate(
        [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  });

  function message(title: string, copy: string, label: string, disabled = false, quiet = false): void {
    noticeTitle.textContent = title;
    noticeCopy.textContent = copy;
    notice.hidden = quiet;
    paymentLabel.textContent = label;
    payment.disabled = disabled;
    payment.setAttribute('aria-busy', String(busy));
    couponApply.disabled = busy;
    couponRemove.disabled = busy;
  }

  function beginOperation(): { id: number; revision: number; controller: AbortController } {
    abort?.abort();
    const controller = new AbortController();

    abort = controller;
    busy = true;

    return { id: ++operation, revision, controller };
  }

  function isCurrent(current: { id: number; revision: number }): boolean {
    return active && current.id === operation && current.revision === revision;
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
    quote = null;
    quoteView.hidden = true;
    renderCoupon();
  }

  function showQuote(value: Devcon26Quote): void {
    quote = value;
    form.querySelector<HTMLElement>('[data-checkout-base]')!.textContent = devcon26Amount(value.base_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-discount]')!.textContent = '−' + devcon26Amount(value.discount_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-final]')!.textContent = devcon26Amount(value.final_amount_minor);
    form.querySelector<HTMLElement>('[data-checkout-discount-row]')!.hidden = value.discount_amount_minor === 0;
    quoteView.hidden = false;
    couponStatus.textContent = '';
    setCouponOpen(false);
  }

  function ready(): void {
    action = 'initialize';
    message('', '', 'Continue to payment', false, true);
  }

  function couponFailure(error: unknown): boolean {
    if (!(error instanceof CheckoutError) || !error.couponError) return false;

    couponInput.setAttribute('aria-invalid', 'true');
    couponStatus.textContent = COUPON_MESSAGES[error.couponError];
    action = 'quote';
    message('Check your coupon.', 'Try another code, or remove it to refresh your total.', 'Apply coupon first', true);
    setCouponOpen(true);

    return true;
  }

  async function refreshQuote(): Promise<void> {
    if (!active) return;
    if (!catalogReady) return void checkAvailability();

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

      const value = devcon26Quote(result, tier!);

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
    if (!active) return;

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
    window.clearTimeout(refreshTimer);
    abort?.abort();
    operation += 1;
    revision += 1;
    requestKey = undefined;
    busy = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!active || busy) return;
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

      const initialized = devcon26Quote(result, tier!);
      const destination = new URL(String(result.authorization_url));

      if (!initialized || initialized.coupon_applied !== expected.coupon_applied
        || destination.protocol !== 'https:' || destination.hostname !== 'checkout.paystack.com'
        || destination.username || destination.password || destination.port) throw new CheckoutError();

      if (initialized.base_amount_minor !== expected.base_amount_minor
        || initialized.discount_amount_minor !== expected.discount_amount_minor
        || initialized.final_amount_minor !== expected.final_amount_minor) {
        busy = false;
        showQuote(initialized);
        message('Your total has changed.', 'Review the updated total before continuing to payment.', 'Continue to payment');

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

      message('Checkout couldn’t start.', 'Please try again. We’ll retry the same checkout.', 'Try again');
    }
  });

  function buyerChanged(): void {
    purchaserName.setCustomValidity('');
    purchaserEmail.setCustomValidity('');
    invalidateInput();

    if (quote) return ready();

    refreshTimer = window.setTimeout(() => {
      if (active) void refreshQuote();
    }, 250);
  }

  purchaserName.addEventListener('input', buyerChanged);
  purchaserEmail.addEventListener('input', buyerChanged);

  couponInput.addEventListener('input', () => {
    invalidateInput();
    hideQuote();
    couponInput.removeAttribute('aria-invalid');
    couponStatus.textContent = couponCode() ? 'Apply your code to update the total.' : '';
    action = 'quote';
    message('Review your coupon.', 'Apply the code or remove it to refresh your total.', 'Apply coupon first', true);

    if (!couponCode()) void refreshQuote();
  });

  couponApply.addEventListener('click', () => {
    if (active && !busy) void refreshQuote();
  });

  couponInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();

    if (active && !busy) void refreshQuote();
  });

  couponRemove.addEventListener('click', () => {
    if (!active || busy) return;

    if (document.activeElement === couponRemove) couponSummary.focus({ preventScroll: true });

    invalidateInput();
    couponInput.value = '';
    couponInput.removeAttribute('aria-invalid');
    couponStatus.textContent = '';
    setCouponOpen(false);
    void refreshQuote();
  });

  window.addEventListener('pagehide', () => {
    active = false;
    window.clearTimeout(refreshTimer);
    abort?.abort();
    operation += 1;
    busy = false;
    hideQuote();
    payment.disabled = true;
  });

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;

    active = true;
    void checkAvailability();
  });

  renderCoupon();
  void checkAvailability();
}
