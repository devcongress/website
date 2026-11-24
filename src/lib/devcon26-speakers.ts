export interface Devcon26Speaker {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  bio: string;
  photoUrl: string | null;
  photoVersion: string | null;
  photoPosition?: string;
}

export interface Devcon26SpeakersResponse {
  year: 2026;
  updatedAt: string | null;
  speakers: Devcon26Speaker[];
}

export const DEFAULT_EMS_API_ORIGIN = 'https://em.devcongress.org';
export const EMS_PUBLIC_SPEAKERS_PATH = '/api/public/annual-conference/2026/speakers';
export const SPEAKERS_RELAY_PATH = '/devcon26/api/speakers';
export const SPEAKER_PHOTO_RELAY_PREFIX = '/devcon26/api/speakers/';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_CACHE_KEY = 'devcon26:speakers:v1';
const SESSION_CACHE_TTL_MS = 2 * 60 * 1000;

export const INITIAL_DEVCON26_SPEAKERS: Devcon26Speaker[] = [
  {
    id: '65a61474-2a6c-4313-81be-f667c4e2a623',
    name: 'Edem Kumodzi',
    role: 'Software Architect',
    organization: 'Microsoft',
    bio: 'Edem Kumodzi is a software architect with over 15 years of experience in software engineering and technical leadership. His career spans Microsoft, ThoughtWorks, and Andela. At Microsoft, his work focuses on trust, privacy, compliance, and applying AI to enterprise workflows.',
    photoUrl: '/images/devcon26/speakers/edem-kumodzi.jpg',
    photoVersion: 'seed-edem',
    photoPosition: '50% 22%',
  },
  {
    id: 'f14f1d3a-d1fc-429e-abcb-20205d766265',
    name: 'Clinton Nyarkoh',
    role: 'CEO',
    organization: 'iSupreme',
    bio: 'I am an entrepreneur building at the intersection of creativity and technology, focused on helping businesses grow, market better, and create stronger connections with their customers.\n\nI am the CEO of iSupreme, a technology-focused growth company with two core arms: iSupreme One, a multidisciplinary marketing agency helping brands create deeper, stronger, and better connections with their customers; and iSupreme Labs, our product and venture studio building technology that powers the next era of marketing.\n\nMy work explores how creativity and technology can come together to create better brands, better customer experiences, and better ways for businesses to grow.\n\nBeyond building iSupreme, I have spoken on panels, lectures, workshops, and training sessions on marketing, technology, entrepreneurship, and building businesses. I enjoy sharing what I learn along the way and connecting with people who are building, creating, and figuring things out.',
    photoUrl: '/images/devcon26/speakers/clinton-nyarkoh.jpg',
    photoVersion: 'seed-clinton',
    photoPosition: '50% 20%',
  },
  {
    id: '8be3abf6-caa7-4da3-9a9a-362601af18b9',
    name: 'Stefan Froelich',
    role: 'Principal Engineer',
    organization: 'Spry',
    bio: 'Stefan Froelich has built software in Ghana since 2011. He is Principal Engineer at Spry, where he runs engineering for the Achieve app and the pension and mutual fund platforms behind it. He built Achieve from zero to more than 580,000 users and over GHS 2.6 billion moved, and was nominated Fintech CTO of the Year 2025. Through Fayaworks Technologies he builds UniversalChatbot, which runs AI agents across WhatsApp, web chat and social channels. He also maintains Plutonium, an open-source Rails framework for business applications.',
    photoUrl: '/images/devcon26/speakers/stefan-froelich.jpg',
    photoVersion: 'seed-stefan',
    photoPosition: '50% 42%',
  },
  {
    id: 'bf8fc371-e3ec-4e0a-9973-5f99ceecde66',
    name: 'Silas Bempong',
    role: 'AI/ML Engineer',
    organization: null,
    bio: 'Silas Bempong is an AI/ML engineer who builds and studies intelligent systems: how they learn, behave and become useful. His work bridges research and engineering across machine learning, reinforcement learning and the data, training and inference systems that support them. He also considers Red Rising the greatest sci-fi series of all time. Hail Reaper!',
    photoUrl: '/images/devcon26/speakers/silas-bempong.jpg',
    photoVersion: 'seed-silas',
    photoPosition: '50% 28%',
  },
];

const LOCAL_SEED_BY_ID = new Map(INITIAL_DEVCON26_SPEAKERS.map((speaker) => [speaker.id, speaker]));

export function splitSpeakerName(fullName: string): { first: string; rest: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', rest: '' };
  return { first: parts[0]!, rest: parts.slice(1).join(' ') };
}

export const MAX_EXPANDED_BIO_PARAGRAPHS = 2;
export const MAX_EXPANDED_BIO_CHARS = 620;

export function splitBioParagraphs(bio: string): string[] {
  return bio
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function limitExpandedBioParagraphs(
  bio: string,
  maxParagraphs = MAX_EXPANDED_BIO_PARAGRAPHS,
  maxChars = MAX_EXPANDED_BIO_CHARS,
): string[] {
  const paragraphs = splitBioParagraphs(bio).slice(0, maxParagraphs);
  if (!paragraphs.length) return [];

  const result: string[] = [];
  let used = 0;

  for (const paragraph of paragraphs) {
    const remaining = maxChars - used;
    if (remaining <= 0) break;

    if (paragraph.length <= remaining) {
      result.push(paragraph);
      used += paragraph.length + 1;
      continue;
    }

    const slice = paragraph.slice(0, remaining);
    const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));

    if (sentenceEnd >= Math.floor(remaining * 0.5)) {
      result.push(slice.slice(0, sentenceEnd + 1).trim());
    } else {
      const wordEnd = slice.lastIndexOf(' ');
      const trimmed = (wordEnd > 24 ? slice.slice(0, wordEnd) : slice).replace(/[,;:\s]+$/, '').trim();
      result.push(`${trimmed}…`);
    }
    break;
  }

  return result;
}

export function speakerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts.at(-1)![0] ?? ''}`.toUpperCase();
}

export function isValidSpeakerId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function speakerRelayPhotoUrl(id: string, version: string | null): string {
  const base = `${SPEAKER_PHOTO_RELAY_PREFIX}${encodeURIComponent(id)}/photo`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

export function parsePublicSpeakersPayload(raw: unknown, useSameOriginPhotoRelay = true): Devcon26SpeakersResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.year !== 2026 || !Array.isArray(record.speakers)) return null;

  const speakers: Devcon26Speaker[] = [];

  for (const entry of record.speakers) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === 'string' && isValidSpeakerId(item.id) ? item.id : null;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const bio = typeof item.bio === 'string' ? item.bio.trim() : '';

    if (!id || !name) continue;

    const role = typeof item.role === 'string' && item.role.trim() ? item.role.trim() : null;
    const organization = typeof item.organization === 'string' && item.organization.trim() ? item.organization.trim() : null;
    const photoVersion = typeof item.photoVersion === 'string' && item.photoVersion.trim() ? item.photoVersion.trim() : null;
    const seeded = LOCAL_SEED_BY_ID.get(id);
    const upstreamPhoto = safeImageUrl(item.photoUrl);
    const photoUrl = photoVersion && useSameOriginPhotoRelay
      ? speakerRelayPhotoUrl(id, photoVersion)
      : upstreamPhoto ?? seeded?.photoUrl ?? null;

    speakers.push({
      id,
      name,
      role,
      organization,
      bio,
      photoUrl,
      photoVersion,
      photoPosition: seeded?.photoPosition ?? '50% 28%',
    });
  }

  return {
    year: 2026,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    speakers,
  };
}

export function speakerLineupFingerprint(speakers: Devcon26Speaker[]): string {
  return speakers
    .map((speaker) => [
      speaker.id,
      speaker.name,
      speaker.role ?? '',
      speaker.organization ?? '',
      speaker.bio,
      speaker.photoVersion ?? speaker.photoUrl ?? '',
    ].join('\u001f'))
    .join('\u001e');
}

function readCachedSpeakers(): Devcon26Speaker[] | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: unknown };
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > SESSION_CACHE_TTL_MS) return null;
    return parsePublicSpeakersPayload(parsed.payload, true)?.speakers ?? null;
  } catch {
    return null;
  }
}

function writeCachedSpeakers(payload: Devcon26SpeakersResponse): void {
  try {
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Ignore storage quota or private-mode restrictions.
  }
}

export async function fetchDevcon26Speakers(apiOrigin = DEFAULT_EMS_API_ORIGIN): Promise<Devcon26Speaker[] | null> {
  const cached = readCachedSpeakers();
  if (cached) return cached;

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const endpoints = isLocalHost
    ? [
        { url: new URL(EMS_PUBLIC_SPEAKERS_PATH, apiOrigin).toString(), relayPhotos: false },
        { url: SPEAKERS_RELAY_PATH, relayPhotos: true },
      ]
    : [
        { url: SPEAKERS_RELAY_PATH, relayPhotos: true },
        { url: new URL(EMS_PUBLIC_SPEAKERS_PATH, apiOrigin).toString(), relayPhotos: false },
      ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6_000),
      });

      if (!response.ok) continue;
      const parsed = parsePublicSpeakersPayload(await response.json(), endpoint.relayPhotos);

      if (!parsed) continue;
      writeCachedSpeakers(parsed);
      return parsed.speakers;
    } catch {
      // Fall through to secondary endpoint or retain built-in snapshot.
    }
  }

  return null;
}
