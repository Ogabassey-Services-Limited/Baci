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
