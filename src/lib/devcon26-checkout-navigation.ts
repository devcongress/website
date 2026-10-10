import type { Devcon26Tier } from './devcon26-checkout-contract';
import { devcon26ConfirmationUrl } from './devcon26-payment-confirmation';

export const DEVCON26_TICKETS = {
  regular: { name: 'Regular ticket', quantity: 1, photo: '/images/devcon26/ticket-solo.webp' },
  team_3: { name: 'Team of 3', quantity: 3, photo: '/images/devcon26/ticket-small-group.webp' },
  team_5: { name: 'Team of 5', quantity: 5, photo: '/images/devcon26/ticket-community.webp' },
} as const;

export function devcon26CheckoutTier(search: string): Devcon26Tier | null {
  const values = new URLSearchParams(search).getAll('tier');

  if (values.length !== 1 || !Object.hasOwn(DEVCON26_TICKETS, values[0])) return null;

  return values[0] as Devcon26Tier;
}

export function redirectDevcon26PaymentReturn(): void {
  const url = new URL(window.location.href);
  const flags = url.searchParams.getAll('test_checkout');

  if (!flags.includes('return')) return;

  const references = url.searchParams.getAll('reference');
  let destination = '/devcon26/payment-confirmation/';

  if (flags.length === 1 && references.length === 1) {
    try {
      destination = devcon26ConfirmationUrl(references[0]);
    } catch {
      // The confirmation page shows a safe missing-reference state.
    }
  }

  for (const key of ['reference', 'trxref', 'test_checkout']) url.searchParams.delete(key);

  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  window.location.replace(destination);
}
