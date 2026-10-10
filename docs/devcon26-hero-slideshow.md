# DevCon26 hero photos

Updated 2026-10-10. The event hero uses a three-photo mosaic: one wide gathering
above two smaller activity photographs, with no overlap. Three disjoint pools
reuse all 16 April and May photographs. No location photo is introduced.
The existing headline and invitation
leave the photographs to tell the community story; the prominent hero ticket
button still links to `#tickets`. The programme, tickets, and payment confirmation
are unchanged.

## Photographs

The April community group, a May host, and a speaker open the mosaic. The original
discussion and speaker photographs remain in the rotation. Fourteen optimized
photographs were selected from the supplied community folder:

| Asset | Supplied source | Use |
| --- | --- | --- |
| `hero-april-community.webp` | `Dev Congress Photos April 2026/Fido Dev-0555.jpg` | April group, main image |
| `hero-april-participant.webp` | `Dev Congress Photos April 2026/Fido Dev-0408.jpg` | April participant, secondary image |
| `hero-community-group.webp` | `DevCon May/IMG_1592.jpg` | Meetup group, main image |
| `hero-meetup-speaker.webp` | `DevCon May/IMG_1543.jpg` | Speaker, secondary image |
| `hero-april-audience.webp` | `Dev Congress Photos April 2026/Fido Dev-0355.jpg` | April audience, main image |
| `hero-april-presenter.webp` | `Dev Congress Photos April 2026/Fido Dev-0519.jpg` | April presenter, secondary image |
| `hero-panel-discussion.webp` | `DevCon May/IMG_1577.jpg` | Panel, main image |
| `hero-meetup-audience.webp` | `DevCon May/IMG_1494.jpg` | Audience, secondary image |
| `hero-april-questions.webp` | `Dev Congress Photos April 2026/Fido Dev-0426.jpg` | April questions, main image |
| `hero-april-conversation.webp` | `Dev Congress Photos April 2026/Fido Dev-0468.jpg` | April conversation, secondary image |
| `hero-may-speakers.webp` | `DevCon May/IMG_1584.jpg` | May speakers, main image |
| `hero-may-host.webp` | `DevCon May/IMG_1500.jpg` | May host, secondary image |
| `hero-may-connections.webp` | `DevCon May/IMG_1562.jpg` | May conversations, main image |
| `hero-may-attendee.webp` | `DevCon May/IMG_1534.jpg` | May attendee, secondary image |

The existing optimized assets are unchanged. Only the three initial photographs
have `src` attributes in the server-rendered page; only the wide image has high
fetch priority. Other photographs keep their URLs in `data-hero-src` until the
controller preloads the next candidate, avoiding eager downloads of all 16.
Eight landscape photographs fill the wide slot. The two smaller slots each use
four different photographs, with focal positions that keep people in view.

## Interaction and accessibility

`src/lib/devcon26-hero-slideshow.ts` progressively enhances server-rendered
image slots. Without JavaScript, all three initial photos stay visible. There are no playback,
previous/next, count, swipe, or keyboard-navigation controls.
Fixed image slots preserve the desktop and mobile geometry. Transitions change
only opacity, using the existing smooth curve for 250 ms.

Autoplay changes one photograph every three seconds while the mosaic is onscreen
and the document is visible. Slot order is wide, small left, small right: each
individual slot changes about every nine seconds. Slow loading can extend a turn.
Fine-pointer hover over the photographs and focus anywhere in the hero pause
temporarily, including while the ticket button is focused. Hovering the headline
does not pause playback. Cycling resumes with a fresh three-second delay.
Reduced-motion preference disables autoplay and CSS motion, including when that
preference changes after load.

Inactive photographs are hidden from assistive technology, and autoplay is not
announced. The next image loads and decodes before its turn. Failed candidates
are skipped independently per slot; stale completions are ignored. An exhausted
slot retains its current image while healthy slots continue. If every alternative
fails, all three current photos remain and playback stops.

The user requested no visible controls. Reduced motion and implicit hover/focus
pausing are retained, but they do not establish WCAG 2.2.2 compliance without a
persistent pause/stop/hide mechanism. Do not present this design as an accessible
carousel with user-selectable slides.

Timers and pending loads pause for page visibility and BFCache lifecycle changes.
Disposal removes listeners and observers when Astro swaps the page. The controller
uses the existing Astro-built same-origin script and does not loosen CSP.

## Verification

Run `pnpm build` and `pnpm exec node scripts/check-devcon26-hero.mjs`. The focused
check covers preload timing, one-slot changes, static markup, broken/slow images,
reduced motion, focus/hover, visibility, BFCache and Astro disposal. Also run
`pnpm exec node scripts/check-devcon26-checkout.mjs` to guard the unchanged checkout.
Inspect desktop and narrow mobile layouts; copy and the ticket CTA precede the
compact mosaic on mobile, and image changes must not move the layout.
