type PaymentMode = 'live' | 'test';

export interface ReceiptCapability {
  providerName: string;
  receiptOrigins: readonly string[];
  customerEmailConfirmedModes: readonly PaymentMode[];
}

export type ReceiptPresentation =
  | { kind: 'link'; url: string }
  | { kind: 'email'; message: string }
  | { kind: 'reference' };

// Code-owned capabilities, never populated from a query parameter or API flags.
// Paystack documents receipt_number, not a customer receipt URL. Its merchant
// email preference has not been confirmed for either payment mode.
export const RECEIPT_CAPABILITIES: Readonly<Record<string, ReceiptCapability>> = {
  paystack: {
    providerName: 'Paystack',
    receiptOrigins: [],
    customerEmailConfirmedModes: [],
  },
};

export function paymentReceiptPresentation(
  provider: string,
  mode: string,
  returnedReceiptUrl: unknown,
  capabilities: Readonly<Record<string, ReceiptCapability>> = RECEIPT_CAPABILITIES,
): ReceiptPresentation {
  if (!Object.hasOwn(capabilities, provider) || (mode !== 'live' && mode !== 'test')) {
    return { kind: 'reference' };
  }

  const capability = capabilities[provider];

  if (typeof returnedReceiptUrl === 'string' && returnedReceiptUrl.length <= 2048
    && !/[\u0000-\u0020\u007f\\]/.test(returnedReceiptUrl)) {
    try {
      const url = new URL(returnedReceiptUrl);

      if (url.protocol === 'https:' && !url.username && !url.password
        && capability.receiptOrigins.includes(url.origin)) {
        return { kind: 'link', url: url.href };
      }
    } catch {
      // Missing or malformed provider URLs fall through to confirmed email.
    }
  }

  if (capability.customerEmailConfirmedModes.includes(mode)) {
    return {
      kind: 'email',
      message: capability.providerName + ' sends payment receipts to your checkout email.',
    };
  }

  return { kind: 'reference' };
}

export function renderPaymentReceipt(
  link: HTMLAnchorElement,
  emailNote: HTMLElement,
  presentation: ReceiptPresentation,
): void {
  link.hidden = true;
  link.removeAttribute('href');
  emailNote.hidden = true;
  emailNote.textContent = '';

  if (presentation.kind === 'link') {
    link.setAttribute('href', presentation.url);
    link.hidden = false;
  } else if (presentation.kind === 'email') {
    emailNote.textContent = presentation.message;
    emailNote.hidden = false;
  }
}
