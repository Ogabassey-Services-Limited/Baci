[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [config/business-types](../README.md) / getBusinessTypeById

# Function: getBusinessTypeById()

> **getBusinessTypeById**(`id`): [`BusinessTypeConfigType`](../type-aliases/BusinessTypeConfigType.md) \| `undefined`

Defined in: [src/config/business-types.ts:261](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L261)

Get business type configuration by ID

## Parameters

### id

`string`

The business type ID

## Returns

[`BusinessTypeConfigType`](../type-aliases/BusinessTypeConfigType.md) \| `undefined`

The business type configuration or undefined if not found

## Example

```typescript
const config = getBusinessTypeById('fashion');
console.log(config.label); // "Fashion & Apparel"
```
