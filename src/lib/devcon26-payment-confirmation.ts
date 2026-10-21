import { DEVCON26_BUYER_GRANT_SESSION_KEY, DEVCON26_PUBLIC_CHECKOUT_PATH, devcon26Amount, devcon26Quote } from './devcon26-checkout-contract';
import { FLEXIBLE_GRANT_SESSION_KEY } from './devcon26-flexible-checkout';

const COMPLETE_TEST_REFERENCE = /^devcon26-complete-test-[a-f0-9]{32}$/;
const COMPLETE_TEST_VERIFY_PATH = '/api/public/annual-conference/2026/complete-test-checkout/verify';

const TEST_REFERENCE = /^devcon26-test-[a-f0-9]{32}$/;
const BUYER_REFERENCE = /^DC26-[A-F0-9]{32}$/;
const LIVE_REFERENCE = /^devcon26_[a-f0-9]{32}$/;
const PUBLIC_VERIFY_PATH = DEVCON26_PUBLIC_CHECKOUT_PATH + '/verify';
const FLEXIBLE_VERIFY_PATH = DEVCON26_PUBLIC_CHECKOUT_PATH + '/flexible/verify';
const VERIFY_PATH = '/api/public/annual-conference/2026/test-checkout/verify';

const TICKET_PRESENTATION = {
  regular: {
    name: 'Regular ticket',
    quantity: 1,
    photo: '/images/devcon26/ticket-solo.webp',
  },
  team_3: {
    name: 'Team of 3',
    quantity: 3,
    photo: '/images/devcon26/ticket-small-group.webp',
  },
  team_5: {
    name: 'Team of 5',
    quantity: 5,
    photo: '/images/devcon26/ticket-community.webp',
  },
} as const;

type PaymentStatus = 'verified' | 'pending' | 'failed' | 'refund_required';
type PageState = PaymentStatus | 'loading' | 'invalid' | 'error';

export interface TestPaymentSummary {
  status: PaymentStatus;
  ticketName: string;
  quantity: number;
  amount: string;
  baseAmount: string;
  feeAmount: string;
  discountAmount: string;
  coupon: string | null;
  hasDiscount: boolean;
  photo: string;
  buyerGrant?: string;
}

export function devcon26ConfirmationUrl(reference: string): string {
  if (!TEST_REFERENCE.test(reference) && !LIVE_REFERENCE.test(reference) && !COMPLETE_TEST_REFERENCE.test(reference)) throw new Error('Invalid payment reference.');

  return '/devcon26/payment-confirmation/#reference=' + encodeURIComponent(reference);
}

export function devcon26BuyerReference(reference: string): string {
  if (COMPLETE_TEST_REFERENCE.test(reference)) return 'TEST-DC26-' + reference.slice('devcon26-complete-test-'.length).toUpperCase();
  if (LIVE_REFERENCE.test(reference)) return 'DC26-' + reference.slice('devcon26_'.length).toUpperCase();
  if (!TEST_REFERENCE.test(reference)) throw new Error('Invalid payment reference.');

  return 'DC26-' + reference.slice('devcon26-test-'.length).toUpperCase();
}

export function devcon26ConfirmationReference(hash: string): string | null {
  return devcon26ReferenceFromParameters(new URLSearchParams(hash.replace(/^#/, '')));
}

export function devcon26ConfirmationQueryReference(search: string): string | null {
  return devcon26ReferenceFromParameters(new URLSearchParams(search));
}

function devcon26ReferenceFromParameters(parameters: URLSearchParams): string | null {
  const values = parameters.getAll('reference');

  if (values.length !== 1) return null;
  if (COMPLETE_TEST_REFERENCE.test(values[0])) return values[0];
  if (TEST_REFERENCE.test(values[0])) return values[0];
  if (LIVE_REFERENCE.test(values[0])) return values[0];
  if (BUYER_REFERENCE.test(values[0])) return 'devcon26-test-' + values[0].slice('DC26-'.length).toLowerCase();

  return null;
}

export function devcon26VerificationUrl(origin: string): string {
  const api = new URL(origin);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);

  if ((api.protocol !== 'https:' && !(loopback && api.protocol === 'http:'))
    || api.username || api.password || api.pathname !== '/' || api.search || api.hash) {
    throw new Error('Invalid checkout API origin.');
  }

  return new URL(VERIFY_PATH, api.origin).href;
}

export function devcon26TestPaymentSummary(input: unknown): TestPaymentSummary | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const result = input as Record<string, unknown>;

  if (result.mode !== 'test' || typeof result.status !== 'string'
    || !['verified', 'pending', 'failed', 'refund_required'].includes(result.status)
    || typeof result.tier_key !== 'string' || !Object.hasOwn(TICKET_PRESENTATION, result.tier_key)
    || result.currency !== 'GHS' || !Number.isSafeInteger(result.amount_minor)
    || (result.amount_minor as number) <= 0) return null;

  const ticket = TICKET_PRESENTATION[result.tier_key as keyof typeof TICKET_PRESENTATION];
  const quote = devcon26Quote(result, result.tier_key, true);

  if (result.quantity !== ticket.quantity || !quote) return null;

  return {
    status: result.refund_required === true ? 'refund_required' : result.status as PaymentStatus,
    ticketName: ticket.name,
    quantity: result.quantity as number,
    amount: devcon26Amount(quote.final_amount_minor),
    baseAmount: devcon26Amount(quote.base_amount_minor),
    feeAmount: '0.00',
    discountAmount: devcon26Amount(quote.discount_amount_minor),
    coupon: quote.coupon_applied,
    hasDiscount: quote.discount_amount_minor > 0,
    photo: ticket.photo,
  };
}

function livePaymentSummary(input: unknown): (TestPaymentSummary & { buyerGrant: string; canFinishLater: boolean }) | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const result = input as Record<string, unknown>;
  const status = result.status;

  if (result.mode !== 'live' || status !== 'verified' || typeof result.tier_key !== 'string'
    || !Object.hasOwn(TICKET_PRESENTATION, result.tier_key) || result.currency !== 'GHS'
    || !Number.isSafeInteger(result.ticket_amount_minor) || !Number.isSafeInteger(result.amount_paid_minor)
    || (result.amount_paid_minor as number) < (result.ticket_amount_minor as number)
    || typeof result.buyer_grant !== 'string' || !result.buyer_grant
    || typeof result.can_return_later !== 'boolean') return null;

  const ticket = TICKET_PRESENTATION[result.tier_key as keyof typeof TICKET_PRESENTATION];
  const quote = devcon26Quote({
    mode: 'live', tier_key: result.tier_key, quantity: result.quantity, currency: result.currency,
    base_amount_minor: result.ticket_amount_minor, discount_amount_minor: 0,
    final_amount_minor: result.ticket_amount_minor, coupon_applied: null,
  }, result.tier_key, false, 'live');

  if (!quote || result.quantity !== ticket.quantity) return null;

  return {
    status: 'verified', ticketName: ticket.name, quantity: ticket.quantity,
    amount: devcon26Amount(Number(result.amount_paid_minor)),
    baseAmount: devcon26Amount(Number(result.ticket_amount_minor)),
    feeAmount: devcon26Amount(Number(result.amount_paid_minor) - Number(result.ticket_amount_minor)),
    discountAmount: '0.00', coupon: null, hasDiscount: false, photo: ticket.photo,
    buyerGrant: result.buyer_grant,
    canFinishLater: result.can_return_later,
  };
}

function flexiblePaymentSummary(input: unknown, mode: 'live' | 'test' = 'live'): TestPaymentSummary | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const result = input as Record<string, unknown>;

  if (result.mode !== mode || result.status !== 'verified' || result.currency !== 'GHS'
    || !Number.isSafeInteger(result.quantity) || (result.quantity as number) < 1
    || !Number.isSafeInteger(result.ticket_amount_minor) || (result.ticket_amount_minor as number) <= 0
    || !Number.isSafeInteger(result.amount_paid_minor)
    || (result.amount_paid_minor as number) < (result.ticket_amount_minor as number)) return null;

  return {
    status: 'verified',
    ticketName: 'DevCon26 ticket',
    quantity: result.quantity as number,
    amount: devcon26Amount(result.amount_paid_minor as number),
    baseAmount: devcon26Amount(result.ticket_amount_minor as number),
    feeAmount: devcon26Amount((result.amount_paid_minor as number) - (result.ticket_amount_minor as number)),
    discountAmount: 'GHS 0.00',
    coupon: null,
    hasDiscount: false,
    photo: '/images/devcon26/ticket-community.webp',
  };
}

export function initializeDevcon26PaymentConfirmation(
  root: HTMLElement,
  initializeCardPreview: (root: HTMLElement, quantity: number, buyerGrant?: string | null, canFinishLater?: boolean) => void = () => undefined,
): void {
  const title = root.querySelector<HTMLElement>('[data-payment-title]')!;
  const copy = root.querySelector<HTMLElement>('[data-payment-copy]')!;
  const status = root.querySelector<HTMLElement>('[data-payment-status]')!;
  const receipt = root.querySelector<HTMLElement>('[data-payment-receipt]')!;
  const attention = root.querySelector<HTMLElement>('[data-payment-attention]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-payment-retry]')!;
  const print = root.querySelector<HTMLButtonElement>('[data-payment-print]')!;
  let operation = 0;
  let abort: AbortController | undefined;

  function showState(state: PageState, heading: string, description: string, canRetry = false): void {
    root.dataset.paymentState = state;
    title.textContent = heading;
    copy.textContent = description;
    status.setAttribute('aria-busy', String(state === 'loading'));
    receipt.hidden = state !== 'verified';
    attention.hidden = state !== 'refund_required';
    retry.hidden = !canRetry;
    retry.disabled = state === 'loading';
    document.title = heading + ' | DevCon26';
  }

  async function verifyPayment(): Promise<void> {
    abort?.abort();
    const controller = new AbortController();

    abort = controller;
    const current = ++operation;
    const reference = devcon26ConfirmationQueryReference(window.location.search)
      ?? devcon26ConfirmationReference(window.location.hash);

    if (!reference) {
      showState('invalid', 'No checkout to confirm.', 'Open the confirmation link from your checkout, or contact us with your payment reference.');

      return;
    }

    const buyerUrl = devcon26ConfirmationUrl(reference);
    const buyerHash = buyerUrl.slice(buyerUrl.indexOf('#'));

    if (window.location.hash !== buyerHash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + buyerHash);
    }

    showState('loading', 'Checking your payment.', 'Just a moment while we confirm your payment with Paystack.');
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const completeTest = COMPLETE_TEST_REFERENCE.test(reference);
      const liveCheckout = LIVE_REFERENCE.test(reference);
      let flexibleGrant: { reference: string; checkout_grant: string; checkout_verifier: string } | null = null;
      let buyerGrant: { reference: string; buyer_grant: string; buyer_verifier: string } | null = null;

      if (liveCheckout || completeTest) {
        try {
          const stored = JSON.parse(sessionStorage.getItem(FLEXIBLE_GRANT_SESSION_KEY) ?? 'null') as Record<string, unknown> | null;

          if (stored && stored.reference === reference && typeof stored.checkout_grant === 'string'
            && typeof stored.checkout_verifier === 'string') {
            flexibleGrant = {
              reference,
              checkout_grant: stored.checkout_grant,
              checkout_verifier: stored.checkout_verifier,
            };
          }
        } catch {
          flexibleGrant = null;
        }

        if (!flexibleGrant) {
        try {
          const stored = JSON.parse(sessionStorage.getItem(DEVCON26_BUYER_GRANT_SESSION_KEY) ?? 'null') as Record<string, unknown> | null;

          if (stored && stored.reference === reference && typeof stored.buyer_grant === 'string'
            && typeof stored.buyer_verifier === 'string') {
            buyerGrant = {
              reference,
              buyer_grant: stored.buyer_grant,
              buyer_verifier: stored.buyer_verifier,
            };
          }
        } catch {
          buyerGrant = null;
        }
        }

        if (!buyerGrant && !flexibleGrant) throw new Error('Secure checkout access is unavailable in this browser session.');
      }

      const verifyPath = completeTest ? COMPLETE_TEST_VERIFY_PATH : flexibleGrant ? FLEXIBLE_VERIFY_PATH : liveCheckout ? PUBLIC_VERIFY_PATH : VERIFY_PATH;
      const response = await fetch(devcon26VerificationUrl(root.dataset.checkoutApiOrigin!).replace(VERIFY_PATH, verifyPath), {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flexibleGrant ?? (liveCheckout ? { ...buyerGrant, reference } : { reference })),
        signal: controller.signal,
      });

      if (current !== operation) return;
      if (response.status === 404) {
        showState('invalid', 'Checkout not found.', 'We couldn’t find a payment for this reference. Return to DevCon26 or contact us for help.');

        return;
      }
      if (!response.ok) throw new Error('Verification unavailable.');

      const payload = await response.json();

      if ((liveCheckout || completeTest) && payload && typeof payload === 'object' && (payload as Record<string, unknown>).mode === (completeTest ? 'test' : 'live')) {
        const liveStatus = (payload as Record<string, unknown>).status;

        if (liveStatus === 'refund_required') {
          root.querySelector<HTMLElement>('[data-attention-reference]')!.textContent = devcon26BuyerReference(reference);
          showState('refund_required', 'Your payment needs attention.', 'We couldn’t complete this payment safely. Contact the event team with the reference below so they can review it. Please don’t start another payment while this is being resolved.', true);

          return;
        }

        if (liveStatus === 'pending') {
          showState('pending', 'Your payment is still pending.', 'Paystack hasn’t confirmed success yet. Check the status again; there’s no need to start another payment.', true);

          return;
        }

        if (liveStatus === 'failed') {
          showState('failed', 'Payment wasn’t successful.', 'No successful payment was confirmed. Return to DevCon26 when you’re ready to try again.');

          return;
        }
      }
      const summary = flexibleGrant ? flexiblePaymentSummary(payload, completeTest ? 'test' : 'live')
        : liveCheckout ? livePaymentSummary(payload) : devcon26TestPaymentSummary(payload);

      if (current !== operation) return;
      if (!summary) throw new Error('Invalid verification result.');

      if (summary.status === 'verified') {
        root.querySelector<HTMLElement>('[data-payment-ticket]')!.textContent = summary.ticketName;
        root.querySelector<HTMLElement>('[data-payment-quantity]')!.textContent = summary.quantity + (summary.quantity === 1 ? ' person' : ' people');
        root.querySelector<HTMLElement>('[data-payment-amount]')!.textContent = summary.amount;
        root.querySelector<HTMLElement>('[data-payment-base]')!.textContent = summary.baseAmount;
        root.querySelector<HTMLElement>('[data-payment-fee]')!.textContent = summary.feeAmount;
        root.querySelector<HTMLElement>('[data-payment-fee-row]')!.hidden = !liveCheckout || summary.feeAmount === 'GHS 0.00';
        root.querySelector<HTMLElement>('[data-payment-discount]')!.textContent = '−' + summary.discountAmount;
        root.querySelector<HTMLElement>('[data-payment-coupon]')!.textContent = summary.coupon || '';
        root.querySelector<HTMLElement>('[data-payment-discount-row]')!.hidden = !summary.hasDiscount;
        root.querySelector<HTMLElement>('[data-payment-reference]')!.textContent = devcon26BuyerReference(reference);
        root.querySelector<HTMLImageElement>('[data-payment-photo]')!.src = summary.photo;
        if (!flexibleGrant) {
          initializeCardPreview(root, summary.quantity, liveCheckout ? summary.buyerGrant : null, liveCheckout && summary.canFinishLater);
        }
        showState('verified', completeTest ? 'Test payment confirmed.' : 'Payment confirmed.', completeTest
          ? 'No money was charged. Your test ticket and badge emails are queued. Use the private links in your inbox to continue testing; test tickets are not valid for admission.'
          : flexibleGrant
          ? 'Your payment is verified. Keep this payment record for your reference; it is not an admission ticket.'
          : 'All done. Your payment was successful, and the details are right here whenever you need them.');
      } else if (summary.status === 'refund_required') {
        root.querySelector<HTMLElement>('[data-attention-reference]')!.textContent = devcon26BuyerReference(reference);
        root.querySelector<HTMLElement>('[data-attention-amount]')!.textContent = summary.amount;
        showState('refund_required', 'Your payment needs attention.', 'We couldn’t complete this payment safely. Contact the event team with the reference below so they can review it. Please don’t start another payment while this is being resolved.', true);
      } else if (summary.status === 'pending') {
        showState('pending', 'Your payment is still pending.', 'Paystack hasn’t confirmed success yet. Check the status again; there’s no need to start another payment.', true);
      } else {
        showState('failed', 'Payment wasn’t successful.', 'No successful payment was confirmed. Return to DevCon26 when you’re ready to try again.');
      }
    } catch {
      if (current !== operation) return;

      showState('error', 'We couldn’t confirm the payment yet.', 'Verification is temporarily unavailable. Check the status again before starting another payment. This retry only checks the existing payment.', true);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  retry.addEventListener('click', () => {
    if (root.dataset.paymentState !== 'loading') void verifyPayment();
  });

  print.hidden = false;
  print.addEventListener('click', () => {
    if (root.dataset.paymentState === 'verified') window.print();
  });

  window.addEventListener('hashchange', () => void verifyPayment());
  window.addEventListener('pagehide', () => {
    operation += 1;
    abort?.abort();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void verifyPayment();
  });

  void verifyPayment();
}
