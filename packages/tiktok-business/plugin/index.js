const { withInfoPlist } = require('expo/config-plugins');

const INFO_PLIST_KEYS = {
  appId: 'BaciTikTokBusinessAppId',
  appSecret: 'BaciTikTokBusinessAppSecret',
  debugMode: 'BaciTikTokBusinessDebugMode',
  disablePaymentTracking: 'BaciTikTokBusinessDisablePaymentTracking',
  disableSKAdNetworkSupport: 'BaciTikTokBusinessDisableSKAdNetworkSupport',
  tiktokAppId: 'BaciTikTokBusinessTikTokAppId',
};

function createTikTokBusinessInfoPlistEntries(ios) {
  return {
    [INFO_PLIST_KEYS.appId]: ios.appId,
    [INFO_PLIST_KEYS.tiktokAppId]: ios.tiktokAppId,
    [INFO_PLIST_KEYS.appSecret]: ios.appSecret,
    [INFO_PLIST_KEYS.debugMode]: Boolean(ios.debugMode),
    [INFO_PLIST_KEYS.disablePaymentTracking]: Boolean(
      ios.disablePaymentTracking
    ),
    [INFO_PLIST_KEYS.disableSKAdNetworkSupport]: Boolean(
      ios.disableSKAdNetworkSupport
    ),
  };
}

const withBaciTikTokBusiness = (config, { ios } = {}) => {
  if (!ios) {
    return config;
  }

  return withInfoPlist(config, (nextConfig) => {
    Object.assign(
      nextConfig.modResults,
      createTikTokBusinessInfoPlistEntries(ios)
    );
    return nextConfig;
  });
};

module.exports = withBaciTikTokBusiness;
module.exports.createTikTokBusinessInfoPlistEntries =
  createTikTokBusinessInfoPlistEntries;
