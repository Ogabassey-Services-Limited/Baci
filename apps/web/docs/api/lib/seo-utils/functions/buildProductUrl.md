[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/seo-utils](../README.md) / buildProductUrl

# Function: buildProductUrl()

> **buildProductUrl**(`productSlug`, `category?`): `string`

Defined in: [src/lib/seo-utils.ts:58](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L58)

Builds the product URL path based on available data
Priority:
  1. /{category}/{product-slug} (if category exists)
  2. /products/{product-slug} (fallback)

Examples:
  - smartphones, "iphone-12-used" → "/smartphones/iphone-12-used"
  - null, "generic-item" → "/products/generic-item"

## Parameters

### productSlug

`string`

### category?

`string` | `null`

## Returns

`string`
