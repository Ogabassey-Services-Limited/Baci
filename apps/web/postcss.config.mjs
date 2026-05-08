/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 moved the PostCSS plugin out of the main package
    // into `@tailwindcss/postcss`. Loading `tailwindcss` directly here
    // (the v3 entry point) errors out under v4.
    '@tailwindcss/postcss': {},
  },
};

export default config;
