[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/csrf](../README.md) / getCsrfToken

# Function: getCsrfToken()

> **getCsrfToken**(): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/csrf.ts:89](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/csrf.ts#L89)

Get CSRF token from cookies (for client-side use)
Note: Does not automatically generate a new token to avoid cookie modification in Server Components

## Returns

`Promise`\<`string` \| `null`\>
