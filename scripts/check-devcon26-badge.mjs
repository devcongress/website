import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const root = new URL('../', import.meta.url).pathname;
const bundle = await build({ entryPoints: [root + 'src/worker.ts'], bundle: true, format: 'cjs', platform: 'browser', write: false });
const photo = readFileSync(root + 'public/images/devcon26/hero-may-attendee.webp');
const logo = readFileSync(root + 'public/images/logo.png');
const backing = readFileSync(root + 'public/images/devcon26/social-card/devcon26-v11-base-1080x1350.png');
const slug = 'synthetic-public-card-000001';
let role = 'attendee';
let unavailable = false;
const worker = { exports: {} };

vm.runInNewContext(bundle.outputFiles[0].text, {
  module: worker, URL, Request, Response, Headers, AbortSignal, Uint8Array, btoa,
  console: { error() {} },
  fetch: async url => {
    assert.ok(String(url).startsWith('https://em.devcongress.org/api/public/annual-conference/2026/social-cards/'));
    if (unavailable) return new Response('', { status: 404 });
    if (String(url).endsWith('/image')) return new Response(photo, { headers: { 'Content-Type': 'image/webp' } });

    return Response.json({ card: {
      display_name: 'Alexandra <script>alert(1)</script> Mensah', role,
      event_name: 'DevCon26', event_date: '19 December 2026', location: 'Accra, Ghana', photo_available: true,
    } });
  },
});

const env = { ASSETS: { fetch: async request => {
  const pathname = new URL(request.url).pathname;
  assert.ok(['/images/logo.png', '/images/devcon26/social-card/devcon26-v11-base-1080x1350.png'].includes(pathname));
  return new Response(pathname === '/images/logo.png' ? logo : backing, { headers: { 'Content-Type': 'image/png' } });
} } };
const run = (suffix = '', method = 'GET') => worker.exports.default.fetch(new Request(`https://example.test/devcon26/cards/${slug}${suffix}`, { method }), env, {});

for (role of ['attendee', 'speaker']) {
  const page = await run();
  const html = await page.text();

  assert.equal(page.status, 200);
  assert.ok(html.includes(role.toUpperCase()));
  assert.ok(html.includes('#f5f2e8'));
  assert.ok(html.includes('/images/logo.png'));
  assert.ok(html.includes(`${slug}/image`));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('capability'));
  const preview = await run('/preview.svg');
  const svg = await preview.text();

  assert.equal(preview.status, 200);
  assert.ok(svg.includes('viewBox="0 0 1080 1350"'));
  assert.ok(svg.includes('font-size="44"'));
  assert.ok(svg.includes('data:image/png;base64,'));
  assert.ok(svg.includes('data:image/webp;base64,'));
  assert.ok(svg.includes(role.toUpperCase()));
  assert.ok(!svg.includes('<script>'));
  assert.equal(await (await run('/preview.svg', 'HEAD')).text(), '');
}

unavailable = true;
assert.equal((await run()).status, 404);
assert.equal((await run('/preview.svg')).status, 404);
assert.equal((await run('/image')).status, 404);
assert.equal((await run('', 'POST')).status, 405);
console.log('PASS: attendee/speaker public badges, real embedded logo/photo, escaping, revoked cards, HEAD and read-only methods.');
