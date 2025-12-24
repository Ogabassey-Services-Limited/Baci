[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/seo-utils](../README.md) / generateProductSchema

# Function: generateProductSchema()

> **generateProductSchema**(`product`, `merchantName`, `currency`): [`ProductSchemaMarkup`](../../products/interfaces/ProductSchemaMarkup.md)

Defined in: [src/lib/seo-utils.ts:125](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/seo-utils.ts#L125)

Generates JSON-LD structured data for a product (2025 Google best practices)
All user-controlled string values are sanitized to prevent XSS attacks.

## Parameters

### product

[`Product`](../../products/interfaces/Product.md)

### merchantName

`string` = `'Baci Store'`

### currency

`string` = `'USD'`

## Returns

[`ProductSchemaMarkup`](../../products/interfaces/ProductSchemaMarkup.md)

## See

https://developers.google.com/search/docs/appearance/structured-data/product
