import { z } from 'zod';

const programmeSchema = z.object({
  year: z.literal(2026),
  rows: z.array(z.object({
    id: z.string(),
    time: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.string(),
    speakers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      photoUrl: z.string().nullable(),
    })),
  })),
});

function safePhotoUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export async function initializeDevcon26Programme(root: HTMLElement | null, speakerRoot: HTMLElement | null): Promise<void> {
  if (!root) return;

  const status = root.querySelector<HTMLElement>('[data-programme-status]');
  const list = root.querySelector<HTMLOListElement>('[data-programme-list]');
  const speakerStatus = speakerRoot?.querySelector<HTMLElement>('[data-speakers-status]');
  const speakerList = speakerRoot?.querySelector<HTMLElement>('[data-speakers-list]');

  if (!status || !list) return;

  root.setAttribute('aria-busy', 'true');
  status.hidden = false;
  status.textContent = 'Loading the programme…';
  speakerRoot?.setAttribute('aria-busy', 'true');

  if (speakerStatus) {
    speakerStatus.hidden = false;
    speakerStatus.textContent = 'Loading speakers…';
  }

  try {
    const configuredOrigin = import.meta.env.PUBLIC_DEVCON26_API_ORIGIN?.trim() || 'https://em.devcongress.org';
    const origin = new URL(configuredOrigin);

    if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) {
      throw new Error('Invalid API origin');
    }

    const isWebsitePreview = /^https:\/\/[a-z0-9-]+-devcongress-website\.admins-a7d\.workers\.dev$/.test(window.location.origin);
    const endpoint = isWebsitePreview && origin.origin === 'https://em.devcongress.org'
      ? new URL('/__public/devcon26/programme', window.location.origin)
      : new URL('/api/public/annual-conference/2026/programme', origin.origin);
    const response = await fetch(endpoint, {
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error('Programme unavailable');

    const programme = programmeSchema.parse(await response.json());
    const fragment = document.createDocumentFragment();

    for (const row of programme.rows) {
      const item = document.createElement('li');
      const time = document.createElement('span');
      const content = document.createElement('div');
      const title = document.createElement('h4');

      time.className = 'programme-time';
      time.textContent = row.time;
      title.textContent = row.title;
      content.append(title);

      if (row.description) {
        const description = document.createElement('p');

        description.textContent = row.description;
        content.append(description);
      }

      if (row.speakers.length) {
        const speakers = document.createElement('div');

        speakers.className = 'programme-speakers';

        for (const speaker of row.speakers) {
          const person = document.createElement('span');
          const photoUrl = safePhotoUrl(speaker.photoUrl);

          person.className = 'programme-speaker';

          if (photoUrl) {
            const photo = document.createElement('img');

            photo.src = photoUrl;
            photo.alt = '';
            photo.loading = 'lazy';
            photo.referrerPolicy = 'no-referrer';
            photo.addEventListener('error', () => photo.remove(), { once: true });
            person.append(photo);
          }

          const name = document.createElement('span');

          name.textContent = speaker.name;
          person.append(name);
          speakers.append(person);
        }

        content.append(speakers);
      }

      item.append(time, content);
      fragment.append(item);
    }

    if (speakerList && speakerStatus) {
      const speakers = new Map<string, { id: string; name: string; photoUrl: string | null }>();

      for (const row of programme.rows) {
        for (const speaker of row.speakers) {
          if (!speakers.has(speaker.id)) speakers.set(speaker.id, speaker);
        }
      }

      const speakerFragment = document.createDocumentFragment();

      for (const speaker of speakers.values()) {
        const item = document.createElement('li');
        const photoUrl = safePhotoUrl(speaker.photoUrl);

        if (photoUrl) {
          const photo = document.createElement('img');

          photo.src = photoUrl;
          photo.alt = '';
          photo.loading = 'lazy';
          photo.referrerPolicy = 'no-referrer';
          photo.addEventListener('error', () => photo.remove(), { once: true });
          item.append(photo);
        }

        const name = document.createElement('span');

        name.textContent = speaker.name;
        item.append(name);
        speakerFragment.append(item);
      }

      speakerList.replaceChildren(speakerFragment);
      speakerStatus.hidden = speakers.size > 0;
      speakerStatus.textContent = speakers.size ? '' : 'Speakers will be announced here soon.';
    }

    list.replaceChildren(fragment);
    status.hidden = programme.rows.length > 0;
    status.textContent = programme.rows.length ? '' : 'The programme will be announced here soon.';
  } catch {
    status.textContent = 'The programme could not be loaded. Please try again later.';
    if (speakerStatus) speakerStatus.textContent = 'Speakers could not be loaded. Please try again later.';
  } finally {
    root.setAttribute('aria-busy', 'false');
    speakerRoot?.setAttribute('aria-busy', 'false');
  }
}
