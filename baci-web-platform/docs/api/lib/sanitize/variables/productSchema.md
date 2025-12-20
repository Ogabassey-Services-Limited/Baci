[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / productSchema

# Variable: productSchema

> `const` **productSchema**: `ZodObject`\<\{ `brand`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `category`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>; `description`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `name`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>; `price`: `ZodPipe`\<`ZodNumber`, `ZodTransform`\<`number`, `number`\>\>; `stock`: `ZodOptional`\<`ZodPipe`\<`ZodNumber`, `ZodTransform`\<`number`, `number`\>\>\>; \}, `$strip`\>

Defined in: [src/lib/sanitize.ts:207](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L207)

Validate and sanitize product data
