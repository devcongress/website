# DevCon26 flexible checkout website

The /devcon26/checkout/ page accepts any whole ticket quantity from one to the
live EMS catalog's flexible_checkout.max_per_payment. The page displays the
server's GHS unit amount and selects Paystack automatically only when EMS
returns the single Paystack provider. One build reads Testing or Live from
EMS at runtime; payment stays disabled unless the managed catalog has a valid
mode, positive settings version, and matching flexible checkout mode. The homepage
links to the page; unavailable checkout is explained before showing buyer fields.

Each seat has one allocation: self (at most one), private gift (recipient
email), organizer-managed community pool, or buyer-shareable claim. New tickets
default to a private gift, which requires an address or an explicit change of
allocation before payment. Sponsor ticket handover is arranged in EMS, not
through this public checkout.

The catalog is GET /api/public/annual-conference/2026/checkout/managed.
Initialization posts the full cart, request UUID, expected_mode, settings_version,
and a Turnstile response bound to devcon26_checkout to its /initialize endpoint.
EMS owns the selected mode and rejects a stale settings version before payment
creation. A checkout_settings_changed response refreshes availability and returns
the buyer to ticket review; it never automatically submits the new mode. The
same review is required when a back-forward restore discovers changed settings.
Purchaser details and allocation emails are JSON body fields, never URL
parameters. The server validates the cart and amount; the website checks the
response against its catalog snapshot before leaving for Paystack. The
checkout grant and verifier remain in this browser's session storage, scoped
to the returned reference. A Paystack callback carries only the reference.

The quantity, allocation, purchaser details, and payment action share one
preserved form across three steps. Allocation choices use native radio groups
with visible explanations. The at-most-one self allocation rule remains visible
and unavailable on the other tickets. Mobile layouts stack the counter, fields,
and order summary without introducing a nested scrolling region.

The payment confirmation page recognizes a matching session grant, verifies
managed-test and managed-live references with /checkout/managed/verify, and shows
a payment record for verified payment only. The stored order owns verification
mode even after EMS changes its current setting. Existing complete-test, sandbox,
and underscore-prefixed live references retain their historical verification paths. The verify response has no admission QR or claim capability, so
the receipt never pretends to be a ticket. Existing standard live and sandbox
confirmation paths remain separate.

After fulfillment, EMS emails the buyer a private
/devcon26/tickets/manage/#capability=... link. That page calls the order
endpoint and can create or replace a shareable admission claim or reissue a gift
invitation. Historical buyer-managed orders retain their existing handover
actions. The page constructs links only from a capability returned by the matching action.
Both pages also accept existing emailed #key=... links when there is exactly
one valid token across both parameter names; duplicate or conflicting tokens
are rejected. Gift and shareable recipients use /devcon26/tickets/claim/#capability=...;
a badge link additionally has purpose=badge. A successful claim reports
the server's delivery state and never displays a QR on the website.

Public checkout contains one EMS-managed payment flow with a visible Testing
notice when EMS returns test mode; no website build flag chooses payment mode. While the catalog
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

## EMS-managed payment mode

The canonical website uses its configured EMS API origin (production defaults
to https://em.devcongress.org). Changing Testing or Live in EMS takes effect
through the runtime catalog; no branch name, preview backend, or
PUBLIC_DEVCON26_COMPLETE_TEST build variable selects the payment environment.
Both modes use the same checkout, Turnstile action, and confirmation page.

Managed references are devcon26-managed-test-<32 hex characters> and
devcon26-managed-live-<32 hex characters>. The reference plus session-scoped
checkout grant and verifier is sent to /checkout/managed/verify, without a
client-selected mode. The response must match the reference's mode. Only an
explicit self-scoped buyer grant opens the post-payment badge editor.

Test mode displays a clear notice that no money is charged and tickets are not
valid for admission. EMS enforces tester eligibility, provider credentials,
fulfillment, and admission rules. A website build does not change EMS mode,
apply database migrations, send email, or prove a hosted payment round trip.

Run pnpm check:tickets for the focused runtime, private-link, receipt, badge,
and existing checkout checks. pnpm build runs this suite after generating the
site so deployment verification includes the built-page assertions. The managed
controller checks cover both modes, stale settings without automatic payment
resubmission, failed refresh recovery, back-forward restoration, safe provider
redirects, historical references, and actual emailed private-link formats.

### Checkout presentation

The purchase page imports `devcon26-checkout-design.css` after the shared ticket-access stylesheet. Its `.checkout-design` scope keeps claim and management screens unchanged. Controls follow the EMS form palette and 8px radii, with 44px minimum button targets and a subtle pink input focus ring. The order summary precedes the form in source/mobile reading order and occupies the right column on desktop. Gift email disclosure and the single continuous form retain the existing checkout controller.

The private claim page keeps its submit button and input focus treatment within
the `.ticket-access` scope. The primary action uses the checkout brand pink, and
focused claim inputs use one pink border edge without an added outline or
shadow. Forced-colors mode adds a system-color outline for keyboard focus. The
shared checkout controls remain unchanged.

### Local stepper refinement

Checkout now presents three steps within one preserved form. Continue validates only the current step; final submission reveals the earliest invalid prior step before reporting browser validity. Earlier-step edits require advancing through validation again. The right context panel uses text-only rendering for allocation and purchaser details, with totals always visible. Turnstile uses explicit rendering when Payment is shown. The local UI was checked with a read-only catalog fixture; payment and email testing still belongs to the authorized preview journey after deployment approval.

The local allocation refinement uses native radio groups within a fieldset per ticket. Changing a selection restores focus to the corresponding replacement radio, and the other tickets disable the personal allocation with a visible explanation. The order preview has decorative masked SVG artwork and ticket notches; it remains explicitly an order preview. Primary actions use accessible deep pink with white text; current-step and selected-choice accents also use pink, while the illustrated ticket retains yellow and softened, fading artwork. The earlier custom dropdown and its keyboard/event state have been removed from the purchase controller.

### Cloudflare builds

Cloudflare builds use the same managed checkout implementation on every branch.
Astro's CSP permits the canonical EMS origin; there is no branch-specific
complete-test backend exception. A different API origin still requires an
explicit CSP and EMS exact-origin review.

### Mobile checkout controls (2026-10-24)

Below 821px, progress uses the current step name, step count and three segments. Progress and ticket quantity stay sticky below the site header; Back/Continue navigate steps. Additional tickets can be removed in place without losing the other recipients. The summary follows the form and starts collapsed on mobile, expanded on desktop.

### Post-payment photo adjustment

The payment badge editor opens the photo adjuster after a new image is selected and exposes Adjust photo in both editing and preview steps. Zoom and horizontal/vertical position use the existing seat card crop API (`scale`, `x`, `y`). Saving waits for the selected seat's upload, persists its crop, and preserves retry controls on failure. Previously saved crops are restored when reopening the editor. Desktop uses side-by-side controls; mobile stacks the preview and 44px controls within a scrollable dialog.

## Failure recovery

An order that cannot accept payment retains its request identity; the buyer is directed to check email or contact the organizer before starting again. The payment confirmation page hides Retry if its browser grant is absent and directs the buyer to their private ticket email. This does not infer that payment failed or authorize a new charge. The admission backend separately reconciles stored payment references.

The missing-access state uses a centered, narrow layout on the existing cream background, with a fixed-size ticket-and-envelope illustration beside the heading on desktop and mobile. It displays the buyer-formatted reference as a support identifier and includes it in the contact-email subject; it is not proof of payment. Other confirmation states hide and clear these recovery details.
