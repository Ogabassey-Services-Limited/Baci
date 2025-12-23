[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/go54](../README.md) / checkDomainAvailability

# Function: checkDomainAvailability()

> **checkDomainAvailability**(`domain`, `_tldsToInclude`, `_isWhmcs`): `Promise`\<`boolean`\>

Defined in: [src/lib/go54.ts:192](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/go54.ts#L192)

Check domain availability using WHOIS

Note: The official API 'lookup' action is deprecated.
We use direct WHOIS lookup as a fallback.

## Parameters

### domain

`string`

### \_tldsToInclude

`string`[] = `[]`

### \_isWhmcs

`number` = `0`

## Returns

`Promise`\<`boolean`\>
