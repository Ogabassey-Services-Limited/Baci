[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [components/analytics/tiktok-pixel](../README.md) / tiktokEvents

# Variable: tiktokEvents

> `const` **tiktokEvents**: `object`

Defined in: src/components/analytics/tiktok-pixel.tsx:65

TikTok E-commerce Event Tracking

Call these functions to track e-commerce events.
Events are only sent if marketing consent is granted.

## Type Declaration

### addToCart()

> **addToCart**: (`productId`, `productName`, `price`, `quantity`, `currency`) => `void`

Track add to cart

#### Parameters

##### productId

`string`

##### productName

`string`

##### price

`number`

##### quantity

`number` = `1`

##### currency

`string` = `'USD'`

#### Returns

`void`

### identify()

> **identify**: (`email?`, `phone?`, `externalId?`) => `void`

Identify user with hashed data for advanced matching

#### Parameters

##### email?

`string`

##### phone?

`string`

##### externalId?

`string`

#### Returns

`void`

### initiateCheckout()

> **initiateCheckout**: (`value`, `currency`, `productIds`) => `void`

Track checkout initiation

#### Parameters

##### value

`number`

##### currency

`string` = `'USD'`

##### productIds

`string`[] = `[]`

#### Returns

`void`

### purchase()

> **purchase**: (`orderId`, `value`, `currency`, `products`) => `void`

Track purchase completion

#### Parameters

##### orderId

`string`

##### value

`number`

##### currency

`string` = `'USD'`

##### products

`object`[]

#### Returns

`void`

### search()

> **search**: (`searchTerm`) => `void`

Track search

#### Parameters

##### searchTerm

`string`

#### Returns

`void`

### viewContent()

> **viewContent**: (`productId`, `productName`, `price`, `currency`) => `void`

Track product view

#### Parameters

##### productId

`string`

##### productName

`string`

##### price

`number`

##### currency

`string` = `'USD'`

#### Returns

`void`
