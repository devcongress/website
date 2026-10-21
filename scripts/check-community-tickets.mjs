import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { transform } = astroRequire('esbuild');
const source = readFileSync('src/lib/devcon26-flexible-checkout.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });

function extractFunction(name) {
  const start = code.indexOf(`function ${name}(`);
  const open = code.indexOf('{', start);
  let depth = 1;
  let end = open + 1;

  while (depth && end < code.length) {
    if (code[end] === '{') depth++;
    if (code[end] === '}') depth--;
    end++;
  }

  assert.ok(start >= 0 && depth === 0);
  return code.slice(start, end);
}

const state = {
  allocations: [{ kind: 'community_managed' }],
  catalog: { maxPerPayment: 20 },
  liveBusy: false,
  quantity: { value: '1', setCustomValidity() {}, reportValidity() {} },
  invalidateLiveRequest() {},
  renderRows() {},
  rows: { querySelector: () => ({ focus() {}, disabled: false }) },
  page: { querySelector: () => ({ textContent: '' }) },
};
vm.createContext(state);
vm.runInContext(extractFunction('setQuantity') + '\n' + extractFunction('changeCommunityQuantity'), state);

state.setQuantity(5);
assert.equal(state.allocations.length, 5);
assert.ok(state.allocations.every((ticket) => ticket.kind === 'community_managed' && !('recipient_email' in ticket)));

state.allocations.push({ kind: 'self' }, { kind: 'gift', recipient_email: 'gift@example.test' }, { kind: 'community_shareable' });
state.changeCommunityQuantity(1);
state.changeCommunityQuantity(-1);
assert.deepEqual(Array.from(state.allocations.slice(5), (ticket) => ({ ...ticket })), [
  { kind: 'self' },
  { kind: 'gift', recipient_email: 'gift@example.test' },
  { kind: 'community_shareable' },
]);
state.setQuantity(9);
assert.equal(state.allocations[8].kind, 'gift');
assert.equal(state.allocations[6].recipient_email, 'gift@example.test');

for (let i = 0; i < 5; i++) state.changeCommunityQuantity(-1);
assert.equal(state.allocations.filter((ticket) => ticket.kind === 'community_managed').length, 0);
assert.equal(state.allocations[1].recipient_email, 'gift@example.test');
state.setQuantity(20);
state.changeCommunityQuantity(1);
assert.equal(state.allocations.length, 20);
state.setQuantity(21);
assert.equal(state.allocations.length, 20);
state.allocations = [{ kind: 'community_managed' }];
state.changeCommunityQuantity(-1);
state.setQuantity(0);
assert.equal(state.allocations.length, 1);
state.liveBusy = true;
state.changeCommunityQuantity(1);
assert.equal(state.allocations.length, 1);
console.log('PASS: community-only growth, mixed allocations and gift preservation, group removal, quantity bounds and busy guard.');
