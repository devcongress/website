const tierQuantities = {
  regular: 1,
  team_3: 3,
  team_5: 5,
} as const;

type TicketTierKey = keyof typeof tierQuantities;

interface PublicTicketPrice {
  tier_key: TicketTierKey;
  quantity: number;
  amount_minor: number;
}

interface PublicTicketCatalog {
  currency: 'GHS';
  tiers: PublicTicketPrice[];
}

function isPublicTicketCatalog(value: unknown): value is PublicTicketCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as Partial<PublicTicketCatalog>;

  if (catalog.currency !== 'GHS' || !Array.isArray(catalog.tiers) || catalog.tiers.length !== 3) return false;

  const tiers = new Map(catalog.tiers.map((tier) => [tier?.tier_key, tier]));

  return Object.entries(tierQuantities).every(([tierKey, quantity]) => {
    const tier = tiers.get(tierKey as TicketTierKey);

    return tier?.tier_key === tierKey && tier.quantity === quantity
      && Number.isSafeInteger(tier.amount_minor) && tier.amount_minor > 0;
  }) && tiers.get('team_3')!.amount_minor <= tiers.get('regular')!.amount_minor * 3
    && tiers.get('team_5')!.amount_minor <= tiers.get('regular')!.amount_minor * 5;
}

function formatGhs(amountMinor: number): string {
  return `GHS ${(amountMinor / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function setPricingUnavailable(root: HTMLElement, message: string) {
  root.setAttribute('aria-busy', 'false');
  root.querySelectorAll<HTMLElement>('[data-ticket-price]').forEach((element) => {
    element.textContent = 'GHS --.--';
  });
  root.querySelectorAll<HTMLElement>('[data-ticket-detail]').forEach((element) => {
    if (element.dataset.ticketDetail !== 'regular') element.textContent = 'Save GHS --.-- together.';
  });
  root.querySelectorAll<HTMLAnchorElement>('[data-ticket-checkout]').forEach((link) => {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.tabIndex = -1;
  });

  const status = root.querySelector<HTMLElement>('[data-ticket-pricing-status]');

  if (status) status.textContent = message;
}

export async function initializeDevcon26TicketPricing(root: HTMLElement | null): Promise<void> {
  if (!root) return;

  const configuredOrigin = import.meta.env.PUBLIC_DEVCON26_API_ORIGIN?.trim() || 'https://em.devcongress.org';
  let apiOrigin: URL;

  try {
    apiOrigin = new URL(configuredOrigin);
    if (apiOrigin.protocol !== 'https:' && apiOrigin.hostname !== 'localhost' && apiOrigin.hostname !== '127.0.0.1') {
      throw new Error('Invalid API origin');
    }
  } catch {
    setPricingUnavailable(root, 'Ticket prices could not be loaded. Please try again later.');

    return;
  }

  const endpoint = new URL('/api/public/annual-conference/2026/ticket-prices', apiOrigin.origin);

  try {
    const response = await fetch(endpoint, {
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error('Prices unavailable');

    const catalog: unknown = await response.json();

    if (!isPublicTicketCatalog(catalog)) throw new Error('Invalid price catalog');

    const prices = new Map(catalog.tiers.map((tier) => [tier.tier_key, tier.amount_minor]));
    const regularPrice = prices.get('regular')!;

    for (const [tierKey, quantity] of Object.entries(tierQuantities) as Array<[TicketTierKey, number]>) {
      const amount = prices.get(tierKey)!;
      const price = root.querySelector<HTMLElement>(`[data-ticket-price="${tierKey}"]`);
      const detail = root.querySelector<HTMLElement>(`[data-ticket-detail="${tierKey}"]`);
      const link = root.querySelector<HTMLAnchorElement>(`[data-ticket-checkout="${tierKey}"]`);

      if (price) price.textContent = formatGhs(amount);

      if (detail && quantity > 1) {
        const savings = regularPrice * quantity - amount;

        detail.textContent = savings > 0 ? `Save ${formatGhs(savings)} together.` : `${quantity} seats in one purchase.`;
      }

      if (link) {
        link.href = `/devcon26/checkout/?tier=${tierKey}&price_minor=${amount}`;
        link.removeAttribute('aria-disabled');
        link.removeAttribute('tabindex');
      }
    }

    const status = root.querySelector<HTMLElement>('[data-ticket-pricing-status]');

    root.setAttribute('aria-busy', 'false');
    if (status) status.textContent = 'Prices shown are current ticket prices from DevCon26 ticketing.';
  } catch {
    setPricingUnavailable(root, 'Ticket prices are temporarily unavailable, so checkout is paused. Please try again later.');
  }
}
