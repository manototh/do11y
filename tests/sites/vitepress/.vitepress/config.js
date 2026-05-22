export default {
  title: 'Do11y Test - VitePress',
  head: [
    ['meta', { name: 'axiom-do11y-framework', content: 'vitepress' }],
    ['meta', { name: 'axiom-do11y-debug', content: 'true' }],
    ['meta', { name: 'axiom-do11y-domains', content: 'localhost' }],
    ['script', { src: '/do11y.js' }],
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
