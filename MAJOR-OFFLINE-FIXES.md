# Major Offline/Network Fixes - Mobile Storefront

**Date:** 2026-01-30
**App:** `/apps/mobile-storefront`
**Status:** COMPLETED

## Summary

This report documents the major offline/network handling improvements made to the Baci mobile storefront app following 2026 best practices for React Native offline-first architecture.

---

## Issues Fixed

### 1. No Request Timeout Configuration (FIXED)

**Problem:** API calls could hang indefinitely without timeout, causing poor UX on slow or unstable connections.

**Solution:** Created a reusable `fetchWithTimeout` utility using AbortController.

**Files Changed:**
- `/apps/mobile-storefront/lib/fetch-with-timeout.ts` (NEW)
- `/apps/mobile-storefront/services/orders.ts` (UPDATED)
- `/apps/mobile-storefront/lib/supabase.ts` (UPDATED)

**Implementation Details:**
```typescript
// New utility: lib/fetch-with-timeout.ts
export const DEFAULT_TIMEOUT = 30000; // 30 seconds
export const SHORT_TIMEOUT = 10000;   // 10 seconds
export const LONG_TIMEOUT = 60000;    // 60 seconds

export async function fetchWithTimeout(url: string, options: FetchWithTimeoutOptions = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Usage in orders.ts:**
```typescript
const response = await fetchWithTimeout(`${API_URL}/api/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(orderPayload),
  timeout: DEFAULT_TIMEOUT, // 30 seconds
});
```

---

### 2. No Offline Mutation Queue (FIXED)

**Problem:** Important mutations like order creation would fail immediately when offline, with no way to retry automatically.

**Solution:** Created a persistent offline mutation queue using AsyncStorage.

**Files Changed:**
- `/apps/mobile-storefront/lib/offline-queue.ts` (NEW)
- `/apps/mobile-storefront/services/orders.ts` (UPDATED)
- `/apps/mobile-storefront/app/_layout.tsx` (UPDATED)

**Implementation Details:**

The queue manager provides:
- Persistent storage using AsyncStorage
- Automatic processing when network is restored
- Exponential backoff retry (up to 5 attempts)
- React hook for UI state (`useOfflineQueue`)

```typescript
// Initialize at app start (_layout.tsx)
await offlineQueue.initialize();
offlineQueue.registerHandler('create_order', async (orderData) => {
  return await createOrder(orderData);
});

// Queue operations when offline (orders.ts)
export async function createOrderWithOfflineSupport(request: CreateOrderRequest) {
  const isOnline = await checkNetwork();

  if (isOnline) {
    try {
      const order = await createOrder(request);
      return { order, queued: false };
    } catch (error) {
      if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR') {
        const queueId = await offlineQueue.enqueue('create_order', request);
        return { order: null, queued: true, queueId };
      }
      throw error;
    }
  }

  const queueId = await offlineQueue.enqueue('create_order', request);
  return { order: null, queued: true, queueId };
}
```

**React Hook for UI:**
```typescript
function CheckoutScreen() {
  const { pendingCount, isProcessing } = useOfflineQueue();

  if (pendingCount > 0) {
    return <Text>Syncing {pendingCount} pending orders...</Text>;
  }
}
```

---

### 3. Images Don't Cache for Offline (FIXED)

**Problem:** Product images weren't configured for offline caching, causing blank images when offline.

**Solution:** Added `cachePolicy: 'memory-disk'` and blurhash placeholders to all expo-image instances.

**Files Changed:**
- `/apps/mobile-storefront/components/storefront/Hero.tsx` (UPDATED)
- `/apps/mobile-storefront/components/storefront/ProductCard.tsx` (ALREADY HAD IT)
- `/apps/mobile-storefront/app/product/[slug].tsx` (ALREADY HAD IT)

**Implementation Pattern:**
```typescript
// Common image props for all product images
const imageProps = {
  placeholder: { blurhash: 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*' },
  transition: 300,
  cachePolicy: 'memory-disk' as const, // Persist images for offline
  contentFit: 'cover' as const,
};

<Image source={{ uri: product.image }} {...imageProps} />
```

**Benefits:**
- Images cached to both memory (fast) and disk (persistent)
- Blurhash placeholders provide instant visual feedback
- 300ms smooth transition from placeholder to loaded image
- Works offline for previously viewed products

---

### 4. No Network Status Indicator (ALREADY WORKING)

**Status:** Already implemented and properly integrated.

**Existing Implementation:**
- `ConnectivityBanner.tsx` - Shows "You're offline" / "Back Online!" banners
- `OfflineNotice.tsx` - Multiple variants (banner, card, inline)
- `use-network-state.ts` - Network state hook with reconnection callbacks
- Already integrated in `_layout.tsx`

**No changes needed** - the implementation follows 2026 best practices.

---

## Files Created

| File | Description |
|------|-------------|
| `lib/fetch-with-timeout.ts` | Fetch wrapper with AbortController timeout |
| `lib/offline-queue.ts` | Persistent offline mutation queue |

## Files Modified

| File | Changes |
|------|---------|
| `services/orders.ts` | Added timeout, offline queue support, `createOrderWithOfflineSupport()` |
| `lib/supabase.ts` | Added timeout to edge function calls |
| `app/_layout.tsx` | Initialize offline queue at app start |
| `components/storefront/Hero.tsx` | Added image caching props |

---

## Architecture Overview

```
App Start (_layout.tsx)
    |
    ├── Initialize Offline Queue
    │   └── Register mutation handlers (create_order, etc.)
    |
    └── Network State Monitoring
        ├── ConnectivityBanner (global)
        └── NetInfo listener → Process queue on reconnect

User Actions (checkout, etc.)
    |
    ├── Online → Direct API call with timeout
    │   └── Timeout/Error → Queue mutation
    |
    └── Offline → Queue mutation immediately
        └── Show "Will sync when online" message

Network Restored
    |
    └── Offline Queue processes automatically
        └── Retry with exponential backoff (up to 5 times)
```

---

## Testing Checklist

- [ ] Enable airplane mode, browse products (cached images should display)
- [ ] Attempt checkout while offline (should queue order)
- [ ] Restore network connection (queued orders should process automatically)
- [ ] Verify ConnectivityBanner appears/disappears correctly
- [ ] Test timeout by throttling network (should timeout after 30s)

---

## Best Practices Applied

1. **AbortController Timeout** - All fetch calls have configurable timeout (default 30s)
2. **Exponential Backoff** - Retry failed operations with increasing delays
3. **Persistent Queue** - AsyncStorage ensures queued mutations survive app restarts
4. **Memory-Disk Image Caching** - expo-image caches to both memory and disk
5. **Blurhash Placeholders** - Instant visual feedback while images load
6. **Network-Aware Mutations** - Check connectivity before mutations, queue if offline
7. **Auto-Sync on Reconnect** - NetInfo listener triggers queue processing
8. **Timer Cleanup** - All setTimeout/setInterval cleaned up on unmount (prevents memory leaks)

---

## Dependencies Used

- `@react-native-community/netinfo` - Network state detection
- `@react-native-async-storage/async-storage` - Persistent offline queue storage
- `expo-image` - High-performance image component with caching
- `@tanstack/react-query` - Already configured with `networkMode: 'offlineFirst'`
- `react-native-mmkv` - Query cache persistence (already configured)

---

## Future Improvements

1. **Sync Status UI** - Add a global sync indicator showing pending mutations
2. **Conflict Resolution** - Handle cases where queued mutations conflict with server state
3. **Background Sync** - Use Expo's BackgroundFetch for processing queue while app is backgrounded
4. **Selective Caching** - Pre-cache popular products for offline browsing
5. **Queue Priority** - Add priority levels for different mutation types
