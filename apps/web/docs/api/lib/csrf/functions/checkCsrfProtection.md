[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/csrf](../README.md) / checkCsrfProtection

# Function: checkCsrfProtection()

> **checkCsrfProtection**(`request`): `Promise`\<\{ `response?`: `NextResponse`\<`unknown`\>; `valid`: `boolean`; \}\>

Defined in: [src/lib/csrf.ts:134](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/csrf.ts#L134)

Middleware to check CSRF token for state-changing requests

## Parameters

### request

`NextRequest`

## Returns

`Promise`\<\{ `response?`: `NextResponse`\<`unknown`\>; `valid`: `boolean`; \}\>
