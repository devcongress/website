const localPath = '/__local/cfp/devcon26';
const deployedEndpoint = 'https://em.devcongress.org/api/cfp/conferences/2026';

/** Read-only development middleware. Never forwards cookies, tokens or request bodies. */
export function localCfpProxy() {
  return {
    name: 'local-cfp-settings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== localPath) return next();

        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json');

        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET');
          response.end(JSON.stringify({ error: 'Local speaker preview is read-only.' }));
          return;
        }

        try {
          const upstream = await fetch(deployedEndpoint, {
            headers: { Accept: 'application/json' },
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
          });
          const body = await upstream.json();

          response.statusCode = upstream.status;
          response.end(JSON.stringify(body));
        } catch {
          response.statusCode = 502;
          response.end(JSON.stringify({ error: 'Unable to load deployed speaker settings.' }));
        }
      });
    },
  };
}
