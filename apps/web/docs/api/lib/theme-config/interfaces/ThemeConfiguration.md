[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/theme-config](../README.md) / ThemeConfiguration

# Interface: ThemeConfiguration

Defined in: [src/lib/theme-config.ts:8](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L8)

Comprehensive Theme Configuration System

This defines ALL visual aspects of the site that can be customized.
Components use CSS variables that are set from this configuration.

## Properties

### animations

> **animations**: `object`

Defined in: [src/lib/theme-config.ts:187](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L187)

#### duration

> **duration**: `object`

##### duration.fast

> **fast**: `string`

##### duration.normal

> **normal**: `string`

##### duration.slow

> **slow**: `string`

#### easing

> **easing**: `object`

##### easing.easeIn

> **easeIn**: `string`

##### easing.easeInOut

> **easeInOut**: `string`

##### easing.easeOut

> **easeOut**: `string`

##### easing.linear

> **linear**: `string`

***

### borders

> **borders**: `object`

Defined in: [src/lib/theme-config.ts:150](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L150)

#### radius

> **radius**: `object`

##### radius.2xl

> **2xl**: `string`

##### radius.full

> **full**: `string`

##### radius.lg

> **lg**: `string`

##### radius.md

> **md**: `string`

##### radius.none

> **none**: `string`

##### radius.sm

> **sm**: `string`

##### radius.xl

> **xl**: `string`

#### style

> **style**: `object`

##### style.dashed

> **dashed**: `string`

##### style.dotted

> **dotted**: `string`

##### style.solid

> **solid**: `string`

#### width

> **width**: `object`

##### width.none

> **none**: `string`

##### width.normal

> **normal**: `string`

##### width.thick

> **thick**: `string`

##### width.thin

> **thin**: `string`

***

### colors

> **colors**: `object`

Defined in: [src/lib/theme-config.ts:10](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L10)

#### accent

> **accent**: `string`

#### background

> **background**: `string`

#### border

> **border**: `string`

#### button

> **button**: `object`

##### button.accent

> **accent**: `object`

##### button.accent.background

> **background**: `string`

##### button.accent.hover

> **hover**: `string`

##### button.accent.text

> **text**: `string`

##### button.primary

> **primary**: `object`

##### button.primary.background

> **background**: `string`

##### button.primary.hover

> **hover**: `string`

##### button.primary.text

> **text**: `string`

##### button.secondary

> **secondary**: `object`

##### button.secondary.background

> **background**: `string`

##### button.secondary.hover

> **hover**: `string`

##### button.secondary.text

> **text**: `string`

#### card

> **card**: `object`

##### card.background

> **background**: `string`

##### card.border

> **border**: `string`

##### card.text

> **text**: `string`

#### footer

> **footer**: `object`

##### footer.background

> **background**: `string`

##### footer.linkColor

> **linkColor**: `string`

##### footer.linkHoverColor

> **linkHoverColor**: `string`

##### footer.text

> **text**: `string`

#### foreground

> **foreground**: `string`

#### header

> **header**: `object`

##### header.background

> **background**: `string`

##### header.cartIconColor

> **cartIconColor**: `string`

##### header.iconColor

> **iconColor**: `string`

##### header.searchBackground

> **searchBackground**: `string`

##### header.searchBorder

> **searchBorder**: `string`

##### header.text

> **text**: `string`

#### input

> **input**: `object`

##### input.background

> **background**: `string`

##### input.border

> **border**: `string`

##### input.focusBorder

> **focusBorder**: `string`

##### input.placeholder

> **placeholder**: `string`

##### input.text

> **text**: `string`

#### muted

> **muted**: `string`

#### mutedForeground

> **mutedForeground**: `string`

#### primary

> **primary**: `string`

#### secondary

> **secondary**: `string`

***

### layout

> **layout**: `object`

Defined in: [src/lib/theme-config.ts:203](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L203)

#### breakpoints

> **breakpoints**: `object`

##### breakpoints.2xl

> **2xl**: `string`

##### breakpoints.lg

> **lg**: `string`

##### breakpoints.md

> **md**: `string`

##### breakpoints.sm

> **sm**: `string`

##### breakpoints.xl

> **xl**: `string`

#### zIndex

> **zIndex**: `object`

##### zIndex.dropdown

> **dropdown**: `number`

##### zIndex.fixed

> **fixed**: `number`

##### zIndex.modal

> **modal**: `number`

##### zIndex.modalBackdrop

> **modalBackdrop**: `number`

##### zIndex.popover

> **popover**: `number`

##### zIndex.sticky

> **sticky**: `number`

##### zIndex.tooltip

> **tooltip**: `number`

***

### shadows

> **shadows**: `object`

Defined in: [src/lib/theme-config.ts:176](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L176)

#### 2xl

> **2xl**: `string`

#### inner

> **inner**: `string`

#### lg

> **lg**: `string`

#### md

> **md**: `string`

#### none

> **none**: `string`

#### sm

> **sm**: `string`

#### xl

> **xl**: `string`

***

### spacing

> **spacing**: `object`

Defined in: [src/lib/theme-config.ts:116](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L116)

#### 2xl

> **2xl**: `string`

#### 3xl

> **3xl**: `string`

#### container

> **container**: `object`

##### container.maxWidth

> **maxWidth**: `string`

##### container.paddingX

> **paddingX**: `string`

#### footer

> **footer**: `object`

##### footer.paddingX

> **paddingX**: `string`

##### footer.paddingY

> **paddingY**: `string`

#### header

> **header**: `object`

##### header.height

> **height**: `string`

##### header.paddingX

> **paddingX**: `string`

##### header.paddingY

> **paddingY**: `string`

#### lg

> **lg**: `string`

#### md

> **md**: `string`

#### section

> **section**: `object`

##### section.paddingX

> **paddingX**: `string`

##### section.paddingY

> **paddingY**: `string`

#### sm

> **sm**: `string`

#### xl

> **xl**: `string`

#### xs

> **xs**: `string`

***

### typography

> **typography**: `object`

Defined in: [src/lib/theme-config.ts:72](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/theme-config.ts#L72)

#### fontFamily

> **fontFamily**: `object`

##### fontFamily.body

> **body**: `string`

##### fontFamily.heading

> **heading**: `string`

##### fontFamily.mono

> **mono**: `string`

#### fontSize

> **fontSize**: `object`

##### fontSize.2xl

> **2xl**: `string`

##### fontSize.3xl

> **3xl**: `string`

##### fontSize.4xl

> **4xl**: `string`

##### fontSize.5xl

> **5xl**: `string`

##### fontSize.6xl

> **6xl**: `string`

##### fontSize.base

> **base**: `string`

##### fontSize.lg

> **lg**: `string`

##### fontSize.sm

> **sm**: `string`

##### fontSize.xl

> **xl**: `string`

##### fontSize.xs

> **xs**: `string`

#### fontWeight

> **fontWeight**: `object`

##### fontWeight.bold

> **bold**: `number`

##### fontWeight.extrabold

> **extrabold**: `number`

##### fontWeight.light

> **light**: `number`

##### fontWeight.medium

> **medium**: `number`

##### fontWeight.normal

> **normal**: `number`

##### fontWeight.semibold

> **semibold**: `number`

#### letterSpacing

> **letterSpacing**: `object`

##### letterSpacing.normal

> **normal**: `string`

##### letterSpacing.tight

> **tight**: `string`

##### letterSpacing.wide

> **wide**: `string`

#### lineHeight

> **lineHeight**: `object`

##### lineHeight.loose

> **loose**: `number`

##### lineHeight.normal

> **normal**: `number`

##### lineHeight.relaxed

> **relaxed**: `number`

##### lineHeight.tight

> **tight**: `number`
