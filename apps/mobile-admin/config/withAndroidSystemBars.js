const { withAndroidStyles } = require('@expo/config-plugins');
const { applyAndroidSystemBarStyles } = require('./androidSystemBars');

function withAndroidSystemBars(config) {
  return withAndroidStyles(config, (innerConfig) => {
    applyAndroidSystemBarStyles(innerConfig.modResults);
    return innerConfig;
  });
}

module.exports = withAndroidSystemBars;
