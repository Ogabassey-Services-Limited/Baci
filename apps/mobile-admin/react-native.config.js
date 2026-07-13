/**
 * React Native configuration for Baci Mobile Admin
 * This file is used to configure autolinking for native modules.
 *
 * react-native-reanimated 4.x doesn't ship with a react-native.config.js,
 * so we need to explicitly add it here to enable autolinking and codegen.
 */
module.exports = {
  dependencies: {
    'react-native-reanimated': {
      root: require('node:path').dirname(
        require.resolve('react-native-reanimated/package.json')
      ),
    },
  },
  // Ensure codegen is generated for Reanimated
  project: {
    ios: {
      sourceDir: './ios',
    },
    android: {
      sourceDir: './android',
    },
  },
};
