[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/event-tracking](../README.md) / trackEvent

# Variable: trackEvent

> `const` **trackEvent**: `object`

Defined in: src/lib/event-tracking.ts:114

Track events - stores in Supabase AND sends to GA4/Facebook

## Type Declaration

### addToCart()

> **addToCart**: (`merchantId`, `product`, `quantity`, `currency`) => `void`

Track add to cart

#### Parameters

##### merchantId

`string`

##### product

[`Product`](../../products/interfaces/Product.md)

##### quantity

`number` = `1`

##### currency

`string` = `'USD'`

#### Returns

`void`

### addToWishlist()

> **addToWishlist**: (`merchantId`, `product`, `currency`) => `void`

Track add to wishlist

#### Parameters

##### merchantId

`string`

##### product

[`Product`](../../products/interfaces/Product.md)

##### currency

`string` = `'USD'`

#### Returns

`void`

### beginCheckout()

> **beginCheckout**: (`merchantId`, `products`, `currency`) => `void`

Track checkout started

#### Parameters

##### merchantId

`string`

##### products

`object`[]

##### currency

`string` = `'USD'`

#### Returns

`void`

### pageView()

> **pageView**: (`merchantId`, `pageUrl`, `pageTitle?`) => `void`

Track page view

#### Parameters

##### merchantId

`string`

##### pageUrl

`string`

##### pageTitle?

`string`

#### Returns

`void`

### productView()

> **productView**: (`merchantId`, `product`, `currency`) => `void`

Track product view

#### Parameters

##### merchantId

`string`

##### product

[`Product`](../../products/interfaces/Product.md)

##### currency

`string` = `'USD'`

#### Returns

`void`

### purchase()

> **purchase**: (`merchantId`, `orderId`, `products`, `total`, `currency`, `shipping?`, `tax?`) => `void`

Track purchase complete

#### Parameters

##### merchantId

`string`

##### orderId

`string`

##### products

`object`[]

##### total

`number`

##### currency

`string` = `'USD'`

##### shipping?

`number`

##### tax?

`number`

#### Returns

`void`

### removeFromCart()

> **removeFromCart**: (`merchantId`, `product`, `quantity`, `currency`) => `void`

Track remove from cart

#### Parameters

##### merchantId

`string`

##### product

[`Product`](../../products/interfaces/Product.md)

##### quantity

`number` = `1`

##### currency

`string` = `'USD'`

#### Returns

`void`

### search()

> **search**: (`merchantId`, `searchTerm`, `resultsCount?`) => `void`

Track search

#### Parameters

##### merchantId

`string`

##### searchTerm

`string`

##### resultsCount?

`number`

#### Returns

`void`
