[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/password-breach](../README.md) / checkPasswordBreach

# Function: checkPasswordBreach()

> **checkPasswordBreach**(`password`): `Promise`\<\{ `count?`: `number`; `error?`: `string`; `isBreached`: `boolean`; \}\>

Defined in: [src/lib/password-breach.ts:13](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/password-breach.ts#L13)

Check if a password has been compromised in a data breach
Uses HaveIBeenPwned Pwned Passwords API with k-Anonymity

How it works:
1. Hash the password with SHA-1
2. Send only the first 5 characters of the hash to the API
3. API returns all hash suffixes that match that prefix
4. Check locally if our full hash is in the returned list

This means the actual password (or even its full hash) never leaves the client.

## Parameters

### password

`string`

## Returns

`Promise`\<\{ `count?`: `number`; `error?`: `string`; `isBreached`: `boolean`; \}\>
