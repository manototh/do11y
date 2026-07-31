export default {
  title: 'Do11y Test - VitePress',
  head: [
    ['script', { src: './do11y-config.js' }],
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
