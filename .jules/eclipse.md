## 2025-02-28 - Dynamic fallback token resolution in SafeImage
**Learning:** Hardcoded default fallback icon colors or placeholder backgrounds (e.g., `#F3F4F6`, `#9CA3AF`) prevent correct theming. A fallback prop like `fallbackIconColor` can be provided a default value via the `useColorScheme` / `Colors` hooks inside the component rather than in the function parameter defaults. Inline dynamic styles are required to override static StyleSheet defaults properly without breaking customization.
**Action:** Always import `useColorScheme` and `Colors` to map default prop colors to theme tokens inside the component body, and use dynamic inline styles to merge `colors.muted` with existing container styles.
**Source:** SafeImage.tsx / Colors.ts
