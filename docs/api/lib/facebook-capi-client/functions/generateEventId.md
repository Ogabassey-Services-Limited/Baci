[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/facebook-capi-client](../README.md) / generateEventId

# Function: generateEventId()

> **generateEventId**(): `string`

Defined in: src/lib/facebook-capi-client.ts:17

Generate a unique event ID for deduplication between
client-side pixel and server-side CAPI events.

When you fire both a client-side pixel event AND a server-side CAPI event
for the same action, use the same event ID for both so Facebook can dedupe them.

## Returns

`string`
