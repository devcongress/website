import { InttegroClient } from '@inttegro/inttegro-sdk';

export interface SupportCheckoutEnv {
  INTTEGRO_API_KEY?: string;
  INTTEGRO_SUPPORT_PURCHASE_INTENT_ID?: string;
}

export const SUPPORT_CHECKOUT_PATH = '/api/support/checkout';

const CURRENCY = 'ghs';
const MIN_AMOUNT_MINOR = 100;
const MAX_AMOUNT_MINOR = 100_000_000;
const MAX_BODY_BYTES = 4_096;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const GHANA_DIAL_CODE = '+233';
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-]{16,64}$/;

interface SupportCheckoutInput {
  amountMinor: number;
  name: string;
  email: string;
  phone: string;
  requestId: string;
}

interface DonationProduct {
  productId: string;
}

let cachedDonationProduct: Promise<DonationProduct> | null = null;

export async function handleSupportCheckout(request: Request, env: SupportCheckoutEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  }

  const origin = new URL(request.url).origin;
  if (request.headers.get('Origin') !== origin) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (!env.INTTEGRO_API_KEY || !env.INTTEGRO_SUPPORT_PURCHASE_INTENT_ID) {
    console.error(JSON.stringify({ event: 'support_checkout_not_configured' }));
    return json({ error: 'Support checkout is not available right now.' }, 503);
  }

  const input = await readInput(request);
  if (typeof input === 'string') return json({ error: input }, 400);

  const inttegro = new InttegroClient({ apiKey: env.INTTEGRO_API_KEY });

  try {
    const { productId } = await donationProduct(inttegro, env.INTTEGRO_SUPPORT_PURCHASE_INTENT_ID);
    const order = await inttegro.orders.create({
      requestMeta: { idempotencyKey: `support-${input.requestId}` },
      customerData: {
        name: input.name,
        emailAddress: input.email,
        phoneNumber: input.phone,
      },
      lineItems: [{
        type: 'product',
        product: {
          productId,
          price: { currency: CURRENCY, value: input.amountMinor },
          quantity: 1,
        },
      }],
      finalize: true,
      checkoutSettings: {
        redirectUrl: `${origin}/?support=thanks#donate`,
        cancelUrl: `${origin}/#donate`,
      },
    });

    return json({ orderId: order.id, checkoutUrl: order.invoice?.format?.web?.url ?? null }, 201);
  } catch (error) {
    cachedDonationProduct = null;
    console.error(JSON.stringify({
      event: 'support_checkout_failed',
      error_name: error instanceof Error ? error.name : 'Error',
      error_message: error instanceof Error ? error.message : String(error),
    }));
    return json({ error: 'We could not start checkout. Please try again.' }, 502);
  }
}

// The Support buy page is an Inttegro purchase intent for a donation product,
// so orders reuse its catalog product with the donor's chosen amount.
function donationProduct(inttegro: InttegroClient, purchaseIntentId: string): Promise<DonationProduct> {
  cachedDonationProduct ??= inttegro.purchaseIntents.lookup({ id: purchaseIntentId }).then((intent) => {
    const productId = intent.product?.id;
    if (!productId) throw new Error('Support purchase intent has no product');
    return { productId };
  });
  return cachedDonationProduct;
}

async function readInput(request: Request): Promise<SupportCheckoutInput | string> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return 'Request too large.';

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return 'Invalid request.';
  }

  const amount = Number(body.amount);
  const amountMinor = Math.round(amount * 100);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : '';
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';

  if (!Number.isFinite(amount) || amountMinor < MIN_AMOUNT_MINOR || amountMinor > MAX_AMOUNT_MINOR) {
    return 'Enter an amount of at least GHS 1.';
  }
  if (!name || name.length > 120) return 'Enter your name.';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return 'Enter a valid email address.';
  if (!PHONE_PATTERN.test(phone)) return 'Enter a valid phone number, e.g. 0241234567 or +233241234567.';
  if (!REQUEST_ID_PATTERN.test(requestId)) return 'Invalid request.';

  return { amountMinor, name, email, phone, requestId };
}

// Donors often type Ghanaian numbers locally (0241234567 or 241234567), so
// those are converted to +233 format; anything else must already be international.
function normalizePhone(value: string): string {
  const phone = value.replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(phone)) return GHANA_DIAL_CODE + phone.slice(1);
  if (/^[1-9]\d{8}$/.test(phone)) return GHANA_DIAL_CODE + phone;
  return phone;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}
