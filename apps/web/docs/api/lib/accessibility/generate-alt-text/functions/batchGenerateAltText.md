[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [lib/accessibility/generate-alt-text](../README.md) / batchGenerateAltText

# Function: batchGenerateAltText()

> **batchGenerateAltText**(`images`): `Promise`\<`Map`\<`string`, [`AltTextResult`](../interfaces/AltTextResult.md)\>\>

Defined in: [src/lib/accessibility/generate-alt-text.ts:160](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L160)

Batch generate alt text for multiple images

## Parameters

### images

`object`[]

Array of image data with URLs and optional context

## Returns

`Promise`\<`Map`\<`string`, [`AltTextResult`](../interfaces/AltTextResult.md)\>\>

Promise<Map<string, AltTextResult>> - Map of URL to alt text results
