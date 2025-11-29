[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/server-side-analytics](../README.md) / ServerAnalyticsUserData

# Interface: ServerAnalyticsUserData

Defined in: src/lib/server-side-analytics.ts:20

Server-Side Analytics Service

Unified interface for sending events to all server-side analytics platforms.
This should be called from checkout/purchase flows for accurate tracking.

Supported platforms:
- Google Analytics 4 (Measurement Protocol)
- Facebook Conversions API
- TikTok Events API
- Snapchat Conversions API

Benefits of server-side tracking:
- Bypasses ad blockers (captures 100% of events)
- More accurate attribution
- Better privacy compliance
- Reduced client-side JavaScript

## Properties

### city?

> `optional` **city**: `string`

Defined in: src/lib/server-side-analytics.ts:25

***

### country?

> `optional` **country**: `string`

Defined in: src/lib/server-side-analytics.ts:28

***

### email?

> `optional` **email**: `string`

Defined in: src/lib/server-side-analytics.ts:21

***

### externalId?

> `optional` **externalId**: `string`

Defined in: src/lib/server-side-analytics.ts:29

***

### firstName?

> `optional` **firstName**: `string`

Defined in: src/lib/server-side-analytics.ts:23

***

### lastName?

> `optional` **lastName**: `string`

Defined in: src/lib/server-side-analytics.ts:24

***

### phone?

> `optional` **phone**: `string`

Defined in: src/lib/server-side-analytics.ts:22

***

### state?

> `optional` **state**: `string`

Defined in: src/lib/server-side-analytics.ts:26

***

### zipCode?

> `optional` **zipCode**: `string`

Defined in: src/lib/server-side-analytics.ts:27
