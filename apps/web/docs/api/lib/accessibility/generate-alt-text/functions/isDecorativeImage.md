[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [lib/accessibility/generate-alt-text](../README.md) / isDecorativeImage

# Function: isDecorativeImage()

> **isDecorativeImage**(`context`): `boolean`

Defined in: [src/lib/accessibility/generate-alt-text.ts:208](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/accessibility/generate-alt-text.ts#L208)

Check if an image should be marked as decorative
Decorative images should have alt="" (empty string)

Common decorative image types:
- Background patterns/textures
- Divider lines
- Purely aesthetic icons that are redundant with text
- Spacers

## Parameters

### context

#### hasAdjacentText?

`boolean`

Does the image have adjacent text that describes it?

#### hasTextLabel?

`boolean`

Is this a decorative icon with redundant text label?

#### isBackground?

`boolean`

Is this a background/texture pattern?

#### isSpacer?

`boolean`

Is this a spacer or divider?

## Returns

`boolean`
