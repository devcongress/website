import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(root + 'package.json');
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');

async function bundle(entry) {
  const result = await build({
    entryPoints: [root + entry],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    write: false,
    logLevel: 'silent',
  });

  return result.outputFiles[0].text;
}

const receiptModule = { exports: {} };

vm.runInNewContext(await bundle('src/lib/payment-receipts.ts'), { module: receiptModule, URL, Object });
const { paymentReceiptPresentation, renderPaymentReceipt } = receiptModule.exports;
const receiptCapabilities = {
  example: { providerName: 'Example', receiptOrigins: ['https://receipts.example.com'], customerEmailConfirmedModes: ['live'] },
};
const receiptPolicy = (url, mode = 'live') => paymentReceiptPresentation('example', mode, url, receiptCapabilities);

assert.equal(receiptPolicy('https://receipts.example.com/receipt/123').kind, 'link');
assert.equal(receiptPolicy('https://receipts.example.com/receipt/123').url, 'https://receipts.example.com/receipt/123');
assert.equal(receiptPolicy(undefined).kind, 'email');
assert.equal(receiptPolicy(undefined, 'test').kind, 'reference');
assert.equal(receiptPolicy('https://receipts.example.com/receipt/123', 'unknown').kind, 'reference');
assert.equal(paymentReceiptPresentation('unknown', 'live', 'https://receipts.example.com/receipt/123', receiptCapabilities).kind, 'reference');
assert.equal(paymentReceiptPresentation('toString', 'live', undefined, receiptCapabilities).kind, 'reference');

for (const invalidUrl of [
  'http://receipts.example.com/123', 'https://receipts.example.com.evil.example/123',
  'https://receipts.example.com:8443/123', 'https://user:password@receipts.example.com/123',
  'javascript:alert(1)', '/receipt/123', 'https://receipts.example.com/\n123',
  'https://receipts.example.com/\\123', 'https://evil.example/123', 123,
]) {
  assert.equal(receiptPolicy(invalidUrl).kind, 'email', 'Invalid URLs fall back only to confirmed email');
  assert.equal(receiptPolicy(invalidUrl, 'test').kind, 'reference');
}

for (const mode of ['test', 'live']) {
  assert.equal(paymentReceiptPresentation('paystack', mode, 'https://paystack.com/receipt/123').kind, 'reference');
  assert.equal(paymentReceiptPresentation('paystack', mode, undefined).kind, 'reference');
}

class Element {
  hidden = false;
  textContent = '';
  attributes = new Map();

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

const receiptLink = new Element();
const receiptEmail = new Element();

renderPaymentReceipt(receiptLink, receiptEmail, receiptPolicy('https://receipts.example.com/receipt/123'));
assert.equal(receiptLink.hidden, false);
assert.equal(receiptEmail.hidden, true);
renderPaymentReceipt(receiptLink, receiptEmail, receiptPolicy(undefined));
assert.equal(receiptLink.hidden, true);
assert.equal(receiptLink.attributes.has('href'), false, 'Email fallback clears a previously rendered URL');
assert.equal(receiptEmail.hidden, false);
renderPaymentReceipt(receiptLink, receiptEmail, { kind: 'reference' });
assert.equal(receiptEmail.hidden, true);
assert.equal(receiptEmail.textContent, '');
assert.equal(receiptLink.attributes.has('href'), false, 'Retries and non-verified outcomes cannot retain a receipt URL');

console.log('PASS: provider receipt capabilities, URL safety, mode-specific email fallback, and stale receipt reset.');

const confirmationSource = readFileSync(root + 'src/pages/devcon26/payment-confirmation.astro', 'utf8');

assert.match(confirmationSource, /@media print[\s\S]*?\.provider-receipt-link[^{]*\{\s*display: none !important;/, 'Native printing hides provider receipt actions');
