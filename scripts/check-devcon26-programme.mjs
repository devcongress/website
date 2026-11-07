import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const bundle = await build({
  entryPoints: [new URL('../src/lib/devcon26-programme.ts', import.meta.url).pathname],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  write: false,
  define: { 'import.meta.env.PUBLIC_DEVCON26_API_ORIGIN': '"https://em.devcongress.org"' },
});

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.textContent = '';
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
  }

  querySelector(selector) {
    return selector.includes('status') ? this.status : this.list;
  }

  addEventListener(_name, callback) {
    this.onError = callback;
  }

  remove() {
    this.removed = true;
  }

}

function createRoot() {
  const root = new Element('root');

  root.status = new Element('status');
  root.list = new Element('list');

  return root;
}

const data = {
  year: 2026,
  rows: [
    {
      id: 'panel', time: '9:00', title: '<b>Talk</b>', description: 'Overview', type: 'panel',
      speakers: [
        { id: 'ada', name: 'Ada', photoUrl: 'https://example.org/ada.png' },
        { id: 'ben-1', name: 'Ben', photoUrl: null },
        { id: 'ben-2', name: 'Ben', photoUrl: null },
        { id: 'ada', name: 'Ada Variant', photoUrl: null },
      ],
    },
    { id: 'break', time: '10:00', title: 'Break', description: '', type: 'break', speakers: [] },
  ],
};

let response = { ok: true, json: async () => data };
let request;
const module = { exports: {} };

vm.runInNewContext(bundle.outputFiles[0].text, {
  module,
  exports: module.exports,
  URL,
  AbortSignal,
  window: { location: { origin: 'https://devcongress.org' } },
  document: {
    createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
  },
  fetch: async (url, options) => {
    request = { url, options };

    return response;
  },
});

const { initializeDevcon26Programme } = module.exports;
const programme = createRoot();
const speakers = createRoot();

await initializeDevcon26Programme(programme, speakers);

const rows = programme.list.children[0].children;
const directory = speakers.list.children[0].children;

assert.equal(rows.length, 2);
assert.equal(rows[0].children[1].children[0].textContent, '<b>Talk</b>');
assert.equal(rows[0].children[1].children[2].children.length, 4);
assert.equal(rows[1].children[1].children.length, 1);
assert.deepEqual(directory.map(item => item.children.at(-1).textContent), ['Ada', 'Ben', 'Ben']);
assert.equal(request.url.href, 'https://em.devcongress.org/api/public/annual-conference/2026/programme');
assert.equal(request.options.credentials, 'omit');
assert.equal(request.options.cache, 'no-store');
assert.equal(programme.status.hidden, true);
assert.equal(programme.attributes['aria-busy'], 'false');

directory[0].children[0].onError();
assert.equal(directory[0].children[0].removed, true);
assert.equal(directory[0].children[1].textContent, 'Ada');

response = { ok: true, json: async () => ({ year: 2026, rows: [] }) };
const emptyProgramme = createRoot();
const emptySpeakers = createRoot();

await initializeDevcon26Programme(emptyProgramme, emptySpeakers);
assert.match(emptyProgramme.status.textContent, /announced/);
assert.match(emptySpeakers.status.textContent, /announced/);

for (const failedResponse of [
  { ok: false },
  { ok: true, json: async () => ({ year: 2026, rows: 'bad' }) },
]) {
  response = failedResponse;
  const failedProgramme = createRoot();
  const failedSpeakers = createRoot();

  await initializeDevcon26Programme(failedProgramme, failedSpeakers);
  assert.match(failedProgramme.status.textContent, /could not be loaded/);
  assert.match(failedSpeakers.status.textContent, /could not be loaded/);
}

const previewModule = { exports: {} };
let previewRequest;

vm.runInNewContext(bundle.outputFiles[0].text, {
  module: previewModule,
  exports: previewModule.exports,
  URL,
  AbortSignal,
  window: { location: { origin: 'https://feature-devcon26-live-programme-devcongress-website.admins-a7d.workers.dev' } },
  document: { createElement: tag => new Element(tag), createDocumentFragment: () => new Element('fragment') },
  fetch: async url => {
    previewRequest = url;

    return { ok: true, json: async () => ({ year: 2026, rows: [] }) };
  },
});

await previewModule.exports.initializeDevcon26Programme(createRoot(), createRoot());
assert.equal(previewRequest.href, 'https://feature-devcon26-live-programme-devcongress-website.admins-a7d.workers.dev/__public/devcon26/programme');

console.log('PASS programme: speaker identity, equal names, panel and break rows, safe text, broken photos, empty and failure states.');
