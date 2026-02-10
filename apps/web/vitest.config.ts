import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.join(__dirname, 'vitest.setup.ts')],
    alias: {
      '@/app/onboarding/actions': path.resolve(
        __dirname,
        './src/app/onboarding/__mocks__/actions.ts'
      ),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
