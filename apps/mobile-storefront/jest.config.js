const reactPath = require.resolve('react');
const reactDomPath = require.resolve('react-dom');
const reactJsxRuntimePath = require.resolve('react/jsx-runtime');
const reactJsxDevRuntimePath = require.resolve('react/jsx-dev-runtime');
const reactTestRendererPath = require.resolve('react-test-renderer');
// jest-expo's browser export condition resolves uuid to its untransformed
// esm-browser build; pin it to the CJS entry Node resolves.
const uuidPath = require.resolve('uuid');

/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '\\.test-utils\\.(t|j)sx?$'],
  // React Native native-module mocks can leave idle handles after every suite
  // has passed; exit explicitly so the run terminates instead of hanging on
  // teardown. This must apply everywhere (CI *and* the local lefthook pre-push
  // gate) — gating it on CI alone made `pnpm turbo test` hang indefinitely
  // locally, blocking every push and spawning zombie `jest --runInBand`
  // processes. The handles are idle and only surface once suites are green, so
  // forcing exit is always safe here.
  forceExit: true,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-vector-icons/.*)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|@supabase/.*|react-native-worklets|zustand|nativewind)',
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
    '^uuid$': uuidPath,
    // Prevent expo winter runtime from loading native-only modules in Jest
    'expo/src/winter/ImportMetaRegistry':
      '<rootDir>/__mocks__/expo-import-meta-registry.js',
    '@ungap/structured-clone': '<rootDir>/__mocks__/structured-clone.js',
    '^nativewind/jsx-dev-runtime$':
      '<rootDir>/__mocks__/react-native-css-interop.js',
    '^nativewind/jsx-runtime$':
      '<rootDir>/__mocks__/react-native-css-interop.js',
    '^react-native-css-interop/jsx-dev-runtime$':
      '<rootDir>/__mocks__/react-native-css-interop.js',
    '^react-native-css-interop/jsx-runtime$':
      '<rootDir>/__mocks__/react-native-css-interop.js',
    '^react-native-css-interop(?:/.*)?$':
      '<rootDir>/__mocks__/react-native-css-interop.js',
  },
};

module.exports = config;
