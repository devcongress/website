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

## Public event data

The homepage, event list, and static fallback pages are generated from the
Events Management public event feed during each static build:

```txt
https://em.devcongress.org/api/public/events
```

The adapter validates the versioned public response before generating the
event surface. If the generic feed is unreachable, times out, returns an error,
or fails validation, the build uses the existing `content/meetups/*.yaml`
official-meetup fallback instead. This keeps the public site deployable during
a temporary upstream incident without exposing organizer credentials or
connecting the browser directly to the operational system.

The deployed Cloudflare surface also refreshes the homepage and `/events/`
list from the public feed in the browser. Canonical `/events/<slug>/` pages
are resolved at the edge and use the same public feed before serving the
static Events page shell. An approved event can therefore become visible
without waiting for the next Astro build. If the public feed is temporarily
unavailable, the static snapshot remains usable where the route exists.

## Event calendar subscription

`/events/calendar.ics` is a public iCalendar subscription generated from the
same validated Events Management feed as `/events/`. On Cloudflare it is
generated dynamically, so newly published events do not wait for the next
Astro build. The static build still produces a fallback feed for GitHub Pages.
It includes only published events that are still in progress or have not
started at request/build time; past events remain available on the website but
are not carried into subscribers' calendars.

The Events page links the feed to Google Calendar. No organizer credentials or
unmoderated submissions are included.

## Public event submission launch controls

Event submissions use one fail-closed build-time flag. Add it as a GitHub
Actions repository variable so GitHub Pages and Cloudflare produce the same
static release:

| Variable | Purpose |
| :-- | :-- |
| `PUBLIC_EVENT_SUBMISSIONS_ENABLED` | Hard website safety switch. When it is not `true`, `/events/submit/` redirects to `/events/`. |

- Public launch: set the variable to `true`. The homepage Events section and
  `/events/` page render a `Submit an event` button linking to `/events/submit/`.
- Safety shutdown: set enabled to `false` and rebuild both static deployments.

When enabled, the public form is indexable. An unset variable is treated as
`false`, hides both public entry points, and redirects direct form visits to the
Events page. Local development can copy `.env.example` to `.env` and opt in
explicitly. This website flag does not disable direct requests to Events
Management; the backend needs its own runtime switch for a system-wide shutdown.

## Cloudflare Workers deployment

Astro still builds a static site-first fallback, while `src/worker.ts` adds a
small read-only edge layer for dynamic public events. `wrangler.jsonc` publishes
Astro's `dist/` output through Cloudflare Workers Static Assets and runs the
Worker first only for `/events/*`; it does not add authentication, organizer
workflows, or database bindings.

- `pnpm deploy:dry-run` builds the site and validates the Worker asset deployment locally.
- `pnpm deploy` builds and deploys the site plus edge route with Wrangler.
- Pull requests run the static build and Wrangler dry-run validation.
- The Cloudflare workflow deploys after merges to `main`, on the daily schedule,
  and on manual runs. GitHub Pages remains an independent static fallback.

Before the first production deployment, repository administrators must create the `cloudflare-workers-production` environment and add these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN` — a least-privilege token permitted to deploy this Worker.
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the Worker and `devcongress.org` zone.

The first dynamic deployment should be validated at its Workers preview URL,
including `/events/<slug>/` and `/events/calendar.ics`. Attach
`devcongress.org` only after URL/content parity checks pass. GitHub Pages
continues to deploy independently during the agreed soak window and remains the
static rollback path.

Forks and fork-origin pull requests run the build jobs only. GitHub Pages artifacts, Workers dry-run validation, protected environments, and production deployments run only from `devcongress/website` itself.
## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
