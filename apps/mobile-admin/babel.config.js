module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Bundle mode (worklets 0.10 stable) loads worklets from the JS bundle
      // instead of duplicating them per runtime — recovers the Hermes/Android
      // memory cost of importing reanimated. No jest gating needed: admin
      // tests run under vitest, which does not read this babel config.
      // strictGlobal deliberately NOT enabled yet — separate change.
      ['react-native-worklets/plugin', { bundleMode: true }],
    ],
  };
};
