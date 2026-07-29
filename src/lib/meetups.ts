import { getCollection, type CollectionEntry } from 'astro:content';
import { z } from 'zod';

const DEFAULT_EVENTS_MANAGEMENT_ORIGIN = 'https://events-management.pages.dev';
const MEETUPS_API_PATH = '/api/public/meetups';
const MEETUPS_API_TIMEOUT_MS = 8_000;
const MAX_MEETUPS_RESPONSE_BYTES = 2 * 1024 * 1024;

const publicHttpUrlSchema = z.string().trim().max(2_048).refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHostname(url.hostname)))
      && !url.username
      && !url.password
      && Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}, 'Expected a public HTTP(S) URL');

const publicWebsiteUrlSchema = z.string().trim().max(2_048).refine((value) => (
  (value.startsWith('/') && !value.startsWith('//'))
  || publicHttpUrlSchema.safeParse(value).success
), 'Expected a relative website path or public HTTP(S) URL');

const meetupSocialSchema = z.object({
  platform: z.enum(['x', 'linkedin', 'github', 'website', 'youtube', 'instagram', 'facebook', 'discord', 'slack']),
  url: publicHttpUrlSchema,
});

const meetupSpeakerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(300),
  bio: z.string().trim().max(5_000).nullable(),
  image: publicWebsiteUrlSchema,
  talk_title: z.string().trim().max(500),
  talk_description: z.string().trim().max(10_000).nullable(),
  slides_url: publicHttpUrlSchema.nullable(),
  recording_url: publicHttpUrlSchema.nullable(),
  socials: z.array(meetupSocialSchema).max(20),
});

const meetupScheduleItemSchema = z.object({
  time: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  type: z.enum([
    'networking',
    'talk',
    'product_demo',
    'panel',
    'workshop',
    'system_design',
    'open_discussion',
    'break',
  ]),
  lead: z.string().trim().max(300).nullable(),
  description: z.string().trim().max(10_000).nullable().optional(),
  system_design_title: z.string().trim().max(500).nullable().optional(),
  resources: z.array(z.object({
    title: z.string().trim().min(1).max(300),
    url: publicHttpUrlSchema,
  })).max(30),
  shared_links: z.array(publicHttpUrlSchema).max(30).optional(),
});

const publicMeetupSchema = z.object({
  id: z.string().trim().min(1).max(300),
  slug: z.string().trim().min(1).max(240).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
  name: z.string().trim().min(2).max(500),
  series_type: z.enum(['monthly', 'quarterly', 'special']).nullable(),
  status: z.enum(['upcoming', 'live', 'past']),
  start: z.string().refine(isValidDateTime, 'Expected a valid start datetime'),
  end: z.string().refine(isValidDateTime, 'Expected a valid end datetime'),
  description: z.string().trim().min(10).max(20_000),
  cover: publicWebsiteUrlSchema,
  location: z.object({
    label: z.string().trim().min(1).max(300).optional(),
    name: z.string().trim().min(1).max(500),
    url: publicHttpUrlSchema.nullable(),
  }),
  stream_url: publicHttpUrlSchema.nullable(),
  embed_stream: z.boolean(),
  registration_url: publicWebsiteUrlSchema.nullable(),
  speakers: z.array(meetupSpeakerSchema).max(200),
  schedule: z.array(meetupScheduleItemSchema).max(300),
  photos: z.array(z.object({
    url: publicWebsiteUrlSchema,
    type: z.enum(['image', 'folder']),
  })).max(500),
  videos: z.array(z.object({
    title: z.string().trim().min(1).max(500),
    embed_url: publicHttpUrlSchema,
  })).max(100),
  cfp_url: publicWebsiteUrlSchema.nullable(),
}).refine(
  ({ start, end }) => new Date(end).getTime() >= new Date(start).getTime(),
  { message: 'Meetup end must not precede its start', path: ['end'] },
);

const publicMeetupsResponseSchema = z.object({
  data: z.array(publicMeetupSchema).min(1).max(500),
  meta: z.object({
    source: z.literal('devcongress-comm'),
    version: z.literal(1),
  }),
}).superRefine(({ data }, context) => {
  const slugs = new Set<string>();
  data.forEach((meetup, index) => {
    if (slugs.has(meetup.slug)) {
      context.addIssue({
        code: 'custom',
        message: 'Meetup slugs must be unique',
        path: ['data', index, 'slug'],
      });
    }
    slugs.add(meetup.slug);
  });
});

type LocalMeetup = CollectionEntry<'meetups'>;
type PublicMeetup = z.infer<typeof publicMeetupSchema>;

export type MeetupSeriesType = 'monthly' | 'quarterly' | 'special';
export type MeetupScheduleType =
  | 'networking'
  | 'talk'
  | 'product_demo'
  | 'panel'
  | 'workshop'
  | 'system_design'
  | 'open_discussion'
  | 'break';

export interface MeetupLocation {
  label?: string;
  name: string;
  url?: string | null;
}

export interface MeetupPhoto {
  url: string;
  type?: 'image' | 'folder';
}

export interface MeetupSocial {
  platform: 'x' | 'linkedin' | 'github' | 'website' | 'youtube' | 'instagram' | 'facebook' | 'discord' | 'slack';
  url: string;
}

export interface MeetupSpeaker {
  name: string;
  title: string;
  bio: string;
  image: string;
  talk_title: string;
  talk_description: string;
  slides_url?: string | null;
  recording_url?: string | null;
  socials?: MeetupSocial[];
}

export interface MeetupScheduleItem {
  time: string;
  title: string;
  type: MeetupScheduleType;
  lead?: string | null;
  description?: string | null;
  system_design_title?: string | null;
  resources?: Array<{
    title: string;
    url: string;
  }>;
  shared_links?: string[];
}

export interface MeetupVideo {
  title: string;
  embed_url: string;
}

export interface WebsiteMeetup {
  id: string;
  data: {
    name: string;
    series_type?: MeetupSeriesType | null;
    start: string;
    end: string;
    description: string;
    cover: string;
    location: MeetupLocation;
    stream_url?: string | null;
    embed_stream?: boolean;
    registration_url?: string | null;
    speakers?: MeetupSpeaker[];
    schedule?: MeetupScheduleItem[];
    photos?: MeetupPhoto[];
    videos?: MeetupVideo[];
  };
}

let meetupsPromise: Promise<WebsiteMeetup[]> | undefined;

export async function getMeetups(): Promise<WebsiteMeetup[]> {
  meetupsPromise ??= loadMeetups();
  return meetupsPromise;
}

export function sortMeetupsByNewest(meetups: WebsiteMeetup[]): WebsiteMeetup[] {
  return [...meetups].sort((a, b) => (
    new Date(b.data.start).getTime() - new Date(a.data.start).getTime()
  ));
}

export function canEmbedMeetupMedia(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
    ) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'youtube.com'
      || hostname === 'www.youtube.com'
      || hostname === 'youtube-nocookie.com'
      || hostname === 'www.youtube-nocookie.com'
    ) {
      return /^\/embed\/[a-z0-9_-]+\/?$/i.test(url.pathname);
    }

    return hostname === 'player.vimeo.com' && /^\/video\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

async function loadMeetups(): Promise<WebsiteMeetup[]> {
  try {
    return await fetchRemoteMeetups();
  } catch (error) {
    console.warn(
      `[meetups] Events Management feed unavailable; building from local meetup YAML. ${getErrorMessage(error)}`,
    );
    return fetchLocalMeetups();
  }
}

async function fetchRemoteMeetups(): Promise<WebsiteMeetup[]> {
  const origin = getEventsManagementOrigin();
  const response = await fetch(new URL(MEETUPS_API_PATH, origin), {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(MEETUPS_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Meetups API returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Meetups API did not return JSON');
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MEETUPS_RESPONSE_BYTES) {
    throw new Error('Meetups API response exceeded the size limit');
  }

  const rawBody = await readResponseBody(response);

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    throw new Error('Meetups API returned invalid JSON');
  }

  const parsed = publicMeetupsResponseSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error('Meetups API response did not match contract version 1');
  }

  console.info(
    `[meetups] Loaded ${parsed.data.data.length} published meetups from ${origin.origin}.`,
  );
  return parsed.data.data.map((meetup) => mapPublicMeetup(meetup, origin));
}

async function fetchLocalMeetups(): Promise<WebsiteMeetup[]> {
  const localMeetups = await getCollection('meetups');
  return localMeetups.map(mapLocalMeetup);
}

function mapLocalMeetup(meetup: LocalMeetup): WebsiteMeetup {
  return {
    id: meetup.id,
    data: {
      ...meetup.data,
      speakers: meetup.data.speakers?.map((speaker) => ({
        ...speaker,
        socials: speaker.socials ?? [],
      })),
    },
  };
}

function mapPublicMeetup(meetup: PublicMeetup, origin: URL): WebsiteMeetup {
  return {
    id: meetup.slug,
    data: {
      name: meetup.name,
      series_type: meetup.series_type,
      start: meetup.start,
      end: meetup.end,
      description: meetup.description,
      cover: resolveRemoteWebsiteUrl(meetup.cover, origin),
      location: {
        label: meetup.location.label,
        name: meetup.location.name,
        url: meetup.location.url,
      },
      stream_url: meetup.stream_url,
      embed_stream: meetup.embed_stream,
      registration_url: resolveOptionalRemoteWebsiteUrl(
        meetup.registration_url ?? meetup.cfp_url,
        origin,
      ),
      speakers: meetup.speakers.map((speaker) => ({
        ...speaker,
        bio: speaker.bio ?? '',
        talk_description: speaker.talk_description ?? '',
        image: resolveRemoteWebsiteUrl(speaker.image, origin),
      })),
      schedule: meetup.schedule,
      photos: meetup.photos.map((photo) => ({
        ...photo,
        url: resolveRemoteWebsiteUrl(photo.url, origin),
      })),
      videos: meetup.videos,
    },
  };
}

function getEventsManagementOrigin(): URL {
  const configured = import.meta.env.EVENTS_MANAGEMENT_ORIGIN?.trim();
  const candidate = configured || DEFAULT_EVENTS_MANAGEMENT_ORIGIN;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('EVENTS_MANAGEMENT_ORIGIN must be a valid URL origin');
  }

  const isLocalHttp = (
    url.protocol === 'http:'
    && isLoopbackHostname(url.hostname)
  );
  if (
    (url.protocol !== 'https:' && !isLocalHttp)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw new Error('EVENTS_MANAGEMENT_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment');
  }

  return url;
}

function resolveRemoteWebsiteUrl(value: string, origin: URL): string {
  return value.startsWith('/') ? new URL(value, origin).toString() : value;
}

function resolveOptionalRemoteWebsiteUrl(value: string | null, origin: URL): string | null {
  return value ? resolveRemoteWebsiteUrl(value, origin) : null;
}

async function readResponseBody(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('Meetups API returned an empty response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_MEETUPS_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Meetups API response exceeded the size limit');
      }
      rawBody += decoder.decode(value, { stream: true });
    }
    return rawBody + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function isValidDateTime(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `The request exceeded ${MEETUPS_API_TIMEOUT_MS / 1_000} seconds.`;
  }

  return error instanceof Error ? error.message : 'Unknown feed error';
}
