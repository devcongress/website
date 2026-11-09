import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const bundle = await build({
  entryPoints: [new URL('../src/worker.ts', import.meta.url).pathname],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  write: false,
});
const worker = { exports: {} };
let upstreamRequest;
let upstream = Response.json({ year: 2026, rows: [] });

vm.runInNewContext(bundle.outputFiles[0].text, {
  module: worker,
  exports: worker.exports,
  URL,
  Request,
  Response,
  Headers,
  AbortSignal,
  Uint8Array,
  console,
  fetch: async (url, options) => {
    upstreamRequest = { url, options };

    return upstream;
  },
});

const preview = 'https://feature-devcon26-live-programme-devcongress-website.admins-a7d.workers.dev';
const path = '/__public/devcon26/programme';
const env = { ASSETS: { fetch: async () => new Response('asset') } };
const run = (url, options) => worker.exports.default.fetch(new Request(url, options), env, {});
const response = await run(preview + path + '?url=https://evil.example', {
  headers: { Cookie: 'private=secret', Authorization: 'Bearer secret' },
});

assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { year: 2026, rows: [] });
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(upstreamRequest.url, 'https://em.devcongress.org/api/public/annual-conference/2026/programme');
assert.equal(upstreamRequest.options.method, 'GET');
assert.equal(upstreamRequest.options.redirect, 'manual');
assert.deepEqual(Object.keys(upstreamRequest.options.headers), ['Accept']);
assert.equal((await run(preview + path, { method: 'POST' })).status, 405);
assert.equal((await run('https://devcongress.org' + path)).status, 404);
assert.equal((await run('https://evil-devcongress-website.admins-a7d.workers.dev.evil.example' + path)).status, 404);
assert.equal(await (await run(preview + '/other')).text(), 'asset');

for (const failed of [
  new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }),
  new Response('bad', { status: 500 }),
  new Response('not json', { headers: { 'Content-Type': 'text/html' } }),
  new Response(new Uint8Array(1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
]) {
  upstream = failed;
  assert.equal((await run(preview + path)).status, 503);
}

console.log('PASS programme relay: exact preview routing, fixed upstream, request isolation, failure and size bounds.');
