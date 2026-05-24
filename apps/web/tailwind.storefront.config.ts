import type { Config } from 'tailwindcss';
import baseConfig from './tailwind.config';

export default {
  ...baseConfig,
  content: [
    './src/app/(storefront)/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/storefront/**/*.{js,ts,jsx,tsx,mdx}',
    './src/templates/**/*.{js,ts,jsx,tsx,mdx}',
  ],
} satisfies Config;
