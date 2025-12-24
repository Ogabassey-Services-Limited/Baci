[**nextn**](../../../../../README.md)

***

[nextn](../../../../../README.md) / [lib/shipping/providers/base](../README.md) / BaseShippingProvider

# Abstract Class: BaseShippingProvider

Defined in: [src/lib/shipping/providers/base.ts:80](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L80)

Abstract base class with shared functionality

## Extended by

- [`GiglProvider`](../../gigl/classes/GiglProvider.md)
- [`ShiipProvider`](../../shiip/classes/ShiipProvider.md)
- [`TopshipProvider`](../../topship/classes/TopshipProvider.md)

## Implements

- [`ShippingProvider`](../interfaces/ShippingProvider.md)

## Constructors

### Constructor

> **new BaseShippingProvider**(): `BaseShippingProvider`

#### Returns

`BaseShippingProvider`

## Properties

### code

> `abstract` `readonly` **code**: [`ShippingProviderCode`](../../../types/type-aliases/ShippingProviderCode.md)

Defined in: [src/lib/shipping/providers/base.ts:81](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L81)

Provider code identifier

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`code`](../interfaces/ShippingProvider.md#code)

***

### displayName

> `abstract` `readonly` **displayName**: `string`

Defined in: [src/lib/shipping/providers/base.ts:83](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L83)

Display name shown to customers (for GIGL: "GIG Logistics")

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`displayName`](../interfaces/ShippingProvider.md#displayname)

***

### name

> `abstract` `readonly` **name**: `string`

Defined in: [src/lib/shipping/providers/base.ts:82](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L82)

Provider name for internal logging

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`name`](../interfaces/ShippingProvider.md#name)

***

### supportsDomestic

> `abstract` `readonly` **supportsDomestic**: `boolean`

Defined in: [src/lib/shipping/providers/base.ts:85](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L85)

Whether this provider supports domestic shipping

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`supportsDomestic`](../interfaces/ShippingProvider.md#supportsdomestic)

***

### supportsInternational

> `abstract` `readonly` **supportsInternational**: `boolean`

Defined in: [src/lib/shipping/providers/base.ts:84](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L84)

Whether this provider supports international shipping

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`supportsInternational`](../interfaces/ShippingProvider.md#supportsinternational)

## Methods

### bookShipment()

> `abstract` **bookShipment**(`request`): `Promise`\<[`ShipmentBookingResult`](../../../types/interfaces/ShipmentBookingResult.md)\>

Defined in: [src/lib/shipping/providers/base.ts:88](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L88)

Book a shipment with the provider

#### Parameters

##### request

[`BookingRequest`](../../../types/interfaces/BookingRequest.md)

Booking request with order details and selected quote

#### Returns

`Promise`\<[`ShipmentBookingResult`](../../../types/interfaces/ShipmentBookingResult.md)\>

Booking result with tracking number

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`bookShipment`](../interfaces/ShippingProvider.md#bookshipment)

***

### cancelShipment()

> `abstract` **cancelShipment**(`shipmentId`): `Promise`\<[`CancellationResult`](../../../types/interfaces/CancellationResult.md)\>

Defined in: [src/lib/shipping/providers/base.ts:90](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L90)

Cancel a shipment

#### Parameters

##### shipmentId

`string`

Provider's shipment ID

#### Returns

`Promise`\<[`CancellationResult`](../../../types/interfaces/CancellationResult.md)\>

Cancellation result

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`cancelShipment`](../interfaces/ShippingProvider.md#cancelshipment)

***

### generateQuoteId()

> `protected` **generateQuoteId**(): `string`

Defined in: [src/lib/shipping/providers/base.ts:107](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L107)

Generate a unique quote ID

#### Returns

`string`

***

### getQuoteExpiry()

> `protected` **getQuoteExpiry**(`hours`): `Date`

Defined in: [src/lib/shipping/providers/base.ts:114](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L114)

Calculate quote expiry (default: 1 hour)

#### Parameters

##### hours

`number` = `1`

#### Returns

`Date`

***

### getQuotes()

> `abstract` **getQuotes**(`request`): `Promise`\<[`ShippingQuote`](../../../types/interfaces/ShippingQuote.md)[]\>

Defined in: [src/lib/shipping/providers/base.ts:87](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L87)

Get shipping quotes for a route

#### Parameters

##### request

[`QuoteRequest`](../../../types/interfaces/QuoteRequest.md)

Quote request with sender, receiver, items

#### Returns

`Promise`\<[`ShippingQuote`](../../../types/interfaces/ShippingQuote.md)[]\>

Array of available shipping quotes

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`getQuotes`](../interfaces/ShippingProvider.md#getquotes)

***

### isAvailable()

> **isAvailable**(): `Promise`\<`boolean`\>

Defined in: [src/lib/shipping/providers/base.ts:95](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L95)

Default availability check - tries to authenticate

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`isAvailable`](../interfaces/ShippingProvider.md#isavailable)

***

### log()

> `protected` **log**(`level`, `message`, `data?`): `void`

Defined in: [src/lib/shipping/providers/base.ts:121](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L121)

Log provider API calls for debugging

#### Parameters

##### level

`"error"` | `"info"` | `"warn"`

##### message

`string`

##### data?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### safeFetch()

> `protected` **safeFetch**(`url`, `options`): `Promise`\<`Response`\>

Defined in: [src/lib/shipping/providers/base.ts:148](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L148)

Safe fetch wrapper with timeout and error handling

#### Parameters

##### url

`string`

##### options

`RequestInit` & `object` = `{}`

#### Returns

`Promise`\<`Response`\>

***

### trackShipment()

> `abstract` **trackShipment**(`trackingNumber`): `Promise`\<[`TrackingResult`](../../../types/interfaces/TrackingResult.md)\>

Defined in: [src/lib/shipping/providers/base.ts:89](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L89)

Track a shipment by tracking number

#### Parameters

##### trackingNumber

`string`

The waybill/tracking number

#### Returns

`Promise`\<[`TrackingResult`](../../../types/interfaces/TrackingResult.md)\>

Tracking information with events

#### Implementation of

[`ShippingProvider`](../interfaces/ShippingProvider.md).[`trackShipment`](../interfaces/ShippingProvider.md#trackshipment)
