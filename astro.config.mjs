// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://devcongress.org',
  base: '/',
  output: 'static',
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
        "connect-src 'self' https://em.devcongress.org https://dvevcongress.goatcounter.com https://gc.zgo.at https://challenges.cloudflare.com",
        "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: ["'self'", 'https://gc.zgo.at', 'https://challenges.cloudflare.com'],
      },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: 'https://fonts.googleapis.com', kind: 'element' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
    },
  },
});
