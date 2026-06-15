// @ts-check

import baseConfig from './tailwind.config.mjs';

/*
 * OgaBassey's dedicated homepage owns its Tailwind source graph in
 * storefront-home.css via Tailwind v4 `source(none)` + explicit `@source`
 * directives. Keep the shared storefront theme, dark variant, and plugins from
 * the app config, but do not inherit the broad app/storefront content globs
 * here; those globs put non-home utilities back on the homepage critical CSS
 * path.
 */
/** @type {import('tailwindcss').Config} */
const config = {
  ...baseConfig,
  content: [],
};

export default config;
