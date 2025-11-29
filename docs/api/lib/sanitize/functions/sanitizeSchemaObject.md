[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / sanitizeSchemaObject

# Function: sanitizeSchemaObject()

> **sanitizeSchemaObject**\<`T`\>(`obj`): `T`

Defined in: [src/lib/sanitize.ts:293](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L293)

Recursively sanitize all string values in an object for use in JSON-LD scripts.
This is useful when using pre-stored schema objects from the database.
Prevents XSS attacks by escaping HTML-sensitive characters in all string values.

## Type Parameters

### T

`T`

## Parameters

### obj

`T`

## Returns

`T`
