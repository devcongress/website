# Astro Starter Kit: Minimal

```sh
pnpm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## Cloudflare Workers deployment

Public pages remain static. `wrangler.jsonc` publishes Astro's `dist/` output through Cloudflare Workers Static Assets. The only runtime paths are `/organizer-console/**` and `/api/auth/**`; all other public assets remain asset-first.

- `pnpm deploy:dry-run` builds the site and validates the Worker asset deployment locally.
- `pnpm deploy` builds and deploys the static site with Wrangler.
- Pull requests run the static build and Wrangler dry-run validation.
- During this migration, GitHub Pages and Cloudflare Workers run as independent workflows. Each builds the site and deploys its own output on pushes, scheduled refreshes, and manual runs on `main`.

Before the first production deployment, repository administrators must create the `cloudflare-workers-production` environment and add these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN` — a least-privilege token permitted to deploy this Worker.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the Worker and `devcongress.org` zone.

The first deployment should be validated at its Workers preview URL. Attach `devcongress.org` only after URL/content parity checks pass. GitHub Pages continues to deploy independently during the agreed soak window and remains the rollback path.

## Organizer console setup

The organizer console lives at `/organizer-console/`. It uses the existing Supabase project and Google OAuth flow, but creates its own app session on `devcongress.org`.

The current production Worker is static-assets-only, so Cloudflare will not show runtime variables yet. After this feature deploys the Worker script for `devcongress-website`, configure these Worker secrets in Cloudflare and rerun the deployment if the first production run needs them:

- `SUPABASE_URL` — the Supabase project URL.
- `SUPABASE_ANON_KEY` — the browser-safe Supabase anon key. The Worker deliberately returns this only from its same-origin auth-config endpoint.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase key. Never expose this key in browser code, GitHub Actions variables, or the repository.

`keep_vars: true` preserves Cloudflare dashboard variables during GitHub Actions deployments. For local Worker testing, create an ignored `.dev.vars` file with the same three values.

In Supabase Auth, add both callback destinations to the allowed redirect URLs:

- `https://devcongress.org/api/auth/admin/callback`
- `https://devcongress-website.admins-a7d.workers.dev/api/auth/admin/callback`

Also add `https://devcongress.org` to the authorized JavaScript origins for the existing Google OAuth client.

Google authentication proves identity only. Access is granted only when the verified Google email has an active row in `public.admin_memberships`; the Worker then stores only a hash of an opaque, HTTP-only `devcon_admin` session token in `public.admin_sessions`.
## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
