# Website typography

## 2026-10-10: An all-sans type system

The public website pairs Bricolage Grotesque for display text with Source Sans 3
for body copy, navigation, labels, buttons, and form controls. This replaces
DM Serif Display and Inter across the homepage, event and meetup listings and
details, event submission, DevCon26, and payment confirmation.

The shared layout loads both families through the existing Google Fonts
stylesheet and preconnections, using display swap. Bricolage supplies real
600–700 weights and optical sizing. Source Sans supplies variable 400–800
upright weights and 400–700 italics, including the intermediate weights used
by existing controls. The site's existing font and stylesheet CSP allowances
remain unchanged; no font package, provider, or new host is introduced.

Use semantic roles rather than naming a font classification:

- `--font-display` and `.heading-display` for headings and display numerals.
- `--font-body` for prose and controls.
- Weight 600 for ordinary display headings; 700 for hero headlines and large
  display numerals. Body copy stays 400, with 600–700 for actions and labels.
- Display tracking is -0.025em and smaller-heading tracking is -0.015em;
  hero-scale text may use -0.03em. Body text and native controls use 0.
- Body-scale tokens are 13px, 15px, 17px, and 19px, followed by the existing
  22px-and-up display scale. Tight display line-height is 1.12; longer copy
  keeps the existing 1.65 leading.

Native buttons, inputs, selects, and textareas inherit the body typography.
Emphasised heading text stays upright, avoiding artificial italic display
letters; ordinary body emphasis uses Source Sans's supplied italic face.
Dynamic event-card headings use the same display utility as static cards.
The homepage hero balances its headline lines to avoid a lone trailing word.

The layout, brand colours, sponsorship content and PDF, checkout behavior,
and interaction animations are unchanged. Changes remain local until a
separate commit, push, or deployment is requested.
