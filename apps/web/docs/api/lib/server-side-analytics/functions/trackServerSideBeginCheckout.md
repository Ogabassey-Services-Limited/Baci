[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/server-side-analytics](../README.md) / trackServerSideBeginCheckout

# Function: trackServerSideBeginCheckout()

> **trackServerSideBeginCheckout**(`merchantId`, `total`, `currency`, `products`, `customer?`, `options?`): `Promise`\<`AnalyticsResult`[]\>

Defined in: src/lib/server-side-analytics.ts:291

Convenience function for tracking checkout initiation

## Parameters

### merchantId

`string`

### total

`number`

### currency

`string`

### products

[`ServerAnalyticsProduct`](../interfaces/ServerAnalyticsProduct.md)[]

### customer?

[`ServerAnalyticsUserData`](../interfaces/ServerAnalyticsUserData.md)

### options?

#### clientId?

`string`

#### eventSourceUrl?

`string`

## Returns

`Promise`\<`AnalyticsResult`[]\>
