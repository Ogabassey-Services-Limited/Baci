import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|@supabase/.*|zustand|nativewind)',
  ],
  // setupFiles runs before the jest-expo preset setup (before test code scope)
  setupFiles: ['<rootDir>/__mocks__/expo-winter-setup.js'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Prevent expo winter runtime from loading native-only modules in Jest
    'expo/src/winter/ImportMetaRegistry':
      '<rootDir>/__mocks__/expo-import-meta-registry.js',
    '@ungap/structured-clone': '<rootDir>/__mocks__/structured-clone.js',
  },
};

export default config;
