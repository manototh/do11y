export default {
  title: 'Do11y Test - VitePress',
  head: [
    ['meta', { name: 'do11y-framework', content: 'vitepress' }],
    ['script', {}, `window.Do11yConfig = { destination: 'supabase' }`],

    ['script', { src: '/do11y-config.js' }],
    ['script', { src: './do11y.js' }],
  ],
  themeConfig: {
    sidebar: [
      { text: 'Introduction', link: '/' },
      { text: 'Guide', link: '/guide' },
    ],
    search: {
      provider: 'local'
    }
  },
};
