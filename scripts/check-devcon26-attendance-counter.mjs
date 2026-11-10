import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');

async function bundle(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'cjs', platform: 'browser', write: false });
  return result.outputFiles[0].text;
}

const counterModule = { exports: {} };
const requests = [];
let payload = { count: 0, source: 'actual' };
let fail = false;
let ok = true;
let invalidJson = false;
const context = {
  module: counterModule,
  URL,
  AbortSignal,
  window: { location: { origin: 'https://devcongress.org' }, addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, setTimeout() { return 1; }, clearInterval() {}, clearTimeout() {} },
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (fail) throw new Error('Network failure');
    return { ok, json: async () => { if (invalidJson) throw new Error('Invalid JSON'); return payload; } };
  },
};
vm.runInNewContext(await bundle('src/lib/devcon26-attendance-counter.ts'), context);
const { publishedAttendance, attendanceEndpoint, initializeAttendanceCounter } = counterModule.exports;

for (const invalid of [null, {}, { count: null, source: null }, { count: 1, source: null }, { count: null, source: 'actual' }, { count: -1, source: 'actual' }, { count: 1.5, source: 'estimate' }, { count: '1', source: 'actual' }, { count: 1, source: 'unknown' }, { count: Number.MAX_SAFE_INTEGER + 1, source: 'actual' }]) {
  assert.equal(publishedAttendance(invalid), null);
}
assert.equal(attendanceEndpoint('https://user:pass@example.com', 'https://devcongress.org'), null);
assert.equal(attendanceEndpoint('https://example.com/path', 'https://devcongress.org'), null);
assert.equal(attendanceEndpoint('http://example.com', 'https://devcongress.org'), null);
assert.equal(attendanceEndpoint('https://em.devcongress.org', 'https://abc-devcongress-website.admins-a7d.workers.dev'), '/api/devcon26/attendance-counter');
for (const localOrigin of ['http://localhost:4321', 'http://127.0.0.1:4321', 'http://[::1]:4321']) {
  assert.equal(attendanceEndpoint('https://em.devcongress.org', localOrigin), '/api/devcon26/attendance-counter');
}
assert.equal(attendanceEndpoint('http://localhost:8787', 'http://localhost:4321'), 'http://localhost:8787/api/public/annual-conference/2026/attendance-counter');
assert.equal(attendanceEndpoint('https://em.devcongress.org', 'https://unrelated.example'), 'https://em.devcongress.org/api/public/annual-conference/2026/attendance-counter');
assert.equal(attendanceEndpoint('https://em.devcongress.org', 'https://devcongress.org'), 'https://em.devcongress.org/api/public/annual-conference/2026/attendance-counter');

function fixture() {
  const count = { textContent: '' };
  const estimate = { hidden: true };
  return { hidden: true, count, estimate, querySelector: (selector) => selector === '[data-attendance-count]' ? count : selector === '[data-attendance-estimate]' ? estimate : null };
}

for (const [input, label, estimated] of [
  [{ count: 0, source: 'actual' }, '0 people are attending', false],
  [{ count: 1, source: 'actual' }, '1 person is attending', false],
  [{ count: 1250, source: 'estimate' }, '1,250 people are attending', true],
  [{ count: 25, source: 'ticket_count' }, '25 tickets', false],
]) {
  payload = input;
  const root = fixture();
  await initializeAttendanceCounter([root], 'https://em.devcongress.org');
  assert.equal(root.hidden, false);
  assert.equal(root.count.textContent, label);
  assert.equal(root.estimate.hidden, !estimated);
}
for (const [variant, count, expected] of [
  ['sticker', 1, '1 person is coming'],
  ['hanging', 1250, '1,250 people are coming'],
]) {
  payload = { count, source: 'actual' };
  const elements = {
    '[data-attendance-count]': { textContent: '' },
    '[data-attendance-sizer]': { textContent: '' },
    '[data-attendance-wording]': { textContent: '' },
    '[data-attendance-label]': { textContent: '' },
  };
  const root = { hidden: true, style: { setProperty() {} }, dataset: { attendanceVariant: variant }, querySelector: (selector) => elements[selector] };

  await initializeAttendanceCounter([root], 'https://em.devcongress.org');
  assert.equal(root.hidden, false);
  assert.equal(elements['[data-attendance-label]'].textContent, expected);
  assert.equal(elements['[data-attendance-count]'].textContent, count.toLocaleString('en-GH'));
  assert.equal(elements['[data-attendance-sizer]'].textContent, count.toLocaleString('en-GH'));
}

for (const input of [{ count: null, source: null }, { count: 1, source: null }, { count: null, source: 'actual' }, { count: -1, source: 'actual' }]) {
  payload = input;
  const root = fixture();
  await initializeAttendanceCounter([root], 'https://em.devcongress.org');
  assert.equal(root.hidden, true);
}
ok = false;
const nonOk = fixture();
await initializeAttendanceCounter([nonOk], 'https://em.devcongress.org');
assert.equal(nonOk.hidden, true);
ok = true;
invalidJson = true;
const invalidBody = fixture();
await initializeAttendanceCounter([invalidBody], 'https://em.devcongress.org');
assert.equal(invalidBody.hidden, true);
invalidJson = false;
fail = true;
const unavailable = fixture();
await initializeAttendanceCounter([unavailable], 'https://em.devcongress.org');
assert.equal(unavailable.hidden, true);
assert.equal(requests[0].options.credentials, 'omit');
assert.equal(requests[0].options.cache, 'no-store');
assert.ok(requests[0].options.signal);

// Exercise refresh signals and ensure a slow response cannot overlap a newer read.
const listeners = {};
const timers = [];
let refreshPayload = { count: 20, source: 'ticket_count' };
let calls = 0;
let release;
const lifecycleModule = { exports: {} };
const lifecycleContext = {
  module: lifecycleModule, URL, AbortSignal,
  window: {
    location: { origin: 'https://devcongress.org' },
    addEventListener(name, callback) { listeners[name] = callback; },
    removeEventListener() {},
    setTimeout(callback) { timers.push(callback); return timers.length; },
    clearTimeout() {}, setInterval(callback) { listeners.interval = callback; return 1; }, clearInterval() {},
  },
  document: { visibilityState: 'visible', addEventListener(name, callback) { listeners[name] = callback; }, removeEventListener() {} },
  fetch: async () => {
    calls += 1;
    if (release) await new Promise((resolve) => { release = resolve; });
    return { ok: true, json: async () => refreshPayload };
  },
};
vm.runInNewContext(await bundle('src/lib/devcon26-attendance-counter.ts'), lifecycleContext);
const lifecycleRoot = fixture();
await lifecycleModule.exports.initializeAttendanceCounter([lifecycleRoot], 'https://em.devcongress.org');
assert.equal(lifecycleRoot.count.textContent, '20 tickets');
refreshPayload = { count: 25, source: 'ticket_count' };
listeners.storage({ key: 'devcon26-ticket-counter-refresh' });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(lifecycleRoot.count.textContent, '25 tickets');
assert.equal(timers.length, 3);
refreshPayload = { count: 26, source: 'ticket_count' };
listeners.visibilitychange();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(lifecycleRoot.count.textContent, '26 tickets');
release = true;
listeners.interval();
listeners.interval();
const duringRequest = calls;
release();
release = null;
await new Promise((resolve) => setImmediate(resolve));
assert.equal(calls, duringRequest + 1, 'overlapping signals coalesce into one follow-up read');
listeners.pagehide({ persisted: false });

const workerModule = { exports: {} };
let upstreamRequest;
let upstreamFails = false;
let upstreamRedirects = false;
vm.runInNewContext(await bundle('src/worker.ts'), {
  module: workerModule, URL, Request, Response, AbortSignal, console,
  fetch: async (url, options) => {
    upstreamRequest = { url: String(url), options };
    if (upstreamFails) throw new Error('Unavailable');
    if (upstreamRedirects) return Response.redirect('https://example.com/', 302);
    return Response.json({ count: 42, source: 'ticket_count', private: 'discarded' });
  },
});
const worker = workerModule.exports.default;
const response = await worker.fetch(new Request('https://preview.workers.dev/api/devcon26/attendance-counter?other=1', { headers: { Cookie: 'secret', Authorization: 'secret' } }), { ASSETS: {} }, {});
assert.deepEqual(await response.json(), { count: 42, source: 'ticket_count' });
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(upstreamRequest.url, 'https://em.devcongress.org/api/public/annual-conference/2026/attendance-counter');
assert.deepEqual(Object.keys(upstreamRequest.options.headers), ['Accept']);
assert.equal(upstreamRequest.options.redirect, 'manual');
assert.equal(upstreamRequest.options.cache, 'no-store');
upstreamRedirects = true;
const redirectedRelay = await worker.fetch(new Request('https://preview.workers.dev/api/devcon26/attendance-counter'), { ASSETS: {} }, {});
assert.equal(redirectedRelay.status, 503);
assert.equal(redirectedRelay.headers.get('Cache-Control'), 'no-store');
assert.equal(redirectedRelay.headers.get('Location'), null);
upstreamRedirects = false;
upstreamFails = true;
const failedRelay = await worker.fetch(new Request('https://preview.workers.dev/api/devcon26/attendance-counter'), { ASSETS: {} }, {});
assert.equal(failedRelay.status, 503);
assert.equal(failedRelay.headers.get('Cache-Control'), 'no-store');
const rejected = await worker.fetch(new Request('https://preview.workers.dev/api/devcon26/attendance-counter', { method: 'POST' }), { ASSETS: {} }, {});
assert.equal(rejected.status, 405);
assert.ok(readFileSync('wrangler.jsonc', 'utf8').includes('"/api/devcon26/attendance-counter"'));
console.log('DevCon26 attendance counter checks passed');
