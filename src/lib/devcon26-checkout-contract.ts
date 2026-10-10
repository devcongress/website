export const DEVCON26_CHECKOUT_PATH = '/api/public/annual-conference/2026/test-checkout';

const TIER_QUANTITIES = { regular: 1, team_3: 3, team_5: 5 } as const;

export type Devcon26Tier = keyof typeof TIER_QUANTITIES;

export interface Devcon26Quote {
  tier_key: Devcon26Tier;
  quantity: number;
  currency: 'GHS';
  base_amount_minor: number;
  discount_amount_minor: number;
  final_amount_minor: number;
  coupon_applied: string | null;
}

export function devcon26Amount(amountMinor: number): string {
  return 'GHS ' + new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function devcon26Quote(input: unknown, expectedTier?: string, allowLegacy = false): Devcon26Quote | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const result = input as Record<string, unknown>;

  if (result.mode !== 'test' || typeof result.tier_key !== 'string'
    || !Object.hasOwn(TIER_QUANTITIES, result.tier_key)
    || (expectedTier && result.tier_key !== expectedTier) || result.currency !== 'GHS') return null;

  const tier = result.tier_key as Devcon26Tier;

  if (result.quantity !== TIER_QUANTITIES[tier]) return null;

  const legacy = allowLegacy && ['base_amount_minor', 'discount_amount_minor', 'final_amount_minor', 'coupon_applied']
    .every((field) => !Object.hasOwn(result, field));
  const base = legacy ? result.amount_minor : result.base_amount_minor;
  const discount = legacy ? 0 : result.discount_amount_minor;
  const final = legacy ? result.amount_minor : result.final_amount_minor;
  const coupon = legacy ? null : result.coupon_applied;

  if (!Number.isSafeInteger(base) || !Number.isSafeInteger(discount) || !Number.isSafeInteger(final)
    || (base as number) <= 0 || (discount as number) < 0 || (final as number) <= 0
    || (base as number) - (discount as number) !== final
    || (Object.hasOwn(result, 'amount_minor') && result.amount_minor !== final)
    || (coupon !== null && (typeof coupon !== 'string' || !/^[A-Z0-9-]{3,48}$/.test(coupon)))
    || (coupon !== null) !== ((discount as number) > 0)) return null;

  return {
    tier_key: tier,
    quantity: TIER_QUANTITIES[tier],
    currency: 'GHS',
    base_amount_minor: base as number,
    discount_amount_minor: discount as number,
    final_amount_minor: final as number,
    coupon_applied: coupon as string | null,
  };
}
