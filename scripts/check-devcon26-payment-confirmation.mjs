import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const bundle = await build({ entryPoints: ['src/lib/devcon26-payment-confirmation.ts'], bundle: true, format: 'cjs', platform: 'browser', write: false });

for (const hasSelf of [true, false]) {
  const reference = 'devcon26-complete-test-' + 'a'.repeat(32);
  const nodes = new Map();
  const root = {
    dataset: { checkoutApiOrigin: 'https://preview-api.example.test' },
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { setAttribute() {}, removeAttribute() {}, addEventListener() {} });
      return nodes.get(selector);
    },
  };
  const module = { exports: {} };
  let requests = 0;
  let badgeCalls = 0;
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module, URL, URLSearchParams, AbortController, console,
    document: {},
    window: { location: { search: '?reference=' + reference, hash: '', pathname: '/devcon26/payment/' },
      history: { replaceState() {} }, setTimeout, clearTimeout, addEventListener() {} },
    sessionStorage: { getItem: () => JSON.stringify({ reference, checkout_grant: 'fixture', checkout_verifier: 'fixture' }) },
    fetch: async url => {
      requests += 1;
      assert.ok(url.endsWith('/complete-test-checkout/verify'));
      return { ok: true, status: 200, json: async () => ({ mode: 'test', status: 'verified', quantity: 1,
        amount_paid_minor: 15000, ticket_amount_minor: 15000, currency: 'GHS',
        card_quantity: hasSelf ? 1 : 0, ...(hasSelf ? { buyer_grant: 'scoped-badge-grant' } : {}) }) };
    },
  });
  module.exports.initializeDevcon26PaymentConfirmation(root, (_root, quantity, grant) => {
    badgeCalls += 1;
    assert.equal(quantity, 1);
    assert.equal(grant, 'scoped-badge-grant');
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests, 1);
  assert.equal(root.dataset.paymentState, 'verified');
  assert.equal(badgeCalls, hasSelf ? 1 : 0);
}
console.log('Complete-test confirmation: verified self badge and gift-only paths passed.');
