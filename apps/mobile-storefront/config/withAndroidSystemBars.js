const { withAndroidStyles } = require('@expo/config-plugins');
const {
  applyAndroidSystemBarStyles,
} = require('../../../.github/scripts/expoAndroidSystemBars');

function withAndroidSystemBars(config) {
  return withAndroidStyles(config, (innerConfig) => {
    applyAndroidSystemBarStyles(innerConfig.modResults);
    return innerConfig;
  });
}

module.exports = withAndroidSystemBars;
