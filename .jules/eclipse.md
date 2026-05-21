## 2025-04-22 - Home Screen Hero Background Hardcoded

**Learning:** The home screen hero section (`eliteBackground`) hardcoded a `#000` background color. The original PR refactored the module-scoped `StyleSheet.create` into a `getStyles` factory function. However, this is an anti-pattern as it recreates the entire stylesheet object on every render. Furthermore, replacing it with `colors.background` broke visibility in light mode because the hero text and icons are explicitly white, so it needs a dedicated black token.
**Action:** When fixing hardcoded colors in React Native components, do not refactor static `StyleSheet.create` into a factory function. Instead, leave the module-scoped `StyleSheet.create` intact and apply dynamic theme colors via an inline style array (e.g., `style={[styles.eliteBackground, { backgroundColor: colors.black }]}`). Choose the correct token (e.g., `colors.black`) to preserve contrast ratios in both themes.
## 2025-05-15 - Hardcoded Colors in Status Indicators
**Learning:** Hardcoded success (`#059669`, `#DEF7EC`) and error (`#DC2626`, `#FEE2E2`) colors inside `payment-gateway/index.tsx` fail to respond to dark mode, creating poor contrast for status indicators. In addition, `webViewLoading` and `actionButtonText` explicitly define white backgrounds/text, ignoring theme colors.
**Action:** Replace hardcoded static hex values with corresponding tokens from `useTheme()`. Use `colors.success` and `colors.error` for text/icons. For background overlays, utilize the token and append transparency strings (e.g., `colors.success + '20'`) inline instead of static hex values. For static white text on buttons, use `colors.primaryForeground` to adapt to theme correctly.
## 2025-05-16 - Hardcoded White Text on Status Indicators
**Learning:** Hardcoded white (`#FFFFFF`) colors inside `WelcomeHeader.tsx` for the notification badge text and edit avatar camera icon failed to adapt correctly, breaking the visual experience by hardcoding values into `StyleSheet.create` and component props instead of relying on the theme system.
**Action:** Always replace hardcoded white (`#FFFFFF`) text and icons with the foreground token for the background they sit on. Use `colors.textOnPrimary` for primary-colored buttons and icon backgrounds, and `colors.textOnNotification` for notification badges instead of statically defined hex values or unrelated foreground tokens.
## 2025-05-15 - Dynamic Colors for Interactive Elements
**Learning:** Hardcoding `#FFF` or `#F3F4F6`, and using static `BRAND.primary` in component styles breaks dark mode support and ignores semantic theme mapping like `colors.price`.
**Action:** Replace hardcoded colors with `colors.*` (like `colors.primaryForeground`, `colors.muted`, and `colors.primary`) to ensure components properly adapt to dark mode and respect the design system theme.
## 2025-05-17 - Hardcoded Colors in Checkout Identity Modal
**Learning:** Hardcoding `#FFF`, `#FFFFFF`, `#DC2626`, `#B91C1C`, `#FEE2E2` and using static `BRAND.primary` / `palette.gray` within component inline styles and `StyleSheet.create` breaks the modal's readability and integration with dark mode on mobile storefront.
**Action:** Replace direct hex and static palette imports with dynamic values from `useTheme().colors` applied through inline style arrays, keeping static `StyleSheet.create` as a base style.

## 2025-05-18 - [Fix Hardcoded Notification Colors]
**Learning:** Hardcoded specific background (`#F0F9FF`), border (`#BAE6FD`), and text (`#DC2626`, `#0369A1`, `#0C4A6E`) colors used in notification and checklist cards break visibility in dark mode, making them difficult to read against dark backgrounds.
**Action:** Replace hardcoded status/notification colors with their respective semantic theme tokens (e.g. `colors.infoLight`, `colors.info`, `colors.errorLight`, `colors.error`) using the `useTheme()` hook, to ensure proper contrast adjustments in dark mode automatically.
## 2026-05-08 - Hardcoded Status/Contact Colors in Mobile Admin
**Learning:** Hardcoded hex values like `#DCFCE7` (success light) or `#16A34A` (success dark) look fine in light mode but fail to adapt to dark mode backgrounds, making UI elements unreadable or visually inconsistent.
**Action:** Replace all such hardcoded hex values with their semantic `useTheme()` equivalents like `colors.successLight` or `colors.info` to ensure cross-theme consistency.
## 2026-05-12 - Replace hardcoded colors with theme tokens in Staff Accounts
**Learning:** Hardcoded hex colors and conditional fallbacks like `#FFF` or `|| '#E8F0FE'` break the design system and do not automatically adapt to dark mode.
**Action:** Use semantic theme tokens (e.g. `colors.textOnPrimary` and `colors.primaryLight`) directly from `useTheme()` instead of hardcoded hex values or unnecessary fallbacks.
## 2026-05-13 - Replace hardcoded brand colors with theme tokens in Analytics Config
**Learning:** Hardcoding brand colors like `#000000` for TikTok can make the icon completely invisible in dark mode when placed on dark card backgrounds (e.g., `#1A1A2E`). Furthermore, `#fff` for active toggle knob states should use semantic tokens.
**Action:** Always replace hardcoded static brand hex values like `#000000` with adaptive tokens from `useTheme()` like `colors.text` so they maintain contrast across both light and dark themes. Use `colors.textOnPrimary` for white toggle knobs so they correctly adapt to the active semantic tokens.
## 2024-05-17 - Replace Hardcoded Apple Sign-in Button Colors
**Learning:** The Apple sign-in button in the mobile app's authentication screen was using hardcoded `#000` (black) backgrounds and `#FFF` (white) text/icons, making it completely invisible when the app was in dark mode (where the main background is also `#000`).
**Action:** Replaced the hardcoded black `#000` with the adaptive theme token `colors.text` and the hardcoded white `#FFF` with `colors.card` so that the button contrasts properly and intelligently adapts to both light and dark modes.
## $(date +%Y-%m-%d) - Replaced hardcoded hex colors with dynamic theme colors in Discounts mobile screens
**Learning:** Hardcoded white `#FFFFFF` text on primary color backgrounds breaks theming consistency, and static border colors like `#eee` do not adjust well to dark mode. Also, `StyleSheet.create` cannot have dynamic colors natively.
**Action:** Removed hardcoded colors from `StyleSheet.create` in `apps/mobile-admin/app/(admin)/discounts/new.tsx` and `apps/mobile-admin/app/(admin)/discounts/index.tsx`. Replaced with `colors.textOnPrimary` and `colors.border` via inline styles array where needed, ensuring we use dynamic colors from `useTheme()` correctly without refactoring into factory functions.
## 2024-05-24 - Fix hardcoded white color in Expense FAB
**Learning:** Hardcoded `#FFFFFF` icons on primary backgrounds cause theming violations if the primary color requires a dark icon in certain themes, and fail to use semantic tokens.
**Action:** Always map white colors on primary backgrounds to `colors.textOnPrimary` from the `useTheme()` hook in Expo apps.

## 2025-05-18 - Extracted Hardcoded Colors from ProductCard.styles.ts
**Learning:** Hardcoded white/gray values (`#FFF`, `#F3F4F6`, `#111827`) in `StyleSheet.create` prevent React Native components from properly adapting to dark mode changes.
**Action:** Remove hardcoded layout colors from `StyleSheet.create` and pass them dynamically via `useTheme()` tokens in component inline styles (e.g., `colors.card`, `colors.border`, `colors.muted`, `colors.primaryForeground`).
## 2026-05-21 - Tab Layout Theming
**Learning:** Tab Layout requires adapting colors for multiple UI parts.
**Action:** Use theme instead of hardcoding.
