import {
  loadInttegro,
  type CheckoutAppearance,
  type CheckoutController,
  type CheckoutOrder,
} from '@inttegro/js';

const orderPattern = /^or_[A-Za-z0-9]{20,128}$/;
const intentPattern = /^sale_[A-Za-z0-9]{20,128}$/;
const checkoutAppearance = {
  theme: 'light',
  colors: {
    background: '#FFFFFF',
    surface: '#F5F2E8',
    foreground: '#111111',
    mutedForeground: '#555555',
    border: '#E0DDD4',
    focus: '#E8117F',
  },
  button: {
    background: '#E8117F',
    foreground: '#FFFFFF',
    border: '#111111',
  },
  input: {
    background: '#FFFFFF',
    foreground: '#111111',
    border: '#111111',
  },
  selection: {
    background: '#FEFCE8',
    foreground: '#111111',
    border: '#111111',
  },
  typography: {
    fontFamily: 'sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
} satisfies CheckoutAppearance;

export function initializeDonationCheckout(root: ParentNode = document): void {
  const page = root.querySelector<HTMLElement>('[data-donation-page]');
  if (!page || page.dataset.initialized === 'true') return;

  const configuredIntent = page.dataset.purchaseIntentId?.trim();
  if (!configuredIntent || !intentPattern.test(configuredIntent)) return;

  const purchaseIntentId: string = configuredIntent;

  page.dataset.initialized = 'true';

  const frame = page.querySelector<HTMLElement>('[data-checkout-frame]')!;
  const status = page.querySelector<HTMLElement>('[data-checkout-status]')!;
  const warning = page.querySelector<HTMLElement>('[data-storage-warning]')!;
  const reference = page.querySelector<HTMLElement>('[data-order-reference]')!;
  const retry = page.querySelector<HTMLButtonElement>('[data-checkout-retry]')!;
  const fallback = page.querySelector<HTMLAnchorElement>('[data-checkout-fallback]')!;
  const restart = page.querySelector<HTMLDetailsElement>('[data-checkout-restart]')!;
  const acknowledge = page.querySelector<HTMLInputElement>('[data-restart-acknowledge]')!;
  const startNew = page.querySelector<HTMLButtonElement>('[data-start-new]')!;
  const key = `devcongress.inttegro.order:${purchaseIntentId}`;
  let orderId: string | undefined;
  let controller: CheckoutController | undefined;
  let busy = false;
  let pending = false;
  let generation = 0;
  let eventVersion = 0;

  function storageWarning(): void {
    warning.hidden = false;
  }

  try {
    const stored = window.sessionStorage.getItem(key)?.trim();
    if (stored && orderPattern.test(stored)) orderId = stored;

    // Probe writes too: reading may work when quota/privacy rules prevent saving.
    window.sessionStorage.setItem(`${key}:probe`, '1');
    window.sessionStorage.removeItem(`${key}:probe`);
  } catch {
    storageWarning();
  }

  function updateControls(): void {
    retry.disabled = busy;
    restart.hidden = !orderId || pending || busy;
    fallback.hidden = Boolean(orderId) || busy || retry.hidden;
    startNew.disabled = busy || pending || !acknowledge.checked;
    reference.hidden = !orderId;
    reference.textContent = orderId ? `Donation reference: ${orderId}` : '';
    frame.setAttribute('aria-busy', String(busy));
  }

  function announce(message: string): void {
    eventVersion += 1;
    status.textContent = message;
    updateControls();
  }

  function remember(order: CheckoutOrder): void {
    if (!orderPattern.test(order.id)) return;

    orderId = order.id;

    try {
      window.sessionStorage.setItem(key, order.id);
    } catch {
      storageWarning();
    }

    pending = ['requires_action', 'processing'].includes(order.status);
    updateControls();
  }

  function showOrder(order: CheckoutOrder): void {
    remember(order);

    const messages: Record<CheckoutOrder['status'], string> = {
      requires_payment: 'Your donation is ready. Complete payment below.',
      requires_action: 'Your payment needs confirmation. Follow the instructions below; do not start another donation.',
      processing: 'Your payment is processing. Keep this reference and check this donation again before paying again.',
      paid: 'Thank you for supporting DevCongress. Your payment is confirmed. Your receipt is available in checkout below.',
      failed: 'This payment attempt failed. Review the checkout below before trying again.',
      expired: 'This order has expired. Check any pending payment before starting a new donation.',
      canceled: 'This order was canceled. Check any pending payment before starting a new donation.',
    };

    announce(messages[order.status]);
  }

  async function mount(): Promise<void> {
    if (busy) return;

    busy = true;
    const currentGeneration = ++generation;
    controller?.destroy();
    controller = undefined;
    frame.replaceChildren();
    retry.hidden = true;
    announce(orderId ? 'Checking your existing donation…' : 'Loading secure checkout…');
    const beforeMount = eventVersion;

    try {
      const inttegro = await loadInttegro();
      if (!inttegro || currentGeneration !== generation) return;

      const checkout = inttegro.createCheckout({
        ...(orderId ? { orderId } : { purchaseIntentId }),
        appearance: checkoutAppearance,
        features: {
          showLineItems: true,
          showInvoiceDownload: true,
          showReceiptDownload: true,
          allowPaymentMethodChange: true,
        },
        locale: 'en-GH',
        title: 'Support DevCongress',
      });
      controller = checkout;

      checkout.onEvent((event) => {
        if (currentGeneration !== generation) return;

        if ('order' in event && event.order) showOrder(event.order);

        if (event.type === 'paymentAttemptStarted' || event.type === 'paymentProcessing' || event.type === 'paymentActionRequired') {
          pending = true;
          announce('Payment is in progress. Follow the checkout instructions. Check this donation before making another payment.');
        } else if (event.type === 'failed') {
          retry.hidden = false;
          announce('We could not confirm the checkout status. Retry this checkout; your saved donation reference has been kept.');
        } else if (event.type === 'canceled') {
          retry.hidden = false;
          announce('Checkout was closed. Reopen this checkout to check its status before paying again.');
        }
      });

      await checkout.mount(frame);

      if (currentGeneration === generation && eventVersion === beforeMount) {
        announce(orderId
          ? 'Existing donation reopened. Review its current status below before paying again.'
          : 'Choose your amount and enter your details below.');
      }
    } catch {
      if (currentGeneration !== generation) return;

      retry.hidden = false;
      announce(orderId
        ? 'Your donation could not be loaded. Retry to check the same order. Do not pay again until its status is clear.'
        : 'Secure checkout could not load. Try again or use the hosted checkout.');
    } finally {
      if (currentGeneration === generation) {
        busy = false;
        updateControls();
      }
    }
  }

  retry.addEventListener('click', () => { void mount(); });
  acknowledge.addEventListener('change', updateControls);
  startNew.addEventListener('click', () => {
    if (busy || pending || !acknowledge.checked) return;

    try {
      // Do not silently restart if the old reference cannot be removed.
      window.sessionStorage.removeItem(key);
    } catch {
      storageWarning();
      announce('Your browser could not clear this checkout. Keep your reference and contact us for help.');
      return;
    }

    orderId = undefined;
    acknowledge.checked = false;
    restart.open = false;
    void mount();
  });

  void mount();
}
