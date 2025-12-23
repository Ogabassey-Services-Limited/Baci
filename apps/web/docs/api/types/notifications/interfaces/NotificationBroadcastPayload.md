[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [types/notifications](../README.md) / NotificationBroadcastPayload

# Interface: NotificationBroadcastPayload

Defined in: [src/types/notifications.ts:228](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L228)

Payload sent via Supabase Broadcast when a new notification arrives

## Properties

### created\_at

> **created\_at**: `string`

Defined in: [src/types/notifications.ts:241](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L241)

***

### event

> **event**: `"new_notification"`

Defined in: [src/types/notifications.ts:229](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L229)

***

### merchant\_notification\_id

> **merchant\_notification\_id**: `string`

Defined in: [src/types/notifications.ts:230](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L230)

***

### notification

> **notification**: `object`

Defined in: [src/types/notifications.ts:231](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L231)

#### action\_label

> **action\_label**: `string` \| `null`

#### action\_url

> **action\_url**: `string` \| `null`

#### channels

> **channels**: [`NotificationChannel`](../type-aliases/NotificationChannel.md)[]

#### id

> **id**: `string`

#### message

> **message**: `string`

#### notification\_type

> **notification\_type**: [`NotificationType`](../type-aliases/NotificationType.md)

#### priority

> **priority**: [`NotificationPriority`](../type-aliases/NotificationPriority.md)

#### title

> **title**: `string`
