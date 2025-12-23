[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [components/analytics/snapchat-pixel](../README.md) / snapchatEvents

# Variable: snapchatEvents

> `const` **snapchatEvents**: `object`

Defined in: src/components/analytics/snapchat-pixel.tsx:68

Snapchat E-commerce Event Tracking

## Type Declaration

### addToCart()

> **addToCart**: (`productId`, `price`, `currency`) => `void`

Track add to cart

#### Parameters

##### productId

`string`

##### price

`number`

##### currency

`string` = `'USD'`

#### Returns

`void`

### purchase()

> **purchase**: (`orderId`, `value`, `currency`, `productIds`) => `void`

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

### setUserData()

> **setUserData**: (`pixelId`, `email?`, `phone?`) => `void`

Set user data for advanced matching
Note: User data should be set during pixel initialization.
This is called automatically if you pass user data to the PAGE_VIEW event.

#### Parameters

##### pixelId

`string`

##### email?

`string`

##### phone?

`string`

#### Returns

`void`

### signUp()

> **signUp**: () => `void`

Track sign up

#### Returns

`void`

### startCheckout()

> **startCheckout**: (`value`, `currency`, `productIds`) => `void`

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

### viewContent()

> **viewContent**: (`productId`, `price`, `currency`) => `void`

Track product view

#### Parameters

##### productId

`string`

##### price

`number`

##### currency

`string` = `'USD'`

#### Returns

`void`
