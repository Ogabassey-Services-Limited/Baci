[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/server-side-analytics](../README.md) / trackServerSidePurchase

# Function: trackServerSidePurchase()

> **trackServerSidePurchase**(`merchantId`, `orderId`, `total`, `currency`, `products`, `customer`, `options?`): `Promise`\<`AnalyticsResult`[]\>

Defined in: src/lib/server-side-analytics.ts:265

Convenience function for tracking purchases

## Parameters

### merchantId

`string`

### orderId

`string`

### total

`number`

### currency

`string`

### products

[`ServerAnalyticsProduct`](../interfaces/ServerAnalyticsProduct.md)[]

### customer

[`ServerAnalyticsUserData`](../interfaces/ServerAnalyticsUserData.md)

### options?

#### clientId?

`string`

#### eventSourceUrl?

`string`

## Returns

`Promise`\<`AnalyticsResult`[]\>
