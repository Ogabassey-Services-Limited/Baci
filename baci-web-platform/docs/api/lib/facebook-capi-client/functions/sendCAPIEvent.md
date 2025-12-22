[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/facebook-capi-client](../README.md) / sendCAPIEvent

# Function: sendCAPIEvent()

> **sendCAPIEvent**(`data`): `Promise`\<\{ `eventId?`: `string`; `success`: `boolean`; \}\>

Defined in: src/lib/facebook-capi-client.ts:59

Send a server-side event to Facebook Conversions API via our backend

This should be called for important conversion events like:
- Purchase (most important)
- InitiateCheckout
- AddToCart (optional, for high-value products)

The server will handle hashing user data and communicating with Facebook.

## Parameters

### data

`CAPIEventData`

## Returns

`Promise`\<\{ `eventId?`: `string`; `success`: `boolean`; \}\>
