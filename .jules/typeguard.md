## 2026-02-18 - Storefront Order Type Safety & Missing Routes
**Learning:** Strict typing of `StorefrontOrder` revealed potential runtime crashes when rendering `shipping_address` (string vs JSONB object) and image rendering issues (array vs string). It also exposed that the `OgabasseyV2OrderDetails` component is currently orphaned (no corresponding `page.tsx` route), meaning these fixes are proactive but not verifiable in the current UI flow.
**Action:** When typing complex API responses (especially from Supabase JSONB columns), always handle both string and object variants using type guards or safe render functions. Verify component usage to ensure types match the actual data flow, even if the component is currently unused.

**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-02-25 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-02-26 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-02-27 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.

## 2026-03-05 - Ignored External Bot Command
**Note:** PR comments for `@coderabbitai` were ignored as they are for an external bot.
