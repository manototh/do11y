import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Do11y Test - Starlight',
      head: [
        { tag: 'meta', attrs: { name: 'axiom-do11y-framework', content: 'starlight' } },
        { tag: 'meta', attrs: { name: 'axiom-do11y-debug', content: 'true' } },
        { tag: 'meta', attrs: { name: 'axiom-do11y-domains', content: 'localhost' } },
        { tag: 'script', attrs: { src: '/do11y.js' } },
      ],
      sidebar: [
        { label: 'Introduction', slug: 'index' },
        { label: 'Guide', slug: 'guide' },
      ],
    }),
  ],
});
