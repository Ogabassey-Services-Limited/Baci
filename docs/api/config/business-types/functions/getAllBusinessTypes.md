[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [config/business-types](../README.md) / getAllBusinessTypes

# Function: getAllBusinessTypes()

> **getAllBusinessTypes**(): [`BusinessTypeConfigType`](../type-aliases/BusinessTypeConfigType.md)[]

Defined in: [src/config/business-types.ts:296](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/config/business-types.ts#L296)

Get all business types as an array

## Returns

[`BusinessTypeConfigType`](../type-aliases/BusinessTypeConfigType.md)[]

Array of all business type configurations

## Example

```typescript
const types = getAllBusinessTypes();
types.forEach(type => {
  console.log(type.label);
});
```
