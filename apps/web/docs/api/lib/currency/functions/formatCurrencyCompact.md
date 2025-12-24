[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/currency](../README.md) / formatCurrencyCompact

# Function: formatCurrencyCompact()

> **formatCurrencyCompact**(`amount`, `countryCode?`): `string`

Defined in: [src/lib/currency.ts:104](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/currency.ts#L104)

Format currency without decimals (for display of whole numbers)

## Parameters

### amount

`number`

### countryCode?

`string` | `null`

## Returns

`string`

## Example

```ts
formatCurrencyCompact(1000, 'NG') // "₦1,000"
```
