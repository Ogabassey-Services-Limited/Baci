## 2025-02-18 - Remove Hardcoded Colors in SafeImage Component
**Learning:** Hardcoding generic fallback and loading UI colors (like `#9CA3AF`, `#F3F4F6`, `#F9FAFB`) breaks the user experience in dark mode, making these elements either too bright or unreadable against darker backgrounds.
**Action:** Always fetch contextual dynamic theme tokens via the `useTheme` hook (e.g., `colors.textSecondary`, `colors.card`, `colors.background`) for loading indicators, placeholder icons, and fallback component backgrounds in Expo components to maintain visual harmony in both light and dark modes.

## 2025-02-18 - Remove Hardcoded Colors in SafeImage Component
**Learning:** Hardcoding generic fallback and loading UI colors (like `#9CA3AF`, `#F3F4F6`, `#F9FAFB`) breaks the user experience in dark mode, making these elements either too bright or unreadable against darker backgrounds.
**Action:** Always fetch contextual dynamic theme tokens via the `useTheme` hook (e.g., `colors.textSecondary`, `colors.card`, `colors.background`) for loading indicators, placeholder icons, and fallback component backgrounds in Expo components to maintain visual harmony in both light and dark modes.
