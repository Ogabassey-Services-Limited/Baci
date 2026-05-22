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
## 2024-05-18 - Mobile Admin Pressable Accessibility & Feedback
**Learning:** React Native `Pressable` components in the Baci monorepo often lack visual feedback and screen reader labels when initially created, particularly in dynamic mapped elements like lists and toggles. When refactoring complex `style` properties on `Pressable`, carefully wrapping existing style objects in arrays alongside the `({ pressed }) => [...]` function is necessary.
**Action:** When creating or modifying `Pressable` components, always use the `({ pressed }) => [pressed && { opacity: 0.7 }, ...]` pattern for visual feedback, and assign explicit `accessibilityLabel` attributes (especially mapped elements or icon buttons). Validate syntax correctness when refactoring inline styles.
## 2026-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like password show/hide toggles) are inaccessible to screen readers without an explicit label.
**Action:** Always add `accessibilityLabel` (and `accessibilityRole="button"`) to `Pressable` components that only contain icons.

## 2026-05-21 - Add aria-expanded to toggle buttons
**Learning:** Toggle buttons (like 'Show more/less') modifying the visual state of content require `aria-expanded` to accurately inform screen readers of their current state.
**Action:** Always bind `aria-expanded={state}` to any button functioning as an accordion or toggle switch.
## $(date +%Y-%m-%d) - Add aria-expanded to Toggle Buttons
**Learning:** In the web storefront, custom toggle buttons (like those for filters or expanding order summaries) often miss the `aria-expanded` attribute, causing assistive technologies to remain unaware of the collapsible content's state.
**Action:** Always ensure that custom disclosure widgets or toggle buttons explicitly implement `aria-expanded={booleanState}` to accurately reflect their expanded or collapsed status to screen readers.
