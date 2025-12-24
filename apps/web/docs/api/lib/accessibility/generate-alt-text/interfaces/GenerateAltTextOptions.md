[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [lib/accessibility/generate-alt-text](../README.md) / GenerateAltTextOptions

# Interface: GenerateAltTextOptions

Defined in: [src/lib/accessibility/generate-alt-text.ts:32](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L32)

## Properties

### category?

> `optional` **category**: `string`

Defined in: [src/lib/accessibility/generate-alt-text.ts:36](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L36)

Product category for context

***

### isProductImage?

> `optional` **isProductImage**: `boolean`

Defined in: [src/lib/accessibility/generate-alt-text.ts:38](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L38)

Whether this is a product image (helps generate more specific alt text)

***

### language?

> `optional` **language**: `string`

Defined in: [src/lib/accessibility/generate-alt-text.ts:42](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L42)

Language for the alt text (default: 'en')

***

### maxLength?

> `optional` **maxLength**: `number`

Defined in: [src/lib/accessibility/generate-alt-text.ts:40](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L40)

Maximum length for the alt text (default: 125 characters per WCAG best practices)

***

### productName?

> `optional` **productName**: `string`

Defined in: [src/lib/accessibility/generate-alt-text.ts:34](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L34)

Product name or context for better alt text generation
