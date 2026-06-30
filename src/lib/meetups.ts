import { getCollection, type CollectionEntry } from 'astro:content';

const DEFAULT_EVENTS_MANAGEMENT_ORIGIN = 'https://events-management.pages.dev';
const eventsManagementOrigin =
  import.meta.env.EVENTS_MANAGEMENT_ORIGIN ??
  DEFAULT_EVENTS_MANAGEMENT_ORIGIN;

let meetupsPromise: Promise<WebsiteMeetup[]> | undefined;

type LocalMeetup = CollectionEntry<'meetups'>;

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
  type: 'networking' | 'talk' | 'panel' | 'workshop' | 'open_discussion' | 'break';
  lead?: string | null;
  resources?: Array<{
    title: string;
    url: string;
  }>;
}

export interface MeetupVideo {
  title: string;
  embed_url: string;
}

export interface WebsiteMeetup {
  id: string;
  data: {
    name: string;
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

interface PublicMeetupsResponse {
  data?: PublicMeetupDto[];
}

interface PublicMeetupDto {
  id?: string;
  slug?: string;
  name?: string;
  start?: string;
  end?: string;
  description?: string;
  cover?: string;
  location?: MeetupLocation;
  stream_url?: string | null;
  embed_stream?: boolean;
  registration_url?: string | null;
  speakers?: MeetupSpeaker[];
  schedule?: MeetupScheduleItem[];
  photos?: MeetupPhoto[];
  videos?: MeetupVideo[];
}

export async function getMeetups(): Promise<WebsiteMeetup[]> {
  meetupsPromise ??= loadMeetups();
  return meetupsPromise;
}

export function sortMeetupsByNewest(meetups: WebsiteMeetup[]): WebsiteMeetup[] {
  return [...meetups].sort((a, b) => new Date(b.data.start).getTime() - new Date(a.data.start).getTime());
}

async function loadMeetups(): Promise<WebsiteMeetup[]> {
  try {
    const remoteMeetups = await fetchRemoteMeetups();
    if (remoteMeetups.length > 0) {
      return remoteMeetups;
    }
  } catch (error) {
    console.warn(
      `[meetups] Falling back to local meetup YAML because ${getApiUrl('/api/public/meetups')} could not be loaded: ${getErrorMessage(error)}`,
    );
  }

  return fetchLocalMeetups();
}

async function fetchRemoteMeetups(): Promise<WebsiteMeetup[]> {
  const response = await fetch(getApiUrl('/api/public/meetups'), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Meetups API returned ${response.status}`);
  }

  const body = await response.json() as PublicMeetupsResponse;
  if (!Array.isArray(body.data)) {
    throw new Error('Meetups API response did not include a data array');
  }

  return body.data.map(mapPublicMeetup).filter((meetup): meetup is WebsiteMeetup => Boolean(meetup));
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
      cover: resolveAssetUrl(meetup.data.cover, false),
      speakers: meetup.data.speakers?.map((speaker) => ({
        ...speaker,
        image: resolveAssetUrl(speaker.image, false),
      })),
      photos: meetup.data.photos?.map((photo) => ({
        ...photo,
        url: resolveAssetUrl(photo.url, false),
      })),
    },
  };
}

function mapPublicMeetup(meetup: PublicMeetupDto): WebsiteMeetup | null {
  if (!meetup.slug || !meetup.name || !meetup.start || !meetup.end || !meetup.description || !meetup.cover) {
    return null;
  }

  return {
    id: meetup.slug,
    data: {
      name: meetup.name,
      start: meetup.start,
      end: meetup.end,
      description: meetup.description,
      cover: resolveAssetUrl(meetup.cover, true),
      location: {
        label: meetup.location?.label,
        name: meetup.location?.name ?? 'Online',
        url: meetup.location?.url ?? null,
      },
      stream_url: meetup.stream_url ?? null,
      embed_stream: meetup.embed_stream ?? false,
      registration_url: meetup.registration_url ?? null,
      speakers: meetup.speakers?.map((speaker) => ({
        ...speaker,
        image: resolveAssetUrl(speaker.image, true),
      })),
      schedule: meetup.schedule ?? [],
      photos: meetup.photos?.map((photo) => ({
        ...photo,
        url: resolveAssetUrl(photo.url, true),
      })),
      videos: meetup.videos ?? [],
    },
  };
}

function getApiUrl(path: string): string {
  return new URL(path, ensureTrailingSlash(eventsManagementOrigin)).toString();
}

function resolveAssetUrl(url: string, fromRemote: boolean): string {
  if (!fromRemote || !url.startsWith('/')) {
    return url;
  }

  return new URL(url, ensureTrailingSlash(eventsManagementOrigin)).toString();
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
