# DevCon26 hero photos

Updated 2026-10-08. The event hero preserves its two-photo tilted collage and
cycles through eight paired community scenes (16 photos) from the April and May
gatherings. No location photo is introduced. The shorter headline and invitation
leave the photographs to tell the community story; the prominent hero ticket
button still links to `#tickets`. The programme, tickets, and payment confirmation
are unchanged.

## Photographs

The April community group and a participant open the sequence. The original
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

New photos are resized WebP assets with metadata removed. Only the initial pair
has `src` attributes in the server-rendered page, and only the first main image
has high fetch priority. Other pairs keep their URLs in `data-hero-src` until the
controller prepares them, avoiding eager downloads of the whole photo sequence.

## Interaction and accessibility

`src/lib/devcon26-hero-slideshow.ts` progressively enhances server-rendered
scenes. Without JavaScript, the first pair stays visible. There are no playback,
previous/next, count, swipe, or keyboard-navigation controls.
Fixed image slots preserve the desktop and mobile geometry. Transitions change
only opacity, using the existing smooth curve for 250 ms.

Autoplay advances every six seconds while the hero is onscreen and the document
is visible. Pointer hover and focus within the hero pause temporarily, including
while the ticket button is focused. Cycling resumes implicitly when the visitor
leaves the hero or changes back to an eligible browser state.
Reduced-motion preference disables autoplay and CSS motion, including when that
preference changes after load.

Inactive scenes are hidden from assistive technology, and autoplay is not
announced. New images must load and decode before
replacing the current scene. Failed pairs are skipped; stale completions are
ignored. If all alternatives fail, the visible pair remains and cycling stops.

The user requested no visible controls. Reduced motion and implicit hover/focus
pausing are retained, but they do not establish WCAG 2.2.2 compliance without a
persistent pause/stop/hide mechanism. Do not present this design as an accessible
carousel with user-selectable slides.

Timers and pending loads pause for page visibility and BFCache lifecycle changes.
Disposal removes listeners and observers when Astro swaps the page. The controller
uses the existing Astro-built same-origin script and does not loosen CSP.
