# Eclipse's Journal

## 2026-05-23 - Network Context Hardcoded Colors
**Learning:** Hardcoded text colors (e.g., `#000` on Orange, `#fff` on Green) in `NetworkContext.tsx` were a violation. Even for fixed background colors (like warning/success), we should use theme tokens to ensure the text color adapts or at least is semantically defined, rather than raw hex.
**Action:** When using fixed status colors (Warning Orange, Success Green), calculate high-contrast text colors using theme tokens: `isDark ? colors.background : colors.text` for warning (needs dark text), and `isDark ? colors.text : colors.card` for success (needs light text).
