/**
 * Do11y configuration example.
 *
 * Copy this file alongside do11y.js in your docs site and rename it to
 * do11y-config.js. Set the values below to match your Axiom setup.
 *
 * This file must load before do11y.js. For frameworks that auto-include
 * all .js files (like Mintlify), alphabetical ordering handles this
 * automatically.
 *
 * Any option from the config object in do11y.js can be set here.
 * See the README for the full list.
 */
window.Do11yConfig = {
  // Required: Axiom ingest endpoint.
  // Use an edge deployment domain for lower latency:
  //   US East 1 (AWS):    'us-east-1.aws.edge.axiom.co'
  //   EU Central 1 (AWS): 'eu-central-1.aws.edge.axiom.co'
  axiomHost: 'AXIOM_DOMAIN',

  // Required: Ingest-only API token scoped to a single dataset.
  axiomToken: 'API_TOKEN',

  // Required: Target Axiom dataset.
  axiomDataset: 'DATASET_NAME',

  // Documentation framework. Supported values:
  // 'mintlify', 'docusaurus', 'nextra', 'gitbook', 'mkdocs-material',
  // 'vitepress', 'custom'
  framework: 'mintlify',

  // Optional: restrict which domains may send data.
  // Set to null to allow any domain.
  // allowedDomains: ['docs.example.com'],
};
