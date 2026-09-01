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
  // Loads src/do11y-otel.js (Do11y + OpenTelemetry Browser SDK) on every page.
  plugins: [require.resolve('./do11y-otel-plugin')],
};
