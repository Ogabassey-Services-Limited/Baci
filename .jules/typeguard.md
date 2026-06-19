## 2025-05-17 - [Typeguard: Strict Typing for Storefront Orders and Wallet]

**Learning:** Returning transformed database records directly from an API endpoint breaks strict typing for consumers expecting a standard model (e.g., `Order`). Explicit anonymous `any` casting in React state loops (`useState<any[]>`, `item: any`) masks these mismatches and risks downstream errors.
**Action:** Always create a specific shared DTO interface (e.g., `StorefrontTransformedOrder`, `StorefrontWallet`) in `packages/shared/src/types/storefront.ts` that explicitly matches the API payload. Map state types and array loops exactly to these definitions to ensure correct inferences and type safety.

## 2024-05-18 - Replacing `as any` in Novel/Tiptap Extensions

**Learning:** Tiptap types can be complex and are often missing properties like `view` and command extensions (`toggleTaskList`, `setYoutubeVideo`) when accessed through Novel's basic `useEditor` hook. Relying on `(editor as any)` creates widespread type blindness, but asserting to `unknown` triggers errors when passed to expected parameters like `EditorView`.
**Action:** Always create a targeted `TiptapEditor` interface and a secure `getTiptap()` downcasting function that correctly imports `EditorView` from `@tiptap/pm/view`. Apply this type guard rather than indiscriminately using `as any` to safely invoke nested chained commands.

## 2026-05-24 - [Properly Type EditorView in Novel Editor]

**Learning:** The tiptap/novel editor callbacks (like `handleImagePaste` and `handleImageDrop`) pass the editor instance view to user functions. Previously this was typed with `any` causing type safety violations. The correct type for this is `EditorView` from the underlying `prosemirror-view` package which novel relies on.
**Action:** When working with novel/tiptap custom extensions and callbacks, explicitly import `import type { EditorView } from '@tiptap/pm/view'` and use it to replace `any` in function signatures.

## 2026-05-28 - [Properly Type Webhook Payloads and Edge Function Returns]

**Learning:** Using `any` for webhook payloads (`record`, `old_record`) or external API responses (`Promise<any>` for gateway verifications) in Supabase Edge Functions defeats strict mode and allows unsafe property access.
**Action:** Always create explicit interfaces matching the database schema (e.g., `AuthUserRecord` with an index signature `[key: string]: unknown` for safety) for webhook payloads. For API verifications, return exact literal unions (e.g., `'success' | 'failed' | 'pending'`) instead of `Promise<any>`.

## 2026-06-01 - [Typing Cart Items in React Components]

**Learning:** Using `any` to type cart items in React components (e.g., `cart.map((item: any) => ...)`) breaks type safety and can lead to runtime errors when accessing properties that do not exist or have different names (like `variant_id` vs `variantId`).
**Action:** Always import and use the `CartItem` interface from `@/hooks/cart/cart-types` to explicitly type cart items in map, filter, and reduce operations to ensure properties are correctly referenced.
## 2025-02-24 - Typed Confirm Insurance Dialog Payload
**Learning:** Replaced `any` with proper domain types `Partial<DeviceInsuranceDetails>` and `OrderDetailsItem[]` in `ConfirmInsuranceDialog`, matching the backend payload used for purchasing insurance and enabling better downstream type inferences in `client-page.tsx`. Used type-only imports and replaced type assumptions with `as const` assertion on deviceType literals where required by the interface.
**Action:** Always search for the destination interface where the data will be used (e.g. `DeviceInsuranceDetails` used by the backend service) and apply it to the component firing the data event instead of using `any` or `Record<string, unknown>`.
## 2025-06-12 - [Strict typing for dynamic Expo module imports]
**Learning:** [When using dynamic imports for native Expo modules (like `expo-device` and `expo-notifications`) to prevent evaluation-time crashes in web or specific environments, variables storing the modules should not be typed as `any`. They can be strictly typed using `typeof import('module') | null`.]
**Action:** [Use `typeof import('expo-module-name') | null` for dynamically loaded native modules, and ensure subsequent module method calls use `if (!Module) return;` to prevent runtime `TypeError` crashes.]
## 2026-06-18 — [Replace any in storefront components]
**Learning:** Hardcoded props and mismatched data property maps were causing incorrect type structures which led to runtime issues with 'any'. Using 'Partial<MerchantData>' resolves the 'any' while forcing correct internal structures.
**Action:** Always verify property names in existing typings against data accessors before mapping them. Use Partial<T> where T is defined but data might be incomplete.

## 2026-06-18 — [Fix 'use client' invalidation]
**Learning:** Adding imports *above* the `'use client'` directive invalidates the directive, causing CI to fail with 'Misplaced "use client" directive' error. In React/Next.js, `'use client'` must be at the absolute top of the file, before any imports.
**Action:** When adding imports programmatically via `sed`, always ensure `'use client'` (if present) remains the very first line of the file. Insert imports on the line *after* it (e.g., using `sed '1a ...'`).

## 2026-06-18 — [Clean up orphaned/outdated comments]
**Learning:** Outdated or contradictory comments left behind after applying a fix can trigger code review warnings. Even though the types are correct, comments explicitly mentioning the usage of `any` violate the spirit of type safety improvements.
**Action:** When updating a property or removing `any`, always ensure related comments that document the old state are deleted or updated to reflect the new implementation.
