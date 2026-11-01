import { ATTENDANCE_RELAY_PATH } from '../src/lib/devcon26-attendance-counter.ts';
import { serveAttendanceCounter } from '../src/lib/devcon26-attendance-relay.ts';

export function localAttendanceRelay() {
  const configure = (server) => {
    server.middlewares.use(async (request, response, next) => {
      if (request.url?.split('?')[0] !== ATTENDANCE_RELAY_PATH) return next();

      if (request.method !== 'GET') {
        response.writeHead(405, { Allow: 'GET', 'Cache-Control': 'no-store' });
        response.end('Method not allowed');
        return;
      }

      const result = await serveAttendanceCounter();
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    });
  };

  return {
    name: 'local-devcon26-attendance',
    apply: 'serve',
    configureServer: configure,
    configurePreviewServer: configure,
  };
}
