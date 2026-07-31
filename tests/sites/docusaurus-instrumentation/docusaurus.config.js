/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: 'Do11y Test - Docusaurus',
  url: 'http://localhost:4001',
  baseUrl: '/',
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'ignore',
  presets: [
    ['classic', { docs: { routeBasePath: '/' }, blog: false, theme: {} }],
  ],
};
