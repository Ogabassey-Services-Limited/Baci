[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/snapchat-capi](../README.md) / sendSnapchatEvent

# Function: sendSnapchatEvent()

> **sendSnapchatEvent**(`pixelId`, `accessToken`, `eventName`, `userData`, `eventData?`, `eventId?`): `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

Defined in: src/lib/snapchat-capi.ts:55

Send event to Snapchat Conversions API

## Parameters

### pixelId

`string`

### accessToken

`string`

### eventName

[`SnapchatEventName`](../type-aliases/SnapchatEventName.md)

### userData

[`SnapchatUserData`](../interfaces/SnapchatUserData.md)

### eventData?

[`SnapchatEventData`](../interfaces/SnapchatEventData.md)

### eventId?

`string`

## Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>
