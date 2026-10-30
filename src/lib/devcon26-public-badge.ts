import { badgeRoleDots } from './devcon26-badge-role';
import type { PublicDevcon26SocialCard } from './live-devcon26-social-cards';
import { PHYSICAL_BADGE_PATH } from './devcon26-digital-badge';

export function escapeBadgeText(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

/** Server-rendered counterpart of the canvas badge, with no private card data. */
export function renderPublicBadgeSvg(card: PublicDevcon26SocialCard, photoUrl: string, logoUrl: string, backingUrl = PHYSICAL_BADGE_PATH): string {
  const words = card.display_name.trim().split(/\s+/);
  let lines = [words.join(' ')];

  if (lines[0].length > 17 && words.length > 1) {
    let best = Infinity;

    for (let split = 1; split < words.length; split += 1) {
      const candidate = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
      const difference = Math.abs(candidate[0].length - candidate[1].length);

      if (difference < best) {
        best = difference;
        lines = candidate;
      }
    }
  }

  const size = Math.min(92, Math.max(32, Math.floor(810 / Math.max(...lines.map(line => line.length)) / 0.68)));
  const name = lines.map((line, index) => {
    const fit = line.length * size * 0.68 > 810 ? ' textLength="810" lengthAdjust="spacingAndGlyphs"' : '';

    return `<text x="134" y="${(lines.length === 1 ? 1080 : 1036) + index * size * 1.05}" font-size="${size}"${fit}>${escapeBadgeText(line)}</text>`;
  }).join('');
  const role = card.role === 'speaker' ? 'SPEAKER' : 'ATTENDEE';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="${escapeBadgeText(card.display_name)} — ${role}">
    <defs>
      <clipPath id="paper"><path d="M110 170H990V1255L950 1290H110Z"/></clipPath>
      <clipPath id="portrait"><rect x="134" y="300" width="810" height="651.521739" rx="28"/></clipPath>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5f2e8" stop-opacity="0"/><stop offset=".55" stop-color="#f5f2e8" stop-opacity=".45"/><stop offset="1" stop-color="#f5f2e8"/></linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="#f5f2e8"/>
    <image href="${escapeBadgeText(backingUrl)}" width="1080" height="1350" transform="matrix(1.16 0 0 1.16 -86.4 -243.2)"/>
    <g clip-path="url(#paper)"><svg x="110" y="170" width="880" height="1120" viewBox="190 500 700 480" preserveAspectRatio="none" overflow="hidden"><image href="${escapeBadgeText(backingUrl)}" width="1080" height="1350"/></svg></g>
    <g font-family="Badge,Arial,sans-serif" font-weight="600" fill="#111">
      <text x="134" y="245" font-size="72">DevCon26</text>
      <path d="M136 269h58" stroke="#ed008c" stroke-width="5"/>
      <g text-anchor="end" font-size="24" fill="#68655d"><text x="944" y="215">ACCRA</text><text x="944" y="249">2026</text></g>
      <rect x="134" y="300" width="810" height="651.521739" rx="28" fill="#e7e2d7"/>
      ${photoUrl ? `<image href="${escapeBadgeText(photoUrl)}" x="134" y="300" width="810" height="651.521739" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait)"/>` : ''}
      <rect x="134" y="761.521739" width="810" height="190" fill="url(#fade)"/>
      ${name}
      <g fill="#ed008c" aria-label="${role}">${badgeRoleDots(card.role === 'speaker' ? 'speaker' : 'attendee').map(dot => `<circle cx="${dot.x}" cy="${dot.y}" r="${dot.radius}"/>`).join('')}</g>
    </g>
    <path d="M134 1180h810" stroke="#d4cfc2"/>
    <image href="${escapeBadgeText(logoUrl)}" x="134" y="1196" width="300" height="48" preserveAspectRatio="xMinYMid meet"/>
  </svg>`;
}

export function renderPublicBadgePage(card: PublicDevcon26SocialCard, pageUrl: string): string {
  const title = `${card.display_name} · ${card.role === 'speaker' ? 'Speaker' : 'Attendee'} · DevCon26`;
  const description = `${card.event_date} · ${card.location}`;
  const badge = renderPublicBadgeSvg(card, card.photo_available ? `${pageUrl}/image` : '', '/images/logo.png');

  return `<!doctype html>
  <html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeBadgeText(title)}</title>
    <meta name="description" content="${escapeBadgeText(description)}">
    <meta property="og:type" content="website"><meta property="og:title" content="${escapeBadgeText(title)}">
    <meta property="og:description" content="${escapeBadgeText(description)}"><meta property="og:url" content="${escapeBadgeText(pageUrl)}">
    <meta property="og:image" content="${escapeBadgeText(pageUrl)}/preview.svg">
    <meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escapeBadgeText(pageUrl)}/preview.svg">
    <meta name="theme-color" content="#f5f2e8">
    <style>
      @font-face { font-family: Badge; src: url('/fonts/devcon26-social-card/BricolageGrotesque-Semibold.ttf'); font-weight: 600; font-display: swap; }
      body { margin: 0; padding: 24px; background: #f5f2e8; color: #111; font-family: Badge, sans-serif; }
      main { width: min(100%, 520px); margin: auto; }
      svg { display: block; width: 100%; height: auto; border-radius: 12px; }
      p { text-align: center; color: #68655d; font-size: 14px; }
    </style>
  </head><body><main>${badge}<p>For sharing, not admission.</p></main></body></html>`;
}
