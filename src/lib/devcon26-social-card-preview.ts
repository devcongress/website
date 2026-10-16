import { layoutDigitalBadgeName, paintDigitalBadge } from './devcon26-digital-badge';

type PhotoCrop = { zoom: number; x: number; y: number };
type SeatCard = { name: string; photo: File | null; crop?: PhotoCrop };
const DEFAULT_PHOTO_CROP: PhotoCrop = { zoom: 1, x: 0.5, y: 0.18 };
type BuyerSeat = { seat_number: number; card: { display_name: string; photo_available: boolean } };
type CardAssets = { base: HTMLImageElement | null; backdrop: HTMLImageElement | null };
const BUYER_CARD_PATH = '/api/public/annual-conference/2026/social-cards/buyer/collection';
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const PHOTO_BOX = { x: 190, y: 460, width: 700, height: 540, radius: 30 };
const NAME_TEXT = { x: 190, textWidth: 698 };
const CARD_BASE_PATH = '/images/devcon26/social-card/devcon26-v11-base-1080x1350.png';
const CARD_BACKDROP_PATH = '/images/devcon26/social-card/devcon26-v14-backdrop-1080x1350.svg';
const CARD_FONT_PATH = '/fonts/devcon26-social-card/BricolageGrotesque-Semibold.ttf';
const CARD_FONT_FAMILY = 'DevCon26 Bricolage Grotesque';

export type Devcon26CardNameLayout = {
  lines: string[];
  fontSize: number;
};

export type Devcon26CardNameLayoutResult =
  | { valid: true; normalized: string; layout: Devcon26CardNameLayout | null }
  | { valid: false; normalized: string; message: string };

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function setCardFont(context: CanvasRenderingContext2D, fontSize: number): void {
  context.font = `600 ${fontSize}px "${CARD_FONT_FAMILY}"`;
}

/** Returns a fully visible, word-boundary-only name layout for the V11 card artwork. */
export function layoutDevcon26CardName(context: CanvasRenderingContext2D, value: string): Devcon26CardNameLayoutResult {
  const normalized = normalizedName(value);

  if (!normalized) return { valid: true, normalized, layout: null };

  for (let fontSize = 48; fontSize >= 38; fontSize -= 1) {
    setCardFont(context, fontSize);
    if (context.measureText(normalized).width <= NAME_TEXT.textWidth) {
      return { valid: true, normalized, layout: { lines: [normalized], fontSize } };
    }
  }

  const words = normalized.split(' ');
  const candidates: Devcon26CardNameLayout[] = [];

  for (let breakAt = 1; breakAt < words.length; breakAt += 1) {
    const lines = [words.slice(0, breakAt).join(' '), words.slice(breakAt).join(' ')];

    for (let fontSize = 36; fontSize >= 32; fontSize -= 1) {
      setCardFont(context, fontSize);
      const widestLine = Math.max(...lines.map((line) => context.measureText(line).width));

      if (widestLine <= NAME_TEXT.textWidth) {
        candidates.push({ lines, fontSize });
        break;
      }
    }
  }

  if (!candidates.length) {
    return {
      valid: false,
      normalized,
      message: 'Use a shorter display name: it must fit on the card without shortening or splitting words.',
    };
  }

  candidates.sort((first, second) => {
    setCardFont(context, first.fontSize);
    const firstBalance = Math.abs(context.measureText(first.lines[0]).width - context.measureText(first.lines[1]).width);
    setCardFont(context, second.fontSize);
    const secondBalance = Math.abs(context.measureText(second.lines[0]).width - context.measureText(second.lines[1]).width);

    return second.fontSize - first.fontSize || firstBalance - secondBalance;
  });

  return { valid: true, normalized, layout: candidates[0] };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The DevCon26 card artwork could not be loaded.'));
    image.src = source;
  });
}

async function loadCardAssets(digital = false): Promise<CardAssets> {
  const font = new FontFace(CARD_FONT_FAMILY, `url(${CARD_FONT_PATH}) format('truetype')`, { weight: '600', style: 'normal' });

  await font.load();
  document.fonts.add(font);
  await document.fonts.load(`600 48px "${CARD_FONT_FAMILY}"`);

  if (digital) return { base: null, backdrop: null };

  const [base, backdrop] = await Promise.all([loadImage(CARD_BASE_PATH), loadImage(CARD_BACKDROP_PATH)]);

  return { base, backdrop };
}

async function paintCard(
  canvas: HTMLCanvasElement,
  base: HTMLImageElement,
  backdrop: HTMLImageElement,
  name: string,
  photo: File | null,
  crop: PhotoCrop = DEFAULT_PHOTO_CROP,
): Promise<Devcon26CardNameLayoutResult> {
  const badgeCanvas = document.createElement('canvas');
  const context = badgeCanvas.getContext('2d');

  if (!context) throw new Error('This browser could not prepare the card image.');

  badgeCanvas.width = CARD_WIDTH;
  badgeCanvas.height = CARD_HEIGHT;
  context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // Enlarge the badge as one composition; leave the branded backdrop full-size.
  // The resulting canvas also supplies the shadow so all layers stay aligned.
  context.save();
  context.setTransform(1.16, 0, 0, 1.16, -86.4, -243.2);
  context.drawImage(base, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  if (photo) {
    const image = await createImageBitmap(photo);
    const scale = Math.max(PHOTO_BOX.width / image.width, PHOTO_BOX.height / image.height) * 1.04 * crop.zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const topOverflow = (height - PHOTO_BOX.height) * crop.y;

    context.save();
    context.beginPath();
    context.roundRect(PHOTO_BOX.x, PHOTO_BOX.y, PHOTO_BOX.width, PHOTO_BOX.height, PHOTO_BOX.radius);
    context.clip();
    context.filter = 'saturate(0.85) sepia(0.10)';
    context.drawImage(image, PHOTO_BOX.x + (PHOTO_BOX.width - width) * crop.x, PHOTO_BOX.y - topOverflow, width, height);
    context.restore();
    image.close();
  }

  const layout = layoutDevcon26CardName(context, name);

  if (layout.valid && layout.layout) {
    context.fillStyle = '#111111';
    setCardFont(context, layout.layout.fontSize);
    const baselines = layout.layout.lines.length === 1 ? [1092] : [1060, 1104];

    layout.layout.lines.forEach((line, index) => context.fillText(line, NAME_TEXT.x, baselines[index]));
  }

  context.restore();

  const ticketContext = canvas.getContext('2d');
  const shadowMaskCanvas = document.createElement('canvas');
  const shadowCanvas = document.createElement('canvas');
  const shadowMaskContext = shadowMaskCanvas.getContext('2d');
  const shadowContext = shadowCanvas.getContext('2d');

  if (!ticketContext || !shadowMaskContext || !shadowContext) {
    throw new Error('This browser could not prepare the card image.');
  }

  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  shadowMaskCanvas.width = CARD_WIDTH;
  shadowMaskCanvas.height = CARD_HEIGHT;
  shadowCanvas.width = CARD_WIDTH;
  shadowCanvas.height = CARD_HEIGHT;
  shadowMaskContext.drawImage(badgeCanvas, 0, 0);
  shadowMaskContext.globalCompositeOperation = 'source-in';
  shadowMaskContext.fillStyle = '#000000';
  shadowMaskContext.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  shadowContext.filter = 'blur(16px)';
  shadowContext.globalAlpha = 0.16;
  shadowContext.drawImage(shadowMaskCanvas, 0, 22);
  ticketContext.drawImage(backdrop, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  ticketContext.drawImage(shadowCanvas, 0, 0);
  ticketContext.drawImage(badgeCanvas, 0, 0);

  return layout;
}

async function makeCardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

  if (!blob) throw new Error('This browser could not prepare the card image.');

  return blob;
}

export function initializeDevcon26SocialCardPreview(
  root: HTMLElement,
  quantity: number,
  buyerGrant: string | null = null,
  canFinishLater = false,
): void {
  const preview = root.querySelector<HTMLElement>('[data-social-card-preview]');
  const isRegistration = root.dataset.cardContext === 'registration';

  if (!preview || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 5) return;

  const seatList = preview.querySelector<HTMLElement>('[data-social-seat-list]')!;
  const seatPicker = preview.querySelector<HTMLElement>('[data-social-seat-picker]')!;
  const seatCount = preview.querySelector<HTMLElement>('[data-social-seat-count]')!;
  const shuffle = preview.querySelector<HTMLButtonElement>('[data-social-seat-shuffle]')!;
  const ticketName = preview.querySelector<HTMLElement>('[data-social-ticket-name]')!;
  const ticket = preview.querySelector<HTMLElement>('[data-social-ticket]')!;
  const ticketCanvas = preview.querySelector<HTMLCanvasElement>('[data-social-ticket-canvas]')!;
  const nameInput = preview.querySelector<HTMLInputElement>('[data-social-ticket-name-input]')!;
  const photoInput = preview.querySelector<HTMLInputElement>('[data-social-ticket-photo-input]')!;
  const photoThumbnail = preview.querySelector<HTMLImageElement>('[data-social-photo-thumbnail]')!;
  const photoLabel = preview.querySelector<HTMLElement>('.social-photo-button')!;
  const photoLabelText = preview.querySelector<HTMLElement>('[data-social-photo-label]')!;
  const status = preview.querySelector<HTMLElement>('[data-social-card-preview-status]')!;
  const navigation = root.querySelector<HTMLElement>('[data-social-navigation]')!;
  const share = root.querySelector<HTMLButtonElement>('[data-social-card-share]')!;
  const download = root.querySelector<HTMLButtonElement>('[data-social-card-download]')!;
  const later = root.querySelector<HTMLButtonElement>('[data-social-card-later]')!;
  const back = root.querySelector<HTMLButtonElement>('[data-social-step-back]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-social-step-next]')!;
  const stepTitle = preview.querySelector<HTMLElement>('[data-social-step-title]')!;
  const resume = root.querySelector<HTMLButtonElement>('[data-social-card-resume]')!;
  const leaveDialog = root.querySelector<HTMLDialogElement>('[data-social-leave-dialog]')!;
  const leaveCopy = root.querySelector<HTMLElement>('[data-social-leave-copy]')!;
  const photoDialog = isRegistration ? root.querySelector<HTMLDialogElement>('[data-photo-dialog]') : null;
  const adjustPhoto = root.querySelector<HTMLButtonElement>('[data-photo-adjust]');
  const adjustCanvas = photoDialog?.querySelector<HTMLCanvasElement>('[data-photo-adjust-canvas]');
  const cropInputs = Array.from(photoDialog?.querySelectorAll<HTMLInputElement>('[data-photo-crop]') ?? []);
  let cropRenderTimer: number | undefined;
  const cards = Array.from({ length: quantity }, () => ({ name: '', photo: null } as SeatCard));
  const exported = Array.from({ length: quantity }, () => false);
  const photoLoadVersions = Array.from({ length: quantity }, () => 0);
  const photoUploadVersions = Array.from({ length: quantity }, () => 0);
  const photoUploadQueues = Array.from({ length: quantity }, () => Promise.resolve());
  let step = quantity > 1 ? 0 : 1;
  let allowLeave = false;
  let leaveAction: (() => void) | null = null;
  let activeSeat = 0;
  let photoUrl: string | null = null;
  let busy = false;
  let cardAssets: CardAssets | null = null;
  let renderVersion = 0;
  let remoteSeats: BuyerSeat[] = [];
  const apiOrigin = root.dataset.checkoutApiOrigin;
  const receiptSurface = root.querySelector<HTMLElement>('[data-receipt-surface]');
  const receiptParts = Array.from(root.querySelectorAll<HTMLElement>(
    '.receipt-masthead, .receipt-heading, .payment-details > div, .receipt-stub, .confirmation-actions',
  ));
  let layoutAnimations: Animation[] = [];

  function cancelLayoutAnimations(): void {
    layoutAnimations.forEach((animation) => animation.cancel());
    layoutAnimations = [];
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  reducedMotion.addEventListener('change', cancelLayoutAnimations);

  function showStep(value: number, focus = true): void {
    const animateLayout = focus && !reducedMotion.matches
      && window.matchMedia('(min-width: 1281px)').matches && receiptSurface;
    const previousHeight = animateLayout ? receiptSurface.getBoundingClientRect().height : 0;
    const previousTops = animateLayout ? receiptParts.map((part) => part.getBoundingClientRect().top) : [];

    // Read the current visual position before cancelling an interrupted transition.
    cancelLayoutAnimations();
    step = value;
    if (isRegistration) root.dataset.cardStep = String(step);
    preview.querySelectorAll<HTMLElement>('[data-social-step]').forEach((panel) => {
      panel.hidden = Number(panel.dataset.socialStep) !== step;
    });
    preview.querySelectorAll<HTMLElement>('[data-social-step-indicator]').forEach((indicator) => {
      const index = Number(indicator.dataset.socialStepIndicator);

      indicator.hidden = quantity === 1 && indicator.dataset.socialStepIndicator === '0';
      indicator.textContent = `${index + (quantity === 1 ? 0 : 1)}. ${['Choose card', 'Personalize', 'Share'][index]}`;
      if (Number(indicator.dataset.socialStepIndicator) === step) indicator.setAttribute('aria-current', 'step');
      else indicator.removeAttribute('aria-current');
    });
    stepTitle.textContent = isRegistration
      ? ['', 'Personalize your card', 'Preview & share'][step]
      : ['Choose your card', `Personalize card ${activeSeat + 1} of ${quantity}`, `Preview card ${activeSeat + 1} of ${quantity}`][step];
    back.hidden = step === (quantity > 1 ? 0 : 1);
    share.hidden = step !== 2;
    download.hidden = step !== 2;
    next.hidden = step === 2 && quantity === 1;
    next.textContent = step === 2 ? 'Other cards' : step === 1 ? 'Preview card' : 'Personalize this card';
    if (step === 2) next.setAttribute('aria-label', 'Choose another card');
    else next.removeAttribute('aria-label');
    if (step === 0) arrangeSeatCards();
    if (focus) stepTitle.focus({ preventScroll: true });

    if (animateLayout && receiptSurface) {
      const height = receiptSurface.getBoundingClientRect().height;
      const options = { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };

      // The receipt clips its photo. Apply shrink immediately so that clipping
      // cannot cut off an oversized surface during a reverse transition.
      if (height < previousHeight - 1) return;

      if (height > 0 && previousHeight > 0 && height - previousHeight > 1) {
        layoutAnimations.push(receiptSurface.animate([
          { transform: `scaleY(${previousHeight / height})` },
          { transform: 'scaleY(1)' },
        ], options));
      }

      receiptParts.forEach((part, index) => {
        const offset = previousTops[index] - part.getBoundingClientRect().top;

        if (!part.getClientRects().length || Math.abs(offset) < 1) return;
        layoutAnimations.push(part.animate([
          { transform: `translateY(${offset}px)` },
          { transform: 'translateY(0)' },
        ], options));
      });
    }
  }

  function needsLeaveConfirmation(): boolean {
    return !allowLeave && !preview.hidden && exported.some((done) => !done);
  }

  function confirmLeave(action: () => void): void {
    leaveAction = action;
    root.querySelector('#social-leave-title')!.textContent = buyerGrant && !canFinishLater
      ? 'Leave the card editor?' : 'Finish your cards later?';
    leaveCopy.textContent = buyerGrant && canFinishLater
      ? 'Your payment and tickets are safe. Use the private collection link in your email to finish later. Only successfully saved changes will be there.'
      : buyerGrant
        ? 'Your payment and tickets are safe. You can keep editing here, but a return link is not available yet. Unsaved changes may be lost if you leave.'
        : root.dataset.cardContext === 'registration'
          ? 'Your registration is unaffected. This local preview is not saved. Confirmed attendees receive a private editor link by email to make a card later.'
          : 'Your payment is unaffected. You can make cards later, but this sandbox preview is not saved. Keep this page open to keep your current edits.';
    if (!leaveDialog.open) leaveDialog.showModal();
  }

  back.addEventListener('click', () => { if (!busy) showStep(step - 1); });
  next.addEventListener('click', () => {
    if (busy) return;
    if (step === 1 && !validateCardReady()) return;
    showStep(step === 2 ? 0 : step + 1);
  });
  root.querySelector('[data-social-leave-cancel]')!.addEventListener('click', () => {
    leaveAction = null;
    leaveDialog.close();
  });
  leaveDialog.addEventListener('cancel', () => { leaveAction = null; });
  root.querySelector('[data-social-leave-confirm]')!.addEventListener('click', () => {
    const action = leaveAction;

    leaveAction = null;
    leaveDialog.close();
    action?.();
  });
  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');

    if (!anchor || anchor.download || anchor.target === '_blank' || !needsLeaveConfirmation()) return;
    if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    const destination = new URL(anchor.href);

    if (!['http:', 'https:'].includes(destination.protocol)) return;
    if (destination.pathname === location.pathname && destination.search === location.search && destination.hash) return;
    event.preventDefault();
    confirmLeave(() => {
      allowLeave = true;
      location.assign(destination.href);
    });
  });
  window.addEventListener('beforeunload', (event) => {
    if (!needsLeaveConfirmation()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  resume.addEventListener('click', () => {
    preview.hidden = false;
    navigation.hidden = false;
    resume.hidden = true;
    showStep(step);
  });

  function updatePhotoPicker(url: string | null): void {
    photoThumbnail.hidden = !url;
    photoThumbnail.removeAttribute('src');

    if (url) {
      photoThumbnail.src = url;
    }
    photoLabel.classList.toggle('has-photo', Boolean(url));
    photoLabelText.textContent = url ? 'Change photo' : 'Choose a photo';
  }

  function validateName(value: string, announce = false, required = false): boolean {
    const context = ticketCanvas.getContext('2d');

    if (!context) return false;
    const result = isRegistration ? layoutDigitalBadgeName(context, value) : layoutDevcon26CardName(context, value);
    const message = required && !result.normalized
      ? 'Add a display name before previewing or sharing your card.'
      : result.valid ? '' : result.message;

    nameInput.setCustomValidity(message);
    nameInput.setAttribute('aria-invalid', String(Boolean(message)));
    if (message && announce) status.textContent = message;

    return !message;
  }

  function validateCardReady(): boolean {
    const hasName = Boolean(normalizedName(cards[activeSeat].name));
    const hasPhoto = Boolean(cards[activeSeat].photo);

    if (!hasName && !hasPhoto) {
      const message = 'Add a display name and choose an authentic photo before previewing or sharing your card.';

      nameInput.setCustomValidity(message);
      nameInput.setAttribute('aria-invalid', 'true');
      status.textContent = message;
      nameInput.reportValidity();

      return false;
    }

    if (!validateName(cards[activeSeat].name, true, true)) {
      nameInput.reportValidity();

      return false;
    }

    if (!hasPhoto) {
      const message = 'Choose an authentic photo before previewing or sharing your card.';

      photoInput.setCustomValidity(message);
      status.textContent = message;
      photoInput.reportValidity();

      return false;
    }

    photoInput.setCustomValidity('');

    return true;
  }

  async function paintPreview(): Promise<void> {
    if (!cardAssets) return;
    const version = ++renderVersion;
    const workCanvas = document.createElement('canvas');
    const card = cards[activeSeat];
    const result = isRegistration
      ? await paintDigitalBadge(workCanvas, card.name, card.photo, card.crop, 'attendee')
      : await paintCard(workCanvas, cardAssets.base!, cardAssets.backdrop!, card.name, card.photo, card.crop);

    if (version !== renderVersion) return;
    const context = ticketCanvas.getContext('2d');

    if (!context) throw new Error('This browser could not prepare the card image.');
    ticketCanvas.width = CARD_WIDTH;
    ticketCanvas.height = CARD_HEIGHT;
    context.drawImage(workCanvas, 0, 0);
    if (adjustCanvas) {
      adjustCanvas.width = CARD_WIDTH;
      adjustCanvas.height = CARD_HEIGHT;
      adjustCanvas.getContext('2d')?.drawImage(workCanvas, 0, 0);
    }
    validateName(cards[activeSeat].name);
    ticketName.textContent = result.valid && result.normalized ? result.normalized : 'Your name here';
  }

  function syncCropInputs(): void {
    const crop = cards[activeSeat].crop ?? DEFAULT_PHOTO_CROP;

    cropInputs.forEach((input) => {
      input.value = String(crop[input.dataset.photoCrop as keyof PhotoCrop]);
    });
  }

  function repaintCrop(): void {
    window.clearTimeout(cropRenderTimer);
    // Invalidate in-flight renders immediately; only the final slider value wins.
    renderVersion += 1;
    cropRenderTimer = window.setTimeout(() => {
      void paintPreview().catch(() => {
        const message = photoDialog?.querySelector<HTMLElement>('[data-photo-adjust-status]');

        if (message) message.textContent = 'Could not update the preview. Try another photo.';
      });
    }, 60);
  }

  adjustPhoto?.addEventListener('click', () => {
    if (busy || !photoDialog || !cards[activeSeat].photo) return;
    syncCropInputs();
    photoDialog.showModal();
  });
  photoDialog?.addEventListener('close', () => { adjustPhoto?.focus(); });
  photoDialog?.querySelector('[data-photo-done]')?.addEventListener('click', () => { photoDialog.close(); });
  photoDialog?.querySelector('[data-photo-reset]')?.addEventListener('click', () => {
    if (busy) return;
    cards[activeSeat].crop = { ...DEFAULT_PHOTO_CROP };
    exported[activeSeat] = false;
    syncCropInputs();
    repaintCrop();
  });
  cropInputs.forEach((input) => input.addEventListener('input', () => {
    if (busy) return;
    const key = input.dataset.photoCrop as keyof PhotoCrop;
    const value = Number(input.value);

    if (!Number.isFinite(value)) return;
    cards[activeSeat].crop = {
      ...(cards[activeSeat].crop ?? DEFAULT_PHOTO_CROP),
      [key]: Math.max(Number(input.min), Math.min(Number(input.max), value)),
    };
    exported[activeSeat] = false;
    repaintCrop();
  }));

  function arrangeSeatCards(): void {
    const buttons = Array.from(seatList.querySelectorAll<HTMLButtonElement>('button'));
    const maxOffset = Math.max(1, Math.floor(quantity / 2));
    const spread = Math.min(32, (seatList.clientWidth * 0.2) / maxOffset);

    buttons.forEach((button, index) => {
      const offset = seatOffset(index);

      button.style.zIndex = String(quantity - Math.abs(offset) + 2);
      button.style.opacity = offset === 0 ? '1' : '0.88';
      button.style.transform = `translate(-50%, -50%) translateX(${offset * spread}px) rotateY(${-offset * 10}deg) rotateZ(${offset * 5}deg) translateZ(${-Math.abs(offset) * 12}px)`;
    });
  }

  function buyerHeaders(): HeadersInit {
    return { 'X-Social-Card-Buyer-Grant': buyerGrant ?? '' };
  }

  async function buyerRequest(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    if (!buyerGrant || !apiOrigin) throw new Error('This ticket-card session is unavailable.');

    const response = await fetch(new URL(BUYER_CARD_PATH + path, apiOrigin), {
      ...init,
      headers: { ...buyerHeaders(), ...(init.headers ?? {}) },
      credentials: 'omit',
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error((payload as { error?: string } | null)?.error ?? 'We could not load your ticket cards.');
    }

    return payload as Record<string, unknown>;
  }

  async function loadRemoteSeats(): Promise<void> {
    if (!buyerGrant) return;
    const result = await buyerRequest('');

    if (!Array.isArray(result.seats)) throw new Error('Your ticket cards could not be loaded.');
    remoteSeats = result.seats.filter((seat): seat is BuyerSeat => {
      if (!seat || typeof seat !== 'object') return false;
      const value = seat as Record<string, unknown>;
      const card = value.card as Record<string, unknown> | undefined;

      return Number.isSafeInteger(value.seat_number) && Boolean(card)
        && typeof card?.display_name === 'string' && typeof card.photo_available === 'boolean';
    });
    if (!remoteSeats.length || remoteSeats.length !== quantity) throw new Error('Your ticket cards are not ready yet.');

    cards.forEach((card, index) => { card.name = remoteSeats[index].card.display_name; });
  }

  async function loadRemotePhoto(seatNumber: number): Promise<boolean> {
    const seatIndex = seatNumber - 1;

    if (!buyerGrant || !apiOrigin || !remoteSeats[seatIndex]?.card.photo_available || cards[seatIndex].photo) return false;
    const loadVersion = ++photoLoadVersions[seatIndex];

    let response: Response;

    try {
      response = await fetch(new URL(`${BUYER_CARD_PATH}/seats/${seatNumber}/photo`, apiOrigin), {
        headers: buyerHeaders(),
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      return false;
    }

    if (!response.ok) return false;
    const blob = await response.blob();

    if (!blob.type.startsWith('image/') || photoLoadVersions[seatIndex] !== loadVersion || cards[seatIndex].photo) return false;
    cards[seatIndex].photo = new File([blob], `devcon26-ticket-card-photo-${seatNumber}.png`, { type: blob.type });

    return true;
  }

  function seatOffset(index: number): number {
    let offset = index - activeSeat;

    if (offset > quantity / 2) offset -= quantity;
    if (offset < -quantity / 2) offset += quantity;

    return offset;
  }

  const render = (_animatePhoto = false, slideDirection = 0) => {
    const card = cards[activeSeat];
    const buttons = Array.from(seatList.querySelectorAll<HTMLButtonElement>('button'));

    nameInput.value = card.name;
    updatePhotoPicker(photoUrl);
    void paintPreview().catch(() => { status.textContent = 'We could not draw this card. Try reloading the page.'; });

    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === activeSeat));
      button.setAttribute('aria-label', `Ticket card ${index + 1}${cards[index].name ? `, ${cards[index].name}` : ''}`);

      const name = button.querySelector<HTMLElement>('.social-seat-name');
      const buttonName = cards[index].name.trim() || 'Add a name';

      if (name) name.textContent = buttonName;
    });
    arrangeSeatCards();
    seatPicker.hidden = quantity < 2 || step !== 0;
    seatCount.textContent = `Card ${activeSeat + 1} of ${quantity}`;
    status.textContent = buyerGrant
      ? `Social card ${activeSeat + 1} of ${quantity}. This image is for sharing, not admission.`
      : root.dataset.cardContext === 'registration'
        ? 'For sharing, not entry. Edits aren’t saved—download to keep your card.'
        : `Sandbox preview · Social card ${activeSeat + 1} of ${quantity}. For sharing only; this preview is not saved or sent.`;

    if (slideDirection) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!reduceMotion) {
        const fromX = slideDirection > 0 ? 14 : -14;

        ticket.animate([
          { opacity: 0.72, transform: `translateX(${fromX}px) rotateZ(${slideDirection * 0.5}deg)` },
          { opacity: 1, transform: 'translateX(0) rotateZ(0)' },
        ], { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      }
    }
  };

  const setBusy = (value: boolean) => {
    busy = value;
    share.disabled = value;
    download.disabled = value;
    photoInput.disabled = value;
    nameInput.disabled = value;
    shuffle.disabled = value;
    back.disabled = value;
    next.disabled = value;
    resume.disabled = value;
    if (adjustPhoto) adjustPhoto.disabled = value;
    cropInputs.forEach((input) => { input.disabled = value; });
    photoDialog?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = value; });
    seatList.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = value; });
  };

  seatList.replaceChildren(...cards.map((_, index) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'social-seat-button';
    button.dataset.seatIndex = String(index);
    button.setAttribute('aria-label', `Ticket card ${index + 1}`);
    button.innerHTML = `<span class="social-seat-number">CARD ${String(index + 1).padStart(2, '0')}</span><span class="social-seat-name">Add a name</span>`;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (busy || index === activeSeat) return;
      const previousOffset = seatOffset(index);

      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = cards[index].photo ? URL.createObjectURL(cards[index].photo!) : null;
      activeSeat = index;
      render(false, previousOffset > 0 ? 1 : -1);
      if (!cards[index].photo) void loadRemotePhoto(index + 1).then((loaded) => {
        if (!loaded || activeSeat !== index || !cards[index].photo) return;
        photoUrl = URL.createObjectURL(cards[index].photo);
        render(true);
      });
    });

    return button;
  }));

  shuffle.addEventListener('click', () => {
    if (busy || quantity < 2) return;
    const nextSeat = (activeSeat + 1) % quantity;

    if (photoUrl) URL.revokeObjectURL(photoUrl);
    activeSeat = nextSeat;
    photoUrl = cards[nextSeat].photo ? URL.createObjectURL(cards[nextSeat].photo!) : null;
    render(false, 1);

    if (!cards[nextSeat].photo) void loadRemotePhoto(nextSeat + 1).then((loaded) => {
      if (!loaded || activeSeat !== nextSeat || !cards[nextSeat].photo) return;
      photoUrl = URL.createObjectURL(cards[nextSeat].photo);
      render(true);
    });
  });

  nameInput.addEventListener('input', () => {
    exported[activeSeat] = false;
    cards[activeSeat].name = normalizedName(nameInput.value.slice(0, 60));
    validateName(cards[activeSeat].name, true);
    void paintPreview().catch(() => { status.textContent = 'We could not draw this card. Try reloading the page.'; });
    const activeButton = seatList.querySelector<HTMLButtonElement>(`button:nth-child(${activeSeat + 1})`);

    if (activeButton) {
      activeButton.setAttribute('aria-label', `Ticket card ${activeSeat + 1}, ${cards[activeSeat].name || 'no name yet'}`);
      activeButton.querySelector<HTMLElement>('.social-seat-name')!.textContent = cards[activeSeat].name.trim() || 'Add a name';
    }
  });

  nameInput.addEventListener('blur', () => {
    const card = cards[activeSeat];

    if (!buyerGrant || !card.name.trim() || !validateName(card.name, true)) return;
    const seatNumber = activeSeat + 1;

    void buyerRequest(`/seats/${seatNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: card.name.trim() }),
    }).then(() => {
      status.textContent = 'Name saved to your social card.';
    }).catch(() => {
      status.textContent = 'Name could not be saved. Check your connection and try again.';
    });
  });

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];

    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/avif', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      status.textContent = 'Choose an AVIF, JPEG, PNG, or WebP image smaller than 5MB.';
      photoInput.value = '';

      return;
    }
    cards[activeSeat].photo = file;
    if (isRegistration) cards[activeSeat].crop = { ...DEFAULT_PHOTO_CROP };
    exported[activeSeat] = false;
    photoLoadVersions[activeSeat] += 1;
    photoInput.setCustomValidity('');
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file);
    render(true);
    if (buyerGrant) {
      const seatIndex = activeSeat;
      const seatNumber = seatIndex + 1;
      const uploadVersion = ++photoUploadVersions[seatIndex];
      const previousUpload = photoUploadQueues[seatIndex];

      // Keep uploads for each seat serial. A newer selection queues behind the
      // active request (and skips stale queued work), so it is always the last
      // successful remote write for that seat.
      photoUploadQueues[seatIndex] = previousUpload.catch(() => {}).then(async () => {
        if (photoUploadVersions[seatIndex] !== uploadVersion) return;
        const body = new FormData();

        body.set('photo', file, file.name);
        await buyerRequest(`/seats/${seatNumber}/photo`, { method: 'POST', body });

        if (photoUploadVersions[seatIndex] === uploadVersion && activeSeat === seatIndex) {
          status.textContent = 'Photo saved to your social card.';
        }
      }).catch(() => {
        if (photoUploadVersions[seatIndex] === uploadVersion && activeSeat === seatIndex) {
          status.textContent = 'Photo could not be saved. Check your connection and try again.';
        }
      });
    }
  });

  async function prepareImage(): Promise<File> {
    if (!cardAssets) throw new Error('The DevCon26 card artwork is still loading.');
    if (!validateCardReady()) throw new Error(nameInput.validationMessage || photoInput.validationMessage);
    window.clearTimeout(cropRenderTimer);
    cropRenderTimer = undefined;
    await paintPreview();
    const blob = await makeCardBlob(ticketCanvas);

    return new File([blob], `devcon26-social-card-${activeSeat + 1}.png`, { type: 'image/png' });
  }

  async function exportCard(shareImage: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    status.textContent = 'Putting your card together…';

    try {
      const file = await prepareImage();

      if (shareImage && navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: isRegistration ? 'My DevCon26 community badge' : 'I’m attending DevCon26',
          text: isRegistration ? 'Part of the DevCon26 community.' : 'See you at DevCon26',
        });
        status.textContent = 'Your card is ready to share.';
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
        status.textContent = shareImage ? 'Image sharing is not available here, so we downloaded your card.' : 'Your card image has been downloaded.';
      }
      exported[activeSeat] = true;
    } catch (error) {
      status.textContent = error instanceof Error && error.name === 'AbortError' ? 'Sharing cancelled.' : 'We could not prepare this card. Try again.';
    } finally {
      setBusy(false);
    }
  }

  share.addEventListener('click', () => { void exportCard(true); });
  download.addEventListener('click', () => { void exportCard(false); });
  later.addEventListener('click', () => {
    confirmLeave(() => {
      preview.hidden = true;
      navigation.hidden = true;
      resume.hidden = false;
      document.getElementById('summary-title')?.focus();
      if (isRegistration) document.querySelector<HTMLElement>('[data-registration-title]')?.focus();
    });
  });
  if (isRegistration) showStep(step, false);
  preview.hidden = false;
  navigation.hidden = false;
  later.hidden = Boolean(buyerGrant) && !canFinishLater;
  status.textContent = 'Loading the DevCon26 card artwork…';
  setBusy(true);
  void loadCardAssets(isRegistration).then((assets) => {
    cardAssets = assets;
    showStep(step, false);
    if (!buyerGrant) {
      render();

      return;
    }

    status.textContent = 'Loading your ticket cards…';
    return loadRemoteSeats().then(() => {
      render();
      void loadRemotePhoto(1).then((loaded) => {
        if (!loaded || activeSeat !== 0 || !cards[0].photo) return;

        photoUrl = URL.createObjectURL(cards[0].photo);
        render(true);
      });
    }).catch(() => {
      status.textContent = 'Your cards are still being prepared. Try reloading in a moment or use the private collection link from your email.';
    });
  }).catch(() => {
    status.textContent = 'We could not load the DevCon26 card artwork. Reload this page to try again.';
  }).finally(() => {
    setBusy(false);
  });
  window.addEventListener('pagehide', () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, { once: true });
}
