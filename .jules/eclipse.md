## 2025-02-28 - Dynamic fallback token resolution in SafeImage
**Learning:** Hardcoded default fallback icon colors or placeholder backgrounds (e.g., `#F3F4F6`, `#9CA3AF`) prevent correct theming. A fallback prop like `fallbackIconColor` can be provided a default value via the `useColorScheme` / `Colors` hooks inside the component rather than in the function parameter defaults. Inline dynamic styles are required to override static StyleSheet defaults properly without breaking customization.
**Action:** Always import `useColorScheme` and `Colors` to map default prop colors to theme tokens inside the component body, and use dynamic inline styles to merge `colors.muted` with existing container styles.
**Source:** SafeImage.tsx / Colors.ts
## 2026-06-16 — Using correct theme tokens for text on primary backgrounds
**Learning:** Hardcoded white text (`#FFFFFF`) on primary-colored buttons should use the `colors.textOnPrimary` token, which is explicitly defined in `theme.ts` alongside `colors.primary`.
**Action:** Always check the theme file (`theme.ts`) for specific contrast tokens like `textOnPrimary` before falling back to general text tokens or hardcoding values.
**Source:** `apps/mobile-admin/constants/theme.ts`
## 2025-02-25 — [Removed hardcoded '#eee' background from Blog Manager thumbnail]
**Learning:** Hardcoded `#eee` for image thumbnail placeholders fails to adapt to dark mode (appearing overly bright) and violates the rule against color literals.
**Action:** Remove from `StyleSheet.create` and apply `colors.border` (or `colors.background`) via dynamic inline styles `style={[styles.thumbnail, { backgroundColor: colors.border }]}`.
**Source:** apps/mobile-admin/constants/theme.ts / WCAG SC 1.4.3
