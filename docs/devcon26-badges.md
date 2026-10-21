# DevCon26 badges

The physical conference badge is shared by immediate local registration previews and
verified attendee/speaker private-card previews and downloads. The role label uses shared dotted uppercase glyphs on the 1080×1350 export, right-aligned opposite `/images/logo.png` in the
footer. The backing reuses the homepage V11 artwork, including its metal clip and
paper outline; a clean sample of its paper texture replaces baked-in lettering
inside the personalized area. The homepage artwork itself is unchanged.

## Role boundary

An anonymous registration `202` response is a neutral receipt, not proof of
admission. Its local sharing card displays ATTENDEE as a community label, not an
admission credential. The private email link reads the existing
EMS card endpoint and uses only its validated `attendee` or `speaker` role.
EMS eligibility remains authoritative: issued/checked-in attendee tickets, or
selected speakers with confirmed sessions. No browser role selector or URL role
override is accepted. This change does not alter EMS or require migrations.

## Rendering and photos

- `devcon26-digital-badge.ts` supplies the browser canvas renderer, font loading,
  name fitting, and role layout. Downloads await the same renderer as previews.
- The private editor stores a 920×740 crop derivative, matching the aspect ratio
  of the 810×651.52 portrait region, then resets crop metadata to centered 1×. Existing saved photos
  remain usable; legacy wide crops cannot recover pixels previously removed.
- Public pages and their SVG previews use a server-rendered counterpart, not
  browser canvas. Public SVGs embed the authorized public photo and real logo with
  bounded reads; their system-font fallback may differ from the downloaded PNG.
- Public lookup/image authorization and opt-in publication remain unchanged.
  Public rendering never receives a management capability or storage path.

## Verification

Run `pnpm build`, `node scripts/check-devcon26-checkout.mjs`, and
`node scripts/check-devcon26-badge.mjs`. Mocked browser checks cover both roles,
private photos, invalid links, name changes, and preview/download parity without
creating registrations, sending email, or publishing real cards.

Payment confirmation places compact edit, download and share actions beneath the badge.
Names retain their original display font. Badge artwork omits testing banners;
test payment and public-publication restrictions remain enforced by the existing flow.
