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
const sharedPackagePath = path.resolve(
  __dirname,
  '../../packages/shared/src/index.ts'
);
const sharedPackageDirectory = path.resolve(
  __dirname,
  '../../packages/shared/src'
);

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

export default defineConfig({
  plugins: [react()],
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${__dirname}/` },
      { find: /^@baci\/shared$/, replacement: sharedPackagePath },
      {
        find: /^@baci\/shared\/(.*)$/,
        replacement: `${sharedPackageDirectory}/$1`,
      },
      {
        find: /^@testing-library\/react$/,
        replacement: testingLibraryReactPath,
      },
      { find: /^react$/, replacement: reactPath },
      {
        find: /^react\/jsx-runtime$/,
        replacement: path.resolve(reactPath, 'jsx-runtime.js'),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: path.resolve(reactPath, 'jsx-dev-runtime.js'),
      },
      { find: /^react-dom$/, replacement: reactDomPath },
      {
        find: /^react-dom\/client$/,
        replacement: path.resolve(reactDomPath, 'client.js'),
      },
      {
        find: /^react-dom\/test-utils$/,
        replacement: path.resolve(reactDomPath, 'test-utils.js'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    noExternal: ['@testing-library/react'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        // Prevent vitest from parsing native packages (Flow/JSX in .js files)
        inline: [/@testing-library\/react/],
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
