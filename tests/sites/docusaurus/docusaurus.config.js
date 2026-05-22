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
  headTags: [
    { tagName: 'meta', attributes: { name: 'axiom-do11y-framework', content: 'docusaurus' } },
    { tagName: 'meta', attributes: { name: 'axiom-do11y-debug', content: 'true' } },
    { tagName: 'meta', attributes: { name: 'axiom-do11y-domains', content: 'localhost' } },
  ],
  scripts: ['/do11y.js'],
};
