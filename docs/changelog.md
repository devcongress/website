# Changelog

## 2026-10-30 — Polish private ticket claim controls

- Match the claim page's primary action to the DevCon26 checkout pink while keeping the styling scoped to ticket-access pages.
- Replace the oversized claim-input focus treatment with one pink border edge; forced-colors mode retains a system-color focus outline. The submit action retains its mobile-sized target.

## 2026-10-28 — EMS-managed checkout mode

- Read Testing or Live and a settings version from one EMS catalog at runtime; remove branch-specific payment-mode and preview-backend build selection.
- Bind initialization to the reviewed mode and settings version. Refresh stale settings and return to ticket review without automatically starting another payment; preserve the same request key for unchanged retries.
- Require the shared human check in both modes, visibly identify test checkout and confirmation, and route new managed references to stored-order verification while retaining historical callback paths.
- Accept canonical private capability links and existing emailed key fragments only when there is one unambiguous token; reject duplicates and conflicts.
- Include focused runtime-mode, stale-settings, callback, private-link, receipt, badge and existing checkout checks in the normal build. Verification: pnpm build and git diff --check passed; no payment, email, migration, deployment or merge was performed.

## 2026-10-28 — Consolidate dependency updates into ticketing

- Rebase the two-commit ticket checkout branch onto current main, preserving the branded donation checkout and Connect navigation.
- Absorb the four dependency updates from #71: Inttegro 0.7.2, Astro 7.4.2, Cloudflare Workers types 5.20261023.1 and Wrangler 4.152.0.
- Raise the Node engine minimum and pin both deployment workflows to Node 22.23.4, matching Astro's supported runtime and fixing the bot PR's build failure. Production deployment conditions and preview-only test settings are unchanged.

## 2026-10-21 — Match the donation form to DevCongress

- Update the embedded donation checkout to `@inttegro/js` 0.7.1 and apply the
  DevCongress palette to its background, surfaces, text, controls, focus state,
  typography and radius through the SDK appearance API.
- Remove the persistent prepared-order recovery statement beneath the form while
  retaining the guarded restart controls and actual same-tab order recovery.

## 2026-10-25 — Grouped community tickets

- Render organizer-assigned community tickets as one quantity group without recipient email inputs, including a grouped order-summary line.
- Grow community-only orders as community tickets; retain explicit additional tickets and per-ticket choices for mixed personal, gift and shareable orders. Changing one grouped ticket’s use preserves the rest.
- Keep gift emails attached to their allocations when community counts change, enforce total ticket limits, and retain keyboard focus at the bounds.
- Keep the community heading inside a continuous card border, use concise explanatory copy and a clearly labeled quantity row, and reduce the change-use action to a quiet secondary control. Wrap controls on narrow phones, with minimum 44px targets and reduced-motion-aware press feedback. Preserve the existing per-seat API contract; no migration or backend setting changes.

## 2026-10-25 — Provider-aware receipt guidance

- Gate receipt actions on code-reviewed provider capabilities: a validated provider URL takes precedence, otherwise confirmed customer receipt email guidance, otherwise payment details only.
- Keep Paystack receipt links and email promises disabled until supported URL origins or mode-specific merchant email settings are verified. Clear stale receipt links whenever verification restarts or leaves the verified state.
- Preserve removal of the unreliable browser-print button. No provider settings or production deployments changed.
- Refresh legacy checkout assertions for the current homepage-to-registration journey, flexible ticket form, dotted badge roles, shared badge renderer, and compact footer; retain payment safety and non-admission checks.

## 2026-10-25 — Remove unreliable payment-record action

- Remove the payment-confirmation Print or save action, which invoked browser printing rather than a provider receipt. Keep verified payment details and the non-admission caption; native browser printing remains available. No provider receipt link is currently supplied by this flow.

## 2026-10-24 — Leave-dialog focus polish

- Focus the payment-confirmation leave-dialog heading on opening so touch users do not see a second outline around Keep editing. Preserve a restrained pink keyboard-focus indicator on both dialog actions.

## 2026-10-24 — Consistent desktop checkout progress

- Match desktop checkout progress to the compact mobile step title/count and three slim segments. Retain accessible, keyboard-operable completed-step navigation without the oversized tinted tabs.

## 2026-10-24 — Compact mobile badge actions

- Keep Edit, Download and Share on one mobile row with shorter labels, and reduce footer separation and bottom padding while preserving touch targets and safe-area spacing.

## 2026-10-24 — Restore badge photo adjustment

- Restore automatic photo adjustment after upload and an Adjust photo action in both editor steps. Save zoom and position with the correct seat, wait for photo uploads, restore saved crops, and keep failed saves retryable.
- Use side-by-side controls on desktop and a scrollable, touch-friendly mobile dialog. Keep mobile footer links together and explicitly color the download action to avoid Safari's default blue.
- Verification: production build, badge renderer and payment-confirmation checks passed; local browser fixtures exercised crop save, retry, Escape and a 390px mobile layout. The legacy checkout check still stops at its unrelated landing-page assertion.

## 2026-10-24 — Clear ticket purchase entry points

- Send homepage Buy tickets actions to the DevCon26 ticket section before checkout. Show the GH₵150 per-person price, QR PDF email and badge link, and multi-ticket guidance. Align navigation and FAQs; remove stale registration-opening copy.

## 2026-10-24 — Payment badge renderer and minimal footer

- Select the blended-photo badge renderer for the payment-confirmation editor as well as registration, including matching name validation, photo defaults and artwork loading. Preview and download now share the approved composition.
- Simplify the page footer to muted links separated by a dot, with pink hover and no arrows or underlines.

## 2026-10-24 — Conference badge and action polish

- Preserve the blended-photo physical badge and original name typography; use dotted uppercase attendee/speaker labels in canvas and SVG.
- Remove testing banners from badge artwork and simplify confirmation copy while retaining test-payment isolation and disabled public publication.
- Place compact badge actions beneath the editor, group download/share on narrow screens, and move page links into a quiet footer. Preserve multi-seat navigation and deferred-edit eligibility.

## 2026-10-21 — Clear public checkout availability

- Remove the one-ticket payment rehearsal and its test-email/Turnstile code from public checkout.
- Replace the disabled form with a loading or unavailable panel and retry action until EMS returns a valid ticket catalog. Clear stale availability and provider details on retry.

## 2026-10-21 — Separate sponsor handover from public checkout

- Remove sponsor handover from the public DevCon26 per-ticket choices. Additional tickets require an explicit gift recipient or community allocation before payment.
- Keep existing order-management actions for historical buyer-managed purchases; sponsor allocations are arranged in EMS.

## 2026-10-20 — Flexible DevCon26 ticket checkout

- Replace the closed checkout redirect with a responsive quantity and per-seat allocation form. The server catalog owns the unit price, payment provider, maximum quantity, and payment availability.
- Unify checkout into one continuous form surface and replace browser-native allocation selects with an accessible in-page choice list that explains each handoff option.
- Add a separate one-ticket Paystack test rehearsal that requires the exact-origin preview-email catalog flag and a Turnstile challenge. Test checkout cannot issue real admission.
- Verify flexible payments using their own session-scoped grant and show a payment record without admission credentials. Add private buyer-management and recipient-claim destinations for the lifecycle emails.

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

### 2026-10-21 — Full-flow test preview

- Select complete-test checkout and confirmation using an explicit preview build flag, with test notices and preview-only human verification.
- Preserve private ticket/claim/badge flows while visibly marking test badge downloads and disabling public badge publication.
- Reset the human check after checkout errors and back-navigation; preserve ordinary live checkout copy.

### 2026-10-21 — Preview backend CSP

- Allow the exact EMS preview backend only for the explicit full-test build; preserve ordinary production CSP.
- Verified the deployed form loads GH₵150 pricing and opens a GH₵300 Paystack TEST checkout for self and gift tickets.

### 2026-10-21 — Preview checkout presentation

- Removed the prominent test-checkout banner at the user’s request to bring the preview layout closer to production. Test payment routing and backend safeguards remain active.

## 2026-10-21 — Clean conference checkout

- Redesigned checkout with compact numbered sections, an integrated quantity stepper, app-style inputs and restrained focus rings.
- Replaced the image summary with a branded conference order summary; it appears before the form on mobile so totals are visible before payment.
- Kept checkout routing, allocations, test payments, ticket/badge delivery, and shared ticket-access styles unchanged.
- Verified the Astro build and preview quantity/allocation controls.

## 2026-10-21 — Local checkout stepper

- Added Tickets, Your details, and Payment steps with contextual order information on the right, per-step validation, preserved back-navigation state, and reduced-motion-aware transitions.
- Render the payment challenge only when Payment is visible; earlier Continue buttons do not initialize payment.
- Tightened the ticket layout to fit a 1280×720 viewport for one ticket, and position assignment menus upward when needed. Small viewports and larger orders retain natural scrolling.
- Verified local catalog-fixture navigation, missing gift/contact validation, retained inputs, summary totals, menu bounds, build, and diff whitespace checks. No payment or email side effects; not pushed or deployed.

## 2026-10-21 — Local ticket choice and boarding-pass refinement

- Replaced the allocation dropdown with native radio tiles, selected-choice explanations, one-self availability, and conditional gift email validation.
- Added a masked decorative Accra-inspired vector illustration, perforated divider, and ticket notches to the order preview; no issued ticket or QR is implied.
- Changed checkout actions to brand yellow and progress to connected segments with current/completed states.
- Checked keyboard radio selection, gift validation/removal, step advancement, local viewport fit, and the production build. This refinement remains local, unpushed, and undeployed.

## 2026-10-21 — Pink checkout interaction accents

- Switched primary checkout actions, current-step indicators and selected ticket choices to pink; retained yellow on the illustrated order preview. Used a deeper pink for readable white button text. Local only; no push or deployment.

### Restrained pink refinement

- Reserved pink for primary actions and focus feedback; restored neutral active-step and selected-ticket styling. Yellow remains on the ticket artwork. Local only.
- Softened the ticket illustration to 42% opacity with fading edge masks, preserving the existing arch clip.

- Restored the previous pink active-step and selected-ticket accents at user request; retained the illustration’s 42% opacity and fading mask. Local only.

### 2026-10-21 — Quantity input focus

- Replace the checkout quantity field’s heavy outer focus outline with a thin inset pink border and a soft tint. Preserve a visible system-color outline in forced-colors mode.

### 2026-10-22 — Persist preview checkout build settings

- Bind the DevCon26 feature branch’s Cloudflare builds to the test checkout backend before Astro generates HTML and CSP, preventing later pushes from reverting the preview to production checkout. Main and other branch builds retain existing settings.

### 2026-10-22 — Payment provider and navigation consistency

- Use the same Back/Continue action row on contact and payment steps.
- Show Paystack as the sole selected provider in a reusable, vertically expanding provider list with a locally served logo; payment routing remains unchanged. Logo source: https://commons.wikimedia.org/wiki/File:Paystack_Logo.svg.

### 2026-10-22 — Compact step actions

- Size contact and payment Continue buttons to their labels, with Back aligned left and the primary action right. Allow wrapping on narrow screens without stretching the primary button.

## 2026-10-22 — Complete-test badge editor after payment

- Open the saved conference badge editor after verified preview payment for a self ticket.
- Address the actual issued seat for name/photo edits and mark preview badge downloads as test-only.
- Preserve gift-only confirmation and add a runtime confirmation regression check.

## 2026-10-24 — Mobile checkout polish

- Added mobile-specific step progress, sticky ticket controls, per-ticket removal, and a collapsed summary below the form.
- Preserved recipient details when removing a middle ticket; refined radio focus, quantity colors and gift labels.
- Verified production build and browser removal/navigation behavior; physical iPhone checks remain pending. Local changes only.

### Mobile ticket quantity alignment

- Use an explicit two-column mobile quantity row so the label stays centered and the stepper sits at the right edge. Keep 44px button targets and allow the label to wrap on narrow screens.

- Added a softly masked community photo behind the expanded mobile order summary at 10% opacity, preserving text contrast and the compact collapsed state.
