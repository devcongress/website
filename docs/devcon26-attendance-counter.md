# DevCon26 attendance counter

The website reads the public 2026 attendance counter from EMS at runtime. An EMS Owner publishes the estimate or actual count from Registration. The website does not calculate or publish a count; it hides the readout when the endpoint returns an unpublished value, an invalid response, or an error.

`PUBLIC_DEVCON26_API_ORIGIN` selects the API origin at build time and defaults to `https://em.devcongress.org`. The production website reads that origin directly. For the website-owned Workers preview URLs using the default API origin, the Worker relays the fixed public counter endpoint because EMS only permits the production website origin. The relay forwards no visitor headers, query parameters, or credentials, and does not cache the response. A custom configured origin is called directly and needs its own CORS and CSP configuration.
