[**nextn**](../../../../../README.md)

***

[nextn](../../../../../README.md) / [lib/shipping/providers/base](../README.md) / ShippingProvider

# Interface: ShippingProvider

Defined in: [src/lib/shipping/providers/base.ts:17](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L17)

## Properties

### code

> `readonly` **code**: [`ShippingProviderCode`](../../../types/type-aliases/ShippingProviderCode.md)

Defined in: [src/lib/shipping/providers/base.ts:19](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L19)

Provider code identifier

***

### displayName

> `readonly` **displayName**: `string`

Defined in: [src/lib/shipping/providers/base.ts:25](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L25)

Display name shown to customers (for GIGL: "GIG Logistics")

***

### name

> `readonly` **name**: `string`

Defined in: [src/lib/shipping/providers/base.ts:22](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L22)

Provider name for internal logging

***

### supportsDomestic

> `readonly` **supportsDomestic**: `boolean`

Defined in: [src/lib/shipping/providers/base.ts:31](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L31)

Whether this provider supports domestic shipping

***

### supportsInternational

> `readonly` **supportsInternational**: `boolean`

Defined in: [src/lib/shipping/providers/base.ts:28](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L28)

Whether this provider supports international shipping

## Methods

### bookShipment()

> **bookShipment**(`request`): `Promise`\<[`ShipmentBookingResult`](../../../types/interfaces/ShipmentBookingResult.md)\>

Defined in: [src/lib/shipping/providers/base.ts:45](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L45)

Book a shipment with the provider

#### Parameters

##### request

[`BookingRequest`](../../../types/interfaces/BookingRequest.md)

Booking request with order details and selected quote

#### Returns

`Promise`\<[`ShipmentBookingResult`](../../../types/interfaces/ShipmentBookingResult.md)\>

Booking result with tracking number

***

### cancelShipment()

> **cancelShipment**(`shipmentId`): `Promise`\<[`CancellationResult`](../../../types/interfaces/CancellationResult.md)\>

Defined in: [src/lib/shipping/providers/base.ts:59](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L59)

Cancel a shipment

#### Parameters

##### shipmentId

`string`

Provider's shipment ID

#### Returns

`Promise`\<[`CancellationResult`](../../../types/interfaces/CancellationResult.md)\>

Cancellation result

***

### getLocations()?

> `optional` **getLocations**(`countryCode`): `Promise`\<[`UnifiedLocation`](../../../types/interfaces/UnifiedLocation.md)[]\>

Defined in: [src/lib/shipping/providers/base.ts:74](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L74)

Get supported locations for this provider
For GIGL: Returns stations/service centers
For Topship: Returns cities from their API

#### Parameters

##### countryCode

`string`

ISO country code (e.g., 'NG')

#### Returns

`Promise`\<[`UnifiedLocation`](../../../types/interfaces/UnifiedLocation.md)[]\>

Array of supported locations

***

### getQuotes()

> **getQuotes**(`request`): `Promise`\<[`ShippingQuote`](../../../types/interfaces/ShippingQuote.md)[]\>

Defined in: [src/lib/shipping/providers/base.ts:38](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L38)

Get shipping quotes for a route

#### Parameters

##### request

[`QuoteRequest`](../../../types/interfaces/QuoteRequest.md)

Quote request with sender, receiver, items

#### Returns

`Promise`\<[`ShippingQuote`](../../../types/interfaces/ShippingQuote.md)[]\>

Array of available shipping quotes

***

### isAvailable()

> **isAvailable**(): `Promise`\<`boolean`\>

Defined in: [src/lib/shipping/providers/base.ts:65](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L65)

Check if provider API is available

#### Returns

`Promise`\<`boolean`\>

true if provider is healthy and responding

***

### trackShipment()

> **trackShipment**(`trackingNumber`): `Promise`\<[`TrackingResult`](../../../types/interfaces/TrackingResult.md)\>

Defined in: [src/lib/shipping/providers/base.ts:52](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L52)

Track a shipment by tracking number

#### Parameters

##### trackingNumber

`string`

The waybill/tracking number

#### Returns

`Promise`\<[`TrackingResult`](../../../types/interfaces/TrackingResult.md)\>

Tracking information with events
