import { devcon26Amount } from './devcon26-checkout-contract';

const COMPLETE_TEST_PATH = '/api/public/annual-conference/2026/complete-test-checkout';
const LIVE_PATH = '/api/public/annual-conference/2026/checkout';
export const FLEXIBLE_GRANT_SESSION_KEY = 'devcon26-flexible-checkout-grant-v1';

type AllocationKind = 'self' | 'gift' | 'community_managed' | 'community_shareable';

interface Allocation {
  kind: AllocationKind;
  recipient_email?: string;
}

interface AllocationChoice {
  kind: AllocationKind;
  label: string;
  description: string;
}

interface LiveCatalog {
  unitAmountMinor: number;
  maxPerPayment: number;
  provider: 'paystack';
}

const ALLOCATION_CHOICES: AllocationChoice[] = [
  { kind: 'self', label: 'My ticket', description: 'Keep this place for yourself' },
  { kind: 'gift', label: 'Private gift', description: 'Send it directly by email' },
  { kind: 'community_managed', label: 'Community pool', description: 'Let the organizers assign this place' },
  { kind: 'community_shareable', label: 'Shareable claim', description: 'Get a private link to share later' },
];

function apiOrigin(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Checkout API origin is invalid.');
  }

  return url.origin;
}

async function api(origin: string, path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(new URL(path, origin), {
      method: body ? 'POST' : 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Checkout response unavailable (HTTP ' + response.status + ').');
    }

    return payload as Record<string, unknown>;
  } finally {
    window.clearTimeout(timeout);
  }
}

function liveCatalog(payload: Record<string, unknown>, mode: 'live' | 'test'): LiveCatalog | null {
  const flexible = payload.flexible_checkout as Record<string, unknown> | undefined;
  const providers = payload.payment_providers;

  if (payload.mode !== mode || payload.currency !== 'GHS' || !flexible || flexible.mode !== mode
    || !Number.isSafeInteger(flexible.unit_amount_minor) || (flexible.unit_amount_minor as number) <= 0
    || !Number.isSafeInteger(flexible.max_per_payment) || (flexible.max_per_payment as number) < 1
    || !Array.isArray(providers) || providers.length !== 1 || providers[0]?.key !== 'paystack') return null;

  return {
    unitAmountMinor: flexible.unit_amount_minor as number,
    maxPerPayment: flexible.max_per_payment as number,
    provider: 'paystack',
  };
}

function paystackUrl(value: unknown): URL {
  if (typeof value !== 'string') throw new Error('Invalid payment destination.');

  const url = new URL(value);

  if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com'
    || url.username || url.password || url.port) throw new Error('Invalid payment destination.');

  return url;
}

export function initializeFlexibleCheckout(page: HTMLElement): void {
  const completeTest = page.dataset.completeTest === 'true';
  const mode = completeTest ? 'test' : 'live';
  const catalogPath = completeTest ? COMPLETE_TEST_PATH : LIVE_PATH;
  const initializePath = completeTest ? COMPLETE_TEST_PATH + '/initialize' : LIVE_PATH + '/flexible/initialize';
  const form = page.querySelector<HTMLFormElement>('[data-live-form]')!;
  const quantity = page.querySelector<HTMLInputElement>('[data-quantity]')!;
  const rows = page.querySelector<HTMLElement>('[data-allocation-list]')!;
  const name = page.querySelector<HTMLInputElement>('[data-name]')!;
  const email = page.querySelector<HTMLInputElement>('[data-email]')!;
  const pay = page.querySelector<HTMLButtonElement>('[data-pay]')!;
  const retry = page.querySelector<HTMLButtonElement>('[data-retry]')!;
  const status = page.querySelector<HTMLElement>('[data-status]')!;
  const availability = page.querySelector<HTMLElement>('[data-availability]')!;
  const availabilityHeading = page.querySelector<HTMLElement>('[data-availability-heading]')!;
  const availabilityMessage = page.querySelector<HTMLElement>('[data-availability-message]')!;
  const checkoutLayout = page.querySelector<HTMLElement>('[data-checkout-layout]')!;
  const steps = Array.from(page.querySelectorAll<HTMLElement>('[data-checkout-step]'));
  const stepLinks = Array.from(page.querySelectorAll<HTMLButtonElement>('[data-step-link]'));
  let currentStep = 0;
  let challengeRendered = false;
  let origin: string;
  let catalog: LiveCatalog | null = null;
  let allocations: Allocation[] = [{ kind: 'self' }];
  let liveBusy = false;
  let liveRequestKey: string | undefined;

  try {
    origin = apiOrigin(page.dataset.apiOrigin ?? '');
  } catch {
    status.textContent = 'Checkout configuration is unavailable.';
    availabilityHeading.textContent = 'Ticket checkout is unavailable';
    availabilityMessage.textContent = 'We couldn’t load checkout. Please try again later.';

    return;
  }

  function invalidateLiveRequest(): void {
    liveRequestKey = undefined;
    updateStepContext();
  }

  function updateStepContext(): void {
    const titles = ['Your ticket choices', 'Your order contact', 'Ready to check out'];
    const descriptions = [
      'Each ticket follows the choice you make here.',
      'Your order confirmation goes to this contact. Gift tickets go to their recipients.',
      'Check your contact and ticket choices. Ticket and badge delivery follows payment.',
    ];
    const items: string[] = [];

    if (currentStep > 0) {
      items.push(name.value.trim() || 'Your name');
      items.push(email.value.trim() || 'Your email address');
    }

    if (currentStep !== 1) {
      allocations.forEach((allocation, index) => {
        const choice = ALLOCATION_CHOICES.find((option) => option.kind === allocation.kind)!;
        const recipient = allocation.kind === 'gift' && allocation.recipient_email
          ? ' · ' + allocation.recipient_email : '';

        items.push('Ticket ' + (index + 1) + ' · ' + choice.label + recipient);
      });
    }

    page.querySelector<HTMLElement>('[data-context-label]')!.textContent = titles[currentStep];
    page.querySelector<HTMLElement>('[data-context-description]')!.textContent = descriptions[currentStep];
    const list = page.querySelector<HTMLElement>('[data-context-items]')!;

    list.replaceChildren(...items.map((text) => {
      const item = document.createElement('li');

      item.textContent = text;

      return item;
    }));
    stepLinks.forEach((button, index) => {
      button.disabled = liveBusy || !catalog || index > currentStep;
    });
    page.querySelectorAll<HTMLButtonElement>('[data-step-next], [data-step-back]').forEach((button) => {
      button.disabled = liveBusy || !catalog;
    });
  }

  function renderChallenge(): void {
    if (!completeTest || currentStep !== 2 || challengeRendered) return;

    const challenge = page.querySelector<HTMLElement>('[data-checkout-challenge]');
    const turnstile = (window as unknown as {
      turnstile?: { render: (container: HTMLElement, options: { sitekey: string; action: string }) => string };
    }).turnstile;

    if (!challenge || !turnstile) return;

    turnstile.render(challenge, {
      sitekey: challenge.dataset.sitekey!,
      action: 'devcon26_complete_test_checkout',
    });
    challengeRendered = true;
  }

  document.querySelector('script[src*="challenges.cloudflare.com/turnstile/"]')
    ?.addEventListener('load', renderChallenge);

  function showStep(index: number, focus = true): void {
    const direction = index >= currentStep ? 1 : -1;

    currentStep = index;
    steps.forEach((section, position) => {
      section.hidden = position !== index;
    });
    stepLinks.forEach((button, position) => {
      button.dataset.complete = String(position < index);
      const marker = button.querySelector('span');

      if (marker) marker.textContent = position < index ? '✓' : String(position + 1).padStart(2, '0');
      if (position === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    updateStepContext();
    renderChallenge();

    if (focus) {
      steps[index].querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      steps[index].scrollIntoView({ block: 'nearest' });

      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        steps[index].getAnimations().forEach((animation) => animation.cancel());
        steps[index].animate([
          { opacity: 0, transform: 'translateX(' + direction * 8 + 'px)' },
          { opacity: 1, transform: 'translateX(0)' },
        ], { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      }
    }
  }

  function validateStep(index: number): boolean {
    if (index === 0 && Number(quantity.value) !== allocations.length) setQuantity(Number(quantity.value));
    if (index === 1) name.setCustomValidity(name.value.trim() ? '' : 'Enter your full name.');

    const inputs = Array.from(steps[index].querySelectorAll<HTMLInputElement>('input:not([type="hidden"])'));
    const invalid = inputs.find((input) => !input.checkValidity());

    if (invalid) {
      showStep(index, false);
      invalid.reportValidity();

      return false;
    }

    return index !== 0 || Number(quantity.value) === allocations.length;
  }

  function nextStep(): void {
    if (!catalog || liveBusy || currentStep >= 2 || !validateStep(currentStep)) return;

    showStep(currentStep + 1);
  }

  page.querySelectorAll<HTMLButtonElement>('[data-step-next]').forEach((button) => {
    button.addEventListener('click', nextStep);
  });
  page.querySelectorAll<HTMLButtonElement>('[data-step-back]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!liveBusy && currentStep > 0) showStep(currentStep - 1);
    });
  });
  stepLinks.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (!liveBusy && catalog && index < currentStep) showStep(index);
    });
  });

  function chooseAllocation(index: number, kind: AllocationKind): void {
    if (!catalog || liveBusy) return;
    if (kind === 'self' && allocations.some((allocation, other) => other !== index && allocation.kind === 'self')) return;

    const previous = allocations[index];

    allocations[index] = kind === 'gift'
      ? { kind, recipient_email: previous.recipient_email ?? '' }
      : { kind };
    invalidateLiveRequest();
    renderRows();
    rows.querySelector<HTMLInputElement>(`[data-choice-ticket="${index}"][value="${kind}"]`)?.focus({ preventScroll: true });
  }

  function renderRows(): void {
    const fragment = document.createDocumentFragment();
    const selfIndex = allocations.findIndex((allocation) => allocation.kind === 'self');


    allocations.forEach((allocation, index) => {
      const row = document.createElement('fieldset');
      const legend = document.createElement('legend');
      const choices = document.createElement('div');
      const helper = document.createElement('p');
      const helperId = 'ticket-choice-help-' + index;
      const shortLabels: Record<AllocationKind, string> = {
        self: 'For me',
        gift: 'A gift',
        community_managed: 'Community',
        community_shareable: 'Share a link',
      };

      row.className = 'ticket-choice-row';
      legend.textContent = 'Ticket ' + (index + 1);
      choices.className = 'ticket-choices';
      helper.className = 'ticket-choice-help';
      helper.id = helperId;
      helper.textContent = ALLOCATION_CHOICES.find((choice) => choice.kind === allocation.kind)!.description + '.';

      if (selfIndex !== -1 && selfIndex !== index) {
        helper.textContent += ' Your own place is Ticket ' + (selfIndex + 1) + '.';
      }

      ALLOCATION_CHOICES.forEach((choice) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        const labelText = document.createElement('span');
        const unavailable = choice.kind === 'self' && selfIndex !== -1 && selfIndex !== index;

        label.className = 'ticket-choice';
        radio.type = 'radio';
        radio.name = 'ticket-choice-' + index;
        radio.value = choice.kind;
        radio.checked = choice.kind === allocation.kind;
        radio.disabled = !catalog || liveBusy || unavailable;
        radio.dataset.choiceTicket = String(index);
        radio.setAttribute('aria-describedby', helperId);
        labelText.textContent = shortLabels[choice.kind];

        if (unavailable) {
          radio.setAttribute('aria-label', 'For me — already assigned to another ticket');
          label.title = 'You already have a ticket for yourself.';
        }

        radio.addEventListener('change', () => {
          if (radio.checked) chooseAllocation(index, choice.kind);
        });
        label.append(radio, labelText);
        choices.append(label);
      });

      row.append(legend, choices, helper);

      if (allocation.kind === 'gift') {
        const gift = document.createElement('input');

        gift.className = 'gift-email';
        gift.type = 'email';
        gift.maxLength = 254;
        gift.required = true;
        gift.placeholder = 'Recipient email address';
        gift.autocomplete = 'off';
        gift.value = allocation.recipient_email ?? '';
        gift.setAttribute('aria-label', 'Gift recipient email for ticket ' + (index + 1));
        gift.addEventListener('input', () => {
          allocations[index].recipient_email = gift.value.trim().toLowerCase();
          invalidateLiveRequest();
        });
        row.append(gift);
      }

      fragment.append(row);
    });

    rows.replaceChildren(fragment);
    updateStepContext();
    page.querySelector<HTMLElement>('[data-summary-quantity]')!.textContent = String(allocations.length);
    page.querySelector<HTMLElement>('[data-total]')!.textContent = catalog
      ? devcon26Amount(catalog.unitAmountMinor * allocations.length) : '—';
    page.querySelector<HTMLButtonElement>('[data-decrease]')!.disabled = !catalog || liveBusy || allocations.length <= 1;
    page.querySelector<HTMLButtonElement>('[data-increase]')!.disabled = !catalog || liveBusy || allocations.length >= (catalog?.maxPerPayment ?? 1);
  }

  function setQuantity(value: number): void {
    if (!catalog || !Number.isSafeInteger(value) || value < 1 || value > catalog.maxPerPayment) {
      quantity.setCustomValidity('Choose between 1 and ' + (catalog?.maxPerPayment ?? 1) + ' tickets.');
      quantity.reportValidity();

      return;
    }

    quantity.setCustomValidity('');
    while (allocations.length < value) allocations.push({ kind: 'gift', recipient_email: '' });
    allocations = allocations.slice(0, value);
    quantity.value = String(value);
    invalidateLiveRequest();
    renderRows();
  }

  page.querySelector<HTMLButtonElement>('[data-decrease]')!.addEventListener('click', () => setQuantity(allocations.length - 1));
  page.querySelector<HTMLButtonElement>('[data-increase]')!.addEventListener('click', () => setQuantity(allocations.length + 1));
  quantity.addEventListener('change', () => setQuantity(Number(quantity.value)));
  name.addEventListener('input', () => {
    name.setCustomValidity('');
    invalidateLiveRequest();
  });
  email.addEventListener('input', invalidateLiveRequest);

  async function checkLive(): Promise<void> {
    const retryRequested = document.activeElement === retry;

    catalog = null;
    pay.disabled = true;
    retry.hidden = !retryRequested;
    retry.disabled = true;
    quantity.disabled = true;
    name.disabled = true;
    email.disabled = true;
    status.textContent = 'Checking whether checkout is open…';
    checkoutLayout.hidden = true;
    availability.hidden = false;
    availabilityHeading.textContent = 'Checking ticket availability…';
    availabilityMessage.textContent = 'We’re checking prices and whether checkout is ready.';
    page.querySelector<HTMLElement>('[data-provider]')!.hidden = true;
    page.querySelector<HTMLElement>('[data-quantity-limit]')!.textContent = 'Checking ticket availability…';
    page.querySelector<HTMLElement>('[data-unit-price]')!.textContent = 'Confirming…';
    renderRows();

    try {
      const result = liveCatalog(await api(origin, catalogPath), mode);

      if (!result) throw new Error('Flexible checkout is not open.');

      catalog = result;
      quantity.max = String(result.maxPerPayment);
      quantity.disabled = false;
      name.disabled = false;
      email.disabled = false;
      pay.disabled = false;
      page.querySelector<HTMLElement>('[data-unit-price]')!.textContent = devcon26Amount(result.unitAmountMinor);
      page.querySelector<HTMLElement>('[data-quantity-limit]')!.textContent = 'Up to ' + result.maxPerPayment + ' tickets in one payment.';
      page.querySelector<HTMLElement>('[data-provider]')!.hidden = false;
      retry.hidden = true;
      availability.hidden = true;
      checkoutLayout.hidden = false;
      status.textContent = 'Checkout is open. Review your choices before continuing.';
      renderRows();

      if (retryRequested) quantity.focus();
    } catch (error) {
      console.warn('Checkout availability check failed:', error instanceof Error ? error.message : 'Unknown error');
      availabilityHeading.textContent = 'Ticket checkout is unavailable';
      availabilityMessage.textContent = 'We can’t load ticket checkout right now. Try again shortly.';
      status.textContent = 'Ticket checkout is unavailable. Try again shortly.';
      page.querySelector<HTMLElement>('[data-quantity-limit]')!.textContent = 'Ticket availability could not be confirmed.';
      page.querySelector<HTMLElement>('[data-unit-price]')!.textContent = 'Unavailable';
      page.querySelector<HTMLElement>('[data-total]')!.textContent = '—';
      retry.hidden = false;
      retry.disabled = false;

      if (retryRequested) retry.focus();
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!catalog || liveBusy) return;

    if (currentStep < 2) {
      nextStep();

      return;
    }

    if (!validateStep(0) || !validateStep(1)) return;
    if (allocations.filter((allocation) => allocation.kind === 'self').length > 1) return;

    const challengeToken = completeTest ? String(new FormData(form).get('cf-turnstile-response') ?? '') : '';

    if (completeTest && !challengeToken) {
      status.textContent = 'Please complete the human check before continuing.';

      return;
    }

    const cart = {
      quantity: allocations.length,
      payment_provider: catalog.provider,
      allocations: allocations.map((allocation) => allocation.kind === 'gift'
        ? { kind: allocation.kind, recipient_email: allocation.recipient_email?.trim().toLowerCase() }
        : { kind: allocation.kind }),
    };
    const expectedAmount = catalog.unitAmountMinor * allocations.length;

    liveBusy = true;
    liveRequestKey ||= crypto.randomUUID();
    pay.disabled = true;
    status.textContent = 'Opening secure Paystack checkout…';
    renderRows();

    try {
      const result = await api(origin, initializePath, {
        checkout_request_key: liveRequestKey,
        purchaser_name: name.value.trim(),
        purchaser_email: email.value.trim().toLowerCase(),
        cart,
        ...(completeTest ? { turnstile_token: challengeToken, turnstile_action: 'devcon26_complete_test_checkout' } : {}),
      });

      if (result.mode !== mode || result.currency !== 'GHS'
        || result.quantity !== allocations.length || result.amount_minor !== expectedAmount
        || typeof result.reference !== 'string' || !(completeTest ? /^devcon26-complete-test-[a-f0-9]{32}$/ : /^devcon26_[a-f0-9]{32}$/).test(result.reference)
        || typeof result.checkout_grant !== 'string' || !result.checkout_grant
        || typeof result.checkout_verifier !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(result.checkout_verifier)) {
        throw new Error('The payment details could not be confirmed.');
      }

      const destination = paystackUrl(result.authorization_url);

      sessionStorage.setItem(FLEXIBLE_GRANT_SESSION_KEY, JSON.stringify({
        reference: result.reference,
        checkout_grant: result.checkout_grant,
        checkout_verifier: result.checkout_verifier,
      }));
      window.location.assign(destination.href);
    } catch {
      status.textContent = completeTest
        ? 'Checkout could not start. Check that all email addresses are approved testers, complete the human check, then try again.'
        : 'Checkout could not start. Try again; we’ll keep this same request.';
      if (completeTest) (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
      liveBusy = false;
      pay.disabled = false;
      renderRows();
    }
  });

  retry.addEventListener('click', () => void checkLive());

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      liveBusy = false;
      if (completeTest) (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
      void checkLive();
    }
  });

  renderRows();
  void checkLive();
}
