[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/analytics](../README.md) / analytics

# Variable: analytics

> `const` **analytics**: `object`

Defined in: [src/lib/analytics.ts:87](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/analytics.ts#L87)

## Type Declaration

### addPaymentInfo()

> **addPaymentInfo**: (`paymentType`, `currency`, `value`) => `void`

#### Parameters

##### paymentType

`string`

##### currency

`string` = `'USD'`

##### value

`number` = `0`

#### Returns

`void`

### addToCart()

> **addToCart**: (`product`, `quantity`, `currency`, `variant?`) => `void`

#### Parameters

##### product

[`Product`](../../products/interfaces/Product.md)

##### quantity

`number` = `1`

##### currency

`string` = `'USD'`

##### variant?

`string`

#### Returns

`void`

### addToWishlist()

> **addToWishlist**: (`product`, `currency`) => `void`

#### Parameters

##### product

[`Product`](../../products/interfaces/Product.md)

##### currency

`string` = `'USD'`

#### Returns

`void`

### beginCheckout()

> **beginCheckout**: (`products`, `currency`) => `void`

#### Parameters

##### products

`object`[]

##### currency

`string` = `'USD'`

#### Returns

`void`

### generateLead()

> **generateLead**: (`value?`, `currency`) => `void`

#### Parameters

##### value?

`number`

##### currency?

`string` = `'USD'`

#### Returns

`void`

### pageView()

> **pageView**: (`url`, `title?`) => `void`

#### Parameters

##### url

`string`

##### title?

`string`

#### Returns

`void`

### purchase()

> **purchase**: (`orderId`, `products`, `total`, `currency`, `tax?`, `shipping?`) => `void`

#### Parameters

##### orderId

`string`

##### products

`object`[]

##### total

`number`

##### currency

`string` = `'USD'`

##### tax?

`number`

##### shipping?

`number`

#### Returns

`void`

### removeFromCart()

> **removeFromCart**: (`product`, `quantity`, `currency`) => `void`

#### Parameters

##### product

[`Product`](../../products/interfaces/Product.md)

##### quantity

`number` = `1`

##### currency

`string` = `'USD'`

#### Returns

`void`

### search()

> **search**: (`searchTerm`) => `void`

#### Parameters

##### searchTerm

`string`

#### Returns

`void`

### selectItem()

> **selectItem**: (`product`, `listId?`, `listName?`, `index?`) => `void`

#### Parameters

##### product

[`Product`](../../products/interfaces/Product.md)

##### listId?

`string`

##### listName?

`string`

##### index?

`number`

#### Returns

`void`

### signUp()

> **signUp**: (`method?`) => `void`

#### Parameters

##### method?

`string`

#### Returns

`void`

### viewItem()

> **viewItem**: (`product`, `currency`) => `void`

#### Parameters

##### product

[`Product`](../../products/interfaces/Product.md)

##### currency

`string` = `'USD'`

#### Returns

`void`

### viewItemList()

> **viewItemList**: (`listId`, `listName`, `products`, `_currency`) => `void`

#### Parameters

##### listId

`string`

##### listName

`string`

##### products

[`Product`](../../products/interfaces/Product.md)[]

##### \_currency

`string` = `'USD'`

#### Returns

`void`
