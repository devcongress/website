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

vm.runInNewContext(confirmationCode, { module: confirmationModule, Intl, URL, URLSearchParams, Number, Object });

const { devcon26TestPaymentSummary } = confirmationModule.exports;
const verified = devcon26TestPaymentSummary({ ...quote, status: 'verified', amount_minor: 18999 });

assert.equal(verified.amount, 'GHS 189.99');
assert.equal(verified.baseAmount, 'GHS 199.99');
assert.equal(verified.discountAmount, 'GHS 10.00');
assert.equal(verified.coupon, 'SAVE-10');
assert.equal(devcon26TestPaymentSummary({ ...quote, status: 'refund_required', amount_minor: 18999 }).status, 'refund_required');
assert.equal(devcon26TestPaymentSummary({ mode: 'test', status: 'verified', tier_key: 'regular', quantity: 1, currency: 'GHS', amount_minor: 19999 }).amount, 'GHS 199.99');
assert.equal(devcon26TestPaymentSummary({ mode: 'test', status: 'verified', tier_key: 'regular', quantity: 1, currency: 'GHS', amount_minor: 19999, base_amount_minor: 19999 }), null);

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

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;

    void this.fire('close');
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

function checkoutFixture({ motion = false, mobile = false, viewportHeight = 1000 } = {}) {
  const page = new Element();
  const dialog = child(page, '#ticket-checkout-dialog');
  const form = child(dialog, '[data-checkout-buyer-form]');
  const elements = {};
  const selectors = [
    'purchaser-name', 'purchaser-email', 'coupon-code', 'coupon', 'coupon-apply',
    'coupon-remove', 'coupon-status', 'payment', 'quote', 'base', 'discount',
    'final', 'discount-row',
  ];

  for (const name of selectors) {
    elements[name] = child(form, '[data-checkout-' + name + ']');
  }

  elements['coupon-summary'] = child(elements.coupon, 'summary');
  elements['coupon-content'] = child(elements.coupon, '[data-checkout-coupon-content]');
  elements['after-coupon'] = child(form, '[data-checkout-after-coupon]');
  elements.panel = child(dialog, '.checkout-panel');
  elements.content = child(elements.panel, '[data-checkout-content]');
  elements.surface = child(dialog, '[data-checkout-surface]');
  elements.dialog = dialog;
  child(form, '.checkout-buyer-fields');
  child(dialog, '.checkout-dismiss');

  for (const name of ['notice-title', 'notice-copy', 'ticket-name', 'ticket-price', 'ticket-photo']) {
    elements[name] = child(dialog, '[data-checkout-' + name + ']');
  }

  const button = new Element();

  button.dataset = { ticketId: 'regular', ticketName: 'Regular ticket', ticketPrice: 'GHS 199.99', ticketPhoto: '/photo.webp' };
  page.children.set('[data-ticket-choice]', [button]);
  page.dataset.checkoutApiOrigin = 'https://em.devcongress.org';
  elements['purchaser-name'].value = 'Ada Buyer';
  elements['purchaser-email'].value = 'ADA@example.org';

  const requests = [];
  const assigned = [];
  const animations = [];
  const reducedMotion = new Element();
  const windowEvents = new Element();

  reducedMotion.matches = !motion;

  if (motion) {
    const naturalHeight = () => elements.coupon.open ? 600 : 500;
    const panelHeight = () => Math.min(Number.parseFloat(elements.panel.style.height) || naturalHeight(), viewportHeight);
    const panelTop = () => (viewportHeight - panelHeight()) / (mobile ? 1 : 2);
    const contentTop = () => {
      elements.panel.scrollTop = Math.min(elements.panel.scrollTop, naturalHeight() - panelHeight());

      return panelTop() - elements.panel.scrollTop;
    };

    elements.panel.getBoundingClientRect = () => ({ top: panelTop(), height: panelHeight() });
    elements.surface.getBoundingClientRect = elements.panel.getBoundingClientRect;
    elements.content.getBoundingClientRect = () => ({ top: contentTop(), height: naturalHeight() });
    elements['coupon-content'].getBoundingClientRect = () => ({ top: contentTop() + 140 });
    elements['after-coupon'].getBoundingClientRect = () => ({
      top: contentTop() + (elements.coupon.open ? 240 : 140),
    });

    for (const name of ['surface', 'panel', 'content', 'coupon-content', 'after-coupon']) {
      elements[name].animate = (keyframes, options) => {
        const animation = {
          name, keyframes, options, cancelled: false, onfinish: null, reversals: 0, currentTime: 75,

          reverse() {
            this.reversals += 1;
          },

          cancel() {
            this.cancelled = true;
          },
        };

        animations.push(animation);

        return animation;
      };
    }
  }

  const window = {
    matchMedia: () => reducedMotion,
    getComputedStyle: () => ({ opacity: '1' }),
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => callback(),
    addEventListener: (name, callback) => windowEvents.addEventListener(name, callback),
    location: { href: 'https://devcongress.org/devcon26/', assign: (url) => assigned.push(url), replace: (url) => assigned.push(url) },
    history: { replaceState: noop },
  };
  const fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url: String(url), options, body: options.body ? JSON.parse(options.body) : null, resolve, reject });
  });
  const module = { exports: {} };

  vm.runInNewContext(checkoutCode, { module, window, fetch, URL, URLSearchParams, Intl, Number, Object, AbortController, crypto: { randomUUID } });
  module.exports.initializeDevcon26Checkout(page);

  return { page, dialog, form, elements, button, requests, assigned, animations, reducedMotion, windowEvents };
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

  await fixture.button.fire('click');
  respond(fixture.requests[0], catalog);
  await tick();
  respond(fixture.requests[1], baseQuote);
  await tick();

  return fixture;
}

const disclosure = await readyFixture();

assert.equal(disclosure.elements['coupon-content'].inert, true);
await disclosure.elements['coupon-summary'].fire('click');
assert.equal(disclosure.elements.coupon.open, true);
assert.equal(disclosure.elements['coupon-content'].inert, false);
await disclosure.elements['coupon-summary'].fire('click');
assert.equal(disclosure.elements.coupon.open, false);
assert.equal(disclosure.elements['coupon-content'].inert, true);
assert.equal(disclosure.animations.length, 0, 'Reduced motion skips animations');
assert.equal(disclosure.requests.length, 2, 'Disclosure does not request a new quote');

const movingDisclosure = await readyFixture({ motion: true });

await movingDisclosure.elements['coupon-summary'].fire('click');
assert.equal(movingDisclosure.elements.coupon.open, true);
assert.equal(movingDisclosure.elements.panel.style.height, '600px', 'Freeze the clipping viewport for the entire transition');
assert.equal(movingDisclosure.animations[1].keyframes[0].transform, 'translateY(-100px)');
assert.equal(movingDisclosure.animations[2].keyframes[0].transform, 'translateY(0px)', 'Roomy content stays inside its own scroll viewport');
assert.equal(movingDisclosure.animations[2].keyframes[1].transform, 'translateY(0px)');
assert.equal(movingDisclosure.animations[2].name, 'content', 'Translate content without scaling its text');
assert.equal(movingDisclosure.animations[3].name, 'surface');
assert.equal(movingDisclosure.animations[3].keyframes[0].transform, 'translateY(50px) scaleY(0.8333333333333334)');
assert.equal(movingDisclosure.animations[3].keyframes[1].transform, 'translateY(0px) scaleY(1)');
assert.equal(movingDisclosure.animations.length, 5);
assert.equal(movingDisclosure.animations[4].name, 'panel');
assert.equal(movingDisclosure.animations[4].keyframes[0].transform, 'translateY(50px)', 'Recentring moves the scroll viewport, not its contents');
assert.equal(movingDisclosure.animations[4].keyframes[1].transform, 'translateY(0px)');

for (const animation of movingDisclosure.animations) {
  assert.equal(animation.options.duration, 180);
  assert.equal(animation.options.easing, 'cubic-bezier(0.16, 1, 0.3, 1)');

  for (const frame of animation.keyframes) {
    assert.ok(Object.keys(frame).every((property) => ['transform', 'opacity'].includes(property)));
  }
}

await movingDisclosure.elements['coupon-summary'].fire('click');
assert.equal(movingDisclosure.elements.coupon.open, true, 'Keep exit content rendered until its fade completes');
assert.equal(movingDisclosure.elements.panel.style.height, '600px', 'Closing must not collapse the clipping viewport');
assert.equal(movingDisclosure.elements['coupon-content'].inert, true);
assert.equal(movingDisclosure.animations.length, 5, 'Reverse the live timeline rather than snapping to a new layout');
assert.ok(movingDisclosure.animations.every((animation) => animation.reversals === 1 && animation.currentTime === 75));

await movingDisclosure.elements['coupon-summary'].fire('click');
assert.equal(movingDisclosure.elements.coupon.open, true);
assert.ok(movingDisclosure.animations.every((animation) => animation.reversals === 2));
assert.equal(movingDisclosure.elements['coupon-content'].inert, false);
const staleFinish = movingDisclosure.animations[0].onfinish;

movingDisclosure.animations[0].onfinish();
assert.ok(movingDisclosure.animations.every((animation) => animation.cancelled));
assert.equal(movingDisclosure.elements.panel.style.height, '');

await movingDisclosure.elements['coupon-summary'].fire('click');
staleFinish();
assert.equal(movingDisclosure.elements.panel.style.height, '600px', 'Stale completion cannot settle a newer transition');
assert.equal(movingDisclosure.animations[6].keyframes[1].transform, 'translateY(-100px)');
assert.equal(movingDisclosure.animations[7].keyframes[1].transform, 'translateY(0px)', 'Closing has no internal recentering overflow');
assert.equal(movingDisclosure.animations[8].keyframes[1].transform, 'translateY(50px) scaleY(0.8333333333333334)');
assert.equal(movingDisclosure.animations[9].keyframes[1].transform, 'translateY(50px)');
movingDisclosure.animations[5].onfinish();
assert.equal(movingDisclosure.elements.coupon.open, false);
assert.equal(movingDisclosure.elements.panel.style.height, '');

await movingDisclosure.elements['coupon-summary'].fire('click');
await movingDisclosure.elements['coupon-summary'].fire('click');
movingDisclosure.reducedMotion.matches = true;
await movingDisclosure.reducedMotion.fire('change');
assert.equal(movingDisclosure.elements.coupon.open, false, 'Reduced-motion change settles an in-flight close');
assert.equal(movingDisclosure.elements.panel.style.height, '');
assert.ok(movingDisclosure.animations.every((animation) => animation.cancelled));

const reversedClose = await readyFixture({ motion: true });

await reversedClose.elements['coupon-summary'].fire('click');
reversedClose.animations[0].onfinish();
await reversedClose.elements['coupon-summary'].fire('click');
await reversedClose.elements['coupon-summary'].fire('click');
assert.ok(reversedClose.animations.slice(5).every((animation) => animation.reversals === 1));
reversedClose.animations[5].onfinish();
assert.equal(reversedClose.elements.coupon.open, true, 'Reversing a closing timeline commits its open starting state');
assert.equal(reversedClose.elements.panel.style.height, '');
await reversedClose.elements['coupon-summary'].fire('click');
reversedClose.elements['coupon-code'].value = 'SAVE-10';
await reversedClose.elements['coupon-code'].fire('input');
assert.ok(reversedClose.animations.every((animation) => animation.cancelled), 'Content changes clear old geometry before updating fields');
assert.equal(reversedClose.elements.panel.style.height, '');

const mobileDisclosure = await readyFixture({ motion: true, mobile: true });

await mobileDisclosure.elements['coupon-summary'].fire('click');
assert.equal(mobileDisclosure.animations[3].keyframes[0].transform, 'translateY(100px) scaleY(0.8333333333333334)', 'Bottom sheets keep their bottom edge anchored');
assert.equal(mobileDisclosure.animations[4].keyframes[0].transform, 'translateY(100px)');
assert.equal(mobileDisclosure.animations[2].keyframes[0].transform, 'translateY(0px)', 'Roomy bottom sheets do not create internal overflow');
await mobileDisclosure.windowEvents.fire('resize');
assert.equal(mobileDisclosure.elements.panel.style.height, '');
assert.ok(mobileDisclosure.animations.every((animation) => animation.cancelled));

for (const viewportHeight of [550, 600]) {
  const boundaryDisclosure = await readyFixture({ motion: true, viewportHeight });

  await boundaryDisclosure.elements['coupon-summary'].fire('click');
  assert.ok(boundaryDisclosure.animations[2].keyframes.every((frame) => frame.transform === 'translateY(0px)'), 'Recentring never creates internal overflow at the viewport boundary');
  boundaryDisclosure.animations[0].onfinish();
  await boundaryDisclosure.elements['coupon-summary'].fire('click');
  assert.ok(boundaryDisclosure.animations[7].keyframes.every((frame) => frame.transform === 'translateY(0px)'));
  boundaryDisclosure.animations[5].onfinish();
  assert.equal(boundaryDisclosure.elements.panel.style.height, '');
}

const scrolledDisclosure = await readyFixture({ motion: true, viewportHeight: 400 });

await scrolledDisclosure.elements['coupon-summary'].fire('click');
scrolledDisclosure.animations[0].onfinish();
scrolledDisclosure.elements.panel.scrollTop = 180;
await scrolledDisclosure.elements['coupon-summary'].fire('click');
assert.equal(scrolledDisclosure.elements.panel.scrollTop, 180, 'Destination probing must restore the live scroll position');
assert.equal(scrolledDisclosure.animations[7].keyframes[1].transform, 'translateY(80px)', 'Bridge the final scroll clamp without moving the viewport');
assert.equal(scrolledDisclosure.animations[9].keyframes[1].transform, 'translateY(0px)', 'Capped panels retain their native scrolling position');
scrolledDisclosure.animations[5].onfinish();
assert.equal(scrolledDisclosure.elements.panel.scrollTop, 100);
assert.equal(scrolledDisclosure.elements.panel.style.height, '');
await scrolledDisclosure.elements['coupon-summary'].fire('click');
await scrolledDisclosure.elements.panel.fire('wheel');
assert.ok(scrolledDisclosure.animations.every((animation) => animation.cancelled), 'Scrolling settles motion without blocking the gesture');
await scrolledDisclosure.elements['coupon-summary'].fire('click');
await scrolledDisclosure.elements.panel.fire('touchstart');
assert.ok(scrolledDisclosure.animations.every((animation) => animation.cancelled), 'Touch scrolling remains available on constrained panels');

const validationDisclosure = await readyFixture({ motion: true });

validationDisclosure.elements['coupon-code'].value = 'INVALID-CODE';
await validationDisclosure.elements['coupon-code'].fire('input');
await validationDisclosure.elements['coupon-apply'].fire('click');
respond(validationDisclosure.requests[2], { coupon_error: 'invalid' }, 400);
await tick();
assert.equal(validationDisclosure.elements.coupon.open, true, 'Validation opens the coupon through the motion helper');
assert.equal(validationDisclosure.elements['coupon-content'].inert, false);
assert.equal(validationDisclosure.animations.length, 5);
await validationDisclosure.dialog.fire('close');
assert.ok(validationDisclosure.animations.every((animation) => animation.cancelled));

const changed = await readyFixture();
const firstSubmission = changed.form.fire('submit');
const initialize = changed.requests[2];

assert.equal(initialize.body.purchaser_name, 'Ada Buyer');
assert.equal(initialize.body.purchaser_email, 'ada@example.org');
assert.deepEqual(Object.keys(initialize.body).sort(), ['checkout_request_key', 'purchaser_email', 'purchaser_name', 'tier_key']);
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

const closed = await readyFixture();
const closingSubmission = closed.form.fire('submit');

await closed.dialog.fire('cancel');
respond(closed.requests[2], { ...baseQuote, authorization_url: 'https://checkout.paystack.com/valid' });
await closingSubmission;
assert.equal(closed.assigned.length, 0);

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
const sponsorSection = html.slice(html.indexOf('<section id="sponsors"'), html.indexOf('<section id="faqs"'));
const checkoutSurface = html.match(/<div\b[^>]*data-checkout-surface[^>]*>([\s\S]*?)<\/div>/)?.[1];
const checkoutArt = html.match(/<div\b[^>]*data-checkout-art[^>]*>([\s\S]*?)<\/div>/)?.[1];

assert.ok(html.includes('data-checkout-coupon-content'));
assert.ok(html.includes('data-checkout-after-coupon'));
assert.ok(html.includes('data-checkout-surface'));
assert.ok(html.includes('data-checkout-content'));
assert.equal(checkoutSurface, '', 'Only the paper belongs to the stretching checkout surface');
assert.ok(checkoutArt?.includes('data-checkout-ticket-photo'), 'The masked photo has its own unscaled layer');
assert.ok(html.indexOf('data-checkout-surface') < html.indexOf('data-checkout-art'));
assert.ok(html.indexOf('data-checkout-art') < html.indexOf('<section class="checkout-panel"'));
assert.ok(!html.includes('data-coupon-closing'), 'Exit fields must remain in normal flow');
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
assert.ok(!/19 December|keynote|700 attendees/i.test(html));

for (const pageName of ['index.html', 'payment-confirmation/index.html']) {
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

console.log('PASS: unscaled checkout photo layer, coupon disclosure motion/reversal/cleanup/reduced motion, quote/confirmation contracts and needs-attention rendering, coupon consistency and bounded errors, strict payload, changed/closed cart, stale coupon responses, changed server total, UUID network/in-progress/expiry/conflict retries, safe redirects, built sponsorship content/CSP, historical partners, and identical PDF.');
