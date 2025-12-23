[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [hooks/use-currency](../README.md) / useCurrencyWithCountry

# Function: useCurrencyWithCountry()

> **useCurrencyWithCountry**(`countryCode`): [`UseCurrencyReturn`](../interfaces/UseCurrencyReturn.md)

Defined in: [src/hooks/use-currency.ts:102](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L102)

Hook for currency formatting with explicit country code
Use this when you have the country code directly (e.g., from props)

## Parameters

### countryCode

`string` | `null` | `undefined`

## Returns

[`UseCurrencyReturn`](../interfaces/UseCurrencyReturn.md)

## Example

```ts
function OrderTotal({ total, merchantCountry }: Props) {
  const { formatCurrency } = useCurrencyWithCountry(merchantCountry);
  return <span>{formatCurrency(total)}</span>;
}
```
