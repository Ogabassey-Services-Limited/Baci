const shouldEnableWorkletsBundleMode = require('./config/shouldEnableWorkletsBundleMode');

const isNodeModule = (filename) =>
  filename.includes('/node_modules/') || filename.includes('\\node_modules\\');

const isTestOrMockDirectory = (filename) =>
  /[/\\]__(tests|mocks)__[/\\]/.test(filename);

const shouldCompileSource = (filename) =>
  !isNodeModule(filename) &&
  !/\.(test|spec)\.[jt]sx?$/.test(filename) &&
  !/\.test-utils\.[jt]sx?$/.test(filename) &&
  !isTestOrMockDirectory(filename);

module.exports = (api) => {
  const isTest = api.env('test');
  const enableWorkletsBundleMode = shouldEnableWorkletsBundleMode();

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: isTest ? 'react' : 'nativewind',
        },
      ],
      ...(!isTest ? ['nativewind/babel'] : []),
    ],
    plugins: [
      // React Compiler must run before other plugins. target '19' matches the
      // installed React 19 and mirrors apps/mobile-admin, which already enables
      // it on this same Expo / React Native / React 19 stack.
      // `sources` compiles app/source code but SKIPS test files: the compiler
      // injects a useMemoCache (_c) call into every component, which breaks jest
      // mock factories (`jest.mock()` forbids out-of-scope vars like _c) and
      // direct component-function calls in tests. Source is still compiled, so
      // tests continue to exercise the RC-optimized components.
      [
        'babel-plugin-react-compiler',
        {
          target: '19',
          sources: shouldCompileSource,
        },
      ],
      [
        'module-resolver',
        {
          alias: {
            '@': './',
          },
          extensions: [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.android.js',
            '.android.jsx',
            '.android.ts',
            '.android.tsx',
            '.ios.js',
            '.ios.jsx',
            '.ios.ts',
            '.ios.tsx',
          ],
        },
      ],
      // Worklets bundle mode is opt-in while SDK 57 / RN 0.86 / worklets 0.10
      // Android expo-updates bundles can crash at startup from downloaded OTA
      // paths. Keep this disabled for update bundles unless the native loader
      // is patched or an embedded-only build explicitly opts in.
      [
        'react-native-worklets/plugin',
        isTest || !enableWorkletsBundleMode ? {} : { bundleMode: true },
      ],
    ],
    env: {
      test: {
        // Jest doesn't support native import() — transform to require()
        plugins: ['@babel/plugin-transform-dynamic-import'],
      },
    },
  };
};
