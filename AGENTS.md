## Commands

- `pnpm dev` — dev server at localhost:4321
- `pnpm build` — static build to `dist/`
- `pnpm preview` — preview production build locally
- `pnpm astro <cmd>` — Astro CLI passthrough

## Architecture

- **Astro 6.4.2** static site, deployed to GitHub Pages via `.github/workflows/deploy.yml`
- Content collections in `src/content.config.ts` with YAML data files in `content/<name>/`
  - Partners: `content/partners/*.yaml`
  - Admins: `content/admins/*.yaml`
  - Activities: `content/activities/*.yaml`
  - Meetups: `content/meetups/*.yaml`
  - Site config: `content/site.yaml`
- Design tokens (colors, spacing, radii, typography) defined as CSS custom properties in `src/layouts/Base.astro`
- Styling is Dodonut-style: bold black borders, offset shadows, rounded corners

## Conventions

- **Use pnpm, never npm.** The user explicitly prefers pnpm.
- **No tests, no linter, no formatter** configured. Don't add them without asking.
- Astro components in `src/components/`, layouts in `src/layouts/`
- For dynamic `style` attributes, use string concatenation (`style={'background-color:' + color}`). **Avoid `style={{ }}` object syntax** (esbuild fails on it in this version).
- The `backgroundColor` field on partners is optional. When present, the image gets `border-radius: var(--r-md)` and `padding: 8px` via the `has-bg` class, plus the inline background color.
