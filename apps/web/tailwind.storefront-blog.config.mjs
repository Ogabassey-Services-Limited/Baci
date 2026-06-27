// @ts-check

import baseConfig from './tailwind.config.mjs';

/*
 * Blog routes own a narrow Tailwind source graph in storefront-blog.css. Do not
 * inherit the broad storefront content globs; they put product/PDP utilities on
 * the blog render-blocking path.
 */
/** @type {import('tailwindcss').Config} */
const config = {
  ...baseConfig,
  content: [],
};

export default config;
