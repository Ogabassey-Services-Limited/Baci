[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [lib/accessibility/generate-alt-text](../README.md) / generateAltText

# Function: generateAltText()

> **generateAltText**(`imageUrl`, `options`): `Promise`\<[`AltTextResult`](../interfaces/AltTextResult.md)\>

Defined in: [src/lib/accessibility/generate-alt-text.ts:61](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L61)

Generates AI-powered alt text for an image

## Parameters

### imageUrl

`string`

The URL of the image to analyze

### options

[`GenerateAltTextOptions`](../interfaces/GenerateAltTextOptions.md) = `{}`

Options for customizing alt text generation

## Returns

`Promise`\<[`AltTextResult`](../interfaces/AltTextResult.md)\>

Promise<AltTextResult> - The generated alt text and metadata

## Example

```ts
const result = await generateAltText('https://example.com/product.jpg', {
  productName: 'Blue Cotton T-Shirt',
  isProductImage: true
});
console.log(result.altText); // "Blue cotton t-shirt with crew neck, front view"
```
