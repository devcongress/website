# DevCon26 homepage introduction

Updated 2026-10-10. The homepage remains the community's front door. DevCon26 is
introduced in three places without replacing the community identity, video, or
programme content:

- Desktop and mobile navigation link to `/devcon26/`.
- The homepage hero pairs the existing community headline with real community
  photography and the invitation: "We connect all year. This December, we come
  together at DevCon26." December 2026 and the confirmed Ghana Digital Center
  (formerly Accra Digital Center), Accra venue sit below it.
- The yellow primary hero action is Get DevCon26 tickets, linking directly to
  `/devcon26/#tickets`. Join the community is the pink secondary Slack action.
  Support us is the third, outlined action and opens the existing Paystack
  donation page. The small announcement strip is removed; navigation and the
  dedicated donation section retain their support actions.
- `Devcon26Feature.astro` renders immediately after Programs and before Events.
  It is now a compact reminder with December / venue metadata and a Get tickets
  link rather than a second photo-heavy hero.

The feature panel is server-rendered, has no card-wide link overlay or script,
and sits outside `data-home-events-grid`. Live event refreshes cannot replace it.
The reminder stacks at 640px; its mobile ticket action spans the content width.
The hero stacks at 800px and its actions become full-width below 480px. Its image
has explicit intrinsic dimensions and eager/high-priority loading. The original
video remains below the composition, with its embed and styling unchanged.
Hero actions use compact 46px minimum heights, 15px labels, and 2px borders.
The pink action uses a slightly darker brand-pink shade to retain readable white
text at the smaller size.

The existing 960px navigation breakpoint is preserved. A compact desktop rule
between 961px and 1100px leaves room for the additional link. New links have
44px-or-larger touch targets and explicit focus indicators. New motion uses only
transform, with fine-pointer hover gating and reduced-motion overrides.

Verify with `pnpm build`, the existing DevCon26 hero and checkout checks, and
desktop/mobile browser checks. Check links, navigation around 960/961px, panel
placement before Where we show up, and visible keyboard focus. No payment-provider
configuration, EMS data, or production checkout behavior is changed.
