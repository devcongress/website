const TEST_REFERENCE = /^devcon26-test-[a-f0-9]{32}$/;
const BUYER_REFERENCE = /^DC26-[A-F0-9]{32}$/;
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

type PaymentStatus = 'verified' | 'pending' | 'failed';
type PageState = PaymentStatus | 'loading' | 'invalid' | 'error';

export interface TestPaymentSummary {
  status: PaymentStatus;
  ticketName: string;
  quantity: number;
  amount: string;
  photo: string;
}

export function devcon26ConfirmationUrl(reference: string): string {
  return '/devcon26/payment-confirmation/#reference=' + devcon26BuyerReference(reference);
}

export function devcon26BuyerReference(reference: string): string {
  if (!TEST_REFERENCE.test(reference)) throw new Error('Invalid payment reference.');

  return 'DC26-' + reference.slice('devcon26-test-'.length).toUpperCase();
}

export function devcon26ConfirmationReference(hash: string): string | null {
  const values = new URLSearchParams(hash.replace(/^#/, '')).getAll('reference');

  if (values.length !== 1) return null;
  if (TEST_REFERENCE.test(values[0])) return values[0];
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
    || !['verified', 'pending', 'failed'].includes(result.status)
    || typeof result.tier_key !== 'string' || !Object.hasOwn(TICKET_PRESENTATION, result.tier_key)
    || result.currency !== 'GHS' || !Number.isSafeInteger(result.amount_minor)
    || (result.amount_minor as number) <= 0) return null;

  const ticket = TICKET_PRESENTATION[result.tier_key as keyof typeof TICKET_PRESENTATION];

  if (result.quantity !== ticket.quantity) return null;

  const amount = new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((result.amount_minor as number) / 100);

  return {
    status: result.status as PaymentStatus,
    ticketName: ticket.name,
    quantity: result.quantity as number,
    amount: 'GHS ' + amount,
    photo: ticket.photo,
  };
}

export function initializeDevcon26PaymentConfirmation(root: HTMLElement): void {
  const title = root.querySelector<HTMLElement>('[data-payment-title]')!;
  const copy = root.querySelector<HTMLElement>('[data-payment-copy]')!;
  const status = root.querySelector<HTMLElement>('[data-payment-status]')!;
  const receipt = root.querySelector<HTMLElement>('[data-payment-receipt]')!;
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
    retry.hidden = !canRetry;
    retry.disabled = state === 'loading';
    document.title = heading + ' | DevCon26';
  }

  async function verifyPayment(): Promise<void> {
    abort?.abort();
    const controller = new AbortController();

    abort = controller;
    const current = ++operation;
    const reference = devcon26ConfirmationReference(window.location.hash);

    if (!reference) {
      showState('invalid', 'No checkout to confirm.', 'Open the confirmation link from your checkout, or contact us with your payment reference.');

      return;
    }

    const buyerUrl = devcon26ConfirmationUrl(reference);
    const buyerHash = buyerUrl.slice(buyerUrl.indexOf('#'));

    if (window.location.hash !== buyerHash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + buyerHash);
    }

    showState('loading', 'Checking your payment.', 'Just a moment while we confirm your payment with Paystack.');
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(devcon26VerificationUrl(root.dataset.checkoutApiOrigin!), {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
        signal: controller.signal,
      });

      if (current !== operation) return;
      if (response.status === 404) {
        showState('invalid', 'Checkout not found.', 'We couldn’t find a payment for this reference. Return to DevCon26 or contact us for help.');

        return;
      }
      if (!response.ok) throw new Error('Verification unavailable.');

      const summary = devcon26TestPaymentSummary(await response.json());

      if (current !== operation) return;
      if (!summary) throw new Error('Invalid verification result.');

      if (summary.status === 'verified') {
        root.querySelector<HTMLElement>('[data-payment-ticket]')!.textContent = summary.ticketName;
        root.querySelector<HTMLElement>('[data-payment-quantity]')!.textContent = summary.quantity + (summary.quantity === 1 ? ' person' : ' people');
        root.querySelector<HTMLElement>('[data-payment-amount]')!.textContent = summary.amount;
        root.querySelector<HTMLElement>('[data-payment-reference]')!.textContent = devcon26BuyerReference(reference);
        root.querySelector<HTMLImageElement>('[data-payment-photo]')!.src = summary.photo;
        showState('verified', 'Payment confirmed.', 'All done. Your payment was successful, and the details are right here whenever you need them.');
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
