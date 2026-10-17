import { loadInttegro, type CheckoutController } from '@inttegro/js';

const configSelector = '[data-donation-checkout-config]';
const triggerSelector = '[data-donation-checkout-trigger]';
const modalHostSelector = '[data-inttegro-checkout-modal]';
const modalOpenClass = 'donation-checkout-open';
const closeOnlyMarker = 'donationCloseOnly';
const checkoutProtocol = 'inttegro.checkout';
const purchaseIntentPattern = /^sale_[A-Za-z0-9]{20,128}$/;

function requireExplicitModalClose(host: HTMLElement): void {
  if (host.dataset[closeOnlyMarker] === 'true') return;

  const root = host.shadowRoot;
  const dialog = root?.querySelector<HTMLDialogElement>('dialog');
  if (!root || !dialog) return;

  host.dataset[closeOnlyMarker] = 'true';

  const preventDismissal = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  root.addEventListener('cancel', preventDismissal, { capture: true });
  root.addEventListener('pointerdown', (event) => {
    if (event.target === dialog) preventDismissal(event);
  }, { capture: true });
  host.addEventListener('pointerdown', (event) => {
    if (event.target === host) preventDismissal(event);
  }, { capture: true });
}

function preventFrameDismissal(event: MessageEvent<unknown>): void {
  const host = document.body.querySelector<HTMLElement>(modalHostSelector);
  const frame = host?.shadowRoot?.querySelector<HTMLIFrameElement>(
    'iframe[data-inttegro-checkout]',
  );
  const message = event.data;

  if (
    !host
    || !frame
    || typeof message !== 'object'
    || message === null
    || event.source !== frame.contentWindow
    || event.origin !== new URL(frame.src).origin
    || !('channel' in message)
    || message.channel !== checkoutProtocol
    || !('instanceId' in message)
    || message.instanceId !== host.dataset.inttegroCheckoutModal
    || !('type' in message)
    || message.type !== 'frame.dismiss'
  ) return;

  event.stopImmediatePropagation();
}

export function initializeDonationCheckout(root: ParentNode = document): void {
  const config = root.querySelector<HTMLElement>(configSelector);
  if (!config || config.dataset.donationCheckoutInitialized === 'true') return;

  const purchaseIntentId = config.dataset.purchaseIntentId?.trim();
  const fallbackPath = config.dataset.fallbackPath?.trim();
  const triggers = Array.from(root.querySelectorAll<HTMLAnchorElement>(triggerSelector));
  if (
    !purchaseIntentId
    || !purchaseIntentPattern.test(purchaseIntentId)
    || !fallbackPath?.startsWith('/')
    || fallbackPath.startsWith('//')
    || triggers.length === 0
  ) return;

  config.dataset.donationCheckoutInitialized = 'true';

  const status = config.querySelector<HTMLElement>('[data-donation-checkout-status]');
  let controller: CheckoutController | undefined;
  let controllerPromise: Promise<CheckoutController> | undefined;
  let presenting = false;
  let canceledDuringPresentation = false;

  const modalObserver = new MutationObserver(() => {
    const modalHost = document.body.querySelector<HTMLElement>(modalHostSelector);
    if (modalHost) requireExplicitModalClose(modalHost);

    document.body.classList.toggle(
      modalOpenClass,
      Boolean(modalHost),
    );
  });
  modalObserver.observe(document.body, { childList: true });
  window.addEventListener('message', preventFrameDismissal, { capture: true });

  function announce(message: string): void {
    if (status) status.textContent = message;
  }

  function setBusy(busy: boolean): void {
    for (const trigger of triggers) {
      trigger.setAttribute('aria-busy', String(busy));
    }
  }

  function checkoutController(): Promise<CheckoutController> {
    if (controller) return Promise.resolve(controller);
    if (controllerPromise) return controllerPromise;

    controllerPromise = loadInttegro()
      .then((inttegro) => {
        if (!inttegro) throw new Error('Inttegro Checkout requires a browser.');

        controller = inttegro.createCheckout({
          purchaseIntentId,
          appearance: {
            primaryColor: '#E8117F',
            theme: 'dark',
          },
          features: {
            showLineItems: true,
            showInvoiceDownload: true,
            showReceiptDownload: true,
            allowPaymentMethodChange: true,
          },
          locale: 'en-GH',
          title: 'Support DevCongress',
        });

        controller.on('canceled', () => {
          canceledDuringPresentation = true;
          announce('Donation checkout closed. You can reopen it when you are ready.');
          setBusy(false);
        });
        controller.on('completed', () => {
          announce('Thank you for supporting DevCongress.');
          setBusy(false);
        });
        controller.on('failed', ({ failure }) => {
          announce(failure.recoverable
            ? 'Donation checkout needs your attention. Please try again.'
            : 'Donation checkout is unavailable. Please try again later.');
          setBusy(false);
        });

        return controller;
      })
      .catch((error) => {
        controllerPromise = undefined;
        throw error;
      });

    return controllerPromise;
  }

  async function presentCheckout(event: MouseEvent): Promise<void> {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;

    event.preventDefault();
    if (presenting) return;

    presenting = true;
    canceledDuringPresentation = false;
    setBusy(true);
    announce('Opening secure donation checkout.');

    try {
      const checkout = await checkoutController();
      if (checkout.state === 'ready') {
        checkout.focus();
        return;
      }
      await checkout.present();
      announce('Secure donation checkout is open.');
    } catch {
      if (canceledDuringPresentation) return;

      document.body.classList.remove(modalOpenClass);
      announce('Opening the secure donation page instead.');
      window.location.assign(fallbackPath);
    } finally {
      presenting = false;
      setBusy(false);
    }
  }

  for (const trigger of triggers) {
    trigger.addEventListener('click', (event) => {
      void presentCheckout(event);
    });
  }
}
