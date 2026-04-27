## 2024-05-30 - Fix hardcoded colors in StaffAccountsScreen
**Learning:** Found several hardcoded fallback colors (e.g. `colors.primaryLight || '#E8F0FE'`) and text colors (`#FFF`) in `apps/mobile-admin/app/(admin)/staff-accounts.tsx` which bypass the design system in the event of missing properties or directly override them, breaking theming on dark mode.
**Action:** Replaced hardcoded hex colors with specific theme tokens from `useTheme()` (`colors.textOnPrimary`, `colors.primaryLight`, `colors.infoLight`, `colors.info`), ensuring proper adaptability for light and dark modes.
