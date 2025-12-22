[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [lib/usage-monitor](../README.md) / getRealtimeUsageStats

# Function: getRealtimeUsageStats()

> **getRealtimeUsageStats**(): `Promise`\<[`RealtimeUsageStats`](../../../types/notifications/interfaces/RealtimeUsageStats.md)\>

Defined in: [src/lib/usage-monitor.ts:24](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/lib/usage-monitor.ts#L24)

Get current usage statistics from Supabase
Note: This requires the Supabase Management API which needs additional setup

For now, this returns simulated data - in production you would:
1. Set up a Supabase Management API key
2. Call the usage endpoints to get actual metrics
3. Or use Supabase's built-in usage alerts

## Returns

`Promise`\<[`RealtimeUsageStats`](../../../types/notifications/interfaces/RealtimeUsageStats.md)\>
