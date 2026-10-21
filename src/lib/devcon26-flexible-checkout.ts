import { devcon26Amount } from './devcon26-checkout-contract';

const LIVE_PATH = '/api/public/annual-conference/2026/checkout';
const TEST_PATH = '/api/public/annual-conference/2026/test-checkout';
const TURNSTILE_ACTION = 'devcon26_test_preview_email';
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

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  getResponse: (widgetId: string) => string;
}

const ALLOCATION_CHOICES: AllocationChoice[] = [
  { kind: 'self', label: 'My ticket', description: 'Keep this place for yourself' },
  { kind: 'gift', label: 'Private gift', description: 'Send it directly by email' },
  { kind: 'community_managed', label: 'Community pool', description: 'Let the organizers assign this place' },
  { kind: 'community_shareable', label: 'Shareable claim', description: 'Get a private link to share later' },
];

declare global {
  interface Window { turnstile?: TurnstileApi }
}

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
      throw new Error('Checkout is unavailable.');
    }

    return payload as Record<string, unknown>;
  } finally {
    window.clearTimeout(timeout);
  }
}

function liveCatalog(payload: Record<string, unknown>): LiveCatalog | null {
  const flexible = payload.flexible_checkout as Record<string, unknown> | undefined;
  const providers = payload.payment_providers;

  if (payload.mode !== 'live' || payload.currency !== 'GHS' || !flexible || flexible.mode !== 'live'
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
  const form = page.querySelector<HTMLFormElement>('[data-live-form]')!;
  const quantity = page.querySelector<HTMLInputElement>('[data-quantity]')!;
  const rows = page.querySelector<HTMLElement>('[data-allocation-list]')!;
  const name = page.querySelector<HTMLInputElement>('[data-name]')!;
  const email = page.querySelector<HTMLInputElement>('[data-email]')!;
  const pay = page.querySelector<HTMLButtonElement>('[data-pay]')!;
  const retry = page.querySelector<HTMLButtonElement>('[data-retry]')!;
  const status = page.querySelector<HTMLElement>('[data-status]')!;
  const previewPanel = page.querySelector<HTMLDetailsElement>('[data-preview-panel]')!;
  const previewForm = page.querySelector<HTMLFormElement>('[data-preview-form]')!;
  const previewPay = page.querySelector<HTMLButtonElement>('[data-preview-pay]')!;
  const previewStatus = page.querySelector<HTMLElement>('[data-preview-status]')!;
  const turnstileContainer = page.querySelector<HTMLElement>('[data-turnstile]')!;
  let origin: string;
  let catalog: LiveCatalog | null = null;
  let allocations: Allocation[] = [{ kind: 'self' }];
  let liveBusy = false;
  let previewBusy = false;
  let liveRequestKey: string | undefined;
  let previewRequestKey: string | undefined;
  let widgetId: string | undefined;
  let turnstileToken = '';
  let openAllocationIndex: number | null = null;

  try {
    origin = apiOrigin(page.dataset.apiOrigin ?? '');
  } catch {
    status.textContent = 'Checkout configuration is unavailable.';
    previewStatus.textContent = 'Test checkout configuration is unavailable.';

    return;
  }

  function invalidateLiveRequest(): void {
    liveRequestKey = undefined;
  }

  function enabledAllocationOptions(index: number): HTMLElement[] {
    return Array.from(rows.querySelectorAll<HTMLElement>(
      `[data-allocation-menu="${index}"] [role="option"]:not([aria-disabled="true"])`,
    ));
  }

  function closeAllocationMenu(returnFocus = false): void {
    if (openAllocationIndex === null) return;

    const index = openAllocationIndex;
    const trigger = rows.querySelector<HTMLButtonElement>(`[data-allocation-trigger="${index}"]`);
    const menu = rows.querySelector<HTMLElement>(`[data-allocation-menu="${index}"]`);

    openAllocationIndex = null;
    trigger?.setAttribute('aria-expanded', 'false');

    if (menu) {
      menu.hidden = true;
      menu.dataset.state = 'closed';
    }

    if (returnFocus) trigger?.focus({ preventScroll: true });
  }

  function openAllocationMenu(index: number, focus: 'selected' | 'first' | 'last' = 'selected'): void {
    if (openAllocationIndex !== index) closeAllocationMenu();

    const trigger = rows.querySelector<HTMLButtonElement>(`[data-allocation-trigger="${index}"]`);
    const menu = rows.querySelector<HTMLElement>(`[data-allocation-menu="${index}"]`);

    if (!trigger || !menu || trigger.disabled) return;

    openAllocationIndex = index;
    trigger.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    menu.dataset.state = 'open';

    window.requestAnimationFrame(() => {
      const options = enabledAllocationOptions(index);
      const selected = menu.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const target = focus === 'first' ? options[0] : focus === 'last' ? options.at(-1) : selected;

      (target && target.getAttribute('aria-disabled') !== 'true' ? target : options[0])?.focus({ preventScroll: true });
    });
  }

  function chooseAllocation(index: number, kind: AllocationKind): void {
    const previous = allocations[index];

    allocations[index] = kind === 'gift'
      ? { kind, recipient_email: previous.recipient_email ?? '' }
      : { kind };
    openAllocationIndex = null;
    invalidateLiveRequest();
    renderRows();
    rows.querySelector<HTMLButtonElement>(`[data-allocation-trigger="${index}"]`)?.focus({ preventScroll: true });
  }

  function moveAllocationFocus(index: number, current: HTMLElement, direction: 1 | -1): void {
    const options = enabledAllocationOptions(index);
    const currentIndex = options.indexOf(current);
    const nextIndex = (currentIndex + direction + options.length) % options.length;

    options[nextIndex]?.focus({ preventScroll: true });
  }

  function renderRows(): void {
    const fragment = document.createDocumentFragment();
    const selfIndex = allocations.findIndex((allocation) => allocation.kind === 'self');

    openAllocationIndex = null;

    allocations.forEach((allocation, index) => {
      const row = document.createElement('div');
      const label = document.createElement('label');
      const control = document.createElement('div');
      const trigger = document.createElement('button');
      const triggerCopy = document.createElement('span');
      const triggerValue = document.createElement('span');
      const triggerDescription = document.createElement('span');
      const chevron = document.createElement('span');
      const menu = document.createElement('ul');
      const id = 'allocation-' + (index + 1);
      const labelId = id + '-label';
      const valueId = id + '-value';
      const menuId = id + '-menu';
      const selectedChoice = ALLOCATION_CHOICES.find((choice) => choice.kind === allocation.kind)!;

      row.className = 'allocation-row';
      label.htmlFor = id;
      label.id = labelId;
      label.textContent = 'Ticket ' + (index + 1);

      control.className = 'allocation-control';

      trigger.className = 'allocation-select';
      trigger.type = 'button';
      trigger.id = id;
      trigger.disabled = !catalog || liveBusy;
      trigger.dataset.allocationTrigger = String(index);
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', menuId);
      trigger.setAttribute('aria-labelledby', `${labelId} ${valueId}`);

      triggerCopy.className = 'allocation-select-copy';
      triggerValue.className = 'allocation-select-value';
      triggerValue.id = valueId;
      triggerValue.textContent = selectedChoice.label;
      triggerDescription.className = 'allocation-select-description';
      triggerDescription.textContent = selectedChoice.description;
      triggerCopy.append(triggerValue, triggerDescription);

      chevron.className = 'allocation-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      trigger.append(triggerCopy, chevron);

      menu.className = 'allocation-menu';
      menu.id = menuId;
      menu.hidden = true;
      menu.dataset.allocationMenu = String(index);
      menu.dataset.state = 'closed';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-labelledby', labelId);

      ALLOCATION_CHOICES.forEach((choice) => {
        const option = document.createElement('li');
        const optionCopy = document.createElement('span');
        const optionLabel = document.createElement('span');
        const optionDescription = document.createElement('span');
        const optionMark = document.createElement('span');
        const unavailable = choice.kind === 'self' && selfIndex !== -1 && selfIndex !== index;

        option.className = 'allocation-option';
        option.tabIndex = -1;
        option.dataset.allocationKind = choice.kind;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(choice.kind === allocation.kind));

        if (unavailable) option.setAttribute('aria-disabled', 'true');

        optionCopy.className = 'allocation-option-copy';
        optionLabel.className = 'allocation-option-label';
        optionLabel.textContent = choice.label;
        optionDescription.className = 'allocation-option-description';
        optionDescription.textContent = unavailable ? 'Already used for another ticket' : choice.description;
        optionCopy.append(optionLabel, optionDescription);

        optionMark.className = 'allocation-option-mark';
        optionMark.textContent = choice.kind === allocation.kind ? '✓' : '';
        optionMark.setAttribute('aria-hidden', 'true');
        option.append(optionCopy, optionMark);

        option.addEventListener('click', () => {
          if (!unavailable) chooseAllocation(index, choice.kind);
        });
        option.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeAllocationMenu(true);

            return;
          }

          if (event.key === 'Tab') {
            closeAllocationMenu();

            return;
          }

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveAllocationFocus(index, option, event.key === 'ArrowDown' ? 1 : -1);

            return;
          }

          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const options = enabledAllocationOptions(index);

            (event.key === 'Home' ? options[0] : options.at(-1))?.focus({ preventScroll: true });

            return;
          }

          if ((event.key === 'Enter' || event.key === ' ') && !unavailable) {
            event.preventDefault();
            chooseAllocation(index, choice.kind);
          }
        });
        menu.append(option);
      });

      trigger.addEventListener('click', () => {
        if (openAllocationIndex === index) {
          closeAllocationMenu(true);

          return;
        }

        openAllocationMenu(index);
      });
      trigger.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;

        event.preventDefault();
        const focus = event.key === 'ArrowUp' || event.key === 'End'
          ? 'last'
          : event.key === 'Home'
            ? 'first'
            : 'selected';

        openAllocationMenu(index, focus);
      });

      control.append(trigger, menu);
      row.append(label, control);

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
    page.querySelector<HTMLElement>('[data-summary-quantity]')!.textContent = String(allocations.length);
    page.querySelector<HTMLElement>('[data-total]')!.textContent = catalog
      ? devcon26Amount(catalog.unitAmountMinor * allocations.length) : '—';
    page.querySelector<HTMLButtonElement>('[data-decrease]')!.disabled = !catalog || liveBusy || allocations.length <= 1;
    page.querySelector<HTMLButtonElement>('[data-increase]')!.disabled = !catalog || liveBusy || allocations.length >= (catalog?.maxPerPayment ?? 1);
  }

  document.addEventListener('pointerdown', (event) => {
    if (openAllocationIndex !== null && !rows.contains(event.target as Node)) closeAllocationMenu();
  });

  rows.addEventListener('focusout', (event) => {
    if (openAllocationIndex !== null && !rows.contains(event.relatedTarget as Node | null)) closeAllocationMenu();
  });

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
  name.addEventListener('input', invalidateLiveRequest);
  email.addEventListener('input', invalidateLiveRequest);

  async function checkLive(): Promise<void> {
    catalog = null;
    pay.disabled = true;
    retry.hidden = true;
    quantity.disabled = true;
    name.disabled = true;
    email.disabled = true;
    status.textContent = 'Checking whether checkout is open…';
    renderRows();

    try {
      const result = liveCatalog(await api(origin, LIVE_PATH));

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
      status.textContent = 'Checkout is open. Review your choices before continuing.';
      renderRows();
    } catch {
      status.textContent = 'Ticket checkout is not available yet. Check back soon.';
      page.querySelector<HTMLElement>('[data-unit-price]')!.textContent = 'Unavailable';
      page.querySelector<HTMLElement>('[data-total]')!.textContent = '—';
      retry.hidden = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!catalog || liveBusy) return;

    const quantityValue = Number(quantity.value);

    if (quantityValue !== allocations.length || !quantity.reportValidity() || !form.reportValidity()) return;
    if (allocations.filter((allocation) => allocation.kind === 'self').length > 1) return;

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
      const result = await api(origin, LIVE_PATH + '/flexible/initialize', {
        checkout_request_key: liveRequestKey,
        purchaser_name: name.value.trim(),
        purchaser_email: email.value.trim().toLowerCase(),
        cart,
      });

      if (result.mode !== 'live' || result.currency !== 'GHS'
        || result.quantity !== allocations.length || result.amount_minor !== expectedAmount
        || typeof result.reference !== 'string' || !/^devcon26_[a-f0-9]{32}$/.test(result.reference)
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
      status.textContent = 'Checkout could not start. Try again; we’ll keep this same request.';
      liveBusy = false;
      pay.disabled = false;
      renderRows();
    }
  });

  retry.addEventListener('click', () => void checkLive());

  function renderTurnstile(): void {
    if (widgetId || !window.turnstile || !page.dataset.turnstileSiteKey) return;

    widgetId = window.turnstile.render(turnstileContainer, {
      sitekey: page.dataset.turnstileSiteKey,
      action: TURNSTILE_ACTION,
      callback: (token: string) => { turnstileToken = token; },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; },
    });
  }

  function loadTurnstile(): void {
    if (document.getElementById('devcon26-turnstile-script')) {
      renderTurnstile();

      return;
    }

    const script = document.createElement('script');

    script.id = 'devcon26-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.addEventListener('load', renderTurnstile);
    document.head.append(script);
  }

  async function checkPreview(): Promise<void> {
    previewPay.disabled = true;
    previewStatus.textContent = 'Checking test checkout availability…';

    try {
      const result = await api(origin, TEST_PATH);

      if (result.mode !== 'test' || result.preview_email_available !== true
        || !Array.isArray(result.tiers)
        || !result.tiers.some((tier) => tier?.tier_key === 'regular' && tier.quantity === 1)) {
        throw new Error('Test preview email is unavailable.');
      }

      previewPay.disabled = false;
      previewStatus.textContent = 'Test email preview is available after a successful test payment.';
      loadTurnstile();
    } catch {
      previewStatus.textContent = 'Test email preview is not available on this website origin right now.';
    }
  }

  previewPanel.addEventListener('toggle', () => {
    if (previewPanel.open) void checkPreview();
  });
  previewForm.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
    previewRequestKey = undefined;
  }));

  previewForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (previewPay.disabled || previewBusy || !previewForm.reportValidity()) return;
    if (!widgetId || !turnstileToken || !window.turnstile?.getResponse(widgetId)) {
      previewStatus.textContent = 'Complete the human check to continue.';

      return;
    }

    previewBusy = true;
    previewPay.disabled = true;
    previewRequestKey ||= crypto.randomUUID();
    previewStatus.textContent = 'Opening test payment…';

    try {
      const result = await api(origin, TEST_PATH + '/initialize', {
        tier_key: 'regular',
        checkout_request_key: previewRequestKey,
        purchaser_name: previewForm.querySelector<HTMLInputElement>('#preview-name')!.value.trim(),
        purchaser_email: previewForm.querySelector<HTMLInputElement>('#preview-email')!.value.trim().toLowerCase(),
        turnstile_token: turnstileToken,
        turnstile_action: TURNSTILE_ACTION,
      });

      if (result.mode !== 'test' || result.tier_key !== 'regular' || result.quantity !== 1
        || result.currency !== 'GHS' || typeof result.reference !== 'string'
        || !/^devcon26-test-[a-f0-9]{32}$/.test(result.reference)) throw new Error('Invalid test checkout.');

      window.location.assign(paystackUrl(result.authorization_url).href);
    } catch {
      previewStatus.textContent = 'Test checkout could not start. Complete a fresh human check and try again.';
      previewBusy = false;
      previewPay.disabled = false;
      turnstileToken = '';
      window.turnstile?.reset(widgetId);
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      liveBusy = false;
      previewBusy = false;
      void checkLive();
      if (previewPanel.open) void checkPreview();
    }
  });

  renderRows();
  void checkLive();
}
