import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const reactPath = path.dirname(require.resolve('react/package.json'));
const reactDomPath = path.dirname(require.resolve('react-dom/package.json'));

function resolveTestingLibraryReactPath() {
  try {
    return require.resolve('@testing-library/react');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve @testing-library/react: ${message}`);
  }
}

const testingLibraryReactPath = resolveTestingLibraryReactPath();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@baci/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts'
      ),
      '@testing-library/react': testingLibraryReactPath,
      react: reactPath,
      'react/jsx-runtime': path.resolve(reactPath, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(reactPath, 'jsx-dev-runtime.js'),
      'react-dom': reactDomPath,
      'react-dom/client': path.resolve(reactDomPath, 'client.js'),
      'react-dom/test-utils': path.resolve(reactDomPath, 'test-utils.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    noExternal: ['@testing-library/react'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.join(__dirname, 'vitest.setup.ts')],
    alias: {
      '@/app/onboarding/actions': path.resolve(
        __dirname,
        './src/app/onboarding/__mocks__/actions.ts'
      ),
    },
    server: {
      deps: {
        inline: [/@testing-library\/react/],
      },
    },
  },
});
