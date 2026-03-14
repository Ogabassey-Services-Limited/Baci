module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
        },
      ],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@baci/shared': '../../packages/shared/src',
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
      'react-native-reanimated/plugin',
    ],
    env: {
      test: {
        // Jest doesn't support native import() — transform to require()
        plugins: ['@babel/plugin-transform-dynamic-import'],
      },
    },
  };
};
