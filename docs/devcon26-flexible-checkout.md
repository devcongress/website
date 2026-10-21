# DevCon26 flexible checkout website

The /devcon26/checkout/ page accepts any whole ticket quantity from one to the
live EMS catalog's flexible_checkout.max_per_payment. The page displays the
server's GHS unit amount and selects Paystack automatically only when EMS
returns the single Paystack provider. It keeps the payment action disabled
until the live catalog reports flexible_checkout.mode: live. The homepage
links to the page; unavailable checkout is explained before showing buyer fields.

Each seat has one allocation: self (at most one), private gift (recipient
email), organizer-managed community pool, or buyer-shareable claim. New tickets
default to a private gift, which requires an address or an explicit change of
allocation before payment. Sponsor ticket handover is arranged in EMS, not
through this public checkout.

Initialization posts the full cart and a request UUID to
/api/public/annual-conference/2026/checkout/flexible/initialize.
Purchaser details and allocation emails are JSON body fields, never URL
parameters. The server validates the cart and amount; the website checks the
response against its catalog snapshot before leaving for Paystack. The
checkout grant and verifier remain in this browser's session storage, scoped
to the returned reference. A Paystack callback carries only the reference.

The quantity, allocation, purchaser details, and payment action share one
continuous form surface. Allocation choices use an in-page listbox rather
than the operating system's select popup, with visible explanations for each
choice and keyboard support for arrow keys, Home, End, Enter, Space, Escape,
and Tab. The listbox keeps the at-most-one self allocation rule visible and
unavailable on the other tickets. Mobile layouts stack the counter, fields,
and order summary without introducing a nested scrolling region.

The payment confirmation page recognizes a matching flexible grant, verifies
with /checkout/flexible/verify, and shows a payment record for verified
payment only. The verify response has no admission QR or claim capability, so
the receipt never pretends to be a ticket. Existing standard live and sandbox
confirmation paths remain separate.

After fulfillment, EMS emails the buyer a private
/devcon26/tickets/manage/#capability=... link. That page calls the order
endpoint and can create or replace a shareable admission claim or reissue a gift
invitation. Historical buyer-managed orders retain their existing handover
actions. The page constructs links only from a capability returned by the matching action.
Gift and shareable recipients use /devcon26/tickets/claim/#capability=...;
a badge link additionally has purpose=badge. A successful claim reports
the server's delivery state and never displays a QR on the website.

Public checkout contains no payment rehearsal or test-email form. While the catalog
loads, a status panel replaces the form. If availability cannot be confirmed,
the panel explains that checkout is unavailable and offers a retry. The form
and order summary appear only after a valid catalog arrives; retry clears stale
provider, price, and availability text. The separate EMS sandbox remains unchanged.

The checkout, management, and claim routes are noindex static pages. They use
the existing site CSP, processed Astro scripts, and the EMS exact-origin CORS
gate. Website source and a successful static build do not activate sales,
apply EMS migrations, or prove a Paystack round trip.

Desktop and mobile captures of the static gated state are available for
[checkout](./screenshots/devcon26/checkout-desktop.png),
[ticket management](./screenshots/devcon26/manage-desktop.png), and
[ticket claims](./screenshots/devcon26/claim-desktop.png). The corresponding
mobile captures are [checkout](./screenshots/devcon26/checkout-mobile.png),
[management](./screenshots/devcon26/manage-mobile.png), and
[claims](./screenshots/devcon26/claim-mobile.png). These show responsive layout
with sales closed; they do not demonstrate payment or admission.

## Full-flow test preview

Build the feature preview with `PUBLIC_DEVCON26_COMPLETE_TEST=true`. This selects the separate complete-test catalog, initialization, and verification endpoints and displays a test-payment notice. Omit the flag for the public website build. The main checkout includes a Turnstile check bound to `devcon26_complete_test_checkout`; its widget must allow the exact preview hostname.

Paystack test payments drive real private management/claim links, QR email attachments, and badge creation. EMS restricts recipients to the enabled tester list and enforces quotas. Test QR PNGs and downloaded badges visibly state that they are not valid for admission. Test badges cannot publish publicly.

EMS migration `20261021150000_complete_test_ticket_checkout.sql` must be reviewed and applied before activating this path. It retains test provenance and blocks live launch while test orders remain. No migration or preview activation was performed as part of the review-fix pass; shared capacity cleanup requires separate approval.

The test build's CSP adds only
`https://devcon26-full-test-events-management.admins-a7d.workers.dev` when both
`PUBLIC_DEVCON26_COMPLETE_TEST=true` and `PUBLIC_DEVCON26_API_ORIGIN` exactly
match that backend. No wildcard or production CSP change is required.

### Checkout presentation

The purchase page imports `devcon26-checkout-design.css` after the shared ticket-access stylesheet. Its `.checkout-design` scope keeps claim and management screens unchanged. Controls follow the EMS form palette and 8px radii, with 44px minimum button targets and a subtle pink input focus ring. The order summary precedes the form in source/mobile reading order and occupies the right column on desktop. Gift email disclosure and the single continuous form retain the existing checkout controller.

### Local stepper refinement

Checkout now presents three steps within one preserved form. Continue validates only the current step; final submission reveals the earliest invalid prior step before reporting browser validity. Earlier-step edits require advancing through validation again. The right context panel uses text-only rendering for allocation and purchaser details, with totals always visible. Turnstile uses explicit rendering when Payment is shown. The local UI was checked with a read-only catalog fixture; payment and email testing still belongs to the authorized preview journey after deployment approval.

The local allocation refinement uses native radio groups within a fieldset per ticket. Changing a selection restores focus to the corresponding replacement radio, and the other tickets disable the personal allocation with a visible explanation. The order preview has decorative masked SVG artwork and ticket notches; it remains explicitly an order preview. Primary actions use accessible deep pink with white text; current-step and selected-choice accents also use pink, while the illustrated ticket retains yellow and softened, fading artwork. The earlier custom dropdown and its keyboard/event state have been removed from the purchase controller.

### Persistent Cloudflare preview builds

Cloudflare Workers Builds supplies `WORKERS_CI=1` and `WORKERS_CI_BRANCH`. For the exact `feature/devcon26-flexible-ticket-checkout` branch, Astro config sets `PUBLIC_DEVCON26_COMPLETE_TEST=true` and the fixed EMS preview API origin before generating HTML and CSP. Every automatic push build therefore retains test routing. No GitHub variables or Worker runtime secrets are needed for these public build settings. Main and other branches retain their existing configuration. Manual builds outside Workers Builds still require the two explicit preview variables.
