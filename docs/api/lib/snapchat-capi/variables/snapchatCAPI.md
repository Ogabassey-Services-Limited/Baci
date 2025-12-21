[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/snapchat-capi](../README.md) / snapchatCAPI

# Variable: snapchatCAPI

> `const` **snapchatCAPI**: `object`

Defined in: src/lib/snapchat-capi.ts:119

Helper functions for common e-commerce events

## Type Declaration

### addToCart()

> **addToCart**: (`pixelId`, `accessToken`, `userData`, `productId`, `price`, `currency`) => `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`SnapchatUserData`](../interfaces/SnapchatUserData.md)

##### productId

`string`

##### price

`number`

##### currency

`string`

#### Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

### purchase()

> **purchase**: (`pixelId`, `accessToken`, `userData`, `transactionId`, `value`, `currency`, `productIds`) => `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`SnapchatUserData`](../interfaces/SnapchatUserData.md)

##### transactionId

`string`

##### value

`number`

##### currency

`string`

##### productIds

`string`[]

#### Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

### startCheckout()

> **startCheckout**: (`pixelId`, `accessToken`, `userData`, `value`, `currency`, `productIds`) => `Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`SnapchatUserData`](../interfaces/SnapchatUserData.md)

##### value

`number`

##### currency

`string`

##### productIds

`string`[]

#### Returns

`Promise`\<\{ `error?`: `string`; `success`: `boolean`; \}\>
