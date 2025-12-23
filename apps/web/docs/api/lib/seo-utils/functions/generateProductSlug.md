[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/seo-utils](../README.md) / generateProductSlug

# Function: generateProductSlug()

> **generateProductSlug**(`name`, `condition?`, `conditionDetail?`): `string`

Defined in: [src/lib/seo-utils.ts:27](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L27)

Generates a full product slug including condition
Examples:
  - "iPhone 12" (new) → "iphone-12-new"
  - "iPhone 12" (used) → "iphone-12-used"
  - "iPhone 12" (refurbished) → "iphone-12-refurbished"
  - "iPhone 12" (no condition) → "iphone-12"

## Parameters

### name

`string`

### condition?

`string`

### conditionDetail?

`string`

## Returns

`string`
