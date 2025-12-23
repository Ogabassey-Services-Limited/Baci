[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/cache](../README.md) / withCache

# Function: withCache()

> **withCache**\<`T`\>(`key`, `ttlSeconds`, `fetchFn`): `Promise`\<`T`\>

Defined in: [src/lib/cache.ts:134](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/cache.ts#L134)

Cached function wrapper with automatic key generation

## Type Parameters

### T

`T`

## Parameters

### key

`string`

### ttlSeconds

`number`

### fetchFn

() => `Promise`\<`T`\>

## Returns

`Promise`\<`T`\>
