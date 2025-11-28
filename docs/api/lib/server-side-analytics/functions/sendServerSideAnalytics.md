[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/server-side-analytics](../README.md) / sendServerSideAnalytics

# Function: sendServerSideAnalytics()

> **sendServerSideAnalytics**(`merchantId`, `event`, `userData`, `eventData`, `options?`): `Promise`\<`AnalyticsResult`[]\>

Defined in: src/lib/server-side-analytics.ts:75

Send server-side analytics events to all configured platforms

## Parameters

### merchantId

`string`

The merchant's ID

### event

The event type

`"view_item"` | `"add_to_cart"` | `"begin_checkout"` | `"purchase"`

### userData

[`ServerAnalyticsUserData`](../interfaces/ServerAnalyticsUserData.md)

User identification data

### eventData

[`ServerAnalyticsEventData`](../interfaces/ServerAnalyticsEventData.md)

Event-specific data

### options?

Additional options like event source URL

#### clientId?

`string`

#### eventId?

`string`

#### eventSourceUrl?

`string`

## Returns

`Promise`\<`AnalyticsResult`[]\>
