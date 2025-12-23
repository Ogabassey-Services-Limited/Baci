[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/twitter-capi](../README.md) / twitterCAPI

# Variable: twitterCAPI

> `const` **twitterCAPI**: `object`

Defined in: src/lib/twitter-capi.ts:137

Helper functions for common e-commerce events

Note: Twitter CAPI has complex OAuth requirements.
For simpler implementation, rely on the client-side pixel
and use CAPI only for high-value conversions like purchases.

## Type Declaration

### purchase()

> **purchase**: (`pixelId`, `oauthToken`, `oauthTokenSecret`, `consumerKey`, `consumerSecret`, `userData`, `orderId`, `value`, `currency`, `productIds`) => `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### pixelId

`string`

##### oauthToken

`string`

##### oauthTokenSecret

`string`

##### consumerKey

`string`

##### consumerSecret

`string`

##### userData

[`TwitterUserData`](../interfaces/TwitterUserData.md)

##### orderId

`string`

##### value

`number`

##### currency

`string`

##### productIds

`string`[]

#### Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>
