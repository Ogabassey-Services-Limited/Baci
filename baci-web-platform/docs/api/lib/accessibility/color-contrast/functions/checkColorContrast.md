[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [lib/accessibility/color-contrast](../README.md) / checkColorContrast

# Function: checkColorContrast()

> **checkColorContrast**(`foreground`, `background`, `isLargeText`): `object`

Defined in: [src/lib/accessibility/color-contrast.ts:132](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/color-contrast.ts#L132)

Check if a color combination meets WCAG 2.1 AA requirements

## Parameters

### foreground

`string`

Foreground color (text or icon)

### background

`string`

Background color

### isLargeText

`boolean` = `false`

Whether the text is large (18pt+ or 14pt+ bold)

## Returns

`object`

Object with compliance status and ratio

### level

> **level**: `"AA"` \| `"AAA"` \| `"fail"`

### passes

> **passes**: `boolean`

### ratio

> **ratio**: `number`

### requiredRatio

> **requiredRatio**: `number`
