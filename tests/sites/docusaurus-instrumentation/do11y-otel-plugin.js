/**
 * Local Docusaurus plugin that wires Do11y + the OpenTelemetry Browser SDK
 * into this test site.
 *
 * `getClientModules()` adds `src/do11y-otel.js` to the browser bundle, so the
 * OTel SDK and `DocsInstrumentation` are initialized once on every page load.
 *
 * `configureWebpack()` does two things:
 *
 * 1. Excludes Do11y's `dist/` from Babel. Do11y is installed as a `file:`
 *    dependency (a symlink to the repo root), so webpack resolves its built
 *    output to a real path OUTSIDE `node_modules` — which escapes Babel's
 *    default `exclude: /node_modules/` and gets its ES class syntax transpiled
 *    into ES5 helpers. Those helpers cannot subclass the native
 *    `InstrumentationBase` that `@opentelemetry/instrumentation` ships
 *    (`TypeError: Class constructor InstrumentationBase cannot be invoked
 *    without 'new'`). Shipping the pre-built `dist/` as-is avoids that.
 *
 * 2. Pins `@opentelemetry/api-logs` and `@opentelemetry/instrumentation` to
 *    THIS site's copies. Without the alias, webpack would resolve those two
 *    imports against the repo root's node_modules (the 0.221.x line) while the
 *    Browser SDK resolves its own (the 0.220.x line) — two `api-logs` copies,
 *    which is the classic OpenTelemetry version negotiation trap where log
 *    records get silently dropped. Aliasing them to a single 0.220.x copy (the
 *    line `@opentelemetry/browser-sdk@0.1.0` targets) keeps everything on one
 *    version.
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

      return {
        resolve: {
          alias: {
            '@opentelemetry/api-logs': path.resolve(
              __dirname,
              'node_modules/@opentelemetry/api-logs',
            ),
            '@opentelemetry/instrumentation': path.resolve(
              __dirname,
              'node_modules/@opentelemetry/instrumentation',
            ),
          },
        },
      };
    },
  };
};
