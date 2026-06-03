// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://devcongress.org',
  base: '/',
  output: 'static',
  image: {
    domains: [
      'pbs.twimg.com',
      'ca.slack-edge.com',
      'api.navii.dev',
      'avatars.githubusercontent.com',
      'images.squarespace-cdn.com',
      'cdn.prod.website-files.com',
      'www.kweku.tech',
      'meltwater.org',
      'xplorio.com',
      'cdn-assets-cloud.frontify.com',
      'lh3.googleusercontent.com',
    ],
  },
});
