[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/products](../README.md) / ProductSchemaMarkup

# Interface: ProductSchemaMarkup

Defined in: [src/lib/products.ts:29](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L29)

## Indexable

\[`key`: `string`\]: `unknown`

## Properties

### @context

> **@context**: `"https://schema.org"`

Defined in: [src/lib/products.ts:30](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L30)

***

### @type

> **@type**: `"Product"`

Defined in: [src/lib/products.ts:31](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L31)

***

### aggregateRating?

> `optional` **aggregateRating**: `object`

Defined in: [src/lib/products.ts:36](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L36)

#### @type

> **@type**: `"AggregateRating"`

#### ratingValue

> **ratingValue**: `number`

#### reviewCount

> **reviewCount**: `number`

***

### brand?

> `optional` **brand**: `object`

Defined in: [src/lib/products.ts:35](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L35)

#### @type

> **@type**: `"Brand"`

#### name

> **name**: `string`

***

### description?

> `optional` **description**: `string`

Defined in: [src/lib/products.ts:33](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L33)

***

### image?

> `optional` **image**: `string`[]

Defined in: [src/lib/products.ts:34](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L34)

***

### name?

> `optional` **name**: `string`

Defined in: [src/lib/products.ts:32](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L32)

***

### offers?

> `optional` **offers**: `object`

Defined in: [src/lib/products.ts:41](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/products.ts#L41)

#### @type

> **@type**: `"Offer"`

#### availability

> **availability**: `string`

#### itemCondition?

> `optional` **itemCondition**: `string`

#### price

> **price**: `number`

#### priceCurrency

> **priceCurrency**: `string`

#### priceSpecification?

> `optional` **priceSpecification**: `object`

##### priceSpecification.@type

> **@type**: `"PriceSpecification"`

##### priceSpecification.price

> **price**: `number`

##### priceSpecification.priceCurrency

> **priceCurrency**: `string`

##### priceSpecification.valueAddedTaxIncluded?

> `optional` **valueAddedTaxIncluded**: `boolean`

#### priceValidUntil?

> `optional` **priceValidUntil**: `string`

#### seller?

> `optional` **seller**: `object`

##### seller.@type

> **@type**: `"Organization"`

##### seller.name

> **name**: `string`

#### url?

> `optional` **url**: `string`
