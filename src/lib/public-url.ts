const MAX_PUBLIC_URL_LENGTH = 2_048;

export function normalizePublicHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_PUBLIC_URL_LENGTH) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || !url.hostname || isPrivateOrLocalHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizePublicWebsiteUrl(value: unknown, relativeOrigin: URL): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_PUBLIC_URL_LENGTH) return null;

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return new URL(candidate, relativeOrigin).toString();
  }

  return normalizePublicHttpUrl(candidate);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;

  const ipv4 = parseIpv4(host);
  if (ipv4) {
    const [first, second] = ipv4;
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224;
  }

  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1' || host.startsWith('::ffff:')) return true;
  return /^f[cd][0-9a-f]{2}(?::|$)/.test(host) || /^fe[89ab][0-9a-f](?::|$)/.test(host);
}

function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number) as [number, number, number, number];
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
}
