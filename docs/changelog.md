# Changelog

## 2026-10-21 — Match the donation form to DevCongress

- Update the embedded donation checkout to `@inttegro/js` 0.7.0 and apply the
  DevCongress palette to its background, surfaces, text, controls, focus state,
  typography and radius through the SDK appearance API.
- Remove the persistent prepared-order recovery statement beneath the form while
  retaining the guarded restart controls and actual same-tab order recovery.

## 2026-10-19 — Consolidate dependency updates from #66

- Include Astro 7.4.0, Zod 4.6.7, Cloudflare Workers types 5.20261016.1 and Wrangler 4.151.0 in the donation follow-up, preserving Inttegro 0.5.8 and the donation recovery build checks. Raise the Node engine minimum to 22.22.0 to match Astro 7.4.0.

## 2026-10-19 — Integrate donation checkout into main

- Bring the dedicated checkout and prepared-order recovery from #65 into main. #65 was merged into #61’s feature branch; closing #61 did not deliver those changes to main.
- Preserve current main’s DevCon26 speaker flow, registration pause, hero assets, narrow-phone navigation, support wording and local CFP proxy.

## 2026-10-18 — Proposal form layout and feedback

- Use a 60/40 desktop proposal grid, a full-width preview notice and a separate Back/Submit row; stack fields on mobile.
- Add a live abstract word count and inline required/word-limit/outcome validation. Preserve local-only submission blocking and production Turnstile verification.
- Replace long step underlines with compact markers and subtle connectors aligned to the form’s full inner width; give Back a fixed-size SVG arrow, explicit alignment and a flat border without the shared raised effect.

## 2026-10-18 — Speaker supporting text

- Use consistent body typography for the introduction, status messages, local preview notice and field hints. Development-only preview messages and submission guards remain unchanged.

## 2026-10-18 — Narrow-phone navigation

- Allow the navbar logo to shrink on narrow phones so the menu button remains fully visible. Checked the hero grid and speaker form steps in local mobile previews.

## 2026-10-18 — Speaker introduction layout

- Stack the speaker application introduction beneath its main heading at every screen size instead of placing it in a right-hand column.

## 2026-10-18 — Selected hero photos

- Preserve the original wide-over-two photo composition and its sixteen photos. Add the six user-selected photos (shortlist 1, 2, 3, 5, 6 and 12), with slot-specific crops and optimized WebP exports. Keep existing lazy loading and slideshow behavior.

## 2026-10-18 — Return-link hover

- Deepen the return link’s pink and move its arrow slightly left on pointer hover, without an underline; disable arrow motion for reduced-motion preferences.

## 2026-10-18 — Main-site navigation and lighter header

- Place a prominent “Back to DevCongress” link on the left of the hero metadata row, as a pink text link with a small back arrow; align the conference label and year to the right. Show the return link only on the conference landing page; retain the conference logo destination on sub-routes.
- Soften shared navbar and mobile-menu bottom dividers to a translucent single-pixel rule.

## 2026-10-18 — Explore conference destination

- Point the homepage “Explore DevCon26” action to `/devcon26/` instead of jumping directly to the registration section.

## 2026-10-18 — Conference navigation and registration notice

- Restore the hero’s yellow “Register now” button, linking to the existing registration section, which still says registration opens soon. Remove the experimental notice styles and preview controls.
- Keep navbar logo navigation within DevCon26 on the conference page and its sub-routes. Other pages continue linking to the main homepage.

## 2026-10-18 — Speaker dropdowns and step readiness

- Adapt EMS dropdown controls into a reusable Astro component with selected checkmarks, circular chevrons, soft menus and keyboard navigation. Keep dropdown choices flat instead of raised.
- Use light single-pixel field borders and keep Continue disabled until required values, email format and both session choices are valid.


## 2026-10-18 — Speaker input polish

- Replace the double focus outline with one inset pink focus indicator. Give speaker text fields consistent padding, regular-weight text and clearer label sizing.


## 2026-10-18 — Local speaker preview

- Load deployed CFP settings through a fixed read-only development proxy; allow local form walkthroughs without real proposal submissions. Production builds continue to use deployed EMS directly.


## 2026-10-18 — Pause DevCon26 public registration

- Show “Registration opens soon” in the existing conference registration section without an active registration button; redirect old registration and checkout URLs to that section.
- Update only registration-related calls to action on the homepage and conference page, plus the registration FAQ copy. Preserve payment confirmation, legacy payment returns, social cards, badges, navigation, donations and the rest of the website.
- Backend closure is a separate Owner setting; publishing this page does not cancel registrations, modify payments or stop existing email jobs.

## 2026-10-18 — Donation checkout page and recovery

- Match the Back to DevCongress link to the DevCon26 page: pink text, compact arrow, 44px target and reduced-motion-aware hover feedback.

- Add a softly masked giving illustration centred across the desktop checkout background and behind the mobile introduction, without increasing page height.

- Replace homepage donation modal with a dedicated `/donate/` page using the existing Inttegro hosted checkout.
- Preserve prepared-order references through reload, completion, and failures; retry the same order and require acknowledgement before a new donation.
- Add visible storage limitations, pending-payment restart protection, safe no-JavaScript guidance, and recovery checks in the build.
- Keep the mobile navigation toggle full-sized on narrow phones.
- Keep payment processing unchanged. Hosted input styling remains controlled by Inttegro and is documented as a visual limitation.


## 2026-10-16

- Make the registration receipt accurately acknowledge a request, not confirmed
  admission or email delivery. Explain that duplicate and cancelled registrations
  remain unchanged, link to the event team for recovery, and identify the sharing
  card as a preview rather than a ticket. Preserve public duplicate privacy.

- Restore the live site navbar alignment and dark-text/pink-underline hover on
  both public and DevCon26 pages, retaining the current fonts and route links.
  Restore the 68px frame, 40px logo, 960px mobile breakpoint, and stacked mobile
  actions while retaining keyboard and guarded-navigation behavior.

- Use the homepage's physical badge artwork for personalized registration,
  attendee, and speaker cards, retaining photo adjustment and prominent names.
  Align the role opposite the real logo in one footer row and match public SVG
  previews; leave the homepage badge untouched.

- Reshape speaker applications into About you, Your session, and Proposal details
  steps with full-width desktop panels, paired fields, and numbered progress.
  Add keyboard-accessible cream dropdown menus using unchanged EMS choice values,
  explicit step validation, fixed-size textareas, and compact human verification.

- Label post-registration sharing cards ATTENDEE without changing admission status
  or private-card eligibility. Order share-step actions Back, Download image (with
  an icon), then Share my card, retaining Share as the primary action.

- Unify verified attendee and speaker private-card previews and PNG downloads
  around the cream portrait badge with a prominent role label and real DevCongress
  logo. Keep immediate registration previews roleless until EMS verifies eligibility.
  Use matching cream public-card pages and self-contained SVG share previews;
  preserve private-link authorization, opt-in publication, and revoked-card checks.
  Save photo crops at the badge portrait ratio and keep preview/download framing
  consistent. These local changes do not enable emails, publish cards, or deploy.

- Unify the sticky navbar across public pages, including registration and speaker applications, with balanced navigation, cream mobile menus, and shared Support Us/Join Slack controls. Refine button feedback and navbar underlines; redesign the DevCon26 registration section around the conference badge and promote the speaker application link to a button. Native cursor appearance remains unresolved; no additional speculative cursor fix is included.

- Add one-shot DevCon26 scroll entrances with section-specific transform/opacity treatments. Keep HTML visible by default, preserve native lazy-image loading, and bypass reveals for reduced motion, keyboard/anchor navigation, and print. No animation dependency or network gate is added.

- Consolidate Dependabot PRs #55 and #58 into #56: update Astro to 7.3.5, Zod to 4.6.5, Cloudflare Workers types to 5.20260925.1, Wrangler to 4.139.0, and the pinned setup-node action to 7.1.0. Preserve the existing Node 22 build configuration and dependency security overrides.

- Replace group-ticket sales entry points with Register for DevCon26. Registration reads EMS availability, collects name/email with Turnstile, and uses privacy-preserving confirmation/waitlist copy. If EMS later enables paid mode, the registration page leads to Regular-only checkout.
- Keep the approved attendee-card artwork and optional immediate local editor; distinguish it from admission, and explain that confirmed registrants receive their private resume link separately.
- Add a two-step speaker application connected to the existing annual-conference CFP, with server-provided formats/tracks, proposal validation, and closed/unavailable states.
- Preserve legacy payment confirmations while rejecting new group-tier checkout links. EMS migrations, sender configuration, CORS/Turnstile hosts, and Owner activation are prerequisites; publishing this website does not activate registration or send email.

## 2026-10-13

- Composed DevCon26 social-card previews and PNG exports from the unchanged V11
  attendee badge over the approved V14 branded backdrop, with a badge-derived
  shadow. Restored the 16% badge enlargement to reduce top headroom while keeping
  the new backdrop unchanged and the photo, name, and shadow aligned.
  This presentation update does not change checkout, payment, or EMS behavior.

- Clarified DevCon26 preview verification: successful GitHub build checks do not
  confirm a Cloudflare branch-preview update. The last inspected Cloudflare log
  uploaded V10 from commit `5c46dce`; the V11 revision `8e60e19` still requires
  a matching Cloudflare build and a live preview check before being called deployed.

- Preserved the updated V11 badge artwork and enlarged its visible composition
  uniformly by 16%, reducing the empty space above the clip. Uploaded photos use
  a subtle warm/desaturated treatment; preview and export share the same canvas.

- Integrated the V10 social-card artwork and bundled font, with word-boundary
  name wrapping and matching preview/download rendering. Exports wait for the
  canvas to finish painting; artwork-load failures release the editor busy state
  for both sandbox and buyer sessions. Photo uploads are serialized per seat.

- Aligned left and right confirmation actions in a shared desktop footer. Card
  actions now have equal widths and 48px heights; the preview grows to 440px wide.

- Enlarged the social-card preview to a readable 400px-wide portrait, removed
  viewport-height zoom reductions, and combined all desktop editor actions into
  one row. The receipt stretches to the same bottom edge; narrower layouts stack.

- Grouped Back and Do this later as compact inline secondary actions with arrows,
  following the confirmation footer's hierarchy without its yellow treatment.

- Made the desktop receipt stretch with the social-card editor, using a short
  transform-only expansion on step changes without scaling text. Taller screens
  get a larger share preview; reduced-motion and mobile layouts skip the motion.

- Matched the social-card name and photo controls at 48px, aligned their edges,
  and replaced the doubled focus ring with a single thin pink border.

- Split post-payment social-card creation into Choose, Personalize, and Share
  steps, retaining each seat's edits. Compact desktop spacing and a scaled preview
  keep the editor from elongating the confirmation page. Added an app-styled
  finish-later confirmation, resume control, and browser departure warning.
  Existing card artwork and exported images are unchanged.

- Reframed the post-payment DevCon26 cards as portrait, social-ready event
  announcements. Each seat can be personalized and shuffled in the layered
  selector; photo uploads transition into the preview, and native sharing uses
  attendee-focused copy. Downloads remain individual 4:5 images, distinct from
  admission tickets and check-in.

## 2026-10-12

- Added the post-payment DevCon26 social-card editor: buyers can personalize one ticket-style share card per purchased seat, choose a photo, and share/download it. The sandbox stays local-only and non-persistent; live editing is separately gated behind verified EMS payment and order-scoped access.
- Restored Join the community and Support us as secondary homepage hero buttons,
  keeping DevCon26 tickets first and visually dominant while removing duplicate
  post-video links.
- Confirmed 19 December 2026 in the homepage feature panel and DevCon26 FAQ,
  then refined the dedicated mobile hero hierarchy for date and venue
  readability.
- Unified the DevCon26 mobile section navigation with the homepage header frame:
  a sticky 68px cream header, homepage-sized controls, a full-width white menu,
  and safe anchor offsets for the dedicated page’s section links.
