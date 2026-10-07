# DevCon26 public test checkout

The `/devcon26/` route uses the public EMS API at `https://em.devcongress.org`.
Buyers do not log in to EMS. The browser never receives a Paystack secret key.
Live ticket sales remain closed; this sandbox does not charge real money,
reserve seats, issue admission tickets, or send ticket emails.

## Configure the EMS sandbox

These settings belong on the **events-management Cloudflare Worker**, not the
website Worker, website environment files, or any `PUBLIC_*` variable.

In Cloudflare, open **Workers & Pages → events-management → Settings → Variables
and Secrets**. Configure the following values and save/deploy the settings:

| Setting | Value | Storage |
| --- | --- | --- |
| `DEVCON26_PAYMENT_PROVIDER` | `paystack` | Text variable |
| `DEVCON26_TEST_BUYER_EMAIL` | An inbox you control for test payments | Secret |
| `PAYSTACK_SECRET_KEY` | The existing Paystack `sk_test_` key | Secret |
| `DEVCON26_TEST_CHECKOUT_ENABLED` | `true`, only after storage is ready | Text variable |

Do not paste a secret key in a PR, commit it, or expose it to the browser. Do not
replace the test key with a live key. Keep `DEVCON26_PAYMENTS_ENABLED=false`.

Apply the EMS database migrations through its approved migration process,
including `20261007050000_devcon26_test_checkout.sql`, before enabling the
sandbox. Merging application source does not apply database migrations.

The read-only availability endpoint is:

```text
GET https://em.devcongress.org/api/public/annual-conference/2026/test-checkout
```

It returns `mode: "test"` with the server-owned GHS ticket catalog only when the
sandbox configuration and isolated test-session storage are ready. It returns
`mode: "unavailable"` when configuration or storage is missing. Initialization
and verification are separate public POST endpoints; status checks create no
payment or checkout session.

## PR and version previews

Use the exact deployed website commit/version URL plus `/devcon26/` to review
the page before merging. Uploading a Worker version for a preview must not move
production traffic; do not use `wrangler deploy` for this purpose.

A preview URL alone does **not** enable end-to-end checkout. EMS currently:

- Allows public API CORS only for explicitly configured origins.
- Requires initialization/verification requests to match its single
  `PUBLIC_WEBSITE_ORIGIN` exactly.
- Builds the Paystack return URL from that same website origin.

Do not repoint the shared production `PUBLIC_WEBSITE_ORIGIN` to a PR preview:
other website links and email flows also depend on it. End-to-end preview tests
need a separately approved, exact-origin sandbox arrangement, such as a
dedicated EMS test deployment or a reviewed test-only origin/callback setting.
Do not use wildcard CORS or production `NODE_ENV=development` as a workaround.

Until that arrangement is ready, a preview can verify the layout, navigation,
single-open FAQs, selected ticket image, mobile bottom drawer, and unavailable
checkout/retry states, but not a successful hosted Paystack round trip.

The website defaults to the production EMS hostname. Its existing CSP permits
connections to that hostname; selecting a different API hostname also requires
an explicit CSP review, not only a `PUBLIC_DEVCON26_API_ORIGIN` override.

## Verification boundaries

The Astro build and focused source/VM checks cover client checkout states,
safe redirect validation, cancellation, navigation, and drawer contracts. They
are not browser-rendering tests or evidence of a successful provider payment.
Use the existing Arc session for any browser verification.

### 2026-10-07: Built-script CSP regression

The checkout and FAQ client must use an Astro-processed `<script>` rather than
`is:inline`. The card buttons start disabled and are enabled by that client;
an unprocessed inline script without an allowed hash is blocked in production.

After building, inspect `dist/devcon26/index.html`: every executable inline
script must have its exact hash in the script CSP, and any external client
module must be a served, same-origin asset. Verify the output includes checkout,
FAQ, and mobile-menu initialization, then confirm card selection in Arc.
Source/VM checks alone do not catch a blocked production script. Keep the CSP
intact; do not add `unsafe-inline` or bypass the sandbox's origin restrictions.
