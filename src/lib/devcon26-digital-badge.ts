type Crop = { zoom: number; x: number; y: number };
export type DigitalBadgeRole = 'attendee' | 'speaker';
type NameLayout = {
  valid: true;
  normalized: string;
  layout: { lines: string[]; fontSize: number } | null;
} | { valid: false; normalized: string; message: string };

const FONT = '"DevCon26 Bricolage Grotesque"';
const INK = '#111111';
const PINK = '#ed008c';
const PHOTO = { x: 134, y: 300, width: 810, height: 810 * 740 / 920 };
export const PHYSICAL_BADGE_PATH = '/images/devcon26/social-card/devcon26-v11-base-1080x1350.png';
let logoPromise: Promise<HTMLImageElement> | undefined;
let backingPromise: Promise<HTMLImageElement> | undefined;
let fontPromise: Promise<void> | undefined;

function paintBadgeBackdrop(context: CanvasRenderingContext2D) {
  context.save();
  context.fillStyle = '#d8d1c2';
  context.fillRect(0, 0, 1080, 1350);

  // Fixed-seed paper grain stays identical in preview and downloaded artwork.
  let seed = 26;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed / 4294967296;
  };

  for (let index = 0; index < 16000; index += 1) {
    const x = random() * 1080;
    const y = random() * 1350;

    context.fillStyle = index % 2 ? 'rgba(255, 252, 240, 0.24)' : 'rgba(71, 60, 43, 0.09)';
    context.fillRect(x, y, 1 + random() * 2, 1);
  }

  // Sparse print-grid dots and cropped brand arcs frame, rather than cover,
  // the physical badge that is composited on top of this backdrop.
  context.fillStyle = 'rgba(71, 60, 43, 0.16)';
  for (let y = 18; y < 1350; y += 24) {
    for (let x = 18; x < 1080; x += 24) {
      context.beginPath();
      context.arc(x, y, 0.9, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.strokeStyle = 'rgba(237, 0, 140, 0.55)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(30, 1120, 140, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(1060, 160, 170, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

export function loadDigitalBadgeFont(): Promise<void> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const font = new FontFace('DevCon26 Bricolage Grotesque', 'url(/fonts/devcon26-social-card/BricolageGrotesque-Semibold.ttf)', { weight: '600' });

      document.fonts.add(await font.load());
    })().catch((error) => {
      fontPromise = undefined;
      throw error;
    });
  }

  return fontPromise;
}

function loadBadgeLogo(): Promise<HTMLImageElement> {
  if (!logoPromise) {
    logoPromise = (async () => {
      const logo = new Image();

      logo.src = '/images/logo.png';
      await logo.decode();

      return logo;
    })().catch(() => {
      logoPromise = undefined;
      throw new Error('The DevCongress logo could not be loaded. Please try again.');
    });
  }

  return logoPromise;
}

function loadBadgeBacking(): Promise<HTMLImageElement> {
  if (!backingPromise) {
    backingPromise = (async () => {
      const image = new Image();

      image.src = PHYSICAL_BADGE_PATH;
      await image.decode();

      return image;
    })().catch(() => {
      backingPromise = undefined;
      throw new Error('The conference badge could not be loaded. Please try again.');
    });
  }

  return backingPromise;
}

/** Keep names complete and readable, with at most two balanced lines. */
export function layoutDigitalBadgeName(context: CanvasRenderingContext2D, value: string): NameLayout {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) return { valid: true, normalized, layout: null };

  const words = normalized.split(' ');
  const candidates = [[normalized]];

  for (let index = 1; index < words.length; index += 1) {
    candidates.push([words.slice(0, index).join(' '), words.slice(index).join(' ')]);
  }

  for (let fontSize = 92; fontSize >= 44; fontSize -= 2) {
    context.font = `600 ${fontSize}px ${FONT}`;
    const fitting = candidates.filter(lines => lines.every(line => context.measureText(line).width <= 810));

    if (!fitting.length) continue;
    fitting.sort((first, second) => {
      if (first.length !== second.length) return first.length - second.length;

      const balance = (lines: string[]) => Math.abs(context.measureText(lines[0]).width - context.measureText(lines[1] ?? '').width);

      return balance(first) - balance(second);
    });

    return { valid: true, normalized, layout: { lines: fitting[0], fontSize } };
  }

  return { valid: false, normalized, message: 'Use a shorter display name so it stays fully readable on your badge.' };
}

/** Cream, portrait-led badge. The same renderer powers preview and export. */
export async function paintDigitalBadge(
  canvas: HTMLCanvasElement,
  name: string,
  photo: File | null,
  crop: Crop = { zoom: 1, x: 0.5, y: 0.18 },
  // Sharing labels are decorative; EMS alone determines admission eligibility.
  role: DigitalBadgeRole | null = null,
): Promise<NameLayout> {
  const [logo, backing] = await Promise.all([loadBadgeLogo(), loadBadgeBacking(), loadDigitalBadgeFont()]);

  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('This browser could not prepare your badge.');

  paintBadgeBackdrop(context);
  context.save();
  context.setTransform(1.16, 0, 0, 1.16, -86.4, -243.2);
  context.shadowColor = 'rgba(52, 43, 31, 0.20)';
  context.shadowBlur = 18;
  context.shadowOffsetY = 8;
  context.drawImage(backing, 0, 0, 1080, 1350);
  context.restore();
  // Reuse the blank paper texture inside the original physical outline so its
  // baked-in lettering does not conflict with personalized names and roles.
  context.save();
  context.beginPath();
  context.moveTo(110, 170);
  context.lineTo(990, 170);
  context.lineTo(990, 1255);
  context.lineTo(950, 1290);
  context.lineTo(110, 1290);
  context.closePath();
  context.clip();
  context.drawImage(backing, 190, 500, 700, 480, 110, 170, 880, 1120);

  context.restore();

  context.fillStyle = INK;
  context.font = `600 72px ${FONT}`;
  context.fillText('DevCon26', 134, 245);
  context.fillStyle = PINK;
  context.fillRect(136, 269, 58, 5);
  context.fillStyle = '#68655d';
  context.font = `600 24px ${FONT}`;
  context.textAlign = 'right';
  context.fillText('ACCRA', 944, 215);
  context.fillText('2026', 944, 249);
  context.textAlign = 'left';

  const portrait = document.createElement('canvas');

  portrait.width = canvas.width;
  portrait.height = canvas.height;
  const portraitContext = portrait.getContext('2d');

  if (!portraitContext) throw new Error('This browser could not prepare your portrait.');

  portraitContext.save();
  portraitContext.beginPath();
  portraitContext.roundRect(PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height, [28, 28, 0, 0]);
  portraitContext.clip();
  portraitContext.fillStyle = '#e7e2d7';
  portraitContext.fillRect(PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height);

  if (photo) {
    const image = await createImageBitmap(photo);

    try {
      const scale = Math.max(PHOTO.width / image.width, PHOTO.height / image.height) * crop.zoom;
      const width = image.width * scale;
      const height = image.height * scale;

      portraitContext.drawImage(image, PHOTO.x - (width - PHOTO.width) * crop.x, PHOTO.y - (height - PHOTO.height) * crop.y, width, height);
    } finally {
      image.close();
    }
  }

  // Fade alpha into the real paper texture, not a flat cream rectangle.
  // Smoothstep has flat endpoints, avoiding a visible start or bottom seam.
  // Limit blending to the lowest edge so the neck and shoulders stay visible.
  const fadeStart = PHOTO.y + PHOTO.height - 90;
  const fade = portraitContext.createLinearGradient(0, fadeStart, 0, PHOTO.y + PHOTO.height - 4);

  for (let step = 0; step <= 24; step += 1) {
    const position = step / 24;
    const opacity = 1 - position * position * (3 - 2 * position);

    fade.addColorStop(position, `rgba(0, 0, 0, ${opacity})`);
  }

  portraitContext.globalCompositeOperation = 'destination-in';
  portraitContext.fillStyle = fade;
  portraitContext.fillRect(PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height);
  portraitContext.restore();
  context.drawImage(portrait, 0, 0);

  const result = layoutDigitalBadgeName(context, name);

  if (result.valid && result.layout) {
    const { lines, fontSize } = result.layout;
    const lineHeight = fontSize * 1.05;
    const firstBaseline = lines.length === 1 ? 1080 : 1036 - (92 - fontSize) * 0.2;

    context.fillStyle = INK;
    context.font = `600 ${fontSize}px ${FONT}`;
    lines.forEach((line, index) => {
      context.fillText(line, 134, firstBaseline + index * lineHeight);
    });
  }

  const roleLabel = role === 'attendee' ? 'ATTENDEE' : role === 'speaker' ? 'SPEAKER' : null;

  if (roleLabel) {
    context.fillStyle = PINK;
    context.font = `600 44px ${FONT}`;
    context.textAlign = 'right';
    context.fillText(roleLabel, 944, 1234);
    context.textAlign = 'left';
  }

  context.fillStyle = '#d4cfc2';
  context.fillRect(134, 1180, 810, 1);
  const logoWidth = 300;
  const logoHeight = logoWidth * logo.naturalHeight / logo.naturalWidth;

  context.drawImage(logo, 134, 1196, logoWidth, logoHeight);

  return result;
}
