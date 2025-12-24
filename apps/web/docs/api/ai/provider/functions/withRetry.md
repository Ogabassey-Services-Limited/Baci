[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [ai/provider](../README.md) / withRetry

# Function: withRetry()

> **withRetry**\<`T`\>(`operation`, `config`): `Promise`\<`T`\>

Defined in: [src/ai/provider.ts:103](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/ai/provider.ts#L103)

Wrapper for AI calls with retry logic

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`\<`T`\>

### config

#### backoffMultiplier

`number` = `2`

#### initialDelayMs

`number` = `1000`

#### maxDelayMs

`number` = `10000`

#### maxRetries

`number` = `3`

## Returns

`Promise`\<`T`\>
