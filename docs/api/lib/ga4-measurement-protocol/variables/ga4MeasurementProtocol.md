[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/ga4-measurement-protocol](../README.md) / ga4MeasurementProtocol

# Variable: ga4MeasurementProtocol

> `const` **ga4MeasurementProtocol**: `object`

Defined in: src/lib/ga4-measurement-protocol.ts:160

Helper functions for common e-commerce events

## Type Declaration

### addToCart()

> **addToCart**: (`measurementId`, `apiSecret`, `userData`, `productId`, `productName`, `price`, `quantity`, `currency`) => `Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

Track add to cart event

#### Parameters

##### measurementId

`string`

##### apiSecret

`string`

##### userData

[`GA4UserData`](../interfaces/GA4UserData.md)

##### productId

`string`

##### productName

`string`

##### price

`number`

##### quantity

`number`

##### currency

`string`

#### Returns

`Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

### beginCheckout()

> **beginCheckout**: (`measurementId`, `apiSecret`, `userData`, `value`, `currency`, `products`) => `Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

Track begin checkout event

#### Parameters

##### measurementId

`string`

##### apiSecret

`string`

##### userData

[`GA4UserData`](../interfaces/GA4UserData.md)

##### value

`number`

##### currency

`string`

##### products

`object`[]

#### Returns

`Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

### purchase()

> **purchase**: (`measurementId`, `apiSecret`, `userData`, `transactionId`, `value`, `currency`, `products`) => `Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

Track a purchase event

#### Parameters

##### measurementId

`string`

##### apiSecret

`string`

##### userData

[`GA4UserData`](../interfaces/GA4UserData.md)

##### transactionId

`string`

##### value

`number`

##### currency

`string`

##### products

`object`[]

#### Returns

`Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

### search()

> **search**: (`measurementId`, `apiSecret`, `userData`, `searchTerm`) => `Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

Track search event

#### Parameters

##### measurementId

`string`

##### apiSecret

`string`

##### userData

[`GA4UserData`](../interfaces/GA4UserData.md)

##### searchTerm

`string`

#### Returns

`Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

### viewItem()

> **viewItem**: (`measurementId`, `apiSecret`, `userData`, `productId`, `productName`, `price`, `currency`, `category?`) => `Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

Track view item event

#### Parameters

##### measurementId

`string`

##### apiSecret

`string`

##### userData

[`GA4UserData`](../interfaces/GA4UserData.md)

##### productId

`string`

##### productName

`string`

##### price

`number`

##### currency

`string`

##### category?

`string`

#### Returns

`Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>
