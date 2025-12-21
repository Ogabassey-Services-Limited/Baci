[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [lib/shipping/aggregator](../README.md) / QuoteAggregator

# Class: QuoteAggregator

Defined in: [src/lib/shipping/aggregator.ts:149](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/aggregator.ts#L149)

## Constructors

### Constructor

> **new QuoteAggregator**(`registry`): `QuoteAggregator`

Defined in: [src/lib/shipping/aggregator.ts:150](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/aggregator.ts#L150)

#### Parameters

##### registry

[`ShippingProviderRegistry`](../../providers/base/classes/ShippingProviderRegistry.md)

#### Returns

`QuoteAggregator`

## Methods

### getQuotes()

> **getQuotes**(`request`): `Promise`\<[`QuoteResponse`](../../types/interfaces/QuoteResponse.md)\>

Defined in: [src/lib/shipping/aggregator.ts:155](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/aggregator.ts#L155)

Get aggregated quotes from all enabled providers

#### Parameters

##### request

[`QuoteRequest`](../../types/interfaces/QuoteRequest.md)

#### Returns

`Promise`\<[`QuoteResponse`](../../types/interfaces/QuoteResponse.md)\>
