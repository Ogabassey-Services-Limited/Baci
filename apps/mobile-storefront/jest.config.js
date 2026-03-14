const reactPath = require.resolve('react');
const reactDomPath = require.resolve('react-dom');
const reactJsxRuntimePath = require.resolve('react/jsx-runtime');
const reactJsxDevRuntimePath = require.resolve('react/jsx-dev-runtime');
const reactTestRendererPath = require.resolve('react-test-renderer');

/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|@supabase/.*|zustand|nativewind)',
  ],
  // setupFiles runs before the jest-expo preset setup (before test code scope)
  setupFiles: ['<rootDir>/__mocks__/expo-winter-setup.js'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@baci/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@baci/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^react$': reactPath,
    '^react-dom$': reactDomPath,
    '^react/jsx-runtime$': reactJsxRuntimePath,
    '^react/jsx-dev-runtime$': reactJsxDevRuntimePath,
    '^react-test-renderer$': reactTestRendererPath,
    // Prevent expo winter runtime from loading native-only modules in Jest
    'expo/src/winter/ImportMetaRegistry':
      '<rootDir>/__mocks__/expo-import-meta-registry.js',
    '@ungap/structured-clone': '<rootDir>/__mocks__/structured-clone.js',
  },
};

module.exports = config;
