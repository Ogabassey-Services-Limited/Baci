[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [components/analytics/twitter-pixel](../README.md) / twitterEvents

# Variable: twitterEvents

> `const` **twitterEvents**: `object`

Defined in: src/components/analytics/twitter-pixel.tsx:65

Twitter/X E-commerce Event Tracking

Event names follow Twitter's conversion event taxonomy.
Events are only sent if marketing consent is granted.

## Type Declaration

### addToCart()

> **addToCart**: (`productId`, `value`, `currency`) => `void`

Track add to cart

#### Parameters

##### productId

`string`

##### value

`number`

##### currency

`string` = `'USD'`

#### Returns

`void`

### addToWishlist()

> **addToWishlist**: (`productId`, `value?`, `currency`) => `void`

Track add to wishlist

#### Parameters

##### productId

`string`

##### value?

`number`

##### currency?

`string` = `'USD'`

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

> **purchase**: (`orderId`, `value`, `currency`, `productIds`, `numItems?`) => `void`

Track purchase completion

#### Parameters

##### orderId

`string`

##### value

`number`

##### currency

`string` = `'USD'`

##### productIds

`string`[] = `[]`

##### numItems?

`number`

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

### signUp()

> **signUp**: () => `void`

Track sign up / lead

#### Returns

`void`

### viewContent()

> **viewContent**: (`productId`, `value?`, `currency`) => `void`

Track product view

#### Parameters

##### productId

`string`

##### value?

`number`

##### currency?

`string` = `'USD'`

#### Returns

`void`
