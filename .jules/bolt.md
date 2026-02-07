# Bolt's Journal

## 2026-02-24 - Cache Key Serialization Bottleneck
**Learning:** `JSON.stringify` can be a significant bottleneck (milliseconds per call) when used for cache key generation in hot paths like currency formatting for product grids.
**Action:** Use simple string concatenation for common cases where object serialization is not strictly necessary.
