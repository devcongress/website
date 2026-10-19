# Changelog

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
