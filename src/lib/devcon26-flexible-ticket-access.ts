const ACCESS_PATH = '/api/public/annual-conference/2026/checkout/flexible/tickets';
const CAPABILITY = /^[0-9a-f]{64}$/;
const ALLOCATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ManagedAllocation {
  allocation_id: string;
  seat_number: number;
  kind: 'self' | 'gift' | 'buyer_managed' | 'community_managed' | 'community_shareable';
  fulfillment_status: string;
  ticket_status: string;
  claim_status: string;
  can_rotate_claim: boolean;
}

function origin(value: string): string {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid ticket API origin.');
  }

  return url.origin;
}

function capabilityFromHash(): string | null {
  const parameters = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const values = parameters.getAll('capability');

  return values.length === 1 && CAPABILITY.test(values[0]) ? values[0] : null;
}

async function post(apiOrigin: string, path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(ACCESS_PATH + path, apiOrigin), {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok || !result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('This ticket action could not be completed.');
  }

  return result as Record<string, unknown>;
}

function actionButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'ticket-action';
  button.textContent = label;
  button.addEventListener('click', action);

  return button;
}

function managedLabel(kind: ManagedAllocation['kind']): string {
  return {
    self: 'Your ticket',
    gift: 'Private gift',
    buyer_managed: 'Sponsor and hand over',
    community_managed: 'Community pool',
    community_shareable: 'Shareable claim',
  }[kind];
}

export function initializeTicketManagement(page: HTMLElement): void {
  const status = page.querySelector<HTMLElement>('[data-access-status]')!;
  const list = page.querySelector<HTMLElement>('[data-management-list]')!;
  const retry = page.querySelector<HTMLButtonElement>('[data-access-retry]')!;
  const capability = capabilityFromHash();
  let apiOrigin: string;

  try {
    apiOrigin = origin(page.dataset.apiOrigin ?? '');
  } catch {
    status.textContent = 'Ticket access is not configured.';

    return;
  }

  if (!capability) {
    status.textContent = 'This private order link is missing or invalid. Open the original email link, or contact the event team.';

    return;
  }

  async function loadOrder(): Promise<void> {
    retry.hidden = true;
    status.textContent = 'Loading your tickets…';
    list.replaceChildren();

    try {
      const result = await post(apiOrigin, '/order', { capability });

      if (!Array.isArray(result.allocations) || !result.allocations.length) throw new Error('Invalid order.');

      const allocations = result.allocations as ManagedAllocation[];
      const fragment = document.createDocumentFragment();

      allocations.forEach((allocation) => {
        if (!ALLOCATION_ID.test(allocation.allocation_id) || !Number.isSafeInteger(allocation.seat_number)) {
          throw new Error('Invalid allocation.');
        }

        const card = document.createElement('article');
        const heading = document.createElement('h2');
        const detail = document.createElement('p');
        const actions = document.createElement('div');
        const resultLine = document.createElement('p');

        card.className = 'managed-ticket';
        heading.textContent = 'Ticket ' + allocation.seat_number + ' · ' + managedLabel(allocation.kind);
        detail.textContent = 'Ticket: ' + allocation.ticket_status.replaceAll('_', ' ')
          + ' · Handoff: ' + allocation.claim_status.replaceAll('_', ' ');
        actions.className = 'managed-actions';
        resultLine.className = 'ticket-result';
        resultLine.setAttribute('role', 'status');
        resultLine.setAttribute('aria-live', 'polite');

        async function perform(path: string, body: Record<string, unknown>, button: HTMLButtonElement, purpose?: 'admission' | 'badge'): Promise<void> {
          button.disabled = true;
          resultLine.textContent = 'Working on ticket ' + allocation.seat_number + '…';

          try {
            const result = await post(apiOrigin, path, body);

            if (purpose) {
              if (result.status !== 'rotated' || typeof result.claim_capability !== 'string'
                || !CAPABILITY.test(result.claim_capability)) throw new Error('Invalid claim link.');

              const url = new URL('/devcon26/tickets/claim/', window.location.origin);

              url.hash = 'capability=' + result.claim_capability + (purpose === 'badge' ? '&purpose=badge' : '');
              const link = document.createElement('a');

              link.href = url.href;
              link.textContent = 'Open the new private claim link';
              link.className = 'private-claim-link';
              const copy = actionButton('Copy link', () => {
                void navigator.clipboard.writeText(url.href).then(() => {
                  copy.textContent = 'Copied';
                }).catch(() => {
                  copy.textContent = 'Copy failed — open the link to share it';
                });
              });

              resultLine.replaceChildren(document.createTextNode('New private link created. Replacing it again revokes this link. '), link, document.createTextNode(' '), copy);
            } else if (result.status === 'queued') {
              resultLine.textContent = 'A new private gift invitation was queued for the recipient email.';
            } else {
              throw new Error('Unexpected ticket response.');
            }
          } catch {
            resultLine.textContent = 'This ticket action is unavailable. Please try again.';
          } finally {
            button.disabled = false;
          }
        }

        if (allocation.kind === 'community_shareable' && allocation.can_rotate_claim) {
          const button = actionButton('Create or replace claim link', () => void perform('/claims/rotate', {
            order_capability: capability,
            allocation_id: allocation.allocation_id,
            purpose: 'admission',
          }, button, 'admission'));

          actions.append(button);
        }

        if (allocation.kind === 'buyer_managed' && allocation.can_rotate_claim) {
          const button = actionButton('Create or replace badge link', () => void perform('/claims/rotate', {
            order_capability: capability,
            allocation_id: allocation.allocation_id,
            purpose: 'badge',
          }, button, 'badge'));

          actions.append(button);
        }

        if (allocation.kind === 'gift' && allocation.claim_status !== 'used') {
          const button = actionButton('Reissue gift invitation', () => void perform('/gifts/reissue', {
            order_capability: capability,
            allocation_id: allocation.allocation_id,
          }, button));

          actions.append(button);
        }

        card.append(heading, detail, actions, resultLine);
        fragment.append(card);
      });

      list.replaceChildren(fragment);
      status.textContent = 'Your order contains ' + allocations.length + (allocations.length === 1 ? ' ticket.' : ' tickets.');
    } catch {
      status.textContent = 'Your tickets could not be loaded. Check this private link or try again.';
      retry.hidden = false;
    }
  }

  retry.addEventListener('click', () => void loadOrder());
  window.addEventListener('hashchange', () => window.location.reload());
  void loadOrder();
}

export function initializeTicketClaim(page: HTMLElement): void {
  const form = page.querySelector<HTMLFormElement>('[data-claim-form]')!;
  const name = form.querySelector<HTMLInputElement>('#claim-name')!;
  const email = form.querySelector<HTMLInputElement>('#claim-email')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-claim-submit]')!;
  const status = form.querySelector<HTMLElement>('[data-access-status]')!;
  const capability = capabilityFromHash();
  const parameters = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const badge = parameters.getAll('purpose').length === 1 && parameters.get('purpose') === 'badge';
  let apiOrigin: string;

  try {
    apiOrigin = origin(page.dataset.apiOrigin ?? '');
  } catch {
    status.textContent = 'Ticket access is not configured.';
    submit.disabled = true;

    return;
  }

  if (!capability) {
    status.textContent = 'This private invitation link is missing or invalid. Open the original email link or ask the person who shared it for a new one.';
    submit.disabled = true;

    return;
  }

  if (badge) {
    email.required = true;
    submit.firstChild!.textContent = 'Create my card ';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (submit.disabled || !form.reportValidity()) return;

    submit.disabled = true;
    status.textContent = badge ? 'Creating your card…' : 'Claiming your ticket…';

    try {
      const result = await post(apiOrigin, badge ? '/badge' : '/claim', {
        capability,
        name: name.value.trim(),
        ...(email.value.trim() ? { email: email.value.trim().toLowerCase() } : {}),
      });

      if (result.status !== 'claimed' || !Number.isSafeInteger(result.seat_number)) {
        throw new Error('Unexpected claim result.');
      }

      status.textContent = badge
        ? 'Your card request is confirmed. ' + (result.delivery_queued === true
          ? 'Check your email for delivery details.' : 'Contact the event team if you need delivery details.')
        : 'Ticket ' + result.seat_number + ' is claimed. ' + (result.delivery_queued === true
          ? 'Check your email for ticket details.' : 'Contact the event team if you need delivery details.');
      form.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    } catch {
      status.textContent = 'This invitation could not be claimed. It may have been used or replaced. Ask for a fresh link or contact the event team.';
      submit.disabled = false;
    }
  });
}
