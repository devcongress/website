import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const result = await build({
  entryPoints: ['src/lib/donation-checkout.ts'],
  bundle: true,
  format: 'cjs',
  write: false,
  plugins: [{
    name: 'mock-inttegro',
    setup(builder) {
      builder.onResolve({ filter: /^@inttegro\/js$/ }, () => ({ path: 'sdk', namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const loadInttegro = () => globalThis.loadMock();' }));
    },
  }],
});
const intent = 'sale_' + 'a'.repeat(24);
const orderId = 'or_' + 'b'.repeat(24);
const key = `devcongress.inttegro.order:${intent}`;

function harness(storage = new Map(), storageBlocked = false) {
  const elements = new Map();
  const controllers = [];
  const state = { rejectMount: false, rejectLoad: false };

  function element(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        hidden: false,
        disabled: false,
        checked: false,
        textContent: '',
        handlers: {},
        setAttribute() {},
        replaceChildren() {},
        addEventListener(type, callback) { this.handlers[type] = callback; },
      });
    }

    return elements.get(selector);
  }

  const page = { dataset: { purchaseIntentId: intent }, querySelector: element };
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    document: { querySelector: () => page },
    window: { sessionStorage: {
      getItem: (k) => storage.get(k),
      setItem(k, value) {
        if (storageBlocked) throw Error('blocked');
        storage.set(k, value);
      },
      removeItem(k) {
        if (storageBlocked) throw Error('blocked');
        storage.delete(k);
      },
    } },
    loadMock: async () => {
      if (state.rejectLoad) throw Error('offline');

      return { createCheckout(options) {
        const controller = {
          options,
          destroyed: false,
          onEvent(callback) { this.emit = callback; },
          async mount() {
            if (state.rejectMount) throw Error('unavailable');
          },
          destroy() { this.destroyed = true; },
        };
        controllers.push(controller);
        return controller;
      } };
    },
  });
  module.exports.initializeDonationCheckout();

  return {
    state, storage, controllers, element,
    async settle() { await new Promise(setImmediate); },
    async click(selector) {
      element(selector).handlers.click();
      await new Promise(setImmediate);
    },
  };
}

const h = harness();
await h.settle();
assert.equal(h.controllers[0].options.purchaseIntentId, intent);
const order = { id: orderId, status: 'requires_payment' };
h.controllers[0].emit({ type: 'orderPrepared', order });
assert.equal(h.storage.get(key), orderId);
assert.deepEqual([...h.storage.keys()], [key]);

const resumed = harness(h.storage);
await resumed.settle();
assert.equal(resumed.controllers[0].options.orderId, orderId);
resumed.controllers[0].emit({ type: 'completed', order: { ...order, status: 'paid' } });
assert.equal(h.storage.get(key), orderId);
assert.match(resumed.element('[data-checkout-status]').textContent, /confirmed/);

for (const recoverable of [true, false]) {
  resumed.controllers.at(-1).emit({ type: 'failed', failure: { recoverable } });
  assert.equal(h.storage.get(key), orderId);
  await resumed.click('[data-checkout-retry]');
  assert.equal(resumed.controllers.at(-1).options.orderId, orderId);
}

resumed.state.rejectMount = true;
await resumed.click('[data-checkout-retry]');
assert.equal(h.storage.get(key), orderId);
assert.equal(resumed.element('[data-checkout-fallback]').hidden, true);
assert.equal(resumed.element('[data-checkout-retry]').hidden, false);

resumed.state.rejectMount = false;
await resumed.click('[data-checkout-retry]');
const oldController = resumed.controllers.at(-2);
oldController.emit({ type: 'orderPrepared', order: { ...order, id: 'or_' + 'c'.repeat(24) } });
assert.equal(h.storage.get(key), orderId, 'ignore stale controller events');

resumed.controllers.at(-1).emit({ type: 'paymentProcessing', order: { ...order, status: 'processing' } });
assert.equal(resumed.element('[data-checkout-restart]').hidden, true);
resumed.element('[data-restart-acknowledge]').checked = true;
await resumed.click('[data-start-new]');
assert.equal(h.storage.get(key), orderId, 'cannot restart a known processing payment');

resumed.controllers.at(-1).emit({ type: 'completed', order: { ...order, status: 'paid' } });
resumed.element('[data-restart-acknowledge]').checked = false;
await resumed.click('[data-start-new]');
assert.equal(h.storage.get(key), orderId, 'unconfirmed restart retains order');
resumed.element('[data-restart-acknowledge]').checked = true;
await resumed.click('[data-start-new]');
assert.equal(h.storage.has(key), false);
assert.equal(resumed.controllers.at(-1).options.purchaseIntentId, intent);

const blocked = harness(new Map(), true);
await blocked.settle();
assert.equal(blocked.element('[data-storage-warning]').hidden, false);
blocked.controllers[0].emit({ type: 'orderPrepared', order });
await blocked.click('[data-checkout-retry]');
assert.equal(blocked.controllers.at(-1).options.orderId, orderId, 'memory recovery survives storage failure');

const worker = readFileSync('src/worker.ts', 'utf8');
assert.match(worker, /SUPPORT_PATHS = new Set\(\['\/support', '\/support\/'\]\)/);
assert.doesNotMatch(readFileSync('src/pages/index.astro', 'utf8'), /useDonationModal|InttegroDonationCheckout/);
console.log('PASS donation recovery: legacy resume, ID-only storage, completion/error retention, same-order retries, stale events, pending-payment guard, acknowledged restart, blocked storage, and page routing.');
