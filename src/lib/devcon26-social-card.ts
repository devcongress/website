import { layoutDigitalBadgeName, loadDigitalBadgeFont, paintDigitalBadge, type DigitalBadgeRole } from './devcon26-digital-badge';

type Role = DigitalBadgeRole;

type Card = {
  is_test?: boolean;
  display_name: string;
  role: Role;
  crop: { x: number; y: number; scale: number };
  public_enabled: boolean;
  public_slug: string;
  photo_available: boolean;
};

const SOCIAL_CARD_PATH = '/api/public/annual-conference/2026/social-cards';

function validApiOrigin(value: string): URL | null {
  try {
    const origin = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);

    if ((origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))
      || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;

    return origin;
  } catch {
    return null;
  }
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const card = value as Record<string, unknown>;
  const crop = card.crop as Record<string, unknown> | undefined;

  return typeof card.display_name === 'string'
    && (card.role === 'attendee' || card.role === 'speaker')
    && typeof card.public_enabled === 'boolean'
    && typeof card.public_slug === 'string'
    && typeof card.photo_available === 'boolean'
    && typeof crop?.x === 'number' && Number.isFinite(crop.x)
    && typeof crop.y === 'number' && Number.isFinite(crop.y)
    && typeof crop.scale === 'number' && Number.isFinite(crop.scale);
}

function toCrop(value: Card['crop']): { x: number; y: number; scale: number } {
  return {
    x: Math.min(1, Math.max(0, value.x)),
    y: Math.min(1, Math.max(0, value.y)),
    scale: Math.min(4, Math.max(1, value.scale)),
  };
}

function endpoint(origin: URL, path = ''): string {
  return new URL(SOCIAL_CARD_PATH + path, origin.origin).toString();
}

function fileError(file: File): string | null {
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return 'Choose an image smaller than 5MB.';
  if (!['image/avif', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose an AVIF, JPEG, PNG, or WebP image.';

  return null;
}

export function initializeDevcon26SocialCard(page: HTMLElement): void {
  const origin = validApiOrigin(page.dataset.socialCardApiOrigin ?? '');
  const fragment = window.location.hash.slice(1);
  const collectionCapability = new URLSearchParams(fragment).get('collection');
  const capability = collectionCapability ? '' : fragment;
  const content = page.querySelector<HTMLElement>('[data-social-card-content]')!;
  const error = page.querySelector<HTMLElement>('[data-social-card-error]')!;
  const status = page.querySelector<HTMLElement>('[data-social-card-status]')!;
  const form = page.querySelector<HTMLFormElement>('[data-social-card-form]')!;
  const preview = page.querySelector<HTMLElement>('[data-social-card-preview]')!;
  const badgeCanvas = page.querySelector<HTMLCanvasElement>('[data-identity-canvas]')!;
  const badgeCaption = page.querySelector<HTMLElement>('[data-identity-caption]')!;
  const displayName = page.querySelector<HTMLInputElement>('[data-social-card-display-name]')!;
  const saveName = page.querySelector<HTMLButtonElement>('[data-social-card-save-name]')!;
  const seats = page.querySelector<HTMLElement>('[data-social-card-seats]')!;
  const seatList = page.querySelector<HTMLElement>('[data-social-card-seat-list]')!;
  const input = page.querySelector<HTMLInputElement>('[data-social-card-file]')!;
  const cropControls = page.querySelector<HTMLFieldSetElement>('[data-social-card-crop-controls]')!;
  const x = page.querySelector<HTMLInputElement>('[data-social-card-crop-x]')!;
  const y = page.querySelector<HTMLInputElement>('[data-social-card-crop-y]')!;
  const scale = page.querySelector<HTMLInputElement>('[data-social-card-crop-scale]')!;
  const saveCrop = page.querySelector<HTMLButtonElement>('[data-social-card-save-crop]')!;
  const download = page.querySelector<HTMLButtonElement>('[data-social-card-download]')!;
  const publish = page.querySelector<HTMLButtonElement>('[data-social-card-publish]')!;
  const revoke = page.querySelector<HTMLButtonElement>('[data-social-card-revoke]')!;
  const share = page.querySelector<HTMLElement>('[data-social-card-share]')!;
  const shareLink = page.querySelector<HTMLAnchorElement>('[data-social-card-share-link]')!;
  const copy = page.querySelector<HTMLButtonElement>('[data-social-card-copy-link]')!;
  let card: Card | null = null;
  let imageUrl: string | null = null;
  let selectedFile: File | null = null;
  let photoFile: File | null = null;
  let renderVersion = 0;
  let rendered = false;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let requestBusy = false;
  let activeSeatNumber: number | null = null;

  function setStatus(message: string): void { status.textContent = message; }

  function setBusy(busy: boolean): void {
    requestBusy = busy;
    form.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = busy; });
    seatList.querySelectorAll<HTMLButtonElement>('.social-card-seat').forEach((button) => { button.disabled = busy; });
    input.disabled = busy;
    [x, y, scale].forEach((control) => { control.disabled = busy; });
  }

  function headers(): HeadersInit {
    return collectionCapability
      ? { 'X-Social-Card-Collection-Capability': collectionCapability }
      : { 'X-Social-Card-Capability': capability };
  }

  function managementPath(path: string): string {
    if (!collectionCapability) return '/manage' + path;
    if (activeSeatNumber === null) throw new Error('Choose a ticket card first.');

    return `/collection/seats/${activeSeatNumber}${path}`;
  }

  async function request(path: string, init: RequestInit = {}): Promise<Card> {
    if (!origin || (!collectionCapability && !capability) || capability.length > 200 || (collectionCapability && collectionCapability.length > 200)) throw new Error('This card link isn’t available.');
    const response = await fetch(endpoint(origin, managementPath(path)), {
      ...init,
      headers: { ...headers(), ...(init.headers ?? {}) },
      credentials: 'omit',
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);

    const result = payload as { card?: unknown; error?: unknown } | null;

    if (!response.ok || !result || !isCard(result.card)) {
      throw new Error((payload as { error?: string } | null)?.error ?? 'We couldn’t save your social card.');
    }

    return result.card;
  }

  function cropValues(): Card['crop'] {
    return toCrop({ x: Number(x.value) / 100, y: Number(y.value) / 100, scale: Number(scale.value) });
  }

  function render(): void {
    if (!card) return;
    const crop = toCrop(card.crop);

    displayName.value = card.display_name;
    preview.dataset.role = card.role;
    x.value = String(Math.round(crop.x * 100));
    y.value = String(Math.round(crop.y * 100));
    scale.value = String(crop.scale);
    cropControls.disabled = !selectedFile;
    publish.hidden = card.public_enabled || Boolean(card.is_test);
    revoke.hidden = !card.public_enabled;
    share.hidden = !card.public_enabled;
    const publicUrl = new URL('/devcon26/cards/' + encodeURIComponent(card.public_slug), window.location.origin).toString();

    shareLink.href = publicUrl;
    shareLink.textContent = publicUrl;
    renderPhoto();
  }

  function renderPhoto(): void {
    clearTimeout(renderTimer);
    renderVersion += 1;
    renderTimer = setTimeout(() => {
      renderTimer = undefined;
      void renderBadge().catch((cause) => {
        setStatus(cause instanceof Error ? cause.message : 'We couldn’t prepare your badge.');
      });
    }, 60);
  }

  async function renderBadge(): Promise<boolean> {
    if (!card) return false;
    const version = ++renderVersion;
    const snapshot = card;
    const crop = cropValues();
    const canvas = document.createElement('canvas');

    rendered = false;
    const result = await paintDigitalBadge(canvas, snapshot.display_name, photoFile, { x: crop.x, y: crop.y, zoom: crop.scale }, snapshot.role);

    if (version !== renderVersion || card !== snapshot) return false;
    if (!result.valid) throw new Error(result.message);
    const context = badgeCanvas.getContext('2d');

    if (!context) throw new Error('Your browser can’t prepare your badge.');
    badgeCanvas.width = canvas.width;
    badgeCanvas.height = canvas.height;
    context.drawImage(canvas, 0, 0);

    if (snapshot.is_test) {
      context.fillStyle = '#111111';
      context.fillRect(0, 0, canvas.width, 64);
      context.fillStyle = '#ffffff';
      context.font = 'bold 28px sans-serif';
      context.textAlign = 'center';
      context.fillText('TEST BADGE — NOT VALID FOR ADMISSION', canvas.width / 2, 42);
    }
    badgeCanvas.setAttribute('aria-label', `${snapshot.display_name} — ${snapshot.role} at DevCon26`);
    badgeCaption.textContent = `${snapshot.is_test ? 'TEST · ' : ''}${snapshot.role === 'speaker' ? 'Speaker' : 'Attendee'} badge · For sharing, not admission.`;
    badgeCanvas.hidden = false;
    rendered = true;

    return true;
  }

  async function loadPrivatePhoto(): Promise<void> {
    if (!origin || !card?.photo_available) return;
    const response = await fetch(endpoint(origin, managementPath('/photo')), { headers: headers(), credentials: 'omit', cache: 'no-store' });

    if (!response.ok) throw new Error('We couldn’t load your saved photo. Please reopen this link to try again.');
    const blob = await response.blob();

    if (!blob.type.startsWith('image/')) throw new Error('Your saved photo could not be opened.');
    photoFile = new File([blob], 'saved-photo', { type: blob.type });
    imageUrl = URL.createObjectURL(blob);
  }

  async function load(): Promise<void> {
    try {
      if (collectionCapability) {
        await loadCollection();
      } else {
        card = await request('');
      }
      history.replaceState(null, '', window.location.pathname);
      if (!collectionCapability) {
        await loadPrivatePhoto();
        render();
      }
      content.hidden = false;
      setStatus(collectionCapability ? 'Choose a ticket card to personalize.' : 'Your card is ready to personalise.');
    } catch {
      error.hidden = false;
      setStatus('');
    }
  }

  async function loadCollection(): Promise<void> {
    if (!origin || !collectionCapability) throw new Error('This collection link isn’t available.');
    const response = await fetch(endpoint(origin, '/collection'), { headers: headers(), credentials: 'omit', cache: 'no-store' });
    const payload = await response.json().catch(() => null) as { seats?: Array<{ seat_number?: unknown }>; error?: string } | null;

    if (!response.ok || !Array.isArray(payload?.seats) || !payload.seats.length) {
      throw new Error(payload?.error ?? 'This collection link isn’t available.');
    }
    const seatNumbers = payload.seats.map((seat) => seat.seat_number).filter((value): value is number => Number.isSafeInteger(value) && Number(value) > 0);

    if (!seatNumbers.length) throw new Error('No ticket cards are available in this collection.');
    seats.hidden = false;
    seatList.replaceChildren(...seatNumbers.map((seatNumber) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'social-card-seat';
      button.textContent = `Ticket ${seatNumber}`;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => { void selectSeat(seatNumber); });

      return button;
    }));
    await selectSeat(seatNumbers[0]);
  }

  async function selectSeat(seatNumber: number): Promise<void> {
    if (requestBusy) return;

    activeSeatNumber = seatNumber;
    clearTimeout(renderTimer);
    renderTimer = undefined;
    renderVersion += 1;
    rendered = false;
    badgeCanvas.hidden = true;
    card = null;
    form.hidden = true;
    seatList.querySelectorAll<HTMLButtonElement>('.social-card-seat').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.textContent === `Ticket ${seatNumber}`));
    });
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    selectedFile = null;
    photoFile = null;
    setStatus(`Opening ticket ${seatNumber}…`);
    setBusy(true);

    try {
      card = await request('');
      await loadPrivatePhoto();
      render();
      form.hidden = false;
      setStatus(`Ticket ${seatNumber} card is ready. You can return to the other cards later.`);
    } catch (cause) {
      card = null;
      setStatus(cause instanceof Error ? cause.message : 'We couldn’t open that ticket card.');
    } finally {
      setBusy(false);
    }
  }

  async function savePosition(): Promise<void> {
    if (!card || requestBusy) return;
    if (!selectedFile || !imageUrl) {
      setStatus('Choose a photo before changing its position.');

      return;
    }
    setBusy(true);
    setStatus('Preparing your photo…');
    try {
      const body = new FormData();
      const derivative = await croppedPhoto(imageUrl, cropValues());

      body.set('photo', derivative, 'devcon26-card-photo.png');
      card = await request('/photo', { method: 'POST', body });
      card = await request('', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ crop: { x: 0.5, y: 0.5, scale: 1 } }) });
      URL.revokeObjectURL(imageUrl);
      imageUrl = URL.createObjectURL(derivative);
      photoFile = new File([derivative], 'saved-photo.png', { type: 'image/png' });
      selectedFile = null;
      render();
      setStatus('Photo saved.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'We couldn’t save that photo.');
    } finally { setBusy(false); }
  }

  async function saveDisplayName(): Promise<void> {
    if (!card || requestBusy) return;
    const value = displayName.value.trim();

    if (!value || value.length > 120) {
      setStatus('Enter a name up to 120 characters.');

      return;
    }
    setBusy(true);
    try {
      await loadDigitalBadgeFont();
      const context = document.createElement('canvas').getContext('2d');

      if (!context) throw new Error('Your browser can’t prepare your badge.');
      const layout = layoutDigitalBadgeName(context, value);

      if (!layout.valid) throw new Error(layout.message);
      card = await request('', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: value }) });
      render();
      setStatus('Name saved.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'We couldn’t save that name.');
    } finally { setBusy(false); }
  }

  async function selectPhoto(): Promise<void> {
    const file = input.files?.[0];
    const validation = file ? fileError(file) : null;

    if (!file || validation || requestBusy) {
      if (validation) setStatus(validation);

      return;
    }
    setStatus('Position your photo, then choose “Use this photo.”');
    try {
      URL.revokeObjectURL(imageUrl ?? '');
      imageUrl = URL.createObjectURL(file);
      selectedFile = file;
      photoFile = file;
      render();
      input.value = '';
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'We couldn’t open that photo.');
    }
  }

  async function updatePublication(action: 'publish' | 'revoke'): Promise<void> {
    if (!card || requestBusy) return;
    if (action === 'revoke' && !window.confirm('Revoke this public link? Anyone opening it will no longer see your card.')) return;
    setBusy(true);
    setStatus(action === 'publish' ? 'Publishing your public link…' : 'Revoking your public link…');
    try {
      card = await request('/' + action, { method: 'PATCH' });
      render();
      setStatus(action === 'publish' ? 'Your public card is live.' : 'Your public card link has been revoked.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'We couldn’t update the public link.');
    } finally { setBusy(false); }
  }

  async function downloadCard(): Promise<void> {
    if (!card || requestBusy) return;
    setBusy(true);
    setStatus('Preparing your card…');
    try {
      clearTimeout(renderTimer);
      renderTimer = undefined;
      if (!await renderBadge() || !rendered) throw new Error('Your badge is still updating. Please try again.');
      const blob = await new Promise<Blob | null>((resolve) => badgeCanvas.toBlob(resolve, 'image/png'));

      if (!blob) throw new Error('We couldn’t prepare this card image.');
      const link = document.createElement('a');

      link.href = URL.createObjectURL(blob);
      link.download = 'devcon26-social-card.png';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
      setStatus('Your social card was downloaded.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'We couldn’t download this card.');
    } finally { setBusy(false); }
  }

  input.addEventListener('change', () => { void selectPhoto(); });
  saveName.addEventListener('click', () => { void saveDisplayName(); });
  [x, y, scale].forEach((control) => control.addEventListener('input', renderPhoto));
  saveCrop.addEventListener('click', () => { void savePosition(); });
  download.addEventListener('click', () => { void downloadCard(); });
  publish.addEventListener('click', () => { void updatePublication('publish'); });
  revoke.addEventListener('click', () => { void updatePublication('revoke'); });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLink.href);
      setStatus('Public link copied.');
    } catch { setStatus('Copy the public link from the field above.'); }
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(renderTimer);
    renderVersion += 1;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, { once: true });
  void load();
}

async function croppedPhoto(source: string, crop: { x: number; y: number; scale: number }): Promise<Blob> {
  const image = new Image();

  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');

  canvas.width = 920;
  canvas.height = 740;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Your browser can’t prepare this photo.');
  const factor = Math.max(canvas.width / image.width, canvas.height / image.height) * crop.scale;
  const width = image.width * factor;
  const height = image.height * factor;
  const left = (canvas.width - width) * crop.x;
  const top = (canvas.height - height) * crop.y;

  context.drawImage(image, left, top, width, height);
  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

  if (!result) throw new Error('We couldn’t prepare this photo.');

  return result;
}
