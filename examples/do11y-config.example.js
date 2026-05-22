/**
 * Do11y configuration example.
 *
 * Copy this file alongside do11y.js in your docs site and rename it to
 * do11y-config.js. Set the values below to match your Tinybird setup.
 *
 * This file must load before do11y.js. For frameworks that auto-include
 * all .js files (like Mintlify), alphabetical ordering handles this
 * automatically.
 *
 * Any option from the config object in do11y.js can be set here.
 * See the README for the full list.
 */
window.Do11yConfig = {
  // Destination: 'tinybird' (default) or 'http'
  destination: 'tinybird',

  // Required: Tinybird API host.
  //   US (default): 'api.tinybird.co'
  //   EU:           'api.eu-central-1.aws.tinybird.co'
  tinybirdHost: 'api.tinybird.co',

  // Required: Tinybird token with DATASOURCE:APPEND scope.
  tinybirdToken: 'YOUR_TINYBIRD_TOKEN',

  // Required: Tinybird datasource name.
  tinybirdDatasource: 'do11y',

  // Documentation framework. Supported values:
  // 'mintlify', 'docusaurus', 'nextra', 'gitbook', 'mkdocs-material',
  // 'vitepress', 'custom'
  framework: 'mintlify',

  // Optional: restrict which domains may send data.
  // Set to null to allow any domain.
  // allowedDomains: ['docs.example.com'],

  // --- Alternative: Generic HTTP destination ---
  // destination: 'http',
  // httpEndpoint: 'https://your-endpoint.com/events',
  // httpHeaders: { 'Authorization': 'Bearer your-token' },
};
