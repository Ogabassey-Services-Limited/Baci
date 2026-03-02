import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  define: {
    __DEV__: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    alias: {
      '@': __dirname,
    },
    server: {
      deps: {
        // Prevent vitest from parsing native packages (Flow/JSX in .js files)
        external: [
          /expo-linear-gradient/,
          /@expo\/vector-icons/,
          /react-native$/,
          /react-native\//,
        ],
      },
    },
  },
});
