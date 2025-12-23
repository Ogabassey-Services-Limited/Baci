[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/facebook-capi-client](../README.md) / trackPurchaseWithCAPI

# Function: trackPurchaseWithCAPI()

> **trackPurchaseWithCAPI**(`merchantId`, `orderId`, `products`, `total`, `currency`, `userData`): `Promise`\<`string`\>

Defined in: src/lib/facebook-capi-client.ts:90

Convenience function for purchase events
Sends to both client-side pixel (via analytics.purchase) and server-side CAPI

## Parameters

### merchantId

`string`

### orderId

`string`

### products

`object`[]

### total

`number`

### currency

`string`

### userData

#### city?

`string`

#### country?

`string`

#### email?

`string`

#### externalId?

`string`

#### firstName?

`string`

#### lastName?

`string`

#### phone?

`string`

#### state?

`string`

#### zipCode?

`string`

## Returns

`Promise`\<`string`\>
