const WEBSITE_ORIGIN = 'https://devcongress.org';

export function withHomepageEventContext(url: string): string {
  const resolved = new URL(url, WEBSITE_ORIGIN);
  if (resolved.origin !== WEBSITE_ORIGIN) return url;

  resolved.searchParams.set('from', 'home');
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export function getEventReturnLink(search: string): { href: string; label: string } {
  const source = new URLSearchParams(search).get('from');
  return source === 'home'
    ? { href: '/#events', label: '← All events' }
    : { href: '/events/', label: '← All events' };
}
