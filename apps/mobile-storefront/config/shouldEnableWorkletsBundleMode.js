const WORKLETS_BUNDLE_MODE_ENV = 'BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE';

function shouldEnableWorkletsBundleMode(env = process.env) {
  return env[WORKLETS_BUNDLE_MODE_ENV] === '1';
}

module.exports = shouldEnableWorkletsBundleMode;
