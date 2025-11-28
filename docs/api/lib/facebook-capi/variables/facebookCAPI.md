[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/facebook-capi](../README.md) / facebookCAPI

# Variable: facebookCAPI

> `const` **facebookCAPI**: `object`

Defined in: src/lib/facebook-capi.ts:253

Helper functions for common e-commerce events

## Type Declaration

### addToCart()

> **addToCart**: (`pixelId`, `accessToken`, `userData`, `productId`, `productName`, `value`, `currency`, `eventSourceUrl?`) => `Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

Track add to cart (server-side)

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`FacebookUserData`](../interfaces/FacebookUserData.md)

##### productId

`string`

##### productName

`string`

##### value

`number`

##### currency

`string`

##### eventSourceUrl?

`string`

#### Returns

`Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

### initiateCheckout()

> **initiateCheckout**: (`pixelId`, `accessToken`, `userData`, `value`, `currency`, `products`, `eventSourceUrl?`) => `Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

Track initiate checkout (server-side)

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`FacebookUserData`](../interfaces/FacebookUserData.md)

##### value

`number`

##### currency

`string`

##### products

`object`[]

##### eventSourceUrl?

`string`

#### Returns

`Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

### purchase()

> **purchase**: (`pixelId`, `accessToken`, `userData`, `orderId`, `value`, `currency`, `products`, `eventSourceUrl?`) => `Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

Track a purchase event (server-side)

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`FacebookUserData`](../interfaces/FacebookUserData.md)

##### orderId

`string`

##### value

`number`

##### currency

`string`

##### products

`object`[]

##### eventSourceUrl?

`string`

#### Returns

`Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

### viewContent()

> **viewContent**: (`pixelId`, `accessToken`, `userData`, `productId`, `productName`, `value`, `currency`, `category?`, `eventSourceUrl?`) => `Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>

Track view content (server-side)

#### Parameters

##### pixelId

`string`

##### accessToken

`string`

##### userData

[`FacebookUserData`](../interfaces/FacebookUserData.md)

##### productId

`string`

##### productName

`string`

##### value

`number`

##### currency

`string`

##### category?

`string`

##### eventSourceUrl?

`string`

#### Returns

`Promise`\<\{ `error?`: `string`; `response?`: `CAPIResponse`; `success`: `boolean`; \}\>
