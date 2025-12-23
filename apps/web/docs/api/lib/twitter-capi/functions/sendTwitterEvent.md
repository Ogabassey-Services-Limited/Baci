[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/twitter-capi](../README.md) / sendTwitterEvent

# Function: sendTwitterEvent()

> **sendTwitterEvent**(`pixelId`, `oauthToken`, `oauthTokenSecret`, `consumerKey`, `consumerSecret`, `eventName`, `userData`, `eventData?`, `eventId?`): `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

Defined in: src/lib/twitter-capi.ts:60

Send event to Twitter Conversions API

Note: Twitter CAPI requires OAuth 1.0a authentication.
You'll need to set up Twitter Ads API access.

## Parameters

### pixelId

`string`

### oauthToken

`string`

### oauthTokenSecret

`string`

### consumerKey

`string`

### consumerSecret

`string`

### eventName

[`TwitterEventName`](../type-aliases/TwitterEventName.md)

### userData

[`TwitterUserData`](../interfaces/TwitterUserData.md)

### eventData?

[`TwitterEventData`](../interfaces/TwitterEventData.md)

### eventId?

`string`

## Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>
