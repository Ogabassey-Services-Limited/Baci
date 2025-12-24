[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/currency](../README.md) / formatCurrency

# Function: formatCurrency()

> **formatCurrency**(`amount`, `countryCode?`, `options?`): `string`

Defined in: [src/lib/currency.ts:76](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/currency.ts#L76)

Format a number as currency based on country code

## Parameters

### amount

`number`

The amount to format

### countryCode?

The country code (e.g., 'NG', 'US', 'GB')

`string` | `null`

### options?

`Partial`\<`NumberFormatOptions`\>

Additional Intl.NumberFormat options

## Returns

`string`

Formatted currency string

## Example

```ts
formatCurrency(1000, 'NG') // "₦1,000.00"
formatCurrency(1000, 'US') // "$1,000.00"
formatCurrency(1000, 'GB') // "£1,000.00"
```
