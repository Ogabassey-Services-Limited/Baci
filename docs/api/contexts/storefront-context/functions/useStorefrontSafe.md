[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [contexts/storefront-context](../README.md) / useStorefrontSafe

# Function: useStorefrontSafe()

> **useStorefrontSafe**(): `StorefrontContextType` \| `null`

Defined in: [src/contexts/storefront-context.tsx:37](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/contexts/storefront-context.tsx#L37)

Safe version of useStorefront that returns null instead of throwing
Use this in components that might render outside of StorefrontProvider (e.g., previews)

## Returns

`StorefrontContextType` \| `null`
