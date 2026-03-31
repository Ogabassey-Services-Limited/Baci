import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

function resolveTestingLibraryReactPath() {
  // Use the package entry instead of an internal dist path to avoid brittle resolution.
  try {
    return require.resolve('@testing-library/react');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve @testing-library/react ESM entry: ${message}`
    );
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
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: [
      { find: '@', replacement: __dirname },
      {
        find: '@baci/shared',
        replacement: path.resolve(
          __dirname,
          '../../packages/shared/src/index.ts'
        ),
      },
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
    noExternal: [
      '@tanstack/react-query',
      '@testing-library/react',
      'react',
      'react-dom',
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        // Prevent vitest from parsing native packages (Flow/JSX in .js files)
        inline: [
          /@tanstack\/react-query/,
          /@testing-library\/react/,
          /^react$/,
          /^react-dom$/,
        ],
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
