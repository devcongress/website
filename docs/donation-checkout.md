# Donation checkout

The `/donate/` page replaces PR #61's homepage modal. It uses the same Inttegro
purchase intent, `@inttegro/js` 0.7.2, hosted fields, payment processing, locale,
and document/payment-method features. `/support` remains the hosted redirect.
The old presentation environment flag is ignored.

## Recovery

Only the public order ID is persisted, under the existing
`devcongress.inttegro.order:<purchaseIntentId>` session-storage key. A prepared
order resumes in the same tab. Completion, cancellation, mount failures, and SDK
failures retain its reference. Retry recreates the controller for that same order.
Late events from destroyed controllers are ignored.

Restart requires an explicit acknowledgement of duplicate-payment risk and clears
only the active reference. Known processing/action-required payments prevent
restart. Never interpret a network error as a failed payment. The hosted checkout
remains the authority for actual payment status and receipt availability.

Unavailable storage produces a visible warning; memory-only retry remains usable
until navigation/reload. Draft fields before order preparation and cross-tab or
cross-device recovery are not guaranteed. No payer PII or payment credentials are
saved by the website. Without JavaScript, users are directed to enable it or
contact support, rather than being sent into a potentially duplicate checkout.

## Visual boundary

The page reuses the website's Bricolage Grotesque/Source Sans 3 fonts, cream palette,
spacing, responsive layout, and contact information. Hosted fields are rendered in
an Inttegro-controlled cross-origin iframe. Version 0.7.2 applies DevCongress's
semantic background, surface, foreground, muted, border, focus, button, input, and
selection colors, along with the SDK's sans-serif typography and shared 8px radius.
The website must not proxy or modify the hosted payment runtime; Inttegro continues
to own the secure controls, validation, and payment states.

## Verification

- `pnpm check:donation`: mocked SDK regression checks for legacy resume, ID-only
  persistence, completion/error retention, same-order retry, stale events, pending
  restart guard, acknowledged restart, storage failure, and Worker routing.
- `pnpm build`: runs the recovery checks before the static build.
- `node scripts/check-devcon26-checkout.mjs`: existing checkout regression checks.
- Strict TypeScript check for the changed checkout controller.
- In-app browser: hosted form rendering and overflow at 1280px, 390px, and 320px widths;
  separate mocked browser fixture for reload, retry, processing, and completion.

Mocked events verify website behavior, not Inttegro's production payment outcomes.
No real payment or production order is created by the automated recovery tests.

## Integration history

PR #65 was merged into `codex/inttegro-donation-modal`, the head branch of PR #61.
PR #61 was then closed as superseded, without merging that branch into `main`.
This follow-up integrates the complete donation change on top of current main,
retaining the newer DevCon26 changes and resolving navigation copy in favour of
main’s “Support the community” wording.

Follow-up validation on 2026-10-19: the donation recovery checks, static build and
DevCon26 hero checks pass. The existing DevCon26 checkout script fails at its
active-registration-link assertion on both unchanged `main` (`f6dd9f7`) and this
integration: main intentionally pauses registration. That unrelated assertion is
not changed here. Screenshots are the approved captures carried over from #65;
main's newer navbar wording is retained in the integrated source.
