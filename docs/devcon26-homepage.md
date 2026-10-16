# DevCon26 homepage introduction

## Dedicated-page scroll motion (2026-10-16)

`src/lib/devcon26-scroll-reveals.ts` progressively enhances the dedicated page
with one-shot, 280ms entrances. Story blocks rise, day columns enter from opposing
sides, speakers gently scale/rise, location blocks shift in, registration copy
lifts, sponsor blocks scale, FAQs fade, and past sponsors shift from the right.
Targets do not nest; existing photo rotation and badge artwork are preserved.

All content remains server-rendered and visible without JavaScript. Initially
visible content is excluded, including on restored scroll/fragment navigation.
One native intersection observer starts effects just before entry and unobserves
each target. Keyboard/focus, hash changes, printing, page exit, and enabling
reduced motion cancel enhancement. No content waits for an image or API response;
existing native lazy loading lets the browser prepare lower-page images without
eagerly fetching the entire page. Slow-network performance is not benchmarked.

## Homepage introduction

Updated 2026-10-12. The homepage remains the community's front door. DevCon26 is
introduced in three places without replacing the community identity, video, or
programme content:

- Desktop and mobile navigation link to `/devcon26/`.
- The homepage hero pairs the existing community headline with real community
  photography and the invitation: "We connect all year. This December, we come
  together at DevCon26." 19 December 2026 and the confirmed Ghana Digital Center
  (formerly Accra Digital Center), Accra venue sit below it.
- The yellow primary hero action is Get DevCon26 tickets, linking directly to
  `/devcon26/#tickets` and remaining first and visually dominant. Join the
  community (the existing Slack link) and Support us (the existing Paystack
  donation link) remain secondary hero buttons with their existing external-link
  behaviour, keyboard focus, fine-pointer transform-only hover feedback, and
  reduced-motion support. The small announcement strip is removed; navigation
  and the dedicated donation section retain their support actions.
- `Devcon26Feature.astro` renders immediately after Programs and before Events.
  It is now a compact reminder with 19 December 2026 / venue metadata and a Get
  tickets link rather than a second photo-heavy hero.

The feature panel is server-rendered, has no card-wide link overlay or script,
and sits outside `data-home-events-grid`. Live event refreshes cannot replace it.
The reminder stacks at 640px; its mobile ticket action spans the content width.
The hero stacks at 800px and its actions become full-width below 480px. Its
image has explicit intrinsic dimensions and eager/high-priority loading. The
original video remains below the composition, with its embed and styling
unchanged. Hero actions use compact 46px minimum heights, 15px labels, and 2px
borders.

The shared navbar follows the live site's left-aligned links after the logo,
right-aligned actions, 68px frame, and 40px logo. Hover darkens link text and
reveals a pink underline; current typography and route-specific links are retained.
The existing 960px navigation breakpoint is preserved. A compact desktop rule
between 961px and 1100px leaves room for the additional link. New links have
44px-or-larger touch targets and explicit focus indicators. New motion uses only
transform, with fine-pointer hover gating and reduced-motion overrides.

On the dedicated DevCon26 page, the mobile `<=760px` hero heading uses -0.025em
tracking. Its date and venue facts use 14px body text with normal tracking at the
same breakpoint.

The dedicated page keeps its own section navigation, but at `<=960px` its header
now shares the homepage navigation frame: a 68px sticky, cream, full-width
header with the homepage-sized logo and burger, plus a full-width white dropdown.
The existing DevCon26 menu script continues to manage its isolated links,
visibility, focus, Escape handling, and reduced-motion behavior. Section anchors
leave an 84px mobile offset so their headings are not obscured by the header.

Verify with `pnpm build`, the existing DevCon26 hero and checkout checks, and
desktop/mobile browser checks. Check links, navigation around 960/961px, panel
placement before Where we show up, and visible keyboard focus. No payment-provider
configuration, EMS data, or production checkout behavior is changed.
