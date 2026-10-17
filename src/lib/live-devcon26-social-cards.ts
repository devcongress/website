export type PublicDevcon26SocialCard = {
  display_name: string;
  role: 'attendee' | 'speaker';
  event_name: 'DevCon26';
  event_date: '19 December 2026';
  location: 'Accra, Ghana';
  photo_available: boolean;
};

export const DEVCON26_SOCIAL_CARDS_API_URL = 'https://em.devcongress.org/api/public/annual-conference/2026/social-cards';

export function isDevcon26SocialCardSlug(value: string): boolean {
  return /^[A-Za-z0-9_-]{22,80}$/.test(value);
}

export async function fetchLiveDevcon26SocialCard(slug: string): Promise<PublicDevcon26SocialCard | null> {
  if (!isDevcon26SocialCardSlug(slug)) return null;
  const response = await fetch(`${DEVCON26_SOCIAL_CARDS_API_URL}/${encodeURIComponent(slug)}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public social-card API returned ${response.status}`);
  const payload: unknown = await response.json();

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Public social-card API returned an invalid response');
  const card = (payload as { card?: unknown }).card;

  if (!isPublicCard(card)) throw new Error('Public social-card API returned an invalid card');

  return card;
}

export async function fetchLiveDevcon26SocialCardImage(slug: string): Promise<Response | null> {
  if (!isDevcon26SocialCardSlug(slug)) return null;
  const response = await fetch(`${DEVCON26_SOCIAL_CARDS_API_URL}/${encodeURIComponent(slug)}/image`, {
    headers: { accept: 'image/avif,image/webp,image/png,image/jpeg' },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public social-card image API returned ${response.status}`);

  return response;
}

function isPublicCard(value: unknown): value is PublicDevcon26SocialCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const card = value as Record<string, unknown>;

  return typeof card.display_name === 'string'
    && (card.role === 'attendee' || card.role === 'speaker')
    && card.event_name === 'DevCon26'
    && card.event_date === '19 December 2026'
    && card.location === 'Accra, Ghana'
    && typeof card.photo_available === 'boolean';
}
