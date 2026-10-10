# DevCon26 public test checkout

The `/devcon26/` route uses the public EMS API at `https://em.devcongress.org`.
Buyers do not log in to EMS. The browser never receives a Paystack secret key.
Live ticket sales remain closed; this sandbox does not charge real money,
reserve seats, issue admission tickets, or send ticket emails.

## Configure the EMS sandbox

These settings belong on the **events-management Cloudflare Worker**, not the
website Worker, website environment files, or any `PUBLIC_*` variable.

In Cloudflare, open **Workers & Pages → events-management → Settings → Variables
and Secrets**. Configure the following values and save/deploy the settings:

| Setting | Value | Storage |
| --- | --- | --- |
| `DEVCON26_PAYMENT_PROVIDER` | `paystack` | Text variable |
| `DEVCON26_TEST_BUYER_EMAIL` | An inbox you control for test payments | Secret |
| `PAYSTACK_SECRET_KEY` | The existing Paystack `sk_test_` key | Secret |
| `DEVCON26_TEST_CHECKOUT_ENABLED` | `true`, only after storage is ready | Text variable |

Do not paste a secret key in a PR, commit it, or expose it to the browser. Do not
replace the test key with a live key. Keep `DEVCON26_PAYMENTS_ENABLED=false`.

Apply the EMS database migrations through its approved migration process,
including `20261007050000_devcon26_test_checkout.sql`, before enabling the
sandbox. Merging application source does not apply database migrations.

The read-only availability endpoint is:

```text
GET https://em.devcongress.org/api/public/annual-conference/2026/test-checkout
```

It returns `mode: "test"` with the server-owned GHS ticket catalog only when the
sandbox configuration and isolated test-session storage are ready. It returns
`mode: "unavailable"` when configuration or storage is missing. Initialization
and verification are separate public POST endpoints; status checks create no
payment or checkout session.

## PR and version previews

Use the exact deployed website commit/version URL plus `/devcon26/` to review
the page before merging. Uploading a Worker version for a preview must not move
production traffic; do not use `wrangler deploy` for this purpose.

A preview URL alone does **not** enable end-to-end checkout. EMS uses a
separate, exact-origin `DEVCON26_TEST_CHECKOUT_ORIGINS` allowlist for the
sandbox. It reflects approved origins only on the sandbox catalog,
initialization, and verification endpoints, without credentials. Paystack
returns to the initiating approved website origin. The default main website
origin remains allowed; general public/organizer CORS is unchanged.

Do not repoint the shared production `PUBLIC_WEBSITE_ORIGIN` to a PR preview:
other website links and email flows also depend on it. New preview origins
need explicit approval and the test-only allowlist setting in EMS.
Do not use wildcard CORS or production `NODE_ENV=development` as a workaround.

Unapproved preview origins can review the layout, navigation, single-open FAQs,
selected ticket image, mobile bottom drawer, and unavailable checkout/retry
states, but cannot complete a hosted Paystack round trip.

The website defaults to the production EMS hostname. Its existing CSP permits
connections to that hostname; selecting a different API hostname also requires
an explicit CSP review, not only a `PUBLIC_DEVCON26_API_ORIGIN` override.

## Verification boundaries

The Astro build and focused source/VM checks cover client checkout states,
safe redirect validation, cancellation, navigation, and drawer contracts. They
are not browser-rendering tests or evidence of a successful provider payment.
Use the existing Arc session for any browser verification.

## Dedicated payment confirmation

After EMS verifies a successful test payment on the existing Paystack return,
the website replaces that return entry with `/devcon26/payment-confirmation/`.
The strictly validated reference travels in `#reference=...`, not a query
parameter on the new page request. New links display a neutral `DC26-` prefix
and the full 32-character session identifier in uppercase. The client reverses
that presentation to the original `devcon26-test-` reference for EMS verification.
Legacy raw fragments remain accepted and are replaced in place with the neutral
format. A reference identifies a sandbox session; it is not proof of payment.

The confirmation page re-verifies with the existing public EMS POST `/verify`
endpoint on load, refresh, fragment changes, and back-forward cache restores.
It never calls `/initialize`, starts another payment, trusts URL success flags,
or caches a verified receipt in browser storage. The server response supplies
the ticket tier, quantity, GHS amount, and payment status; local tier metadata
supplies only the matching label and photo.

Only a valid `mode: "test"`, `status: "verified"` response reveals the payment
summary, full neutral reference, optional print/save action, and next steps.
Pending, failed, missing/unknown reference, invalid response, timeout, and
connection-error states never display successful payment or a usable ticket.
Retries only check the existing payment. No JavaScript means no verified
receipt; the page provides a plain-language fallback and support link.

The page is excluded from search indexing and retains the website's restrictive
built-script CSP. Its warm-paper summary, quiet selected photo, yellow accents,
and restrained controls use the existing website design tokens. Mobile uses a
single-column page, not another modal. Print output includes the payment record
and its non-admission caption, not an admission QR code or ticket.

### 2026-10-07: Buyer-facing presentation and confirmed venue

Removed buyer-visible test/sandbox labels from the landing page checkout and
confirmation states, at the user's request, to preview the intended customer
experience. Technical documentation, endpoint names, exact-origin allowlists,
test-key checks, and `mode: "test"` response guards remain explicit and unchanged.
This is presentation only: it does not enable live payments or fulfillment.
Replacing the provider key alone does not make this test-only flow production-ready.

The confirmation now pairs a stronger amount-first receipt with a confirmation
seal, confirmed venue details, and concise save/support/programme guidance.
It does not claim an admission ticket, seat reservation, or email was issued.
Support can reconstruct the raw EMS reference by replacing `DC26-` with
`devcon26-test-` and lowercasing the full identifier. No identifier is truncated.

The user confirmed **Ghana Digital Center, Accra, Ghana** as the venue. The hero,
location section, confirmation, and FAQ reflect it. December 2026 remains the
published month; no exact date, room, or admission instructions are invented.

The proposed venue photo was omitted before commit/push because its source
did not provide an explicit reuse license. No unlicensed photo or broken asset
reference is published. Add an owned or explicitly licensed venue image in a
separate update. Official venue sites were unavailable during asset research;
no TLS or browser safety barrier was bypassed.

### 2026-10-08: User-supplied venue photograph

Added the hall photograph supplied by the user as `ADC.jpg`, with Ghana Digital
Center as the primary venue name and "formerly Accra Digital Center" in supporting
venue copy and the FAQ. The original upload remains unchanged. The website serves
one optimized 1200 × 1594 WebP (239,078 bytes) with image metadata removed.

Both the event location section and verified confirmation venue details use the
photo as a lazy-loaded, decorative background. Absolute positioning avoids adding
an image row or changing the content layout; low opacity and soft edge masks keep
the copy readable. The image is hidden from assistive technology and print output
on the confirmation page. Checkout scripts, verification, payment mode, dates,
and admission behavior are unchanged.

### 2026-10-08: Left-column venue photo refinement

The event-page venue photograph now belongs only to the left-hand Accra block,
including on the stacked mobile layout. A centered, closest-side mask fades all
four edges to transparent so the photo has no rectangular section boundary and
cannot extend behind the right-hand copy. Its opacity and the confirmation photo
treatment are unchanged. Venue details consistently use "Ghana Digital Center
(formerly Accra Digital Center)"; checkout behavior remains unchanged.

### 2026-10-08: Location image removed

Removed the venue photo and its mask from the event-page location section.
The existing Accra typography, venue name, and directions link remain;
the proposed standalone photograph layout was reverted. The payment confirmation
image, checkout scripts, and verification behavior are unchanged.
The location section no longer includes the event month. Its venue caption puts
the current name first and the former name on a quieter second line, with pretty
text wrapping for narrow screens. Event dates elsewhere remain unchanged.

### 2026-10-08: Conference label polish

The hero conference label uses the shared metadata type size, muted uppercase
text, balanced wrapping, and a compact pale-yellow year badge. The descriptor
can wrap on narrow screens while the year stays intact. This is a static
typography refinement: the hero heading, event information, images, and checkout
behavior are unchanged.

### 2026-10-07: Confirmation page

Added the dedicated confirmation destination and server-verified receipt
states. The earlier preview sandbox fix completed a real Paystack **test**
payment/return round trip in the user's Arc session. This new page still needs
its own browser verification after a website preview is published; that earlier
test is not evidence of the new page being deployed or visually checked.

### 2026-10-07: Built-script CSP regression

The checkout and FAQ client must use an Astro-processed `<script>` rather than
`is:inline`. The card buttons start disabled and are enabled by that client;
an unprocessed inline script without an allowed hash is blocked in production.

After building, inspect `dist/devcon26/index.html`: every executable inline
script must have its exact hash in the script CSP, and any external client
module must be a served, same-origin asset. Verify the output includes checkout,
FAQ, and mobile-menu initialization, then confirm card selection in Arc.
Source/VM checks alone do not catch a blocked production script. Keep the CSP
intact; do not add `unsafe-inline` or bypass the sandbox's origin restrictions.

### 2026-10-10: Purchaser details and quoted coupons

The checkout collects a purchaser name and email without requiring an EMS login.
The browser sends those fields only in the initialization POST body; it does not
put them in URLs, browser storage, or logs. EMS stores them in the isolated
Owner-visible test checkout record. Paystack continues to receive the configured
test buyer email, not the visitor's identity. No ticket email is sent.

The catalog must advertise `accepts_coupon: true`. The browser then requests a
server quote using `{ tier_key, coupon_code? }` at POST `/quote`, including when
no coupon is entered. Quote responses supply the base, discount, final amount,
quantity, and normalized `coupon_applied` value. Quotes do not reserve coupon
capacity. The optional coupon disclosure supports applying and removing one
code; invalid, expired, ineligible, and unavailable codes show bounded messages.

Name, email, and coupon inputs use a compact ink focus edge, a faint pink halo,
and a pink caret instead of the page's wider action-link focus outline. Invalid
coupon fields retain their pink error edge. Forced-colors mode uses a system
highlight outline; native browser autocomplete and keyboard behavior remain intact.

The coupon disclosure keeps its native details/summary keyboard behavior while
the fields fade and slide over 180ms. The clipping and scroll viewport stays at
the larger endpoint size for that transition; a separate decorative paper
surface translates and scales to bridge the modal's visible size. The selected
masked photo lives in an independent clipped layer, outside both the stretching
paper and the scroll viewport. Its width-derived 5:4 geometry and crop do not
change when the coupon toggles. Desktop anchoring follows the dialog's fixed
centre; the mobile drawer keeps the original 78px bottom anchor. Photo opacity,
radial mask, and grayscale treatment are unchanged. Text and
controls translate without scaling. Recentring and bottom-sheet anchoring move
the scroll viewport itself, not the content inside it, so that movement does not
create a temporary internal scrollbar when both endpoint layouts fit. Only a
real scroll-position clamp contributes an internal content translation; the
panel retains `overflow-y: auto` for genuinely constrained screens. The total
and payment button use local
transform-only FLIP motion; no height is animated. Closing fields remain in
normal flow and become inert until the timeline finishes, when the native
closed state and natural viewport size are committed together.

Rapid toggles [reverse the running timeline](https://developer.mozilla.org/en-US/docs/Web/API/Animation/reverse)
instead of rebuilding from a snapped layout. Destination measurements restore
the live scroll position, and content translation bridges any final scroll clamp.
Scroll anchoring is disabled and a stable scrollbar gutter prevents width changes.
Coupon errors open the same disclosure. Reduced motion, viewport resizing,
scroll/touch gestures, checkout-content changes, and modal closure settle the
latest requested state and clear the temporary viewport size and animations.
The modal's own entrance/exit transform is not changed by the disclosure.

### 2026-10-10: Stable checkout photo during coupon disclosure

Separated the selected ticket photo from the resizing paper surface so coupon
opening, closing, and reversal no longer stretch it. The existing five-animation
timeline and native scrolling remain unchanged. Built-markup checks require an
empty paper layer and a separate, non-interactive photo layer behind the form.

POST `/initialize` sends only the tier, UUID request key, trimmed purchaser name,
normalized email, and optional coupon. It never sends client amounts. Changing
buyer, coupon, or tier input invalidates in-flight work and clears the request
key; unchanged retries retain their UUID. Closing the drawer prevents stale
responses from updating it or redirecting. Every request has a 15-second timeout.
Bounded `finished` or `cart_conflict` responses clear the UUID and require a new
quote; `in_progress` and uncertain network failures retain it to avoid duplicates.

The client checks integer amount arithmetic, tier quantity, coupon/discount
consistency, and the Paystack HTTPS destination before redirecting. If the server
initialization returns changed amounts, the updated total is shown for another
explicit Continue action. A changed coupon is never silently substituted.

Verification now accepts `refund_required` as a needs-attention outcome. The
confirmation page shows a support reference and expected checkout total without
a success receipt or admission claim. Verified receipts include the original
ticket total and any coupon discount. Legacy verification responses without any
quote fields remain supported as undiscounted records; partial or inconsistent
quote summaries are rejected. Test mode guards and live-payment flags remain
unchanged. Deploying this client alone does not apply the new EMS migration.

#### Repeatable website verification

From the website repository, run:

```sh
pnpm build && pnpm exec node scripts/check-devcon26-checkout.mjs
```

The script bundles the existing client with Astro's installed esbuild dependency
and exercises it in Node with a fake DOM and mocked requests. It covers quote
validation, bounded coupon errors, stale responses, request-key retry rules,
changed server totals, safe redirects, and needs-attention confirmation states.
Disclosure checks cover the stable viewport and decorative surface endpoints,
desktop/mobile positioning, scrolled-panel clamp continuity, transform-only
motion, reversal in both directions, validation-driven reopening, content and
modal cleanup, resize/scroll interruption, and live reduced-motion changes.
It also checks the built sponsorship content, historical partner order, and CSP
hashes. The published and built PDF must match the approved SHA-256 recorded in
the script; no Downloads folder or external source file is required.

These checks neither call the payment API nor replace browser layout, native
form validation, or Paystack round-trip verification. No dependency or separate
test runner is added.
