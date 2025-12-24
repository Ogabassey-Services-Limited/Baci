[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [types/notifications](../README.md) / NotificationWithStats

# Interface: NotificationWithStats

Defined in: [src/types/notifications.ts:192](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L192)

Notification with delivery stats (for admin view)

## Extends

- [`Notification`](Notification.md)

## Properties

### action\_label

> **action\_label**: `string` \| `null`

Defined in: [src/types/notifications.ts:74](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L74)

#### Inherited from

[`Notification`](Notification.md).[`action_label`](Notification.md#action_label)

***

### action\_url

> **action\_url**: `string` \| `null`

Defined in: [src/types/notifications.ts:73](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L73)

#### Inherited from

[`Notification`](Notification.md).[`action_url`](Notification.md#action_url)

***

### channels

> **channels**: [`NotificationChannel`](../type-aliases/NotificationChannel.md)[]

Defined in: [src/types/notifications.ts:72](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L72)

#### Inherited from

[`Notification`](Notification.md).[`channels`](Notification.md#channels)

***

### created\_at

> **created\_at**: `string`

Defined in: [src/types/notifications.ts:78](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L78)

#### Inherited from

[`Notification`](Notification.md).[`created_at`](Notification.md#created_at)

***

### created\_by

> **created\_by**: `string`

Defined in: [src/types/notifications.ts:77](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L77)

#### Inherited from

[`Notification`](Notification.md).[`created_by`](Notification.md#created_by)

***

### expires\_at

> **expires\_at**: `string` \| `null`

Defined in: [src/types/notifications.ts:76](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L76)

#### Inherited from

[`Notification`](Notification.md).[`expires_at`](Notification.md#expires_at)

***

### id

> **id**: `string`

Defined in: [src/types/notifications.ts:63](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L63)

#### Inherited from

[`Notification`](Notification.md).[`id`](Notification.md#id)

***

### is\_system

> **is\_system**: `boolean`

Defined in: [src/types/notifications.ts:80](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L80)

#### Inherited from

[`Notification`](Notification.md).[`is_system`](Notification.md#is_system)

***

### message

> **message**: `string`

Defined in: [src/types/notifications.ts:66](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L66)

#### Inherited from

[`Notification`](Notification.md).[`message`](Notification.md#message)

***

### notification\_type

> **notification\_type**: [`NotificationType`](../type-aliases/NotificationType.md)

Defined in: [src/types/notifications.ts:67](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L67)

#### Inherited from

[`Notification`](Notification.md).[`notification_type`](Notification.md#notification_type)

***

### priority

> **priority**: [`NotificationPriority`](../type-aliases/NotificationPriority.md)

Defined in: [src/types/notifications.ts:68](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L68)

#### Inherited from

[`Notification`](Notification.md).[`priority`](Notification.md#priority)

***

### scheduled\_for

> **scheduled\_for**: `string` \| `null`

Defined in: [src/types/notifications.ts:75](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L75)

#### Inherited from

[`Notification`](Notification.md).[`scheduled_for`](Notification.md#scheduled_for)

***

### sent\_at

> **sent\_at**: `string` \| `null`

Defined in: [src/types/notifications.ts:79](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L79)

#### Inherited from

[`Notification`](Notification.md).[`sent_at`](Notification.md#sent_at)

***

### stats

> **stats**: [`NotificationStats`](NotificationStats.md)

Defined in: [src/types/notifications.ts:193](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L193)

***

### target\_merchant\_ids

> **target\_merchant\_ids**: `string`[]

Defined in: [src/types/notifications.ts:70](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L70)

#### Inherited from

[`Notification`](Notification.md).[`target_merchant_ids`](Notification.md#target_merchant_ids)

***

### target\_segment

> **target\_segment**: [`TargetSegment`](../type-aliases/TargetSegment.md) \| `null`

Defined in: [src/types/notifications.ts:71](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L71)

#### Inherited from

[`Notification`](Notification.md).[`target_segment`](Notification.md#target_segment)

***

### target\_type

> **target\_type**: [`TargetType`](../type-aliases/TargetType.md)

Defined in: [src/types/notifications.ts:69](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L69)

#### Inherited from

[`Notification`](Notification.md).[`target_type`](Notification.md#target_type)

***

### template\_id

> **template\_id**: `string` \| `null`

Defined in: [src/types/notifications.ts:64](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L64)

#### Inherited from

[`Notification`](Notification.md).[`template_id`](Notification.md#template_id)

***

### title

> **title**: `string`

Defined in: [src/types/notifications.ts:65](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/types/notifications.ts#L65)

#### Inherited from

[`Notification`](Notification.md).[`title`](Notification.md#title)
