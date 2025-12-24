[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/tiktok-events-api](../README.md) / sendTikTokEvent

# Function: sendTikTokEvent()

> **sendTikTokEvent**(`pixelId`, `accessToken`, `eventName`, `userData`, `properties?`, `eventId?`, `testEventCode?`): `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

Defined in: src/lib/tiktok-events-api.ts:63

Send event to TikTok Events API

## Parameters

### pixelId

`string`

### accessToken

`string`

### eventName

[`TikTokEventName`](../type-aliases/TikTokEventName.md)

### userData

[`TikTokUserData`](../interfaces/TikTokUserData.md)

### properties?

[`TikTokEventProperties`](../interfaces/TikTokEventProperties.md)

### eventId?

`string`

### testEventCode?

`string`

## Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>
