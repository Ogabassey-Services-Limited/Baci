/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidStyles } = require('@expo/config-plugins');

/**
 * Workaround for expo-splash-screen config plugin bug:
 *
 * `withAndroidSplashStyles` always adds a `windowSplashScreenAnimatedIcon`
 * item referencing `@drawable/splashscreen_logo`, but
 * `withAndroidSplashImages` only creates the drawable when an image is
 * configured. When no splash image is set (intentional — we rely on the
 * native splash background color only), the build fails with:
 *   "resource drawable/splashscreen_logo not found"
 *
 * This plugin runs AFTER expo-splash-screen and removes the animated-icon
 * style item so the build succeeds without a splash image.
 */
const withNoSplashImage = (config) => {
  return withAndroidStyles(config, (innerConfig) => {
    const styles = innerConfig.modResults;

    // Find the splash screen theme style
    const splashTheme = styles.resources?.style?.find(
      (s) =>
        s.$.name === 'Theme.App.SplashScreen' ||
        s.$.parent === 'Theme.SplashScreen'
    );

    if (splashTheme?.item) {
      splashTheme.item = splashTheme.item.filter(
        (item) =>
          item.$.name !== 'windowSplashScreenAnimatedIcon' &&
          item.$.name !== 'android:windowSplashScreenBehavior'
      );
    }

    return innerConfig;
  });
};

module.exports = withNoSplashImage;
