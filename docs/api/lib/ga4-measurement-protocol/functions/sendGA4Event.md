[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/ga4-measurement-protocol](../README.md) / sendGA4Event

# Function: sendGA4Event()

> **sendGA4Event**(`measurementId`, `apiSecret`, `eventName`, `userData`, `params?`, `debug?`): `Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>

Defined in: src/lib/ga4-measurement-protocol.ts:82

Send event to GA4 Measurement Protocol

## Parameters

### measurementId

`string`

### apiSecret

`string`

### eventName

`string`

### userData

[`GA4UserData`](../interfaces/GA4UserData.md)

### params?

[`GA4EventParams`](../interfaces/GA4EventParams.md)

### debug?

`boolean` = `false`

## Returns

`Promise`\<\{ `debugInfo?`: `unknown`; `error?`: `string`; `success`: `boolean`; \}\>
