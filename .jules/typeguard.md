# Typeguard's Journal

## 2026-02-18 - Eliminating `any` in Local Storage Parsing
**Learning:** Parsing data from `localStorage` often tempts developers to use `any` casts because `JSON.parse` returns `any`. However, strict typing can be achieved by defining a "raw" interface (e.g., `StoredCartItem`) and using a custom type guard function (`isValidStoredCartItem`) to validate the shape before processing.
**Action:** Always define an intermediate interface and a type guard for external data sources (like `localStorage` or API responses) instead of casting to the final type immediately.
