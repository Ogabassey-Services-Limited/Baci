## 2025-05-18 - Extracted Hardcoded Colors from ProductCard.styles.ts
**Learning:** Hardcoded white/gray values (`#FFF`, `#F3F4F6`, `#111827`) in `StyleSheet.create` prevent React Native components from properly adapting to dark mode changes.
**Action:** Remove hardcoded layout colors from `StyleSheet.create` and pass them dynamically via `useTheme()` tokens in component inline styles (e.g., `colors.card`, `colors.border`, `colors.muted`, `colors.primaryForeground`).
