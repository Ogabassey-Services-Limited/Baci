[**nextn**](../../../../../README.md)

***

[nextn](../../../../../README.md) / [lib/shipping/providers/topship](../README.md) / TopshipProvider

# Class: TopshipProvider

Defined in: [src/lib/shipping/providers/topship.ts:127](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L127)

Abstract base class with shared functionality

## Extends

- [`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md)

## Constructors

### Constructor

> **new TopshipProvider**(): `TopshipProvider`

#### Returns

`TopshipProvider`

#### Inherited from

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`constructor`](../../base/classes/BaseShippingProvider.md#constructor)

## Properties

### code

> `readonly` **code**: `"TOPSHIP"`

Defined in: [src/lib/shipping/providers/topship.ts:128](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L128)

Provider code identifier

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`code`](../../base/classes/BaseShippingProvider.md#code)

***

### displayName

> `readonly` **displayName**: `"Topship"` = `'Topship'`

Defined in: [src/lib/shipping/providers/topship.ts:130](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L130)

Display name shown to customers (for GIGL: "GIG Logistics")

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`displayName`](../../base/classes/BaseShippingProvider.md#displayname)

***

### name

> `readonly` **name**: `"Topship"` = `'Topship'`

Defined in: [src/lib/shipping/providers/topship.ts:129](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L129)

Provider name for internal logging

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`name`](../../base/classes/BaseShippingProvider.md#name)

***

### supportsDomestic

> `readonly` **supportsDomestic**: `true` = `true`

Defined in: [src/lib/shipping/providers/topship.ts:132](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L132)

Whether this provider supports domestic shipping

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`supportsDomestic`](../../base/classes/BaseShippingProvider.md#supportsdomestic)

***

### supportsInternational

> `readonly` **supportsInternational**: `true` = `true`

Defined in: [src/lib/shipping/providers/topship.ts:131](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L131)

Whether this provider supports international shipping

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`supportsInternational`](../../base/classes/BaseShippingProvider.md#supportsinternational)

## Methods

### bookShipment()

> **bookShipment**(`request`): `Promise`\<[`ShipmentBookingResult`](../../../types/interfaces/ShipmentBookingResult.md)\>

Defined in: [src/lib/shipping/providers/topship.ts:392](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L392)

Book a shipment with the provider

#### Parameters

##### request

[`BookingRequest`](../../../types/interfaces/BookingRequest.md)

Booking request with order details and selected quote

#### Returns

`Promise`\<[`ShipmentBookingResult`](../../../types/interfaces/ShipmentBookingResult.md)\>

Booking result with tracking number

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`bookShipment`](../../base/classes/BaseShippingProvider.md#bookshipment)

***

### cancelShipment()

> **cancelShipment**(`shipmentId`): `Promise`\<[`CancellationResult`](../../../types/interfaces/CancellationResult.md)\>

Defined in: [src/lib/shipping/providers/topship.ts:531](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L531)

Cancel a shipment

#### Parameters

##### shipmentId

`string`

Provider's shipment ID

#### Returns

`Promise`\<[`CancellationResult`](../../../types/interfaces/CancellationResult.md)\>

Cancellation result

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`cancelShipment`](../../base/classes/BaseShippingProvider.md#cancelshipment)

***

### generateQuoteId()

> `protected` **generateQuoteId**(): `string`

Defined in: [src/lib/shipping/providers/base.ts:107](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L107)

Generate a unique quote ID

#### Returns

`string`

#### Inherited from

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`generateQuoteId`](../../base/classes/BaseShippingProvider.md#generatequoteid)

***

### getCities()

> **getCities**(`stateCode`): `Promise`\<`TopshipCity`[]\>

Defined in: [src/lib/shipping/providers/topship.ts:189](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L189)

#### Parameters

##### stateCode

`string`

#### Returns

`Promise`\<`TopshipCity`[]\>

***

### getLocations()

> **getLocations**(`countryCode`): `Promise`\<[`UnifiedLocation`](../../../types/interfaces/UnifiedLocation.md)[]\>

Defined in: [src/lib/shipping/providers/topship.ts:144](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L144)

#### Parameters

##### countryCode

`string` = `'NG'`

#### Returns

`Promise`\<[`UnifiedLocation`](../../../types/interfaces/UnifiedLocation.md)[]\>

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

#### Inherited from

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`getQuoteExpiry`](../../base/classes/BaseShippingProvider.md#getquoteexpiry)

***

### getQuotes()

> **getQuotes**(`request`): `Promise`\<[`ShippingQuote`](../../../types/interfaces/ShippingQuote.md)[]\>

Defined in: [src/lib/shipping/providers/topship.ts:293](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L293)

Get shipping quotes for a route

#### Parameters

##### request

[`QuoteRequest`](../../../types/interfaces/QuoteRequest.md)

Quote request with sender, receiver, items

#### Returns

`Promise`\<[`ShippingQuote`](../../../types/interfaces/ShippingQuote.md)[]\>

Array of available shipping quotes

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`getQuotes`](../../base/classes/BaseShippingProvider.md#getquotes)

***

### getStates()

> **getStates**(`countryCode`): `Promise`\<`TopshipState`[]\>

Defined in: [src/lib/shipping/providers/topship.ts:161](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L161)

#### Parameters

##### countryCode

`string` = `'NG'`

#### Returns

`Promise`\<`TopshipState`[]\>

***

### isAvailable()

> **isAvailable**(): `Promise`\<`boolean`\>

Defined in: [src/lib/shipping/providers/topship.ts:560](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L560)

Default availability check - tries to authenticate

#### Returns

`Promise`\<`boolean`\>

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`isAvailable`](../../base/classes/BaseShippingProvider.md#isavailable)

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

#### Inherited from

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`log`](../../base/classes/BaseShippingProvider.md#log)

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

#### Inherited from

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`safeFetch`](../../base/classes/BaseShippingProvider.md#safefetch)

***

### trackShipment()

> **trackShipment**(`trackingNumber`): `Promise`\<[`TrackingResult`](../../../types/interfaces/TrackingResult.md)\>

Defined in: [src/lib/shipping/providers/topship.ts:483](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/topship.ts#L483)

Track a shipment by tracking number

#### Parameters

##### trackingNumber

`string`

The waybill/tracking number

#### Returns

`Promise`\<[`TrackingResult`](../../../types/interfaces/TrackingResult.md)\>

Tracking information with events

#### Overrides

[`BaseShippingProvider`](../../base/classes/BaseShippingProvider.md).[`trackShipment`](../../base/classes/BaseShippingProvider.md#trackshipment)
