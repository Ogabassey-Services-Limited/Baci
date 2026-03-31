import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function resolveTestingLibraryReactPath() {
  try {
    return require.resolve('@testing-library/react');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve @testing-library/react: ${message}`);
  }
}

const testingLibraryReactPath = resolveTestingLibraryReactPath();
const testingLibraryRoot = path.dirname(
  require.resolve('@testing-library/react/package.json')
);
const testingLibraryRequire = createRequire(
  path.join(testingLibraryRoot, 'package.json')
);
const reactPath = testingLibraryRequire.resolve('react');
const reactJsxRuntimePath = testingLibraryRequire.resolve('react/jsx-runtime');
const reactJsxDevRuntimePath = testingLibraryRequire.resolve(
  'react/jsx-dev-runtime'
);
const reactDomPath = testingLibraryRequire.resolve('react-dom');
const reactDomClientPath = testingLibraryRequire.resolve('react-dom/client');
const reactDomTestUtilsPath = testingLibraryRequire.resolve(
  'react-dom/test-utils'
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@testing-library/react', replacement: testingLibraryReactPath },
      { find: /^react$/, replacement: reactPath },
      { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimePath },
      { find: /^react\/jsx-dev-runtime$/, replacement: reactJsxDevRuntimePath },
      { find: /^react-dom$/, replacement: reactDomPath },
      { find: /^react-dom\/client$/, replacement: reactDomClientPath },
      { find: /^react-dom\/test-utils$/, replacement: reactDomTestUtilsPath },
    ],
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    noExternal: ['@testing-library/react', 'react', 'react-dom'],
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
        inline: [/@testing-library\/react/, /^react$/, /^react-dom$/],
      },
    },
  },
});
