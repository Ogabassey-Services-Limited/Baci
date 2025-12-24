[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [config/business-types](../README.md) / BusinessTypeConfig

# Interface: BusinessTypeConfig

Defined in: [src/config/business-types.ts:50](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L50)

Complete business type configuration

## Properties

### aiPromptContext

> **aiPromptContext**: `string`

Defined in: [src/config/business-types.ts:58](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L58)

Context passed to AI prompts for this business type

***

### description

> **description**: `string`

Defined in: [src/config/business-types.ts:56](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L56)

Detailed description of this business category

***

### icon

> **icon**: `LucideIcon`

Defined in: [src/config/business-types.ts:64](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L64)

Lucide icon component for UI

***

### id

> **id**: `string`

Defined in: [src/config/business-types.ts:52](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L52)

Unique identifier (matches form values)

***

### journey

> **journey**: [`BusinessTypeJourney`](BusinessTypeJourney.md)

Defined in: [src/config/business-types.ts:66](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L66)

Journey configuration for onboarding and product creation

***

### label

> **label**: `string`

Defined in: [src/config/business-types.ts:54](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L54)

Display label shown to users

***

### recommendedFeatures?

> `optional` **recommendedFeatures**: `string`[]

Defined in: [src/config/business-types.ts:60](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L60)

Recommended features for this business type (future)

***

### template

> **template**: `ComponentType`\<`unknown`\>

Defined in: [src/config/business-types.ts:62](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L62)

Template component to use for storefronts
