/**
 * Local Docusaurus plugin that wires Do11y + the OpenTelemetry Browser SDK
 * into this test site.
 *
 * `getClientModules()` adds `src/do11y-otel.js` to the browser bundle, so the
 * OTel SDK and `DocsInstrumentation` are initialized once on every page load.
 *
 * `configureWebpack()` excludes Do11y's `dist/` from Babel. Do11y is installed
 * as a `file:` dependency (a symlink to the repo root), so webpack resolves its
 * built output to a real path OUTSIDE `node_modules` — which escapes Babel's
 * default `exclude: /node_modules/` and gets its ES class syntax transpiled
 * into ES5 helpers. Those helpers cannot subclass the native
 * `InstrumentationBase` that `@opentelemetry/instrumentation` ships
 * (`TypeError: Class constructor InstrumentationBase cannot be invoked
 * without 'new'`). Shipping the pre-built `dist/` as-is avoids that.
 *
 * Version alignment: this site pins `@opentelemetry/browser-sdk@0.3.0`, which
 * targets the 0.221.x `@opentelemetry/api-logs` line
 */
const path = require('path');
const fs = require('fs');

module.exports = function do11yOtelPlugin() {
  return {
    name: 'do11y-otel-plugin',

    getClientModules() {
      return [path.resolve(__dirname, 'src/do11y-otel.js')];
    },

    configureWebpack(config, isServer) {
      // The Babel exclude and OTel alias only matter for the browser bundle;
      // the server bundle never executes the client module.
      if (isServer) {
        return {};
      }

      // Real path of the symlinked @manototh/do11y package — i.e. the repo
      // root's dist/, which is what webpack actually matches rules against.
      const do11yDist = path.join(
        fs.realpathSync(path.resolve(__dirname, 'node_modules/@manototh/do11y')),
        'dist',
      );

      for (const rule of config.module.rules) {
        const loaders = Array.isArray(rule.use)
          ? rule.use
          : rule.use
            ? [rule.use]
            : [];
        const usesBabel = loaders.some((loader) => {
          const name =
            typeof loader === 'string' ? loader : loader && loader.loader;
          return typeof name === 'string' && name.includes('babel-loader');
        });
        if (usesBabel) {
          const excludes = Array.isArray(rule.exclude)
            ? rule.exclude
            : rule.exclude
              ? [rule.exclude]
              : [];
          if (!excludes.includes(do11yDist)) {
            excludes.push(do11yDist);
          }
          rule.exclude = excludes;
        }
      }

      return {};
    },
  };
};
