import { defineConfig } from 'vitepress'

const BASE_URL = 'https://docservable.com'
const PATH = '/'

const SITE_URL = `${BASE_URL}${PATH}`
const OG_IMAGE = `${SITE_URL}og-image.png`

export default defineConfig({
  base: PATH,
  title: "Do11y",
  description: "Documentation observability. Stream behavioral events from your docs site in real time.",
  sitemap: {
    hostname: `${SITE_URL}`,
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${PATH}logo-dark.svg` }],
    ['link', { rel: 'icon', type: 'image/x-icon', href: `${PATH}favicon.ico` }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Do11y' }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],
    ['meta', { name: 'do11y-url', content: 'https://YOUR_PROJECT.supabase.co' }],
    ['meta', { name: 'do11y-key', content: 'YOUR_ANON_KEY' }],
    ['meta', { name: 'do11y-framework', content: 'vitepress' }],
    ['script', { src: 'https://cdn.jsdelivr.net/npm/do11y@latest/dist/do11y.min.js' }],
  ],
  themeConfig: {
    siteTitle: 'Do11y Documentation',
    
    logo: {
      light: '/logo-light.svg',
      dark: '/logo-dark.svg',
    },

    search: {
      provider: 'local',
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction' },
      { text: 'Install', link: '/get-started' },
      { text: 'Analyze', link: '/integration-dashboard' },
      { text: 'Reference', link: '/reference' },
    ],

    sidebar: [
      {
        text: 'Overview',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'What Do11y collects', link: '/introduction#events' },
          { text: 'Privacy', link: '/introduction#privacy' },
          { text: 'Supported frameworks', link: '/introduction#supported-frameworks' },
        ],
      },
      {
        text: 'Install',
        collapsed: false,
        items: [
          { text: 'Get started', link: '/get-started' },
          { text: 'Mintlify', link: '/install/mintlify' },
          { text: 'Docusaurus', link: '/install/docusaurus' },
          { text: 'Nextra', link: '/install/nextra' },
          { text: 'VitePress', link: '/install/vitepress' },
          { text: 'MkDocs Material', link: '/install/mkdocs-material' },
          { text: 'Manual setup', link: '/install/manual' },
        ],
      },
      {
        text: 'Analyze',
        collapsed: false,
        items: [
          { text: 'Analyzing your data', link: '/integration-dashboard' },
          { text: 'Insights', link: '/insights' },
          { text: 'Audit docs with AI agent', link: '/audit' },
          { text: 'Example queries', link: '/queries' },
        ],
      },
      {
        text: 'Configure',
        collapsed: false,
        items: [
          { text: 'Configuration', link: '/configuration' },
          { text: 'Custom selectors', link: '/configuration#custom-selectors' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Events', link: '/reference#events' },
          { text: 'AI traffic detection', link: '/reference#ai-traffic-detection' },
          { text: 'JavaScript API', link: '/reference#javascript-api' },
          { text: 'Known limitations', link: '/reference#known-limitations' },
        ],
      },
      {
        text: 'Development',
        collapsed: false,
        items: [
          { text: 'Tests', link: '/development#tests' },
          { text: 'Create a release', link: '/development#create-a-release' },
        ],
      },
    ],

    editLink: {
      pattern: 'https://github.com/manototh/do11y/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/manototh/do11y' }
    ],

    footer: {
      message: 'Released under the MIT License.',
    },
  }
})
