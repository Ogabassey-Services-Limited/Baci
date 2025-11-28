[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/shipping](../README.md) / ShippingService

# Class: ShippingService

Defined in: [src/lib/shipping/index.ts:42](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L42)

## Constructors

### Constructor

> **new ShippingService**(): `ShippingService`

Defined in: [src/lib/shipping/index.ts:46](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L46)

#### Returns

`ShippingService`

## Methods

### bookShipment()

> **bookShipment**(`provider`, `request`): `Promise`\<[`ShipmentBookingResult`](../types/interfaces/ShipmentBookingResult.md)\>

Defined in: [src/lib/shipping/index.ts:83](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L83)

Book a shipment with the specified provider

#### Parameters

##### provider

[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md)

##### request

[`BookingRequest`](../types/interfaces/BookingRequest.md)

#### Returns

`Promise`\<[`ShipmentBookingResult`](../types/interfaces/ShipmentBookingResult.md)\>

***

### cancelShipment()

> **cancelShipment**(`provider`, `shipmentId`): `Promise`\<[`CancellationResult`](../types/interfaces/CancellationResult.md)\>

Defined in: [src/lib/shipping/index.ts:151](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L151)

Cancel a shipment

#### Parameters

##### provider

[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md)

##### shipmentId

`string`

#### Returns

`Promise`\<[`CancellationResult`](../types/interfaces/CancellationResult.md)\>

***

### getEnabledProviders()

> **getEnabledProviders**(): [`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md)[]

Defined in: [src/lib/shipping/index.ts:220](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L220)

Get list of enabled providers

#### Returns

[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md)[]

***

### getNigerianLocations()

> **getNigerianLocations**(): `Promise`\<[`UnifiedLocation`](../types/interfaces/UnifiedLocation.md)[]\>

Defined in: [src/lib/shipping/index.ts:172](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L172)

Get Nigerian locations from all providers

#### Returns

`Promise`\<[`UnifiedLocation`](../types/interfaces/UnifiedLocation.md)[]\>

***

### getProviderQuotes()

> **getProviderQuotes**(`provider`, `request`): `Promise`\<[`ShippingQuote`](../types/interfaces/ShippingQuote.md)[]\>

Defined in: [src/lib/shipping/index.ts:65](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L65)

Get quotes from a specific provider

#### Parameters

##### provider

[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md)

##### request

[`QuoteRequest`](../types/interfaces/QuoteRequest.md)

#### Returns

`Promise`\<[`ShippingQuote`](../types/interfaces/ShippingQuote.md)[]\>

***

### getProviderStatus()

> **getProviderStatus**(): `Promise`\<`Record`\<[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md), `boolean`\>\>

Defined in: [src/lib/shipping/index.ts:203](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L203)

Check which providers are available

#### Returns

`Promise`\<`Record`\<[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md), `boolean`\>\>

***

### getQuotes()

> **getQuotes**(`request`): `Promise`\<[`QuoteResponse`](../types/interfaces/QuoteResponse.md)\>

Defined in: [src/lib/shipping/index.ts:58](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L58)

Get aggregated shipping quotes from all enabled providers

#### Parameters

##### request

[`QuoteRequest`](../types/interfaces/QuoteRequest.md)

#### Returns

`Promise`\<[`QuoteResponse`](../types/interfaces/QuoteResponse.md)\>

***

### trackShipment()

> **trackShipment**(`trackingNumber`, `provider?`): `Promise`\<[`TrackingResult`](../types/interfaces/TrackingResult.md)\>

Defined in: [src/lib/shipping/index.ts:115](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/index.ts#L115)

Track a shipment by tracking number
Tries all providers if provider is not specified

#### Parameters

##### trackingNumber

`string`

##### provider?

[`ShippingProviderCode`](../types/type-aliases/ShippingProviderCode.md)

#### Returns

`Promise`\<[`TrackingResult`](../types/interfaces/TrackingResult.md)\>
