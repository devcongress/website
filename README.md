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

This site remains fully static. `wrangler.jsonc` publishes Astro's `dist/` output through Cloudflare Workers Static Assets; it does not add a server entrypoint, API routes, authentication, or database bindings.

- `pnpm deploy:dry-run` builds the site and validates the Worker asset deployment locally.
- `pnpm deploy` builds and deploys the static site with Wrangler.
- Pull requests run the static build and Wrangler dry-run validation.
- During this migration, GitHub Pages and Cloudflare Workers run as independent workflows. Each builds the site and deploys its own output on pushes, scheduled refreshes, and manual runs on `main`.

Before the first production deployment, repository administrators must create the `cloudflare-workers-production` environment and add these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN` — a least-privilege token permitted to deploy this Worker.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the Worker and `devcongress.org` zone.

The first deployment should be validated at its Workers preview URL. Attach `devcongress.org` only after URL/content parity checks pass. GitHub Pages continues to deploy independently during the agreed soak window and remains the rollback path.

Forks and fork-origin pull requests run the build jobs only. GitHub Pages artifacts, Workers dry-run validation, protected environments, and production deployments run only from `devcongress/website` itself.

## Organizer access (not deployed)

The public website deliberately contains no organizer route or navigation link. A separate organizer-only Astro build and Worker configuration are prepared for the future confirmed subdomain.

- `pnpm build:organizer` produces the private site in `dist-organizer/`.
- `wrangler.organizer.jsonc` defines the separate `devcongress-organizer` Worker and intentionally has no route until the hostname is confirmed.
- `ORGANIZER_ORIGIN` must be set to that exact HTTPS origin before the Worker will serve auth requests.
- After the initial script deployment creates the Worker, set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as Cloudflare secrets. Do not put them in this repository.

When the hostname is confirmed, add it as a Cloudflare custom domain, then add the matching Supabase redirect URL and Google OAuth authorized JavaScript origin.
## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
