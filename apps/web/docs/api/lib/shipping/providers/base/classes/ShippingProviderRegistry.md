[**nextn**](../../../../../README.md)

***

[nextn](../../../../../README.md) / [lib/shipping/providers/base](../README.md) / ShippingProviderRegistry

# Class: ShippingProviderRegistry

Defined in: [src/lib/shipping/providers/base.ts:177](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L177)

Provider registry for managing multiple providers

## Constructors

### Constructor

> **new ShippingProviderRegistry**(): `ShippingProviderRegistry`

#### Returns

`ShippingProviderRegistry`

## Methods

### get()

> **get**(`code`): [`ShippingProvider`](../interfaces/ShippingProvider.md) \| `undefined`

Defined in: [src/lib/shipping/providers/base.ts:184](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L184)

#### Parameters

##### code

[`ShippingProviderCode`](../../../types/type-aliases/ShippingProviderCode.md)

#### Returns

[`ShippingProvider`](../interfaces/ShippingProvider.md) \| `undefined`

***

### getAll()

> **getAll**(): [`ShippingProvider`](../interfaces/ShippingProvider.md)[]

Defined in: [src/lib/shipping/providers/base.ts:188](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L188)

#### Returns

[`ShippingProvider`](../interfaces/ShippingProvider.md)[]

***

### getDomestic()

> **getDomestic**(): [`ShippingProvider`](../interfaces/ShippingProvider.md)[]

Defined in: [src/lib/shipping/providers/base.ts:197](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L197)

#### Returns

[`ShippingProvider`](../interfaces/ShippingProvider.md)[]

***

### getEnabled()

> **getEnabled**(): [`ShippingProvider`](../interfaces/ShippingProvider.md)[]

Defined in: [src/lib/shipping/providers/base.ts:192](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L192)

#### Returns

[`ShippingProvider`](../interfaces/ShippingProvider.md)[]

***

### getInternational()

> **getInternational**(): [`ShippingProvider`](../interfaces/ShippingProvider.md)[]

Defined in: [src/lib/shipping/providers/base.ts:201](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L201)

#### Returns

[`ShippingProvider`](../interfaces/ShippingProvider.md)[]

***

### register()

> **register**(`provider`): `void`

Defined in: [src/lib/shipping/providers/base.ts:180](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/shipping/providers/base.ts#L180)

#### Parameters

##### provider

[`ShippingProvider`](../interfaces/ShippingProvider.md)

#### Returns

`void`
