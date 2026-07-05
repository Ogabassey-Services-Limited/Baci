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
      // it on this same Expo SDK 56 / RN 0.85 / React 19 stack.
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
      // Bundle mode (worklets 0.10 stable) loads worklets from the JS bundle
      // instead of duplicating them per runtime — recovers the Hermes/Android
      // memory cost of importing reanimated. Disabled under jest: tests have
      // no worklet runtimes to load bundles into. strictGlobal deliberately
      // NOT enabled yet — separate change, separate risk.
      ['react-native-worklets/plugin', isTest ? {} : { bundleMode: true }],
    ],
    env: {
      test: {
        // Jest doesn't support native import() — transform to require()
        plugins: ['@babel/plugin-transform-dynamic-import'],
      },
    },
  };
};
