[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/server-side-analytics](../README.md) / default

# Variable: default

> **default**: `object`

Defined in: src/lib/server-side-analytics.ts:312

## Type Declaration

### sendServerSideAnalytics()

> **sendServerSideAnalytics**: (`merchantId`, `event`, `userData`, `eventData`, `options?`) => `Promise`\<`AnalyticsResult`[]\>

Send server-side analytics events to all configured platforms

#### Parameters

##### merchantId

`string`

The merchant's ID

##### event

The event type

`"view_item"` | `"add_to_cart"` | `"begin_checkout"` | `"purchase"`

##### userData

[`ServerAnalyticsUserData`](../interfaces/ServerAnalyticsUserData.md)

User identification data

##### eventData

[`ServerAnalyticsEventData`](../interfaces/ServerAnalyticsEventData.md)

Event-specific data

##### options?

Additional options like event source URL

###### clientId?

`string`

###### eventId?

`string`

###### eventSourceUrl?

`string`

#### Returns

`Promise`\<`AnalyticsResult`[]\>

### trackServerSideBeginCheckout()

> **trackServerSideBeginCheckout**: (`merchantId`, `total`, `currency`, `products`, `customer?`, `options?`) => `Promise`\<`AnalyticsResult`[]\>

Convenience function for tracking checkout initiation

#### Parameters

##### merchantId

`string`

##### total

`number`

##### currency

`string`

##### products

[`ServerAnalyticsProduct`](../interfaces/ServerAnalyticsProduct.md)[]

##### customer?

[`ServerAnalyticsUserData`](../interfaces/ServerAnalyticsUserData.md)

##### options?

###### clientId?

`string`

###### eventSourceUrl?

`string`

#### Returns

`Promise`\<`AnalyticsResult`[]\>

### trackServerSidePurchase()

> **trackServerSidePurchase**: (`merchantId`, `orderId`, `total`, `currency`, `products`, `customer`, `options?`) => `Promise`\<`AnalyticsResult`[]\>

Convenience function for tracking purchases

#### Parameters

##### merchantId

`string`

##### orderId

`string`

##### total

`number`

##### currency

`string`

##### products

[`ServerAnalyticsProduct`](../interfaces/ServerAnalyticsProduct.md)[]

##### customer

[`ServerAnalyticsUserData`](../interfaces/ServerAnalyticsUserData.md)

##### options?

###### clientId?

`string`

###### eventSourceUrl?

`string`

#### Returns

`Promise`\<`AnalyticsResult`[]\>
