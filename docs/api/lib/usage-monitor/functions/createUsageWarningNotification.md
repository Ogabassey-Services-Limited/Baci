[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/usage-monitor](../README.md) / createUsageWarningNotification

# Function: createUsageWarningNotification()

> **createUsageWarningNotification**(`stats`): \{ `message`: `string`; `notification_type`: `"error"` \| `"warning"`; `priority`: `"high"` \| `"urgent"`; `title`: `string`; \} \| `null`

Defined in: [src/lib/usage-monitor.ts:161](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/usage-monitor.ts#L161)

Create a usage warning notification payload
This can be used to auto-create system notifications for admins

## Parameters

### stats

[`RealtimeUsageStats`](../../../types/notifications/interfaces/RealtimeUsageStats.md)

## Returns

\{ `message`: `string`; `notification_type`: `"error"` \| `"warning"`; `priority`: `"high"` \| `"urgent"`; `title`: `string`; \} \| `null`
