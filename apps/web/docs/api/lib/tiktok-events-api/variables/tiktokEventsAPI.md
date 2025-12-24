[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/tiktok-events-api](../README.md) / tiktokEventsAPI

# Variable: tiktokEventsAPI

> `const` **tiktokEventsAPI**: `object`

Defined in: src/lib/tiktok-events-api.ts:140

Helper functions for common e-commerce events

## Type Declaration

### initiateCheckout()

> **initiateCheckout**: (`pixelId`, `accessToken`, `userData`, `value`, `currency`, `productIds`) => `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`TikTokUserData`](../interfaces/TikTokUserData.md)

##### value

`number`

##### currency

`string`

##### productIds

`string`[]

#### Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

### purchase()

> **purchase**: (`pixelId`, `accessToken`, `userData`, `orderId`, `value`, `currency`, `products`) => `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`TikTokUserData`](../interfaces/TikTokUserData.md)

##### orderId

`string`

##### value

`number`

##### currency

`string`

##### products

`object`[]

#### Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>
