import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Do11y Test - Starlight',
      head: [
        { tag: 'script', attrs: { src: '/do11y-config.js' } },
        { tag: 'script', attrs: { src: '/do11y.js' } },
      ],
      sidebar: [
        { label: 'Introduction', slug: 'index' },
        { label: 'Guide', slug: 'guide' },
      ],
    }),
  ],
});
