import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const path = '/api/public/annual-conference/2026/checkout/managed';
const apiOrigin = 'https://em.devcongress.org';
const capability = 'a'.repeat(64);
const verifier = 'v'.repeat(43);

async function bundle(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'cjs', platform: 'browser', write: false });

  return result.outputFiles[0].text;
}

const [checkoutCode, confirmationCode, accessCode] = await Promise.all([
  bundle('src/lib/devcon26-flexible-checkout.ts'),
  bundle('src/lib/devcon26-payment-confirmation.ts'),
  bundle('src/lib/devcon26-flexible-ticket-access.ts'),
]);

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.dataset = {};
    this.children = [];
    this.selectors = new Map();
    this.listeners = new Map();
    this.attributes = new Map();
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.firstChild = { textContent: '' };
  }

  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element());

    return this.selectors.get(selector);
  }

  querySelectorAll(selector) {
    if (this.selectors.has(selector)) return this.selectors.get(selector);
    if (selector.startsWith('input')) {
      return this.children.flatMap((child) => child.tagName === 'input' ? [child] : child.querySelectorAll(selector));
    }

    return [];
  }

  addEventListener(name, callback) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), callback]);
  }

  async fire(name, event = {}) {
    for (const callback of this.listeners.get(name) ?? []) {
      await callback({ preventDefault() {}, ...event });
    }
  }

  append(...children) {
    this.children.push(...children.flatMap((child) => child.tagName === 'fragment' ? child.children : [child]));
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  setCustomValidity(message) {
    this.validityMessage = message;
  }

  checkValidity() {
    if (this.disabled) return true;
    if (this.validityMessage || (this.required && !this.value.trim())) return false;
    if (this.type === 'number' && (Number(this.value) < Number(this.min) || Number(this.value) > Number(this.max))) return false;

    return this.type !== 'email' || this.value.includes('@');
  }

  reportValidity() {
    return this.checkValidity();
  }

  focus() {}
  scrollIntoView() {}
}

function catalog(mode = 'test', version = 1) {
  return {
    mode, settings_version: version, currency: 'GHS', payment_providers: [{ key: 'paystack' }],
    flexible_checkout: {
      mode, unit_amount_minor: 15000, max_per_payment: 20,
      fee_rate_basis_points: 195, fee_policy: 'buyer_pays_processing', fee_rounding: 'ceil_minor',
    },
  };
}

function initialized(mode = 'test') {
  return {
    mode, reference: 'devcon26-managed-' + mode + '-' + 'b'.repeat(32), currency: 'GHS', quantity: 1,
    ticket_amount_minor: 15000, processing_fee_minor: 299, amount_minor: 15299,
    checkout_grant: 'scoped-grant', checkout_verifier: verifier,
    authorization_url: 'https://checkout.paystack.com/fixture',
  };
}

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function checkoutFixture(handler) {
  const page = new Element();
  const windowEvents = new Element();
  const assigned = [];
  const requests = [];
  const storage = new Map();
  const steps = [new Element(), new Element(), new Element()];
  const links = [new Element(), new Element(), new Element()];
  const next = [new Element(), new Element()];
  const back = [new Element(), new Element()];
  const form = page.querySelector('[data-live-form]');
  const name = page.querySelector('[data-name]');
  const email = page.querySelector('[data-email]');
  const quantity = page.querySelector('[data-quantity]');
  let challenge = 'human-check';
  let resetCount = 0;

  page.dataset.apiOrigin = apiOrigin;
  page.selectors.set('[data-checkout-step]', steps);
  page.selectors.set('[data-step-link]', links);
  page.selectors.set('[data-step-next]', next);
  page.selectors.set('[data-step-back]', back);
  page.selectors.set('[data-step-next], [data-step-back]', [...next, ...back]);
  page.selectors.set('.mobile-progress-track i', [new Element(), new Element(), new Element()]);
  steps[0].selectors.set('input:not([type="hidden"])', []);
  steps[1].selectors.set('input:not([type="hidden"])', [name, email]);
  name.value = 'Ada Buyer';
  name.required = true;
  email.value = 'ada@example.test';
  email.required = true;
  email.type = 'email';
  quantity.type = 'number';
  quantity.min = '1';
  quantity.value = '1';
  const module = { exports: {} };
  const document = {
    activeElement: null,
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
    querySelector: () => new Element(),
  };

  vm.runInNewContext(checkoutCode, {
    module, document, URL, URLSearchParams, AbortController, crypto: { randomUUID },
    console: { warn() {} },
    FormData: class { get() { return challenge; } },
    sessionStorage: { setItem: (key, value) => storage.set(key, value) },
    window: {
      setTimeout, clearTimeout,
      matchMedia: (query) => ({ matches: query.includes('reduced-motion'), addEventListener() {} }),
      addEventListener: (name, callback) => windowEvents.addEventListener(name, callback),
      location: { assign: (url) => assigned.push(url) },
      turnstile: { render() {}, reset() { resetCount += 1; } },
    },
    fetch: async (url, options) => {
      const request = { url: String(url), body: options.body ? JSON.parse(options.body) : null, options };

      requests.push(request);

      return handler(request, requests);
    },
  });
  module.exports.initializeFlexibleCheckout(page);

  return {
    page, form, steps, next, requests, assigned, storage, windowEvents,
    clearChallenge() { challenge = ''; },
    resets: () => resetCount,
    async review() {
      await next[0].fire('click');
      await next[1].fire('click');
    },
  };
}

for (const mode of ['test', 'live']) {
  const fixture = checkoutFixture((request) => response(request.body ? initialized(mode) : catalog(mode, 7)));

  await tick();
  assert.equal(fixture.requests[0].url, apiOrigin + path);
  assert.equal(fixture.page.querySelector('[data-payment-mode-notice]').hidden, mode !== 'test');
  assert.equal(fixture.page.querySelector('[data-checkout-layout]').hidden, false);
  assert.equal(fixture.requests.length, 1, 'Loading a catalog does not initialize payment');
  await fixture.review();
  await fixture.form.fire('submit');
  const body = fixture.requests[1].body;

  assert.equal(fixture.requests[1].url, apiOrigin + path + '/initialize');
  assert.equal(body.expected_mode, mode);
  assert.equal(body.settings_version, 7);
  assert.equal(body.turnstile_action, 'devcon26_checkout');
  assert.equal(body.turnstile_token, 'human-check');
  assert.equal(body.purchaser_email, 'ada@example.test');
  assert.deepEqual(body.cart.allocations, [{ kind: 'self' }]);
  assert.deepEqual(fixture.assigned, ['https://checkout.paystack.com/fixture']);
  assert.equal(fixture.page.querySelector('[data-subtotal]').textContent, 'GHS 150.00');
  assert.equal(fixture.page.querySelector('[data-processing-fee]').textContent, 'GHS 2.99');
  assert.equal(fixture.page.querySelector('[data-total]').textContent, 'GHS 152.99');
  assert.equal(fixture.page.querySelector('[data-mobile-total]').textContent, 'GHS 152.99');
  assert.match(fixture.page.querySelector('[data-pay]').firstChild.textContent, /GHS 152\.99/);
  const stored = JSON.parse([...fixture.storage.values()][0]);

  assert.equal(stored.mode, mode);
  assert.equal(stored.flow, 'managed');
  assert.equal(stored.reference, initialized(mode).reference);
}

let activeMode = 'test';
let initializationCount = 0;
const stale = checkoutFixture((request) => {
  if (!request.body) return response(catalog(activeMode, activeMode === 'test' ? 1 : 2));

  initializationCount += 1;
  if (initializationCount === 1) {
    activeMode = 'live';

    return response({ code: 'checkout_settings_changed' }, 409);
  }

  return response(initialized('live'));
});

await tick();
await stale.review();
await stale.form.fire('submit');
assert.equal(initializationCount, 1, 'Stale test settings never silently start a live checkout');
assert.equal(stale.requests.length, 3, 'A stale response only refreshes availability');
assert.equal(stale.steps[0].hidden, false, 'Changed settings return the buyer to ticket review');
assert.match(stale.page.querySelector('[data-payment-mode-notice]').textContent, /settings changed/);
assert.equal(stale.storage.size, 0);
assert.deepEqual(stale.assigned, []);
await tick();
assert.equal(initializationCount, 1, 'Waiting does not resubmit payment');
await stale.form.fire('submit');
await stale.form.fire('submit');
assert.equal(initializationCount, 1, 'Advancing both review steps does not submit payment');
await stale.form.fire('submit');
assert.equal(initializationCount, 2);
assert.equal(stale.requests[3].body.expected_mode, 'live');
assert.equal(stale.requests[3].body.settings_version, 2);
assert.notEqual(stale.requests[1].body.checkout_request_key, stale.requests[3].body.checkout_request_key);
assert.deepEqual(stale.assigned, ['https://checkout.paystack.com/fixture']);


let refreshCalls = 0;
const failedRefresh = checkoutFixture((request) => {
  if (request.body) return response({ code: 'checkout_settings_changed' }, 409);

  refreshCalls += 1;
  if (refreshCalls === 2) return response({ error: 'Temporarily unavailable' }, 503);

  return response(catalog(refreshCalls === 1 ? 'test' : 'live', refreshCalls === 1 ? 1 : 2));
});

await tick();
await failedRefresh.review();
await failedRefresh.form.fire('submit');
assert.equal(failedRefresh.page.querySelector('[data-checkout-layout]').hidden, true);
await failedRefresh.page.querySelector('[data-retry]').fire('click');
await tick();
assert.equal(failedRefresh.steps[0].hidden, false, 'A failed refresh retains the requirement to review after retry');
assert.match(failedRefresh.page.querySelector('[data-payment-mode-notice]').textContent, /settings changed/);
assert.equal(failedRefresh.requests.filter((request) => request.body).length, 1);

let resolvePayment;
let restored = false;
const departed = checkoutFixture((request) => {
  if (!request.body) return response(catalog(restored ? 'live' : 'test', restored ? 2 : 1));

  return new Promise((resolve) => { resolvePayment = resolve; });
});

await tick();
await departed.review();
const pendingSubmit = departed.form.fire('submit');

await tick();
await departed.windowEvents.fire('pagehide');
resolvePayment(response(initialized()));
await pendingSubmit;
assert.deepEqual(departed.assigned, [], 'A late initialization response cannot redirect after page departure');
assert.equal(departed.storage.size, 0);
restored = true;
await departed.windowEvents.fire('pageshow', { persisted: true });
await tick();
assert.equal(departed.steps[0].hidden, false, 'BFCache restoration notices a settings change and requires review');
assert.equal(departed.requests.filter((request) => request.body).length, 1, 'Restoration only refreshes the catalog');

let retryCount = 0;
const retry = checkoutFixture((request) => {
  if (!request.body) return response(catalog('live'));

  retryCount += 1;

  return retryCount === 1 ? response({ error: 'Provider temporarily unavailable.' }, 503) : response(initialized('live'));
});

await tick();
await retry.review();
await retry.form.fire('submit');
await retry.form.fire('submit');
assert.equal(retry.requests[1].body.checkout_request_key, retry.requests[2].body.checkout_request_key, 'Unchanged retries retain their idempotency key');
assert.equal(retry.resets(), 1);

for (const unavailable of [
  { mode: 'unavailable' },
  { ...catalog(), settings_version: 0 },
  { ...catalog(), flexible_checkout: { ...catalog().flexible_checkout, mode: 'live' } },
  { ...catalog(), flexible_checkout: { ...catalog().flexible_checkout, fee_rate_basis_points: 0 } },
  { ...catalog(), flexible_checkout: { ...catalog().flexible_checkout, fee_policy: 'organizer_pays_processing' } },
  { ...catalog(), flexible_checkout: { ...catalog().flexible_checkout, fee_rounding: 'floor_minor' } },
  { ...catalog(), payment_providers: [{ key: 'unreviewed-provider' }] },
]) {
  const fixture = checkoutFixture(() => response(unavailable));

  await tick();
  await fixture.review();
  await fixture.form.fire('submit');
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.page.querySelector('[data-pay]').disabled, true);
  assert.equal(fixture.page.querySelector('[data-checkout-layout]').hidden, true);
}

for (const invalid of [
  { ...initialized('test'), mode: 'live' },
  { ...initialized('test'), reference: initialized('live').reference },
  { ...initialized('test'), authorization_url: 'https://checkout.paystack.com.attacker.test/fixture' },
  { ...initialized('test'), authorization_url: 'https://user@checkout.paystack.com/fixture' },
  { ...initialized('test'), authorization_url: 'http://checkout.paystack.com/fixture' },
  { ...initialized('test'), ticket_amount_minor: 14999 },
  { ...initialized('test'), processing_fee_minor: 298 },
  { ...initialized('test'), amount_minor: 15298 },
]) {
  const fixture = checkoutFixture((request) => response(request.body ? invalid : catalog()));

  await tick();
  await fixture.review();
  await fixture.form.fire('submit');
  assert.deepEqual(fixture.assigned, []);
  assert.equal(fixture.storage.size, 0);
}

const humanCheck = checkoutFixture(() => response(catalog()));

await tick();
humanCheck.clearChallenge();
await humanCheck.review();
await humanCheck.form.fire('submit');
assert.equal(humanCheck.requests.length, 1, 'A missing human check cannot initialize either payment mode');

function confirmationFixture(reference, mode, options = {}) {
  const root = new Element();
  const requests = [];
  const badgeCalls = [];
  const module = { exports: {} };

  root.dataset.checkoutApiOrigin = apiOrigin;
  vm.runInNewContext(confirmationCode, {
    module, URL, URLSearchParams, AbortController, document: {},
    sessionStorage: { getItem: () => options.missingGrant ? null : JSON.stringify({
      reference, checkout_grant: 'scoped-grant', checkout_verifier: verifier,
    }) },
    window: {
      location: { search: '?reference=' + reference, hash: '', pathname: '/devcon26/payment-confirmation/' },
      history: { replaceState() {} }, setTimeout, clearTimeout, addEventListener() {},
    },
    fetch: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });

      return response({
        mode: options.responseMode ?? mode, status: options.status ?? 'verified', currency: 'GHS', quantity: 1,
        ticket_amount_minor: 15000, processing_fee_minor: 299, amount_paid_minor: 15299,
        card_quantity: 1, buyer_grant: 'self-seat-grant',
      });
    },
  });
  module.exports.initializeDevcon26PaymentConfirmation(root, (...args) => badgeCalls.push(args));

  return { root, requests, badgeCalls, exports: module.exports };
}

for (const mode of ['test', 'live']) {
  const fixture = confirmationFixture(initialized(mode).reference, mode);

  await tick();
  assert.equal(fixture.requests[0].url, apiOrigin + path + '/verify');
  assert.deepEqual(Object.keys(fixture.requests[0].body).sort(), ['checkout_grant', 'checkout_verifier', 'reference']);
  assert.equal(fixture.root.dataset.paymentState, 'verified');
  assert.equal(fixture.root.querySelector('[data-payment-mode-notice]').hidden, mode !== 'test');
  assert.equal(fixture.root.querySelector('[data-payment-fee-row]').hidden, false);
  assert.equal(fixture.root.querySelector('[data-payment-fee]').textContent, 'GHS 2.99');
  assert.equal(fixture.badgeCalls.length, 1, 'Both modes can open only their self-scoped badge grant');
  assert.equal(fixture.badgeCalls[0][2], 'self-seat-grant');
  const shown = fixture.exports.devcon26BuyerReference(initialized(mode).reference);

  assert.equal(fixture.exports.devcon26ConfirmationReference('#reference=' + shown), initialized(mode).reference);
}

for (const options of [{ missingGrant: true }, { responseMode: 'live' }]) {
  const fixture = confirmationFixture(initialized('test').reference, 'test', options);

  await tick();
  assert.equal(fixture.root.dataset.paymentState, options.missingGrant ? 'access_lost' : 'error');
  assert.equal(fixture.root.querySelector('[data-payment-receipt]').hidden, true);
  assert.equal(fixture.badgeCalls.length, 0);
  if (options.missingGrant) {
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.root.querySelector('[data-payment-retry]').hidden, true);
  }
}

for (const [reference, verifyPath] of [
  ['devcon26-complete-test-' + 'b'.repeat(32), '/api/public/annual-conference/2026/complete-test-checkout/verify'],
  ['devcon26_' + 'b'.repeat(32), '/api/public/annual-conference/2026/checkout/flexible/verify'],
  ['devcon26-test-' + 'b'.repeat(32), '/api/public/annual-conference/2026/test-checkout/verify'],
]) {
  const fixture = confirmationFixture(reference, reference.startsWith('devcon26_') ? 'live' : 'test');

  await tick();
  assert.equal(fixture.requests[0].url, apiOrigin + verifyPath, 'Existing initialized references retain their verification route');
}

async function accessFixture(hash, claim = false) {
  const page = new Element();
  const requests = [];
  const module = { exports: {} };
  const form = page.querySelector('[data-claim-form]');

  page.dataset.apiOrigin = apiOrigin;
  form.querySelector('#claim-name').value = 'Recipient';
  form.querySelector('#claim-email').value = 'recipient@example.test';
  vm.runInNewContext(accessCode, {
    module, URL, URLSearchParams, AbortSignal,
    document: { createElement: (tag) => new Element(tag), createDocumentFragment: () => new Element('fragment') },
    window: { location: { hash }, addEventListener() {} },
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body) });

      return response(claim ? { status: 'claimed', seat_number: 1, delivery_queued: true } : { allocations: [{
        allocation_id: '11111111-1111-1111-1111-111111111111', seat_number: 1, kind: 'self',
        ticket_status: 'issued', claim_status: 'used', can_rotate_claim: false,
      }] });
    },
  });
  if (claim) {
    module.exports.initializeTicketClaim(page);
    await form.fire('submit');
  } else {
    module.exports.initializeTicketManagement(page);
    await tick();
  }

  return { page, requests };
}

for (const claim of [false, true]) {
  for (const key of ['key', 'capability']) {
    const fixture = await accessFixture('#' + key + '=' + capability, claim);

    assert.equal(fixture.requests.length, 1, 'Actual emailed and canonical fragment links open');
    assert.equal(fixture.requests[0].body.capability, capability);
  }

  for (const hash of [
    '#capability=' + capability + '&key=' + capability,
    '#capability=' + capability + '&capability=' + capability,
    '#key=' + capability + '&key=' + capability,
    '#capability=' + capability + '&key=' + 'b'.repeat(64),
    '#key=invalid', '',
  ]) {
    const fixture = await accessFixture(hash, claim);

    assert.equal(fixture.requests.length, 0, 'Ambiguous, duplicated, conflicting, or malformed private links fail closed');
  }
}

const config = readFileSync('astro.config.mjs', 'utf8');
const page = readFileSync('src/pages/devcon26/checkout.astro', 'utf8');

assert.ok(!config.includes('WORKERS_CI_BRANCH') && !config.includes('full-test-events-management'));
assert.ok(!page.includes('PUBLIC_DEVCON26_COMPLETE_TEST') && !page.includes('data-complete-test'));
assert.ok(page.includes('data-payment-mode-notice') && page.includes('data-checkout-challenge'));
console.log('PASS managed checkout: runtime test/live, stale-settings review without resubmission, bounded retries, fail-closed catalog/redirects, historical callbacks, and actual private email links.');

for (const mode of ['test', 'live']) {
  const fixture = confirmationFixture(initialized(mode).reference, mode, { missingGrant: true });

  await tick();
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.root.querySelector('[data-payment-retry]').hidden, true);
  assert.equal(fixture.root.dataset.paymentState, 'access_lost');
  assert.equal(fixture.root.querySelector('[data-checkout-recovery]').hidden, false);
  assert.equal(fixture.root.querySelector('[data-payment-receipt]').hidden, true);
  assert.equal(fixture.root.querySelector('[data-recovery-reference]').textContent, fixture.exports.devcon26BuyerReference(initialized(mode).reference));
  assert.ok(fixture.root.querySelector('[data-recovery-contact]').attributes.get('href').startsWith('mailto:hello@devcongress.org?subject='));
}
console.log('PASS lost-session recovery: no unauthenticated request or useless Retry in either mode.');
