import type { Config } from 'tailwindcss';
import baseConfig from './tailwind.config';

export default {
  ...baseConfig,
  content: [],
} satisfies Config;
