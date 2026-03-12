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
    '^react$': '<rootDir>/node_modules/react',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime.js',
    '^react/jsx-dev-runtime$': '<rootDir>/node_modules/react/jsx-dev-runtime.js',
    '^react-test-renderer$': '<rootDir>/../../node_modules/react-test-renderer',
    // Prevent expo winter runtime from loading native-only modules in Jest
    'expo/src/winter/ImportMetaRegistry':
      '<rootDir>/__mocks__/expo-import-meta-registry.js',
    '@ungap/structured-clone': '<rootDir>/__mocks__/structured-clone.js',
  },
};

module.exports = config;
