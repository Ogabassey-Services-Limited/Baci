const { createTikTokBusinessInfoPlistEntries } = require('./index.js');

describe('createTikTokBusinessInfoPlistEntries', () => {
  it('maps TikTok SDK values to private iOS Info.plist keys', () => {
    expect(
      createTikTokBusinessInfoPlistEntries({
        appId: '6472735367',
        appSecret: 'secret',
        autoInitialize: false,
        debugMode: true,
        disablePaymentTracking: false,
        disableSKAdNetworkSupport: true,
        tiktokAppId: '7644050881196883975',
      })
    ).toEqual({
      BaciTikTokBusinessAppId: '6472735367',
      BaciTikTokBusinessAppSecret: 'secret',
      BaciTikTokBusinessAutoInitialize: false,
      BaciTikTokBusinessDebugMode: true,
      BaciTikTokBusinessDisablePaymentTracking: false,
      BaciTikTokBusinessDisableSKAdNetworkSupport: true,
      BaciTikTokBusinessTikTokAppId: '7644050881196883975',
    });
  });

  it('defaults optional booleans to false', () => {
    expect(
      createTikTokBusinessInfoPlistEntries({
        appId: '6757810806',
        appSecret: 'secret',
        tiktokAppId: 'admin-tiktok-app-id',
      })
    ).toMatchObject({
      BaciTikTokBusinessDebugMode: false,
      BaciTikTokBusinessAutoInitialize: true,
      BaciTikTokBusinessDisablePaymentTracking: false,
      BaciTikTokBusinessDisableSKAdNetworkSupport: false,
    });
  });
});
