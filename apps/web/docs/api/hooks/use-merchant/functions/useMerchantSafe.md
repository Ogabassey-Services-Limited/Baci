[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [hooks/use-merchant](../README.md) / useMerchantSafe

# Function: useMerchantSafe()

> **useMerchantSafe**(): `MerchantContextType` \| `null`

Defined in: [src/hooks/use-merchant.tsx:267](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-merchant.tsx#L267)

Safe version of useMerchant that returns null instead of throwing
Use this in components that might render outside of MerchantProvider (e.g., previews)

## Returns

`MerchantContextType` \| `null`
