## 2026-05-12 - Missing ARIA Labels on Interactive Icon Buttons
**Learning:** Icon-only buttons (like Plus/Minus for quantity, heart for favorites, X for close) in interactive product components often miss `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always ensure `lucide-react` icons used as primary interaction points are wrapped in `<button>` tags with explicit, descriptive `aria-label` attributes.

## 2026-05-16 - Missing hitSlop on Compact Action Buttons
**Learning:** Interactive components like icon menus in list cards often fall below the 44x44px mobile touch target requirement, causing tap inaccuracy.
**Action:** Always use `hitSlop` on `TouchableOpacity` elements when their visual constraints prevent them from meeting the minimum 44x44 target dimensions.

## 2026-05-13 - Explicit type="button" for icon buttons

**Learning:** Interactive icon-only buttons without explicit `type="button"` can accidentally trigger form submissions.
**Action:** Always ensure `<button>` tags that don't submit forms have `type="button"` explicitly defined.
## 2024-05-30 - Interactive Elements Pressable Feedback and A11y
**Learning:** Custom interactive elements (like lists or buttons) built with React Native's `Pressable` often lack visual feedback when pressed and do not announce their role to screen readers by default.
**Action:** Always provide visual feedback using the `({ pressed }) => [...]` style pattern (e.g., `opacity: 0.7`) and explicitly assign an `accessibilityRole="button"` (or appropriate role) to enhance both visual UX and accessibility.
## 2026-05-18 - Enhanced Pressable Accessibility and Touch Feedback
**Learning:** In React Native, custom interactive elements using `Pressable` must explicitly define accessibility properties (`accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState`) to be compliant with screen readers. Additionally, providing visual feedback via the `({ pressed }) => [...]` style pattern is crucial for a responsive user experience.
**Action:** Always ensure that every `Pressable` functioning as a button includes appropriate `accessibilityRole`, descriptive labels, state indicators (like disabled), and visual opacity/color shifts when pressed.
