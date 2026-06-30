## 2024-07-02 — [NewOrderFooterBar Payment Toggle Shadows]
**Learning:** Hardcoded `#000` shadows combined with raw opacity values create inconsistent elevation appearances across light and dark modes, particularly since dark mode often requires different shadow opacities to appear natural against darker backgrounds.
**Action:** Always replace hardcoded `shadowColor` and related properties (`shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`) with the semantic `shadows` tokens from `useTheme()` (e.g., `...shadows.sm`). Ensure custom controllers like `useNewOrderController` forward `shadows` from `useTheme()`.
**Source:** `apps/mobile-admin/hooks/useTheme.ts`, `apps/mobile-admin/constants/theme.ts`
