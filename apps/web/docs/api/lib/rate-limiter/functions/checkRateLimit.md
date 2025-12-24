[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/rate-limiter](../README.md) / checkRateLimit

# Function: checkRateLimit()

> **checkRateLimit**(`supabase`, `identifier`, `endpoint`, `maxRequests`, `windowMinutes`): `Promise`\<`boolean`\>

Defined in: [src/lib/rate-limiter.ts:12](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/rate-limiter.ts#L12)

Check rate limit for a specific action

## Parameters

### supabase

`SupabaseClient`

Supabase client

### identifier

`string`

User ID or IP address

### endpoint

`string`

Endpoint or action name (e.g. 'dns_update', 'domain_register')

### maxRequests

`number` = `100`

Maximum requests allowed in the window

### windowMinutes

`number` = `1`

Window size in minutes

## Returns

`Promise`\<`boolean`\>

true if allowed, false if limit exceeded
