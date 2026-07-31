import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Do11y Test - Starlight',
      head: [
        { tag: 'meta', attrs: { name: 'do11y-framework', content: 'starlight' } },
        { tag: 'script', content: `window.Do11yConfig = { destination: 'supabase' };` },
        { tag: 'script', attrs: { src: '/do11y.js' } },
        { tag: 'script', attrs: { src: '/do11y-config.js' } },
      ],
      sidebar: [
        { label: 'Introduction', slug: 'index' },
        { label: 'Guide', slug: 'guide' },
      ],
    }),
  ],
});
