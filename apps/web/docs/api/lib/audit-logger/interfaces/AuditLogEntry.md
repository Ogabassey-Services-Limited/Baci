[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/audit-logger](../README.md) / AuditLogEntry

# Interface: AuditLogEntry

Defined in: [src/lib/audit-logger.ts:3](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L3)

## Properties

### action

> **action**: `string`

Defined in: [src/lib/audit-logger.ts:6](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L6)

***

### changes?

> `optional` **changes**: `object`

Defined in: [src/lib/audit-logger.ts:9](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L9)

#### after?

> `optional` **after**: `Record`\<`string`, `unknown`\>

#### before?

> `optional` **before**: `Record`\<`string`, `unknown`\>

***

### error\_message?

> `optional` **error\_message**: `string`

Defined in: [src/lib/audit-logger.ts:16](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L16)

***

### ip\_address?

> `optional` **ip\_address**: `string`

Defined in: [src/lib/audit-logger.ts:13](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L13)

***

### merchant\_id?

> `optional` **merchant\_id**: `string`

Defined in: [src/lib/audit-logger.ts:5](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L5)

***

### resource\_id

> **resource\_id**: `string`

Defined in: [src/lib/audit-logger.ts:8](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L8)

***

### resource\_type

> **resource\_type**: `"domain"` \| `"dns"` \| `"email_forwarding"` \| `"id_protection"`

Defined in: [src/lib/audit-logger.ts:7](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L7)

***

### status

> **status**: `"success"` \| `"failure"`

Defined in: [src/lib/audit-logger.ts:15](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L15)

***

### user\_agent?

> `optional` **user\_agent**: `string`

Defined in: [src/lib/audit-logger.ts:14](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L14)

***

### user\_id

> **user\_id**: `string`

Defined in: [src/lib/audit-logger.ts:4](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/audit-logger.ts#L4)
