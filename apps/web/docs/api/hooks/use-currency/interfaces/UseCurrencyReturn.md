[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [hooks/use-currency](../README.md) / UseCurrencyReturn

# Interface: UseCurrencyReturn

Defined in: [src/hooks/use-currency.ts:21](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L21)

## Properties

### config

> **config**: [`CurrencyConfig`](../../../lib/currency/interfaces/CurrencyConfig.md)

Defined in: [src/hooks/use-currency.ts:31](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L31)

Full currency configuration

***

### countryCode

> **countryCode**: `string` \| `null`

Defined in: [src/hooks/use-currency.ts:33](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L33)

The country code being used

***

### currencyCode

> **currencyCode**: `string`

Defined in: [src/hooks/use-currency.ts:29](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L29)

Get the currency code (e.g., "NGN")

***

### currencySymbol

> **currencySymbol**: `string`

Defined in: [src/hooks/use-currency.ts:27](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L27)

Get just the currency symbol (e.g., "₦")

***

### formatCurrency()

> **formatCurrency**: (`amount`) => `string`

Defined in: [src/hooks/use-currency.ts:23](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L23)

Format amount as currency (e.g., "₦1,000.00")

#### Parameters

##### amount

`number`

#### Returns

`string`

***

### formatCurrencyCompact()

> **formatCurrencyCompact**: (`amount`) => `string`

Defined in: [src/hooks/use-currency.ts:25](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-currency.ts#L25)

Format amount without decimals (e.g., "₦1,000")

#### Parameters

##### amount

`number`

#### Returns

`string`
