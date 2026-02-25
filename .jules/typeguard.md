## 2026-02-18 - Storefront Order Type Safety & Missing Routes
**Learning:** Strict typing of `StorefrontOrder` revealed potential runtime crashes when rendering `shipping_address` (string vs JSONB object) and image rendering issues (array vs string). It also exposed that the `OgabasseyV2OrderDetails` component is currently orphaned (no corresponding `page.tsx` route), meaning these fixes are proactive but not verifiable in the current UI flow.
**Action:** When typing complex API responses (especially from Supabase JSONB columns), always handle both string and object variants using type guards or safe render functions. Verify component usage to ensure types match the actual data flow, even if the component is currently unused.

**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-02-25 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-02-26 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-03-05 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-03-01 - Typeguard: Fixed `any` in Reviews and Storefront Order API
**Learning:** The lack of generated Supabase types for joined queries (`products(images)`) led to widespread use of `any` and type assertions. By creating explicit interfaces (`StorefrontReview`) and updating the API to match the type contract (adding `product_id` and mapping `image`), we eliminated dozens of implicit `any` usages.
**Action:** When dealing with Supabase joins without generated types, define a specific interface for the joined result or use `unknown` with a type assertion to avoid `any` lint errors while maintaining type safety at the boundary.
