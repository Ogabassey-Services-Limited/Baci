[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [hooks/use-currency](../README.md) / useCurrency

# Function: useCurrency()

> **useCurrency**(): [`UseCurrencyReturn`](../interfaces/UseCurrencyReturn.md)

Defined in: [src/hooks/use-currency.ts:56](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L56)

Hook for currency formatting using merchant's country

## Returns

[`UseCurrencyReturn`](../interfaces/UseCurrencyReturn.md)

## Examples

```ts
function ProductPrice({ price }: { price: number }) {
  const { formatCurrency } = useCurrency();
  return <span>{formatCurrency(price)}</span>;
}
```

```ts
function PriceDisplay({ price }: { price: number }) {
  const { currencySymbol, formatCurrencyCompact } = useCurrency();
  return (
    <div>
      <span className="text-sm">{currencySymbol}</span>
      <span className="text-2xl">{formatCurrencyCompact(price)}</span>
    </div>
  );
}
```
