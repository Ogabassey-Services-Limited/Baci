[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/sanitize](../README.md) / orderSchema

# Variable: orderSchema

> `const` **orderSchema**: `ZodObject`\<\{ `customer_email`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>; `customer_name`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>; `customer_phone`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `notes`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `shipping_fee`: `ZodPipe`\<`ZodNumber`, `ZodTransform`\<`number`, `number`\>\>; `subtotal`: `ZodPipe`\<`ZodNumber`, `ZodTransform`\<`number`, `number`\>\>; \}, `$strip`\>

Defined in: [src/lib/sanitize.ts:219](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/sanitize.ts#L219)

Validate and sanitize order data
