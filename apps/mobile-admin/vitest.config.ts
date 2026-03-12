import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const reactPath = path.resolve(__dirname, 'node_modules/react');
const reactDomPath = path.resolve(__dirname, 'node_modules/react-dom');

function resolveTestingLibraryReactPath() {
  // Vitest needs the ESM bundle here so Vite can dedupe React and React DOM.
  try {
    return require.resolve('@testing-library/react/dist/@testing-library/react.esm.js');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve @testing-library/react ESM entry: ${message}`);
  }
}

const testingLibraryReactPath = resolveTestingLibraryReactPath();

export default defineConfig({
  plugins: [react()],
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      '@': __dirname,
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
