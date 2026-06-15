// @ts-check

import baseConfig from './tailwind.config.mjs';

/** @type {import('tailwindcss').Config} */
const config = {
  ...baseConfig,
  content: [
    './src/app/(storefront)/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/storefront/**/*.{js,ts,jsx,tsx,mdx}',
    './src/templates/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;
