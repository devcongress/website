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

## Meetup data

The homepage and meetup pages are generated from the Events Management public
meetup feed during each static build:

```txt
https://em.devcongress.org/api/public/meetups
```

The adapter validates the versioned public response before generating routes.
If the feed is unreachable, times out, returns an error, or fails validation,
the build uses `content/meetups/*.yaml` instead. This keeps the public site
deployable during a temporary upstream incident without exposing organizer
credentials or connecting the browser directly to the operational system.

Pushes to `main`, manual workflow runs, and the daily `06:17 UTC` scheduled
build refresh the static event snapshot.

## Event calendar subscription

`/events/calendar.ics` is a public iCalendar subscription generated from the
same validated Events Management feed as `/events/`. It includes only published
events that are still in progress or have not started at build time; past events
remain available on the website but are not carried into subscribers' calendars.

The Events page links the feed to Google Calendar. The feed is refreshed by the
same push, manual, and daily builds described above. No organizer credentials or
unmoderated submissions are included.

## Public event submission launch controls

Event submissions use one fail-closed build-time flag. Add it as a GitHub
Actions repository variable so GitHub Pages and Cloudflare produce the same
static release:

| Variable | Purpose |
| :-- | :-- |
| `PUBLIC_EVENT_SUBMISSIONS_ENABLED` | Hard website safety switch. When it is not `true`, `/events/submit/` redirects to `/events/`. |

- Private beta: set the variable to `true`, then share `/events/submit/`
  directly with testers.
- Safety shutdown: set enabled to `false` and rebuild both static deployments.

The website does not render an event-submission link during beta, and the form
page remains `noindex`. Its permanent public entry point will be chosen after
beta. An unset variable is treated as `false`. Local development can copy
`.env.example` to `.env` and opt in explicitly. This website flag does not
disable direct requests to Events Management; the backend needs its own runtime
switch for a system-wide shutdown.

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
## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
