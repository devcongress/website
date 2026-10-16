import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(root + '/package.json');
const astroRequire = createRequire(require.resolve('astro/package.json'));
const { build } = astroRequire('esbuild');
const result = await build({
  entryPoints: [root + '/src/lib/devcon26-hero-slideshow.ts'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  write: false,
  logLevel: 'silent',
});
const code = result.outputFiles[0].text;

function harness({ reduced = false, failure = () => false } = {}) {
  let now = 0;
  let nextTimer = 0;
  let observer;
  const timers = new Map();
  const document = Object.assign(new EventTarget(), { hidden: false, activeElement: null });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const finePointer = Object.assign(new EventTarget(), { matches: true });
  const window = Object.assign(new EventTarget(), {
    innerHeight: 900,
    matchMedia: (query) => query.includes('reduced-motion') ? motion : finePointer,
    setTimeout(callback, delay) {
      const id = ++nextTimer;

      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });

  class Photo extends EventTarget {
    constructor(slotIndex, photoIndex) {
      super();
      this.dataset = { heroSrc: '/photo-' + slotIndex + '-' + photoIndex + '.webp' };
      this.attributes = new Map();
      this.classes = new Set(photoIndex === 0 ? ['is-active'] : []);
      this.classList = {
        add: (value) => this.classes.add(value),
        remove: (value) => this.classes.delete(value),
      };
      this.complete = photoIndex === 0;
      this.naturalWidth = photoIndex === 0 ? 1000 : 0;

      if (photoIndex === 0) this.attributes.set('src', this.dataset.heroSrc);
      else this.attributes.set('aria-hidden', 'true');
    }

    set src(value) {
      this.attributes.set('src', value);
      const outcome = failure(value);

      if (outcome === 'slow') return;

      queueMicrotask(() => {
        this.complete = true;
        this.naturalWidth = outcome ? 0 : 1000;
        this.dispatchEvent(new Event(outcome ? 'error' : 'load'));
      });
    }

    decode() {
      return Promise.resolve();
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    removeAttribute(name) {
      this.attributes.delete(name);
    }
  }

  const slots = [8, 4, 4].map((count, slotIndex) => ({
    photos: Array.from({ length: count }, (_, photoIndex) => new Photo(slotIndex, photoIndex)),
    querySelectorAll() {
      return this.photos;
    },
  }));
  const focusScope = Object.assign(new EventTarget(), { contains: (node) => node === focusScope });
  const element = Object.assign(new EventTarget(), {
    querySelectorAll: () => slots,
    closest: () => focusScope,
    getBoundingClientRect: () => ({ top: 100, bottom: 600 }),
  });
  class Observer {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observer = this;
    }

    observe() {}

    disconnect() {
      this.disconnected = true;
    }
  }

  const module = { exports: {} };

  vm.runInNewContext(code, { module, window, document, AbortController, IntersectionObserver: Observer });
  const dispose = module.exports.initDevcon26HeroSlideshow(element);
  const flush = async () => {
    for (let index = 0; index < 80; index += 1) await Promise.resolve();
  };
  const advance = async (duration) => {
    const end = now + duration;

    await flush();

    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];

      if (!next || next[1].at > end) break;

      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    }

    now = end;
    await flush();
  };
  const active = () => slots.map((slot) => {
    const visible = slot.photos.filter((photo) => photo.classes.has('is-active'));

    assert.equal(visible.length, 1);
    assert.equal(visible[0].getAttribute('aria-hidden'), null);
    assert.ok(slot.photos.every((photo) => photo === visible[0] || photo.getAttribute('aria-hidden') === 'true'));
    return slot.photos.indexOf(visible[0]);
  });
  const emit = (target, name, properties = {}) => target.dispatchEvent(Object.assign(new Event(name), properties));

  return { slots, element, focusScope, motion, window, document, timers, dispose, advance, active, emit, flush, get observer() { return observer; } };
}

const normal = harness();

await normal.flush();
assert.deepEqual(normal.active(), [0, 0, 0]);
assert.ok(normal.slots[0].photos[1].getAttribute('src'), 'next photo is primed before its tick');
assert.equal(normal.slots[1].photos[1].getAttribute('src'), null, 'remaining pools are not eagerly downloaded');
await normal.advance(2999);
assert.deepEqual(normal.active(), [0, 0, 0]);
await normal.advance(1);
assert.deepEqual(normal.active(), [1, 0, 0]);
await normal.advance(3000);
assert.deepEqual(normal.active(), [1, 1, 0]);
await normal.advance(3000);
assert.deepEqual(normal.active(), [1, 1, 1]);
await normal.advance(3000);
assert.deepEqual(normal.active(), [2, 1, 1]);

normal.emit(normal.focusScope, 'pointerenter', { pointerType: 'mouse' });
await normal.advance(3000);
assert.deepEqual(normal.active(), [2, 2, 1], 'hovering copy does not pause photographs');
normal.emit(normal.element, 'pointerenter', { pointerType: 'mouse' });
await normal.advance(9000);
assert.deepEqual(normal.active(), [2, 2, 1]);
normal.emit(normal.element, 'pointerleave');
await normal.advance(2999);
assert.deepEqual(normal.active(), [2, 2, 1], 'resume has a full interval');
await normal.advance(1);
assert.deepEqual(normal.active(), [2, 2, 2]);

normal.emit(normal.focusScope, 'focusin');
await normal.advance(9000);
assert.deepEqual(normal.active(), [2, 2, 2]);
normal.emit(normal.focusScope, 'focusout', { relatedTarget: null });
normal.document.hidden = true;
normal.emit(normal.document, 'visibilitychange');
await normal.advance(9000);
assert.deepEqual(normal.active(), [2, 2, 2]);
normal.document.hidden = false;
normal.emit(normal.document, 'visibilitychange');
normal.observer.callback([{ isIntersecting: false }]);
await normal.advance(9000);
assert.deepEqual(normal.active(), [2, 2, 2]);
normal.observer.callback([{ isIntersecting: true }]);
normal.emit(normal.window, 'pagehide');
await normal.advance(9000);
assert.deepEqual(normal.active(), [2, 2, 2]);
normal.emit(normal.window, 'pageshow');
await normal.advance(3000);
assert.deepEqual(normal.active(), [3, 2, 2]);
normal.motion.matches = true;
normal.emit(normal.motion, 'change');
await normal.advance(9000);
assert.deepEqual(normal.active(), [3, 2, 2]);
normal.motion.matches = false;
normal.emit(normal.motion, 'change');
await normal.advance(3000);
assert.deepEqual(normal.active(), [3, 3, 2]);
normal.emit(normal.document, 'astro:before-swap');
await normal.advance(9000);
assert.deepEqual(normal.active(), [3, 3, 2]);
assert.equal(normal.timers.size, 0);
assert.equal(normal.observer.disconnected, true);
normal.dispose();

const reduced = harness({ reduced: true });

await reduced.advance(30000);
assert.deepEqual(reduced.active(), [0, 0, 0]);
assert.equal(reduced.slots[0].photos[1].getAttribute('src'), null);
reduced.dispose();

const failed = harness({ failure: (url) => url.startsWith('/photo-0-') });

await failed.advance(3000);
assert.deepEqual(failed.active(), [0, 1, 0], 'failed wide pool does not stop healthy pools');
await failed.advance(3000);
assert.deepEqual(failed.active(), [0, 1, 1]);
failed.dispose();

const allFailed = harness({ failure: () => true });

await allFailed.advance(30000);
assert.deepEqual(allFailed.active(), [0, 0, 0]);
assert.equal(allFailed.timers.size, 0, 'exhausted alternatives stop playback without clearing visible images');
allFailed.dispose();

const slow = harness({ failure: (url) => url === '/photo-0-1.webp' ? 'slow' : false });

await slow.advance(3000);
assert.deepEqual(slow.active(), [0, 0, 0], 'loading never blanks current image');
slow.emit(slow.window, 'pagehide');
await slow.advance(10000);
assert.deepEqual(slow.active(), [0, 0, 0], 'aborted slow preparation cannot commit');
slow.emit(slow.window, 'pageshow');
await slow.advance(8000);
assert.deepEqual(slow.active(), [2, 0, 0], 'timed-out photo is skipped after resume');
slow.dispose();
assert.equal(slow.timers.size, 0);

const html = readFileSync(root + '/dist/devcon26/index.html', 'utf8');
const mosaic = html.slice(html.indexOf('<div class="hero-images"'), html.indexOf('</section>', html.indexOf('<div class="hero-images"')));
const photos = [...mosaic.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);

assert.equal((mosaic.match(/data-hero-slot=/g) || []).length, 3);
assert.equal(photos.length, 16);
assert.equal(photos.filter((photo) => /\ssrc=/.test(photo)).length, 3, 'three images exist without JS');
assert.equal(photos.filter((photo) => /class="is-active"/.test(photo)).length, 3);
assert.equal(photos.filter((photo) => /aria-hidden="true"/.test(photo)).length, 13);
assert.equal(photos.filter((photo) => /fetchpriority="high"/.test(photo)).length, 1);
assert.ok(!mosaic.includes('<button') && !mosaic.includes('aria-live'));

for (const photo of photos) {
  const src = photo.match(/data-hero-src="([^"]+)"/)[1];

  assert.ok(existsSync(root + '/public' + src), 'photo exists: ' + src);
  assert.match(photo, /alt="[^"]+"/);
  assert.match(photo, /width="\d+"/);
  assert.match(photo, /height="\d+"/);
}

console.log('DevCon26 hero checks passed: 3 static photos, 16 assets, staggered/preloaded rotation, failure recovery, pause/resume and cleanup.');
