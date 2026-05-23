/**
 * Do11y configuration example.
 *
 * Copy this file alongside do11y.js in your docs site and rename it to
 * do11y-config.js. Set the values below to match your Supabase setup.
 *
 * This file must load before do11y.js. For frameworks that auto-include
 * all .js files (like Mintlify), alphabetical ordering handles this
 * automatically.
 *
 * Any option from the config object in do11y.js can be set here.
 * See the README for the full list.
 */
window.Do11yConfig = {
  // Destination: 'supabase' (default) or 'http'
  destination: 'supabase',

  // Required: Supabase project URL.
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',

  // Required: Supabase anon (publishable) key.
  supabaseKey: 'YOUR_ANON_KEY',

  // Optional: Table name (default: 'do11y_events').
  supabaseTable: 'do11y_events',

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
