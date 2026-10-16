import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const APPROVED_PDF_SHA256 = '568b3c1033927570be176238816b4ebb86498576dd8e9960eaafa836f0d01ade';
const require = createRequire(root + '/package.json');
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');

async function bundle(entry) {
  const result = await build({
    entryPoints: [root + '/' + entry],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    write: false,
    logLevel: 'silent',
  });

  return result.outputFiles[0].text;
}

const contractCode = await bundle('src/lib/devcon26-checkout-contract.ts');
const contractModule = { exports: {} };

vm.runInNewContext(contractCode, { module: contractModule, Intl, URL, Number, Object });

const { devcon26Quote } = contractModule.exports;
const quote = {
  mode: 'test',
  tier_key: 'regular',
  quantity: 1,
  currency: 'GHS',
  base_amount_minor: 19999,
  discount_amount_minor: 1000,
  final_amount_minor: 18999,
  coupon_applied: 'SAVE-10',
};

assert.ok(devcon26Quote(quote));
assert.ok(devcon26Quote({ ...quote, discount_amount_minor: 0, final_amount_minor: 19999, coupon_applied: null }));
assert.equal(devcon26Quote({ ...quote, discount_amount_minor: 0, final_amount_minor: 19999 }), null);
assert.equal(devcon26Quote({ ...quote, coupon_applied: null }), null);
assert.equal(devcon26Quote({ ...quote, final_amount_minor: 0 }), null);
assert.equal(devcon26Quote({ ...quote, final_amount_minor: 20000 }), null);
assert.equal(devcon26Quote({ ...quote, mode: 'live' }), null);
assert.equal(devcon26Quote({ ...quote, quantity: 3 }), null);
assert.equal(devcon26Quote({ ...quote, amount_minor: 19999 }), null);

const confirmationCode = await bundle('src/lib/devcon26-payment-confirmation.ts');
const confirmationModule = { exports: {} };
const testReference = 'devcon26-test-' + 'a'.repeat(32);

vm.runInNewContext(confirmationCode, { module: confirmationModule, Intl, URL, URLSearchParams, Number, Object });

const {
  devcon26ConfirmationQueryReference,
  devcon26ConfirmationReference,
  devcon26ConfirmationUrl,
  devcon26TestPaymentSummary,
} = confirmationModule.exports;
const directConfirmationSearch = '?test_checkout=return&reference=' + testReference + '&trxref=' + testReference;

assert.equal(devcon26ConfirmationQueryReference(directConfirmationSearch), testReference);
assert.equal(devcon26ConfirmationQueryReference('?reference=DC26-' + 'A'.repeat(32)), testReference);
assert.equal(devcon26ConfirmationQueryReference('?reference=' + testReference + '&reference=' + testReference), null);
assert.equal(devcon26ConfirmationReference('#reference=DC26-' + 'A'.repeat(32)), testReference);
assert.equal(devcon26ConfirmationUrl(testReference), '/devcon26/payment-confirmation/#reference=' + testReference);
assert.equal(devcon26ConfirmationQueryReference('?reference=devcon26_' + 'a'.repeat(32)), 'devcon26_' + 'a'.repeat(32));
const verified = devcon26TestPaymentSummary({ ...quote, status: 'verified', amount_minor: 18999 });

assert.equal(verified.amount, 'GHS 189.99');
assert.equal(verified.baseAmount, 'GHS 199.99');
assert.equal(verified.discountAmount, 'GHS 10.00');
assert.equal(verified.coupon, 'SAVE-10');
assert.equal(devcon26TestPaymentSummary({ ...quote, status: 'refund_required', amount_minor: 18999 }).status, 'refund_required');
assert.equal(devcon26TestPaymentSummary({ mode: 'test', status: 'verified', tier_key: 'regular', quantity: 1, currency: 'GHS', amount_minor: 19999 }).amount, 'GHS 199.99');
assert.equal(devcon26TestPaymentSummary({ mode: 'test', status: 'verified', tier_key: 'regular', quantity: 1, currency: 'GHS', amount_minor: 19999, base_amount_minor: 19999 }), null);

const navigationCode = await bundle('src/lib/devcon26-checkout-navigation.ts');

for (const [search, expected] of [
  ['?test_checkout=return&reference=' + testReference + '&trxref=' + testReference, '/devcon26/payment-confirmation/#reference=' + testReference],
  ['?test_checkout=return', '/devcon26/payment-confirmation/'],
  ['?test_checkout=return&reference=invalid', '/devcon26/payment-confirmation/'],
  ['?test_checkout=return&reference=' + testReference + '&reference=' + testReference, '/devcon26/payment-confirmation/'],
  ['?test_checkout=return&test_checkout=other&reference=' + testReference, '/devcon26/payment-confirmation/'],
  ['?tier=regular', null],
]) {
  const module = { exports: {} };
  const cleaned = [];
  const destinations = [];
  const window = {
    location: { href: 'https://devcongress.org/devcon26/' + search, replace: (url) => destinations.push(url) },
    history: { replaceState: (_state, _title, url) => cleaned.push(url) },
  };

  vm.runInNewContext(navigationCode, { module, window, URL, URLSearchParams, Intl, Number, Object });
  module.exports.redirectDevcon26PaymentReturn();
  assert.deepEqual(destinations, expected ? [expected] : []);

  if (expected) {
    assert.equal(cleaned.length, 1);
    assert.ok(!/reference|trxref|test_checkout/.test(cleaned[0]), 'Legacy callback parameters are removed before confirmation navigation');
  }
}

class Element {
  constructor() {
    this.dataset = {};
    this.listeners = new Map();
    this.children = new Map();
    this.attributes = new Map();
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.open = false;
    this.style = { height: '' };
    this.scrollTop = 0;
  }

  querySelector(selector) {
    return this.children.get(selector) || null;
  }

  querySelectorAll(selector) {
    return this.children.get(selector) || [];
  }

  addEventListener(name, callback) {
    this.listeners.set(name, [...(this.listeners.get(name) || []), callback]);
  }

  async fire(name, event = {}) {
    for (const callback of this.listeners.get(name) || []) {
      await callback({ preventDefault: noop, target: this, ...event });
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  setCustomValidity(value) {
    this.invalid = value;
  }

  reportValidity() {
    return true;
  }

  contains(element) {
    return this === element || [...this.children.values()].some((child) => child instanceof Element && child.contains(element));
  }

  focus() {
    this.focused = true;
  }
}

function noop() {
  // Fake DOM events and navigation have no browser default action.
}

function child(parent, selector) {
  const element = new Element();

  parent.children.set(selector, element);

  return element;
}

const checkoutCode = await bundle('src/lib/devcon26-checkout.ts');

function checkoutFixture({ motion = false, search = '?tier=regular', origin = 'https://em.devcongress.org' } = {}) {
  const page = new Element();
  const form = child(page, '[data-checkout-buyer-form]');
  const fields = child(form, '[data-checkout-fields]');
  const invalid = child(page, '[data-checkout-invalid]');
  const elements = {};
  const requests = [];
  const assigned = [];
  const animations = [];
  const reducedMotion = new Element();
  const windowEvents = new Element();
  const document = { activeElement: null };

  fields.disabled = true;
  invalid.hidden = true;
  reducedMotion.matches = !motion;

  for (const name of ['purchaser-name', 'purchaser-email', 'coupon-code', 'coupon', 'coupon-apply', 'coupon-remove', 'coupon-status', 'payment', 'retry', 'quote', 'base', 'discount', 'final', 'discount-row', 'price-status']) {
    elements[name] = child(form, '[data-checkout-' + name + ']');
  }

  const notice = child(form, '[data-checkout-notice]');

  elements['notice-title'] = child(notice, '[data-checkout-notice-title]');
  elements['notice-copy'] = child(notice, '[data-checkout-notice-copy]');
  elements.notice = notice;
  elements['payment-label'] = child(elements.payment, '[data-checkout-payment-label]');
  elements.photo = child(page, '[data-checkout-photo]');
  elements.photo.hidden = true;
  elements['ticket-name'] = child(page, '[data-checkout-ticket-name]');
  elements['ticket-quantity'] = child(page, '[data-checkout-ticket-quantity]');
  elements['coupon-summary'] = child(elements.coupon, 'summary');
  elements['coupon-label'] = child(elements['coupon-summary'], '[data-checkout-coupon-label]');
  elements['coupon-action'] = child(elements['coupon-summary'], '[data-checkout-coupon-action]');
  elements['coupon-content'] = child(elements.coupon, '[data-checkout-coupon-content]');
  elements['coupon-content'].children.set('input', elements['coupon-code']);
  elements['coupon-summary'].focus = () => {
    document.activeElement = elements['coupon-summary'];
  };
  page.dataset.checkoutApiOrigin = origin;
  elements['purchaser-name'].value = ' Ada Buyer ';
  elements['purchaser-email'].value = ' ADA@EXAMPLE.ORG ';

  if (motion) {
    elements['coupon-content'].animate = (keyframes, options) => {
      animations.push({ keyframes, options });
    };
  }

  const window = {
    matchMedia: () => reducedMotion,
    setTimeout,
    clearTimeout,
    addEventListener: (name, callback) => windowEvents.addEventListener(name, callback),
    location: {
      href: 'https://devcongress.org/devcon26/checkout/' + search,
      search,
      assign: (url) => assigned.push(url),
    },
  };
  const fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url: String(url), options, body: options.body ? JSON.parse(options.body) : null, resolve, reject });
  });
  const module = { exports: {} };

  vm.runInNewContext(checkoutCode, { module, document, window, fetch, URL, URLSearchParams, Intl, Number, Object, AbortController, crypto: { randomUUID } });
  module.exports.initializeDevcon26Checkout(page);

  return { page, form, fields, invalid, elements, document, requests, assigned, animations, reducedMotion, windowEvents };
}

async function toggleCoupon(fixture, open) {
  fixture.elements.coupon.open = open;
  await fixture.elements.coupon.fire('toggle');
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

function respond(request, payload, status = 200) {
  request.resolve({ ok: status >= 200 && status < 300, status, json: async () => payload });
}

const baseQuote = { ...quote, discount_amount_minor: 0, final_amount_minor: 19999, coupon_applied: null };
const catalog = { mode: 'test', accepts_coupon: true, tiers: [{ tier_key: 'regular', currency: 'GHS', amount_minor: 19999 }] };

const attentionRoot = new Element();
const attentionElements = {};

for (const selector of [
  'payment-title', 'payment-copy', 'payment-status', 'payment-receipt', 'payment-attention',
  'payment-retry', 'payment-print', 'attention-reference', 'attention-amount',
]) {
  attentionElements[selector] = child(attentionRoot, '[data-' + selector + ']');
}

attentionRoot.dataset.checkoutApiOrigin = 'https://em.devcongress.org';
const attentionModule = { exports: {} };
let resolveAttention;
let printed = false;

vm.runInNewContext(confirmationCode, {
  module: attentionModule,
  URL,
  URLSearchParams,
  Intl,
  Number,
  Object,
  AbortController,
  document: { title: '' },
  window: {
    location: { hash: '#reference=DC26-' + 'A'.repeat(32), pathname: '/devcon26/payment-confirmation/', search: '' },
    history: { replaceState: noop },
    setTimeout,
    clearTimeout,
    addEventListener: noop,
    print() {
      printed = true;
    },
  },
  fetch: () => new Promise((resolve) => {
    resolveAttention = resolve;
  }),
});

attentionModule.exports.initializeDevcon26PaymentConfirmation(attentionRoot);
resolveAttention({ ok: true, status: 200, json: async () => ({ ...quote, status: 'refund_required', amount_minor: 18999 }) });
await tick();
assert.equal(attentionRoot.dataset.paymentState, 'refund_required');
assert.equal(attentionElements['payment-receipt'].hidden, true);
assert.equal(attentionElements['payment-attention'].hidden, false);
assert.equal(attentionElements['payment-title'].textContent, 'Your payment needs attention.');
await attentionElements['payment-print'].fire('click');
assert.equal(printed, false);

async function readyFixture(options) {
  const fixture = checkoutFixture(options);

  respond(fixture.requests[0], catalog);
  await tick();
  respond(fixture.requests[1], baseQuote);
  await tick();

  return fixture;
}

for (const search of ['', '?tier=wrong', '?tier=regular&tier=team_3', '?tier=__proto__', '?tier=team-3']) {
  const invalid = checkoutFixture({ search });

  assert.equal(invalid.requests.length, 0, 'Invalid selection never starts an API request');
  assert.equal(invalid.fields.disabled, true);
  assert.equal(invalid.form.hidden, true);
  assert.equal(invalid.invalid.hidden, false);
  assert.equal(invalid.elements.photo.hidden, true, 'Invalid selection never selects a photo');
}

const hinted = checkoutFixture({ search: '?tier=regular&price_minor=19999' });

assert.equal(hinted.elements.quote.hidden, false, 'A valid ticket-page price appears before the checkout API responds');
assert.equal(hinted.elements.base.textContent, 'GHS 199.99');
assert.equal(hinted.elements.final.textContent, 'GHS 199.99');
assert.equal(hinted.elements['price-status'].textContent, 'Price shown from the ticket page; confirming with ticketing…');
assert.equal(hinted.elements.payment.disabled, true, 'A displayed price hint cannot enable payment');
assert.equal(hinted.requests[0].body, null, 'The display-only price hint is never sent to availability');
respond(hinted.requests[0], catalog);
await tick();
assert.equal(hinted.requests[1].body.tier_key, 'regular');
assert.equal(Object.hasOwn(hinted.requests[1].body, 'price_minor'), false, 'The display-only price hint is never sent to the quote API');
assert.equal(hinted.elements.base.textContent, 'GHS 199.99', 'The previous page price remains visible while quote is pending');
respond(hinted.requests[1], baseQuote);
await tick();
assert.equal(hinted.elements.base.textContent, 'GHS 199.99', 'A matching server quote does not change the displayed amount');
assert.equal(hinted.elements.final.textContent, 'GHS 199.99');
assert.equal(hinted.elements['price-status'].textContent, 'Current ticket price confirmed by ticketing.');
assert.equal(hinted.elements.payment.disabled, false, 'Only the server quote enables payment');

const changedHint = checkoutFixture({ search: '?tier=regular&price_minor=19999' });
const updatedQuote = { ...baseQuote, base_amount_minor: 21999, final_amount_minor: 21999 };

respond(changedHint.requests[0], catalog);
await tick();
respond(changedHint.requests[1], updatedQuote);
await tick();
assert.equal(changedHint.elements.base.textContent, 'GHS 219.99', 'A changed server price replaces the prior-page hint');
assert.equal(changedHint.elements.final.textContent, 'GHS 219.99');
assert.match(changedHint.elements['price-status'].textContent, /ticket price changed to GHS 219\.99/);

for (const search of [
  '?tier=regular&price_minor=0',
  '?tier=regular&price_minor=abc',
  '?tier=regular&price_minor=19999&price_minor=20999',
  '?tier=regular&price_minor=9007199254740992',
]) {
  const invalidHint = checkoutFixture({ search });

  assert.equal(invalidHint.elements.quote.hidden, true, 'Malformed or duplicate display hints are ignored');
}

const quoteUnavailable = checkoutFixture({ search: '?tier=regular&price_minor=19999' });

respond(quoteUnavailable.requests[0], catalog);
await tick();
quoteUnavailable.requests[1].reject(new Error('Quote unavailable'));
await tick();
assert.equal(quoteUnavailable.elements.payment.disabled, true, 'Payment stays disabled when the server quote fails');
assert.equal(quoteUnavailable.elements.retry.hidden, false, 'A separate retry remains available after quote failure');
assert.equal(quoteUnavailable.elements.final.textContent, 'GHS 199.99', 'The prior-page amount remains visibly provisional after quote failure');
await quoteUnavailable.elements.retry.fire('click');
assert.ok(quoteUnavailable.requests[2].url.endsWith('/quote'), 'Retry repeats price verification without starting payment');
assert.equal(quoteUnavailable.elements.payment.disabled, true);

for (const [tier, name, quantity, amount, photo] of [
  ['regular', 'Regular ticket', 1, 19999, 'ticket-solo.webp'],
]) {
  const selected = checkoutFixture({ search: '?tier=' + tier });
  const selectedQuote = { ...baseQuote, tier_key: tier, quantity, base_amount_minor: amount, final_amount_minor: amount };

  assert.equal(selected.elements['ticket-name'].textContent, name);
  assert.equal(selected.elements['ticket-quantity'].textContent, quantity + (quantity === 1 ? ' person' : ' people'));
  assert.equal(selected.elements.photo.src, '/images/devcon26/' + photo);
  assert.equal(selected.elements.photo.hidden, false);
  assert.ok(readFileSync(root + '/public' + selected.elements.photo.src).length > 0, 'Selected photo exists locally');
  assert.equal(selected.fields.disabled, false);
  respond(selected.requests[0], { ...catalog, tiers: [{ tier_key: tier, currency: 'GHS', amount_minor: amount }] });
  await tick();
  assert.deepEqual(selected.requests[1].body, { tier_key: tier });
  respond(selected.requests[1], selectedQuote);
  await tick();
  assert.equal(selected.elements.payment.disabled, false);
  assert.equal(selected.elements['payment-label'].textContent, 'Continue to payment');
  assert.equal(selected.elements.payment.textContent, '', 'State changes update the label, preserving the button icon');
  assert.equal(selected.requests.length, 2, 'Page load only checks catalog and quote');
  assert.equal(selected.assigned.length, 0);
}

const disclosure = await readyFixture();

for (const tier of ['team_3', 'team_5']) {
  const retired = checkoutFixture({ search: '?tier=' + tier });
  assert.equal(retired.requests.length, 0, 'Retired group tiers cannot start checkout');
  assert.equal(retired.fields.disabled, true);
}

const registrationModule = { exports: {} };
vm.runInNewContext(await bundle('src/lib/devcon26-registration-contract.ts'), { module: registrationModule });
const { parseRegistrationMode } = registrationModule.exports;
assert.equal(parseRegistrationMode({ mode: 'free', waitlist: true }).waitlist, true);
assert.equal(parseRegistrationMode({ mode: 'paid' }).mode, 'paid');
assert.equal(parseRegistrationMode({ mode: 'closed' }).mode, 'closed');
assert.equal(parseRegistrationMode({ mode: 'unexpected' }), null);

assert.equal(disclosure.elements['coupon-content'].inert, true);
await toggleCoupon(disclosure, true);
assert.equal(disclosure.elements['coupon-content'].inert, false);
await toggleCoupon(disclosure, false);
assert.equal(disclosure.elements['coupon-content'].inert, true);
assert.equal(disclosure.animations.length, 0, 'Reduced motion skips animations');
assert.equal(disclosure.requests.length, 2, 'Disclosure does not request a new quote');
assert.equal(disclosure.elements.photo.src, '/images/devcon26/ticket-solo.webp', 'Coupon toggles retain the selected background');

const movingDisclosure = await readyFixture({ motion: true });

await toggleCoupon(movingDisclosure, true);
assert.equal(movingDisclosure.animations.length, 1);
assert.equal(movingDisclosure.animations[0].options.duration, 180);
assert.equal(movingDisclosure.animations[0].options.easing, 'cubic-bezier(0.16, 1, 0.3, 1)');
assert.ok(movingDisclosure.animations[0].keyframes.every((frame) => Object.keys(frame).every((property) => ['transform', 'opacity'].includes(property))));

const applied = await readyFixture();

await toggleCoupon(applied, true);
applied.elements['coupon-code'].value = 'save-10';
await applied.elements['coupon-code'].fire('input');
applied.document.activeElement = applied.elements['coupon-code'];
await applied.elements['coupon-apply'].fire('click');
respond(applied.requests[2], quote);
await tick();
assert.equal(applied.elements.coupon.open, false, 'Applying a coupon collapses the editor');
assert.equal(applied.document.activeElement, applied.elements['coupon-summary'], 'Collapsed fields return focus to the summary');
assert.equal(applied.elements['coupon-label'].textContent, 'SAVE-10 applied');
assert.equal(applied.elements['coupon-action'].textContent, 'Change');
assert.equal(applied.elements['coupon-remove'].hidden, false);
assert.equal(applied.elements.final.textContent, 'GHS 189.99');
await toggleCoupon(applied, true);
assert.equal(applied.requests.length, 3, 'Change keeps the accepted quote until the draft changes');
assert.equal(applied.elements.payment.disabled, false);
applied.elements['coupon-code'].value = 'OTHER-CODE';
await applied.elements['coupon-code'].fire('input');
assert.equal(applied.elements.payment.disabled, true, 'Editing requires an explicit new quote');
applied.document.activeElement = applied.elements['coupon-remove'];
await applied.elements['coupon-remove'].fire('click');
assert.equal(applied.document.activeElement, applied.elements['coupon-summary'], 'Removing a coupon returns focus before the Remove button is hidden');
assert.deepEqual(applied.requests[3].body, { tier_key: 'regular' });
respond(applied.requests[3], baseQuote);
await tick();
assert.equal(applied.elements.coupon.open, false);
assert.equal(applied.elements['coupon-label'].textContent, 'Have a coupon?');
assert.equal(applied.elements.final.textContent, 'GHS 199.99');

const keyboardCoupon = await readyFixture();

keyboardCoupon.elements['coupon-code'].value = 'SAVE-10';
await keyboardCoupon.elements['coupon-code'].fire('input');
await keyboardCoupon.elements['coupon-code'].fire('keydown', { key: 'Enter' });
assert.ok(keyboardCoupon.requests[2].url.endsWith('/quote'), 'Enter in the coupon field applies a quote, never initializes payment');
respond(keyboardCoupon.requests[2], quote);
await tick();
await toggleCoupon(keyboardCoupon, true);
await keyboardCoupon.elements['coupon-code'].fire('keydown', { key: 'Enter' });
assert.ok(keyboardCoupon.requests[3].url.endsWith('/quote'), 'Enter on an unchanged applied coupon still cannot start payment');
respond(keyboardCoupon.requests[3], quote);
await tick();
assert.equal(keyboardCoupon.assigned.length, 0);

const discounted = await readyFixture();

discounted.elements['coupon-code'].value = 'SAVE-10';
await discounted.elements['coupon-code'].fire('input');
await discounted.elements['coupon-apply'].fire('click');
respond(discounted.requests[2], quote);
await tick();
const discountedSubmission = discounted.form.fire('submit');

assert.equal(discounted.requests[3].body.coupon_code, 'SAVE-10');
respond(discounted.requests[3], { ...quote, authorization_url: 'https://checkout.paystack.com/valid' });
await discountedSubmission;
assert.deepEqual(discounted.assigned, ['https://checkout.paystack.com/valid']);

for (const invalidCatalog of [
  { ...catalog, mode: 'live' },
  { ...catalog, accepts_coupon: false },
  { ...catalog, tiers: [] },
  { ...catalog, tiers: [{ tier_key: 'regular', currency: 'USD', amount_minor: 19999 }] },
]) {
  const unavailable = checkoutFixture();

  respond(unavailable.requests[0], invalidCatalog);
  await tick();
  assert.equal(unavailable.requests.length, 1);
  assert.equal(unavailable.elements.quote.hidden, true);
  assert.equal(unavailable.elements.payment.disabled, true, 'Payment stays disabled if availability cannot be verified');
  assert.equal(unavailable.elements['notice-title'].textContent, 'We couldn’t connect to checkout.');
}

for (const origin of ['http://api.example.org', 'https://user:pass@api.example.org', 'https://api.example.org/path', 'https://api.example.org/?secret=1']) {
  const invalidOrigin = checkoutFixture({ origin });

  await tick();
  assert.equal(invalidOrigin.requests.length, 0, 'Unsafe API origins never receive a request');
}

const changed = await readyFixture({ search: '?tier=regular&price_minor=19999' });
const firstSubmission = changed.form.fire('submit');
const initialize = changed.requests[2];

assert.equal(initialize.body.purchaser_name, 'Ada Buyer');
assert.equal(initialize.body.purchaser_email, 'ada@example.org');
assert.deepEqual(Object.keys(initialize.body).sort(), ['checkout_request_key', 'purchaser_email', 'purchaser_name', 'tier_key']);
assert.equal(Object.hasOwn(initialize.body, 'price_minor'), false, 'The display-only price hint is never sent to payment initialization');
changed.elements['purchaser-name'].value = 'Changed Buyer';
await changed.elements['purchaser-name'].fire('input');
respond(initialize, { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
await firstSubmission;
assert.equal(changed.assigned.length, 0);

const retrySubmission = changed.form.fire('submit');

assert.notEqual(changed.requests[3].body.checkout_request_key, initialize.body.checkout_request_key);
respond(changed.requests[3], { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
await retrySubmission;
assert.equal(changed.assigned.length, 1);

const leftPage = await readyFixture();
const leavingSubmission = leftPage.form.fire('submit');
const leavingKey = leftPage.requests[2].body.checkout_request_key;

await leftPage.windowEvents.fire('pagehide');
assert.equal(leftPage.requests[2].options.signal.aborted, true);
respond(leftPage.requests[2], { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
await leavingSubmission;
assert.equal(leftPage.assigned.length, 0, 'Responses cannot redirect after leaving the page');
await leftPage.form.fire('submit');
assert.equal(leftPage.requests.length, 3, 'A hidden page cannot start another request');
await leftPage.windowEvents.fire('pageshow', { persisted: true });
respond(leftPage.requests[3], catalog);
await tick();
respond(leftPage.requests[4], baseQuote);
await tick();
assert.equal(leftPage.requests.length, 5, 'BFCache restore only refreshes availability and quote');
const restoredSubmission = leftPage.form.fire('submit');

assert.equal(leftPage.requests[5].body.checkout_request_key, leavingKey, 'BFCache preserves the unchanged checkout key');
respond(leftPage.requests[5], { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
await restoredSubmission;
assert.equal(leftPage.assigned.length, 1);

const stale = await readyFixture();

stale.elements['coupon-code'].value = 'SAVE-10';
await stale.elements['coupon-code'].fire('input');
await stale.elements['coupon-apply'].fire('click');
const oldCouponRequest = stale.requests[2];

stale.elements['coupon-code'].value = 'OTHER-CODE';
await stale.elements['coupon-code'].fire('input');
respond(oldCouponRequest, quote);
await tick();
assert.equal(stale.elements.payment.disabled, true);
assert.equal(stale.elements.quote.hidden, true);

const updated = await readyFixture();
const amountSubmission = updated.form.fire('submit');

respond(updated.requests[2], { ...baseQuote, base_amount_minor: 20999, final_amount_minor: 20999, authorization_url: 'https://checkout.paystack.com/valid' });
await amountSubmission;
assert.equal(updated.assigned.length, 0);
assert.equal(updated.elements.final.textContent, 'GHS 209.99');

const network = await readyFixture();
const failedSubmission = network.form.fire('submit');
const failedKey = network.requests[2].body.checkout_request_key;

network.requests[2].reject(new Error('Network failed'));
await failedSubmission;
const repeatedSubmission = network.form.fire('submit');

assert.equal(network.requests[3].body.checkout_request_key, failedKey);
respond(network.requests[3], { ...baseQuote, authorization_url: 'https://evil.example/checkout' });
await repeatedSubmission;
assert.equal(network.assigned.length, 0);

for (const checkoutError of ['finished', 'cart_conflict']) {
  const expired = await readyFixture();
  const expiredSubmission = expired.form.fire('submit');
  const expiredKey = expired.requests[2].body.checkout_request_key;

  respond(expired.requests[2], { checkout_error: checkoutError }, 409);
  await expiredSubmission;
  assert.equal(expired.elements.quote.hidden, true);
  const requoteSubmission = expired.form.fire('submit');

  respond(expired.requests[3], baseQuote);
  await requoteSubmission;
  await tick();
  const freshSubmission = expired.form.fire('submit');

  assert.notEqual(expired.requests[4].body.checkout_request_key, expiredKey);
  respond(expired.requests[4], { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
  await freshSubmission;
  assert.equal(expired.assigned.length, 1);
}

const progressing = await readyFixture();
const progressingSubmission = progressing.form.fire('submit');
const progressingKey = progressing.requests[2].body.checkout_request_key;

respond(progressing.requests[2], { checkout_error: 'in_progress' }, 409);
await progressingSubmission;
const progressingRetry = progressing.form.fire('submit');

assert.equal(progressing.requests[3].body.checkout_request_key, progressingKey);
respond(progressing.requests[3], { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
await progressingRetry;

for (const authorizationUrl of [
  'http://checkout.paystack.com/valid',
  'https://checkout.paystack.com.evil.example/valid',
  'https://user:password@checkout.paystack.com/valid',
  'https://checkout.paystack.com:444/valid',
  'javascript:alert(1)',
]) {
  const unsafe = await readyFixture();
  const submission = unsafe.form.fire('submit');

  respond(unsafe.requests[2], { ...baseQuote, authorization_url: authorizationUrl });
  await submission;
  assert.equal(unsafe.assigned.length, 0, 'Unsafe provider destinations are rejected');
}

for (const couponError of ['invalid', 'expired', 'ineligible', 'unavailable']) {
  const bounded = await readyFixture();

  bounded.elements['coupon-code'].value = 'SAVE-10';
  await bounded.elements['coupon-code'].fire('input');
  await bounded.elements['coupon-apply'].fire('click');
  respond(bounded.requests[2], { error: 'Do not render this untrusted message', coupon_error: couponError }, 400);
  await tick();
  assert.equal(bounded.elements.payment.disabled, true);
  assert.equal(bounded.elements.quote.hidden, true);
  assert.equal(bounded.elements.coupon.open, true);
  assert.ok(!bounded.elements['coupon-status'].textContent.includes('untrusted'));
}

const html = readFileSync(root + '/dist/devcon26/index.html', 'utf8');
const homeHtml = readFileSync(root + '/dist/index.html', 'utf8');
const sponsorSection = html.slice(html.indexOf('<section id="sponsors"'), html.indexOf('<section id="faqs"'));
const checkoutSource = readFileSync(root + '/src/pages/devcon26/checkout.astro', 'utf8');
const checkoutHtml = readFileSync(root + '/dist/devcon26/checkout/index.html', 'utf8');

assert.ok(!html.includes('ticket-checkout-dialog'), 'The landing page no longer contains a checkout modal');

assert.ok(html.includes('href="/devcon26/register/"'), 'The landing page leads to current registration availability');
assert.ok(html.includes('href="/devcon26/speak/"'), 'The landing page links the annual conference CFP');
assert.ok(!html.includes('data-ticket-checkout='), 'Group ticket sales are no longer advertised');
assert.ok(readFileSync(root + '/dist/devcon26/register/index.html', 'utf8').includes('name="email"'));

assert.ok(checkoutHtml.includes('data-checkout-page'));
assert.ok(checkoutHtml.includes('Complete your booking.'));
assert.ok(checkoutHtml.includes('noindex, nofollow'));
assert.ok(checkoutHtml.includes('data-checkout-fields disabled'), 'Buyer fields are disabled without JavaScript');
assert.ok(!/name="(?:purchaser_name|purchaser_email|coupon_code)"/.test(checkoutHtml), 'Native form fallback cannot send buyer details in a URL');
assert.ok(!checkoutHtml.includes('<dialog'), 'Checkout has no dialog');
assert.ok(checkoutHtml.includes('class="checkout-backdrop"') && checkoutHtml.includes('data-checkout-photo'), 'Checkout renders a decorative tier-selected background');
assert.ok(checkoutHtml.includes('src="/images/logo.png"') && !checkoutHtml.includes('devcongress-logo.png'), 'Header uses the existing working logo asset');
assert.ok(readFileSync(root + '/public/images/logo.png').length > 0);
assert.equal((checkoutHtml.match(/class="checkout-icon"/g) || []).length, 9, 'Navigation, ticket details, coupon, payment, and security icons render inline');
assert.ok(checkoutHtml.includes('data-checkout-payment-label'), 'Payment label has its own node so icons survive state changes');
assert.ok(checkoutHtml.includes('data-checkout-retry'), 'Price verification retry is separate from the payment action');
assert.match(checkoutSource, /\.checkout-backdrop\s*\{[^}]*position: absolute;[^}]*height: 960px;/, 'Background geometry does not depend on the expanding coupon content');
assert.match(checkoutSource, /\.checkout-backdrop img\s*\{[^}]*aspect-ratio: 5 \/ 4;[^}]*mask-image: radial-gradient/, 'Large photo keeps its crop and soft edge mask');
assert.match(checkoutSource, /ellipse 50% 50% at 50% 50%,[\s\S]*?transparent 96%/, 'An inscribed centred ellipse fades completely before all four image edges');
assert.match(checkoutSource, /\.checkout-backdrop img\s*\{[^}]*width: min\(1100px, 100%\);/, 'The photo stays within its container instead of clipping an oversized crop');
assert.ok(!checkoutSource.includes('coupon-chevron'), 'Coupon disclosure no longer uses a chevron');
assert.ok(checkoutSource.includes('CheckoutIcon name="plus"'), 'Coupon disclosure renders a plus icon');
assert.match(checkoutSource, /\.coupon\[open\] \.coupon-symbol :global\(path:last-child\)\s*\{\s*opacity: 0;/, 'Open disclosure hides only the vertical stroke to show a minus');
assert.match(checkoutSource, /\.coupon-symbol :global\(path:last-child\)\s*\{\s*transition: opacity 140ms/, 'The plus-to-minus change uses a brief interruptible opacity transition');
assert.match(checkoutSource, /input:focus\s*\{[^}]*border-color: var\(--checkout-focus\);[^}]*outline: 2px solid var\(--checkout-focus\);[^}]*outline-offset: -1px;/, 'Focus uses a crisp subdued edge that remains visible without stacked black outlines');
assert.ok(!/overflow-y: ?(?:auto|scroll)|max-height:/.test(checkoutSource), 'Checkout uses natural page scrolling, not a nested scroll viewport');
assert.ok(checkoutSource.includes('grid-template-columns: minmax(0, 1fr);'), 'Mobile stacks buyer details and summary');
assert.ok(!html.includes('partner-symbol'), 'The decorative pink plus signs are removed');

assert.equal((sponsorSection.match(/class="sponsor-item"/g) || []).length, 1);
const packagePlans = [...sponsorSection.matchAll(/<article\b[^>]*class="package-plan"[^>]*>([\s\S]*?)<\/article>/g)];

assert.equal(packagePlans.length, 6);
assert.ok(sponsorSection.includes('class="package-grid"'), 'Packages have one compact comparison grid');
assert.ok(!sponsorSection.includes('package-band'), 'The tall alternating package rows are removed');
assert.ok(!sponsorSection.includes('View package details'), 'The PDF is the full package details reference');
assert.ok(!sponsorSection.includes('package-disclosure'), 'Package disclosures are removed');
assert.ok(sponsorSection.includes('PDF · Full benefits and terms'));

for (const [, plan] of packagePlans) {
  const highlights = plan.match(/<ul\b[^>]*class="package-highlights"[^>]*>([\s\S]*?)<\/ul>/)?.[1];

  assert.equal((highlights?.match(/<li\b/g) || []).length, 3, 'Each package has three concise highlights');
  assert.ok(!plan.includes('<details'), 'Cards contain no package details accordion');
  assert.ok(!plan.includes('data-sponsorship-mark'), 'Comparison cards have no decorative illustrations');
  assert.equal((plan.match(/class="package-family"/g) || []).length, 1, 'Each package has one visible family tag');
  assert.equal((plan.match(/class="package-tier"/g) || []).length, 1, 'Each package has one clear tier name');
  assert.ok(!plan.includes('package-pass-count'), 'Pass allocation is plain visible text, not a badge');
  assert.ok(plan.includes('class="package-qualification"'), 'A short qualification is always visible');
  assert.equal((plan.match(/class="package-enquiry"/g) || []).length, 1, 'Each package has one direct enquiry action');
  assert.ok(!plan.includes('sponsorship-packages.pdf'), 'The shared PDF download stays outside the cards');
  assert.ok(!plan.includes('<img'), 'Individual package photographs are removed');
}
assert.equal((sponsorSection.match(/mailto:events@devcongress.org/g) || []).length, 7);
assert.ok(!sponsorSection.includes('Become a sponsor'), 'The redundant generic sponsorship action is removed');
assert.ok(sponsorSection.includes('Discuss a custom partnership'), 'The custom-partnership option remains available');
assert.ok(sponsorSection.includes('Kweku Tech Media'));
assert.ok(!sponsorSection.includes('Fido Credit'));
assert.ok(!sponsorSection.includes('MEST Africa'));

const expectedPackages = [
  ['contributor', 'Community Contributor', 'GHS 5,000', '2 conference passes'],
  ['collaborator', 'Community Collaborator', 'GHS 10,000', '4 conference passes'],
  ['builder', 'Community Builder', 'GHS 20,000', '6 conference passes'],
  ['catalyst', 'Community Catalyst', 'GHS 30,000', '8 conference passes'],
  ['champion', 'Community Champion', 'GHS 50,000', '10 conference passes'],
  ['title', 'Title Partner', 'GHS 70,000+', 'Conference passes tailored to your partnership'],
];

function plainText(markup = '') {
  return markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

for (const [id, name, price, passes] of expectedPackages) {
  const plan = packagePlans.find(([article]) => article.includes('aria-labelledby="package-' + id + '"'))?.[1];

  assert.ok(plan, id);
  const heading = plan.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/)?.[1];

  assert.equal(plainText(heading), name, 'The full tier name stays visible and accessible');
  assert.ok(!heading.includes('sr-only'), 'No part of the package name is hidden');
  assert.ok(!heading.includes('aria-hidden'), 'The family tag remains part of the accessible heading');

  const family = heading.match(/<span\b[^>]*class="package-family"[^>]*>([\s\S]*?)<\/span>/)?.[1];
  const tier = heading.match(/<span\b[^>]*class="package-tier"[^>]*>([\s\S]*?)<\/span>/)?.[1];

  assert.equal(plainText(family), id === 'title' ? 'Title' : 'Community', 'The family label is shown as a tag');
  assert.equal(plainText(tier), name.replace(/^(Community|Title) /, ''), 'The tier name does not repeat the family label');

  assert.equal(plainText(plan.match(/<p\b[^>]*class="package-price"[^>]*>([\s\S]*?)<\/p>/)?.[1]), price, 'Split currency and value keep the exact price');
  const visiblePasses = plan.match(/<p\b[^>]*class="package-passes"[^>]*>([\s\S]*?)<\/p>/)?.[1];

  assert.equal(plainText(visiblePasses), passes, 'Full pass allocation stays visible and accessible');
  assert.ok(!visiblePasses.includes('sr-only') && !visiblePasses.includes('aria-hidden'), 'Allocation has no hidden duplicate');
  assert.ok(plan.includes(encodeURIComponent('DevCon26 ' + name + ' sponsorship enquiry')), 'The mail subject identifies the full package');

  const enquiry = plan.match(/<a\b[^>]*class="package-enquiry"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);

  assert.ok(enquiry, 'Each package has a mailto action');
  assert.ok(enquiry[2].includes('Choose this package'), 'The action selects the published package');
  assert.ok(!enquiry[2].includes('Discuss this package'), 'The action does not imply negotiating the package');

  const mailto = new URL(enquiry[1].replaceAll('&amp;', '&'));
  const expectedBody = [
    'Hi DevCongress team,',
    '',
    'We would like to proceed with the ' + name + ' sponsorship package at ' + price + '.',
    '',
    'Organisation: [Organisation name]',
    'Contact name: [Your name]',
    '',
    'Please share the next steps to confirm our sponsorship.',
  ].join('\r\n');

  assert.equal(mailto.protocol, 'mailto:');
  assert.equal(mailto.pathname, 'events@devcongress.org');
  assert.equal(mailto.searchParams.get('subject'), 'DevCon26 ' + name + ' sponsorship enquiry');
  assert.equal(mailto.searchParams.get('body'), expectedBody, 'The draft identifies the exact package and price, with editable contact placeholders');
  assert.deepEqual([...mailto.searchParams.keys()], ['subject', 'body'], 'The link only prefills a draft');
}

for (const qualification of [
  'No exhibition, speaking, or dedicated activations.',
  'No exhibition or stage opportunities.',
  'Speaking and programme opportunities require DevCongress approval.',
  'Programme opportunities require DevCongress approval.',
  'Exhibition space and passes replace the previous tier’s allocation.',
  'Exclusivity is limited to the agreed category at this sponsorship level.',
  'Benefits are agreed individually.',
]) {
  assert.ok(sponsorSection.includes(qualification), qualification);
}

const historical = html.slice(html.indexOf('<section class="past-sponsors-section'), html.indexOf('</main>'));
const historicalNames = ['Fido Credit', 'Kweku Tech Media', 'MEST Africa', 'Old Mutual Insurance Ltd.', 'Paystack', 'UNICEF Ghana'];
let position = -1;

for (const name of historicalNames) {
  const next = historical.indexOf(name, position + 1);

  assert.ok(next > position, name);
  position = next;
}

assert.ok(html.indexOf('<section id="faqs"') < html.indexOf('<section class="past-sponsors-section'));
assert.ok(html.includes('download="DevCon26 Sponsorship Packages.pdf"'));
assert.ok(html.includes('19 December 2026'));
assert.match(homeHtml, /<div class="hero-conference-meta"[^>]*>[\s\S]*?<time datetime="2026-12-19"[^>]*>19 December 2026<\/time>/, 'Homepage hero publishes the confirmed DevCon26 date');
assert.ok(!/keynote|700 attendees/i.test(html));

const confirmationSource = readFileSync(root + '/src/pages/devcon26/payment-confirmation.astro', 'utf8');
const socialCardSource = readFileSync(root + '/src/lib/devcon26-social-card-preview.ts', 'utf8');
const digitalBadgeCode = await bundle('src/lib/devcon26-digital-badge.ts');
const digitalBadgeModule = { exports: {} };

vm.runInNewContext(digitalBadgeCode, {
  module: digitalBadgeModule,
  FontFace: class { async load() { return this; } },
  document: {
    fonts: { add() {} },
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const context = new Proxy({
        createLinearGradient() { return { addColorStop() {} }; },
      }, { get(target, key) { return key in target ? target[key] : () => {}; } });

      return { getContext() { return context; } };
    },
  },
  Image: class {
    naturalWidth = 1794;
    naturalHeight = 285;
    async decode() {}
  },
});

const digitalNameContext = {
  font: '',
  measureText(text) {
    const fontSize = Number(this.font.match(/600 (\d+)px/)?.[1] ?? 48);

    return { width: text.length * fontSize * 0.6 };
  },
};

for (const name of ['Ada', 'Your Name', 'Alexandra Nana Akua Mensah', 'Jean-Luc Osei-Danquah']) {
  const result = digitalBadgeModule.exports.layoutDigitalBadgeName(digitalNameContext, name);

  assert.equal(result.valid, true, 'Digital badge supports complete multi-word names');
  assert.equal(result.layout.lines.join(' '), name, 'Digital badge never truncates names');
  assert.ok(result.layout.lines.length <= 2);
  assert.ok(result.layout.fontSize >= 44);
  digitalNameContext.font = `600 ${result.layout.fontSize}px`;
  assert.ok(result.layout.lines.every(line => digitalNameContext.measureText(line).width <= 908));
}

assert.equal(digitalBadgeModule.exports.layoutDigitalBadgeName(digitalNameContext, 'W'.repeat(60)).valid, false, 'Unbreakable names fail visibly rather than clip');

for (const role of [null, 'attendee', 'speaker']) {
  const text = [];
  const images = [];
  const context = new Proxy({
    ...digitalNameContext,
    fillText(value) { text.push(value); },
    drawImage(...args) { images.push(args); },
    createLinearGradient() { return { addColorStop() {} }; },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const canvas = { getContext() { return context; } };

  await digitalBadgeModule.exports.paintDigitalBadge(canvas, 'Your Name', null, undefined, role);
  assert.equal(text.includes('ATTENDEE'), role === 'attendee');
  assert.equal(text.includes('SPEAKER'), role === 'speaker');
  assert.equal(text.includes('COMMUNITY'), false, 'No placeholder footer role');
  assert.equal(images.at(-1)[0].src, '/images/logo.png', 'Uses the real shared DevCongress logo');
  assert.ok(images[0][0].src.endsWith('devcon26-v11-base-1080x1350.png'), 'Uses the homepage physical badge artwork');
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1350);
}
assert.match(socialCardSource, /isRegistration \? layoutDigitalBadgeName\(context, value\) : layoutDevcon26CardName\(context, value\)/, 'Validation follows the selected renderer');
assert.match(socialCardSource, /if \(digital\) return \{ base: null, backdrop: null \}/, 'Digital badge does not depend on legacy bitmap artwork');
assert.ok(socialCardSource.includes("paintDigitalBadge(workCanvas, card.name, card.photo, card.crop, 'attendee')"), 'Registration sharing cards display ATTENDEE');
const registrationCardSource = readFileSync(root + '/src/components/Devcon26RegistrationCard.astro', 'utf8');
assert.ok(registrationCardSource.indexOf('data-social-step-back') < registrationCardSource.indexOf('data-social-card-download'), 'Back precedes Download');
assert.ok(registrationCardSource.indexOf('data-social-card-download') < registrationCardSource.indexOf('data-social-card-share'), 'Download precedes Share');
assert.match(registrationCardSource, /data-social-card-download[^>]*>\s*<svg[^>]*aria-hidden="true"/, 'Download includes a decorative icon');
const confirmationHtml = readFileSync(root + '/dist/devcon26/payment-confirmation/index.html', 'utf8');
const socialCardBase = readFileSync(root + '/public/images/devcon26/social-card/devcon26-v11-base-1080x1350.png');
const socialCardBackdrop = readFileSync(root + '/public/images/devcon26/social-card/devcon26-v14-backdrop-1080x1350.svg', 'utf8');
const socialCardFont = readFileSync(root + '/public/fonts/devcon26-social-card/BricolageGrotesque-Semibold.ttf');
const socialCardLicence = readFileSync(root + '/public/fonts/devcon26-social-card/OFL.txt', 'utf8');
const DEVCON26_V11_SOURCE_SVG_SHA256 = 'e346319fca3f545cb838eea598f3e25e21aa044941ea30c53414552ecb326098';

function confirmationRule(selector, occurrence = 0) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = Array.from(confirmationSource.matchAll(new RegExp('(?:^|\\n)\\s*' + escaped + '\\s*\\{([^}]*)\\}', 'g')));
  const rule = rules[occurrence];

  assert.ok(rule, 'Confirmation style exists: ' + selector + ' occurrence ' + occurrence);

  return rule[1];
}

assert.ok(!confirmationSource.includes('venue-photo'), 'Confirmation venue has no decorative photo or mask');
assert.ok(!confirmationHtml.includes('ghana-digital-center.webp'), 'Confirmation does not load the removed building image');
assert.ok(confirmationHtml.includes('class="receipt-photo"') && confirmationHtml.includes('data-payment-photo'), 'Selected ticket photo remains available');
assert.match(confirmationRule('.payment-receipt'), /border:\s*1px solid/, 'Receipt retains a single outer border');
assert.match(confirmationRule('.receipt-surface'), /transform-origin:\s*top;/, 'Receipt expansion scales only its decorative surface from the top');
assert.match(confirmationRule('.receipt-surface'), /border:\s*1px solid oklch\(/, 'Receipt surface owns the visible border');
assert.match(confirmationRule('.receipt-surface'), /background:\s*var\(--payment-paper\)/, 'Receipt surface owns the paper background');
assert.match(confirmationSource, /@media \(min-width: 761px\)[\s\S]*?\.confirmation-content\s*\{\s*align-items: stretch;/, 'Desktop receipt tracks the adjacent editor height');
assert.match(socialCardSource, /!reducedMotion\.matches/, 'Receipt growth respects reduced motion');
assert.match(socialCardSource, /duration: 240/, 'Receipt expansion remains a short transition');
assert.match(confirmationRule('.payment-receipt'), /padding:\s*0 28px 28px;/, 'Desktop receipt reserves space for its ticket-style masthead');
assert.match(confirmationSource, /@media \(max-width: 760px\)[\s\S]*?\.payment-receipt\s*\{\s*padding:\s*0 22px 22px;/, 'Mobile receipt keeps the ticket-style masthead aligned');
assert.ok(confirmationHtml.includes('class="receipt-masthead"') && confirmationHtml.includes('Payment record'), 'Receipt has a payment-record masthead');
assert.match(confirmationHtml, /<h2 id="summary-title"[^>]*>Payment confirmed<\/h2>/, 'Verified payment state is explicit in the record');
assert.ok(!confirmationSource.includes('verified-label'), 'Receipt omits the redundant payment-status pill');
assert.match(confirmationRule('.payment-details'), /display:\s*grid;/, 'Receipt details use a consistent grid');
assert.match(confirmationRule('.payment-details'), /row-gap:\s*6px;/, 'Receipt details retain their row spacing');
assert.match(confirmationRule('.payment-details > div'), /padding-block:\s*8px;/, 'Receipt rows retain breathing room without separators');
assert.ok(!/border/.test(confirmationRule('.payment-details > div')), 'Receipt rows use hierarchy instead of separator lines');
assert.match(confirmationRule('.receipt-stub'), /display:\s*grid;/, 'Save action and disclaimer retain their grouped layout');
assert.match(confirmationRule('.receipt-stub'), /gap:\s*8px;/, 'Receipt footer retains spacing between the save action and disclaimer');
assert.match(confirmationRule('.receipt-stub'), /margin-top:\s*28px;/, 'Receipt footer remains separated by whitespace');
assert.match(confirmationRule('.receipt-stub'), /border-top:\s*1px dashed/, 'Receipt footer has a restrained perforation divider');
assert.match(confirmationRule('.payment-details .amount-detail'), /padding-block:\s*12px 20px;/, 'Amount remains the leading receipt group');
assert.ok(confirmationRule('.payment-details .ticket-detail').includes('margin-top: 16px'), 'Ticket selection begins a distinct spacing group');
assert.ok(confirmationRule('.payment-details .reference-detail').includes('margin-top: 12px'), 'Payment reference begins a distinct spacing group');
assert.ok(confirmationHtml.includes('data-payment-print') && confirmationHtml.includes('Print or save payment record') && confirmationHtml.includes('Payment record only. Not an admission ticket.'), 'Print/save action and non-admission boundary remain');
assert.ok(confirmationHtml.includes('data-social-card-preview') && confirmationHtml.includes('data-social-card-share') && confirmationHtml.includes('data-social-card-download'), 'Verified checkout presents an editable ticket-style social card with share and download actions');
assert.match(confirmationHtml, /id="social-card-title"[^>]*>I’m attending <em[^>]*>DevCon26\.<\/em>/, 'Social-card editor uses the attendee announcement framing');
assert.ok(confirmationHtml.includes('data-social-ticket-canvas') && !confirmationHtml.includes('social-ticket-header'), 'Social-card preview uses one V11 canvas instead of a separate HTML yellow ticket');
assert.deepEqual([...socialCardBase.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'V11 base artwork is a PNG');
assert.equal(socialCardBase.readUInt32BE(16), 1080, 'V11 base artwork is 1080px wide');
assert.equal(socialCardBase.readUInt32BE(20), 1350, 'V11 base artwork is 1350px high');
assert.equal(socialCardBase[24], 8, 'V11 base artwork uses 8-bit channels');
assert.equal(socialCardBase[25], 6, 'V11 base artwork preserves RGBA transparency');
assert.equal(DEVCON26_V11_SOURCE_SVG_SHA256, 'e346319fca3f545cb838eea598f3e25e21aa044941ea30c53414552ecb326098', 'V11 base provenance records the approved editable SVG');
assert.equal(createHash('sha256').update(socialCardBase).digest('hex'), '41ece5d91407da5f8310f23b36223d7a49cb4446afa3d645699fe37b199dd7db', 'V11 transparent 1080x1350 base artwork is unchanged');
assert.equal(createHash('sha256').update(socialCardBackdrop).digest('hex'), 'b223a15ecd58d09cb877ef59afaa729c4055ffcb99341d6714c0763d3ae5a367', 'V14 backdrop is byte-identical to the approved editable backdrop');
assert.match(socialCardBackdrop, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1080" height="1350" viewBox="0 0 1080 1350">/, 'V14 backdrop retains its exact 1080×1350 viewBox');
assert.match(socialCardBackdrop, /<rect width="1080" height="1350" fill="#FFF8A8"\/>/, 'V14 backdrop retains its soft-yellow field');
assert.match(socialCardBackdrop, /<circle cx="1060" cy="0" r="240" fill="none" stroke="#E8117F" stroke-width="40"\/>/, 'V14 backdrop retains its upper-right pink arc geometry');
assert.match(socialCardBackdrop, /<circle cx="0" cy="1350" r="300" fill="#F5E642"\/>/, 'V14 backdrop retains its lower-left yellow disc geometry');
assert.match(socialCardBackdrop, /<circle cx="0" cy="780" r="170" fill="none" stroke="#E8117F" stroke-width="4" opacity="0\.55"\/>/, 'V14 backdrop retains its fine pink arc geometry');
assert.match(socialCardBackdrop, /<path id="technical-ticks" d="M800 0 H840 M1060 220 V260" fill="none" stroke="#F5F2E8" stroke-width="3" opacity="0\.65"\/>/, 'V14 backdrop retains its pale technical ticks');
assert.doesNotMatch(socialCardBackdrop, /<(?:image|text)\b/i, 'V14 backdrop contains no embedded image or text element');
assert.equal(createHash('sha256').update(socialCardFont).digest('hex'), '1d1ae0bf45689f8c3f9356a9dfe7fef8856e77746556d17af90dd5a96bc596d1', 'V11 bundled Bricolage Semibold font is unchanged');
assert.match(socialCardLicence, /SIL Open Font License/, 'Bundled social-card font includes its OFL licence');
assert.match(socialCardSource, /CARD_BASE_PATH = '\/images\/devcon26\/social-card\/devcon26-v11-base-1080x1350\.png'/, 'Canvas loads the V11 base artwork');
assert.match(socialCardSource, /CARD_BACKDROP_PATH = '\/images\/devcon26\/social-card\/devcon26-v14-backdrop-1080x1350\.svg'/, 'Canvas loads the V14 backdrop');
assert.match(socialCardSource, /new FontFace\(CARD_FONT_FAMILY, `url\(\$\{CARD_FONT_PATH\}\)/, 'Canvas explicitly loads the bundled V11 font without a fallback');
assert.match(socialCardSource, /PHOTO_BOX = \{ x: 190, y: 460, width: 700, height: 540, radius: 30 \}/, 'Photo uses the approved V11 rounded crop window');
assert.match(socialCardSource, /context\.roundRect\(PHOTO_BOX\.x, PHOTO_BOX\.y, PHOTO_BOX\.width, PHOTO_BOX\.height, PHOTO_BOX\.radius\)/, 'Photo crop preserves the V11 rounded corners');
assert.match(socialCardSource, /const badgeCanvas = document\.createElement\('canvas'\);[\s\S]*?badgeCanvas\.width = CARD_WIDTH;[\s\S]*?badgeCanvas\.height = CARD_HEIGHT;/, 'V11 badge paints on a private transparent 1080×1350 canvas');
assert.match(socialCardSource, /context\.setTransform\(1\.16, 0, 0, 1\.16, -86\.4, -243\.2\)/, 'Badge, photo and name enlarge uniformly to reduce top headroom without clipping');
assert.match(socialCardSource, /context\.filter = 'saturate\(0\.85\) sepia\(0\.10\)';\s*context\.drawImage\(image,[\s\S]*?context\.restore\(\)/, 'Warm desaturation is scoped to the photo, not artwork or name');
assert.match(socialCardSource, /const shadowMaskCanvas = document\.createElement\('canvas'\);[\s\S]*?shadowMaskContext\.drawImage\(badgeCanvas, 0, 0\);[\s\S]*?shadowMaskContext\.globalCompositeOperation = 'source-in';[\s\S]*?shadowMaskContext\.fillStyle = '#000000';[\s\S]*?shadowMaskContext\.fillRect\(0, 0, CARD_WIDTH, CARD_HEIGHT\);/, 'Shadow starts from the enlarged badge alpha at the same position as the visible badge');
assert.match(socialCardSource, /shadowContext\.filter = 'blur\(16px\)';\s*shadowContext\.globalAlpha = 0\.16;\s*shadowContext\.drawImage\(shadowMaskCanvas, 0, 22\);/, 'Offscreen shadow blurs the alpha mask by 16px at 16 percent opacity and a 22px y offset without drawing a source badge');
assert.doesNotMatch(socialCardSource, /shadowContext\.shadow|destination-out/, 'Shadow never uses a source-producing shadow draw or destination-out cleanup pass');
assert.match(socialCardSource, /ticketContext\.drawImage\(backdrop, 0, 0, CARD_WIDTH, CARD_HEIGHT\);\s*ticketContext\.drawImage\(shadowCanvas, 0, 0\);\s*ticketContext\.drawImage\(badgeCanvas, 0, 0\);/, 'Final canvas paints unchanged backdrop, aligned shadow, then the enlarged badge exactly once');
assert.match(socialCardSource, /\* 1\.04/, 'Photo cover crop includes the approved 1.04 zoom');
assert.match(socialCardSource, /DEFAULT_PHOTO_CROP: PhotoCrop = \{ zoom: 1, x: 0\.5, y: 0\.18 \}/, 'Default photo crop preserves approved zoom and 18 percent top overflow');
assert.match(socialCardSource, /crop: PhotoCrop = DEFAULT_PHOTO_CROP/, 'Existing callers retain the approved crop');
assert.match(socialCardSource, /\(height - PHOTO_BOX\.height\) \* crop\.y/, 'Photo position uses scaled overflow so it never exposes blank edges');
assert.match(socialCardSource, /isRegistration \? root\.querySelector<HTMLDialogElement>\('\[data-photo-dialog\]'\) : null/, 'Photo adjustment UI is registration-only');
assert.match(socialCardSource, /NAME_TEXT = \{ x: 190, textWidth: 698 \}/, 'Name uses the approved V11 editorial width');
assert.match(socialCardSource, /const baselines = layout\.layout\.lines\.length === 1 \? \[1092\] : \[1060, 1104\]/, 'Name uses the approved V11 single- and two-line baselines');
assert.doesNotMatch(socialCardSource, /NAME_LABEL|context\.fillRect\(/, 'V11 draws editorial name text without a name plate or fill rectangle');
assert.match(socialCardSource, /fontSize >= 38/, 'Single-line names retain the 38px minimum');
assert.match(socialCardSource, /fontSize >= 32/, 'Two-line names retain the 32px minimum');
assert.match(socialCardSource, /words\.slice\(0, breakAt\)/, 'Two-line names split only at whitespace word boundaries');
assert.match(socialCardSource, /nameInput\.setCustomValidity\(message\)/, 'Unfit names use actionable native custom validity');
assert.match(socialCardSource, /!validateName\(card\.name, true\)\) return;/, 'Invalid names are never PATCHed to the remote collection');
assert.match(socialCardSource, /function validateCardReady\(\): boolean/, 'Preview/export uses one explicit completion gate');
assert.match(socialCardSource, /Add a display name and choose an authentic photo before previewing or sharing your card\./, 'Empty card details receive actionable guidance');
assert.match(socialCardSource, /if \(step === 1 && !validateCardReady\(\)\) return;/, 'Personalize cannot advance without a valid name and photo');
assert.match(socialCardSource, /if \(!validateCardReady\(\)\) throw new Error/, 'Share and download require a valid name and photo');
assert.match(socialCardSource, /await paintPreview\(\);\s*const blob = await makeCardBlob\(ticketCanvas\);/, 'Exports await preview painting and encode the same canvas');
assert.doesNotMatch(socialCardSource, /if \(!buyerGrant\) setBusy\(false\)/, 'Artwork failure releases busy state for buyer sessions too');
assert.match(socialCardSource, /return loadRemoteSeats\(\)\.then/, 'Initialization awaits remote seats before releasing busy state');
assert.match(socialCardSource, /const photoUploadVersions = Array\.from/, 'Photo uploads track a version for every seat');
assert.match(socialCardSource, /const previousUpload = photoUploadQueues\[seatIndex\];[\s\S]*photoUploadQueues\[seatIndex\] = previousUpload\.catch/, 'Photo uploads serialize per seat');
assert.match(socialCardSource, /if \(photoUploadVersions\[seatIndex\] !== uploadVersion\) return;/, 'Queued stale photo uploads never reach the API');
assert.match(confirmationRule('.social-ticket'), /aspect-ratio:\s*4\s*\/\s*5;/, 'Social-card preview uses a portrait feed-friendly format');
assert.match(confirmationRule('.social-preview-step .social-ticket'), /width:\s*440px;/, 'Share preview uses the additional vertical space');
assert.ok(!/zoom\s*:/.test(confirmationSource), 'Preview is not reduced with CSS zoom');
assert.match(confirmationSource, /@media \(min-width: 1281px\)[\s\S]*?grid-auto-columns: minmax\(0, 1fr\);/, 'Desktop card actions use equal-width columns');
assert.match(confirmationSource, /\.confirmation-actions \.payment-actions\s*\{\s*margin-top: 0;/, 'Left and right actions align in a shared footer');
assert.match(socialCardSource, /preview.hidden = true;\s*navigation.hidden = true;/, 'Deferring hides the detached editor controls');
assert.match(socialCardSource, /share\.hidden = step !== 2;\s*download\.hidden = step !== 2;/, 'Export actions only appear in the share step');
assert.match(socialCardSource, /canvas\.width = CARD_WIDTH;[\s\S]*canvas\.height = CARD_HEIGHT;/, 'Downloaded social image uses a 4:5 portrait canvas');
assert.match(socialCardSource, /title: isRegistration \? 'My DevCon26 community badge' : 'I’m attending DevCon26',[\s\S]*text: isRegistration \? 'Part of the DevCon26 community\.' : 'See you at DevCon26'/, 'Registration sharing stays neutral while paid sharing retains its attendance message');
assert.match(socialCardSource, /render\(true\);\s*if \(buyerGrant\)/, 'Uploaded photo animates from the picker preview into the social-card preview');
assert.match(socialCardSource, /photoLoadVersions\[seatIndex\] !== loadVersion \|\| cards\[seatIndex\]\.photo/, 'A stale saved-photo request cannot overwrite a newly uploaded photo');
assert.match(socialCardSource, /index === activeSeat\) return;[\s\S]*const previousOffset = seatOffset\(index\);[\s\S]*previousOffset > 0 \? 1 : -1/, 'Seat selection skips redundant animation and follows the wrapped stack direction');
assert.match(socialCardSource, /document\.getElementById\('summary-title'\)\?\.focus\(\)/, 'Choosing to finish later moves focus to visible confirmation content');
assert.equal((confirmationSource.match(/data-social-step="[012]"/g) ?? []).length, 3, 'Card creation has three distinct panels');
assert.match(socialCardSource, /panel\.hidden = Number\(panel\.dataset\.socialStep\) !== step/, 'Only the current step is visible');
assert.match(socialCardSource, /let step = quantity > 1 \? 0 : 1/, 'Single-seat orders skip seat selection');
assert.match(socialCardSource, /indicator\.setAttribute\('aria-current', 'step'\)/, 'Progress identifies the current step accessibly');
assert.match(socialCardSource, /leaveDialog\.showModal\(\)/, 'Leaving uses a native modal with app styling and focus containment');
assert.match(socialCardSource, /window\.addEventListener\('beforeunload'/, 'Browser-controlled departures have an unfinished-work warning');
assert.match(confirmationSource, /:global\(\.social-seat-button\)/, 'Generated seat buttons receive scoped-container styles');
assert.doesNotMatch(confirmationRule('.social-card-seats :global(.social-seat-name)'), /text-overflow|ellipsis|white-space:\s*nowrap|overflow-wrap:\s*anywhere/, 'Seat names are neither truncated nor split at characters');
assert.match(confirmationRule('.social-card-seats :global(.social-seat-name)'), /overflow-wrap:\s*normal/, 'Seat names wrap only at natural whitespace');
assert.match(confirmationRule('.social-card-seats :global(.social-seat-name)'), /word-break:\s*normal/, 'Seat names preserve complete words');
assert.match(confirmationRule('.social-card-fields'), /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\);/, 'Desktop social-card controls share a compact two-column row');
assert.match(confirmationSource, /\.social-card-fields input\[type="text"\]:focus,\s*\.social-photo-button:has\(\+ input\[type="file"\]:focus-visible\)\s*\{\s*border-color:\s*var\(--pink\);\s*outline:\s*none;\s*box-shadow:\s*none;/, 'Focus changes the existing border without an outer ring or shadow');
assert.match(confirmationSource, /\.social-card-fields input\[type="text"\],\s*\.social-card-fields \.social-photo-button\s*\{\s*box-sizing: border-box;\s*height: 48px;\s*min-height: 48px;/, 'Name and photo controls share a 48px border-box height');
assert.match(confirmationRule('.social-card-fields .social-photo-button'), /grid-row: 2;/, 'Photo picker aligns with the name input, not its label');
assert.match(confirmationSource, /@media \(max-width: 760px\)[\s\S]*?\.social-card-fields\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/, 'Social-card controls return to a single column on mobile');
assert.match(confirmationSource, /@media print\s*\{[\s\S]*?\.payment-header, \.payment-status, \.payment-attention, \.payment-actions, \.print-button, \.skip-link, \.receipt-photo, \.next-steps, \.no-script\s*\{\s*display: none !important;/, 'Print hides the surrounding confirmation experience');
assert.match(confirmationSource, /@media print\s*\{[\s\S]*?max-width:\s*150mm;/, 'Print constrains the record to a one-page receipt width');
assert.match(confirmationSource, /@media print\s*\{[\s\S]*?(?:^|\n)\s+print-color-adjust:\s*exact;/m, 'Print preserves the receipt hierarchy when background graphics are available');
assert.match(confirmationSource, /@media print\s*\{[\s\S]*?page-break-inside:\s*avoid;/, 'Print keeps the payment record together');

for (const pageName of ['index.html', 'checkout/index.html', 'payment-confirmation/index.html']) {
  const built = readFileSync(root + '/dist/devcon26/' + pageName, 'utf8');
  const meta = built.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i)?.[0];
  const csp = meta?.match(/content="([^"]+)"/i)?.[1];

  assert.ok(csp, 'Built CSP exists');
  assert.ok(!csp.includes("script-src 'unsafe-inline'"));

  for (const script of built.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(script[1]) || /application\/ld\+json/.test(script[1]) || !script[2].trim()) continue;

    const digest = createHash('sha256').update(script[2]).digest('base64');

    assert.ok(csp.includes('sha256-' + digest), 'Executable inline script hash matches CSP');
  }
}

const pdfPublished = readFileSync(root + '/public/downloads/devcon26-sponsorship-packages.pdf');
const pdfBuilt = readFileSync(root + '/dist/downloads/devcon26-sponsorship-packages.pdf');

function sha(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

assert.equal(sha(pdfPublished), APPROVED_PDF_SHA256, 'Published PDF matches the approved source');
assert.equal(sha(pdfBuilt), APPROVED_PDF_SHA256, 'Built PDF matches the approved source');

console.log('PASS: dedicated checkout navigation and tier whitelist, matched background photos and persistent inline icons, restrained input focus, compact applied coupon and reduced motion, server-only totals and strict payload, stale input/pagehide responses and BFCache UUID retention, network/in-progress/expiry/conflict retries, bounded coupon errors, safe Paystack redirects and legacy returns, confirmation contracts and clean receipt, built pages/CSP, sponsorships and identical PDF.');
