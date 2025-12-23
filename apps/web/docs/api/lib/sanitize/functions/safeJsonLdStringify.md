[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / safeJsonLdStringify

# Function: safeJsonLdStringify()

> **safeJsonLdStringify**\<`T`\>(`schema`): `string`

Defined in: [src/lib/sanitize.ts:329](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L329)

Safely stringify a JSON-LD schema object for use in dangerouslySetInnerHTML.
This function sanitizes all string values and returns a safe JSON string.

Usage:
  <script type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(schema) }}
  />

## Type Parameters

### T

`T` *extends* `Record`\<`string`, `unknown`\>

## Parameters

### schema

`T`

## Returns

`string`
