[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/seo-utils](../README.md) / LocalBusinessData

# Interface: LocalBusinessData

Defined in: [src/lib/seo-utils.ts:298](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L298)

Generates LocalBusiness schema for merchant storefronts
All user-controlled string values are sanitized to prevent XSS attacks.

## See

https://developers.google.com/search/docs/appearance/structured-data/local-business

## Properties

### address?

> `optional` **address**: `object`

Defined in: [src/lib/seo-utils.ts:305](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L305)

#### city?

> `optional` **city**: `string`

#### country?

> `optional` **country**: `string`

#### postalCode?

> `optional` **postalCode**: `string`

#### state?

> `optional` **state**: `string`

#### street?

> `optional` **street**: `string`

***

### description?

> `optional` **description**: `string`

Defined in: [src/lib/seo-utils.ts:300](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L300)

***

### email?

> `optional` **email**: `string`

Defined in: [src/lib/seo-utils.ts:304](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L304)

***

### geo?

> `optional` **geo**: `object`

Defined in: [src/lib/seo-utils.ts:312](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L312)

#### latitude

> **latitude**: `number`

#### longitude

> **longitude**: `number`

***

### logo?

> `optional` **logo**: `string`

Defined in: [src/lib/seo-utils.ts:302](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L302)

***

### name

> **name**: `string`

Defined in: [src/lib/seo-utils.ts:299](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L299)

***

### openingHours?

> `optional` **openingHours**: `string`[]

Defined in: [src/lib/seo-utils.ts:316](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L316)

***

### priceRange?

> `optional` **priceRange**: `string`

Defined in: [src/lib/seo-utils.ts:317](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L317)

***

### socialMedia?

> `optional` **socialMedia**: `Record`\<`string`, `string`\>

Defined in: [src/lib/seo-utils.ts:318](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L318)

***

### telephone?

> `optional` **telephone**: `string`

Defined in: [src/lib/seo-utils.ts:303](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L303)

***

### url

> **url**: `string`

Defined in: [src/lib/seo-utils.ts:301](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L301)
