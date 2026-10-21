# DevCon26 flexible checkout website

The /devcon26/checkout/ page accepts any whole ticket quantity from one to the
live EMS catalog's flexible_checkout.max_per_payment. The page displays the
server's GHS unit amount and selects Paystack automatically only when EMS
returns the single Paystack provider. It keeps the payment action disabled
until the live catalog reports flexible_checkout.mode: live. The homepage
links to the page so visitors can inspect ticket choices while sales are
closed.

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

The one-ticket rehearsal on the checkout page remains a separate Paystack
test flow. It never creates a real seat, claim, or QR. It is enabled only
when the test catalog reports preview_email_available: true for the exact
website origin. The request includes a Turnstile token with action
devcon26_test_preview_email; EMS performs recipient screening and sends
test-only email after verified test payment. If the preview flag is false,
the entered-address preview cannot start.

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
