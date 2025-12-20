[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/facebook-capi](../README.md) / sendFacebookCAPIEvent

# Function: sendFacebookCAPIEvent()

> **sendFacebookCAPIEvent**(`pixelId`, `accessToken`, `eventName`, `userData`, `customData?`, `eventSourceUrl?`, `eventId?`): `Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

Defined in: src/lib/facebook-capi.ts:188

Send event to Facebook Conversions API

## Parameters

### pixelId

`string`

### accessToken

`string`

### eventName

[`FacebookEventName`](../type-aliases/FacebookEventName.md)

### userData

[`FacebookUserData`](../interfaces/FacebookUserData.md)

### customData?

[`FacebookCustomData`](../interfaces/FacebookCustomData.md)

### eventSourceUrl?

`string`

### eventId?

`string`

## Returns

`Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>
