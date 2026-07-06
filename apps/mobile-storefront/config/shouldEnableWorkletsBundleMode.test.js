const shouldEnableWorkletsBundleMode = require('./shouldEnableWorkletsBundleMode');

describe('shouldEnableWorkletsBundleMode', () => {
  it('keeps Worklets bundle mode disabled by default for expo-updates safety', () => {
    expect(shouldEnableWorkletsBundleMode({})).toBe(false);
  });

  it('enables Worklets bundle mode only for the explicit embedded-bundle opt-in', () => {
    expect(
      shouldEnableWorkletsBundleMode({
        BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE: '1',
      })
    ).toBe(true);
  });
});
