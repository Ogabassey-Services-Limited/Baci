# Typeguard's Journal

## 2025-05-15 - Fixing Cart Hydration Types
**Learning:** Hydrating complex objects from `localStorage` often tempts developers to use `any` because `JSON.parse` returns `any`. However, strict typing is crucial here because stored data might be stale or malformed.
**Action:** Instead of casting to `any`, use a type guard function (e.g., `isValidStoredCartItem(i: unknown): i is StoredCartItem`) that validates the minimal required shape (e.g., `id` and `name` are strings) before casting. This ensures runtime safety and keeps TypeScript happy without `any`.
