# DevCon26 attendance counter

The website reads the public 2026 attendance counter from EMS at runtime. EMS calculates the counter from a starting count and net fulfilled live ticket purchases. The website does not calculate or publish a count; it hides the readout when the endpoint returns an unpublished value, an invalid response, or an error.

`PUBLIC_DEVCON26_API_ORIGIN` selects the API origin at build time and defaults to `https://em.devcongress.org`. The production website reads that origin directly. For the website-owned Workers preview URLs using the default API origin, the Worker relays the fixed public counter endpoint because EMS only permits the production website origin. The relay forwards no visitor headers, query parameters, or credentials, and does not cache the response. A custom configured origin is called directly and needs its own CORS and CSP configuration.

Deploy the reader and relay before activating the EMS `ticket_count` source. The reader also accepts the legacy sources during rollout. It refreshes on return to the page, after a verified live purchase in the same page or another same-origin tab, and periodically while visible; bounded retries accommodate delayed confirmation. Cross-origin tabs are picked up by visibility or periodic refresh. Fetch failures hide the counter.
