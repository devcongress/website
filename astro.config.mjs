// @ts-check
import { defineConfig } from 'astro/config';
import { localCfpProxy } from './scripts/local-cfp-proxy.mjs';

const previewBackend = 'https://devcon26-full-test-events-management.admins-a7d.workers.dev';
const previewConnectSource = process.env.PUBLIC_DEVCON26_COMPLETE_TEST === 'true'
  && process.env.PUBLIC_DEVCON26_API_ORIGIN === previewBackend ? ` ${previewBackend}` : '';

export default defineConfig({
  site: 'https://devcongress.org',
  base: '/',
  output: 'static',
  vite: {
    plugins: [localCfpProxy()],
  },
  markdown: {
    syntaxHighlight: false,
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self' https://em.devcongress.org",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com",
        `connect-src 'self' https://em.devcongress.org https://dvevcongress.goatcounter.com https://gc.zgo.at https://challenges.cloudflare.com${previewConnectSource}`,
        "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com https://pages.inttegro.com",
        "worker-src 'self' blob:",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: ["'self'", 'https://gc.zgo.at', 'https://challenges.cloudflare.com', 'https://js.inttegro.com'],
      },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: 'https://fonts.googleapis.com', kind: 'element' },
          // Inttegro's hosted runtime applies container styles at runtime.
          { resource: "'unsafe-inline'", kind: 'element' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
});
