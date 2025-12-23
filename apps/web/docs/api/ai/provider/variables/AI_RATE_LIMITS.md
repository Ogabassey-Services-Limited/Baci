[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [ai/provider](../README.md) / AI\_RATE\_LIMITS

# Variable: AI\_RATE\_LIMITS

> `const` **AI\_RATE\_LIMITS**: `object`

Defined in: [src/ai/provider.ts:30](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/ai/provider.ts#L30)

Rate Limiting Configuration
Prevents API abuse and manages costs

## Type Declaration

### autofill

> **autofill**: `object`

#### autofill.requests

> **requests**: `number` = `30`

#### autofill.windowMs

> **windowMs**: `number`

### builder

> **builder**: `object`

#### builder.requests

> **requests**: `number` = `10`

#### builder.windowMs

> **windowMs**: `number`

### imageGeneration

> **imageGeneration**: `object`

#### imageGeneration.requests

> **requests**: `number` = `5`

#### imageGeneration.windowMs

> **windowMs**: `number`

### insights

> **insights**: `object`

#### insights.requests

> **requests**: `number` = `5`

#### insights.windowMs

> **windowMs**: `number`

### productDescription

> **productDescription**: `object`

#### productDescription.requests

> **requests**: `number` = `20`

#### productDescription.windowMs

> **windowMs**: `number`
