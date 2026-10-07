const TEST_REFERENCE = /^devcon26-test-[a-f0-9]{32}$/;
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
  if (!TEST_REFERENCE.test(reference)) throw new Error('Invalid test payment reference.');

  return '/devcon26/payment-confirmation/#reference=' + encodeURIComponent(reference);
}

export function devcon26ConfirmationReference(hash: string): string | null {
  const values = new URLSearchParams(hash.replace(/^#/, '')).getAll('reference');

  return values.length === 1 && TEST_REFERENCE.test(values[0]) ? values[0] : null;
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
      showState('invalid', 'No checkout to confirm.', 'Open this page from your Paystack return to check a payment. This link does not contain a valid test payment reference.');

      return;
    }

    showState('loading', 'Checking your payment.', 'We’re confirming the result with Paystack through EMS. Returning from checkout alone does not confirm a successful payment.');
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
        showState('invalid', 'Checkout not found.', 'We couldn’t find a test checkout for this reference. Return to DevCon26 or contact us if you need help with your test.');

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
        root.querySelector<HTMLElement>('[data-payment-reference]')!.textContent = reference;
        root.querySelector<HTMLImageElement>('[data-payment-photo]')!.src = summary.photo;
        showState('verified', 'Payment confirmed.', 'Your Paystack test payment was successful. Here’s your summary and what to know next.');
      } else if (summary.status === 'pending') {
        showState('pending', 'Your payment is still pending.', 'Paystack hasn’t confirmed success yet. Check the status again; there’s no need to start another payment.', true);
      } else {
        showState('failed', 'Test payment wasn’t successful.', 'No successful test payment was confirmed. You can return to DevCon26 if you’d like to try the sandbox again.');
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
