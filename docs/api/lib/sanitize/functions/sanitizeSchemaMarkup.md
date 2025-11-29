[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / sanitizeSchemaMarkup

# Function: sanitizeSchemaMarkup()

> **sanitizeSchemaMarkup**\<`T`\>(`obj`): `T`

Defined in: [src/lib/sanitize.ts:122](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L122)

Recursively sanitize all string values in a JSON-LD schema object.
This prevents XSS when rendering schema_markup from the database.
Performance: O(n) where n is total number of values, with minimal memory overhead.

## Type Parameters

### T

`T`

## Parameters

### obj

`T`

## Returns

`T`
