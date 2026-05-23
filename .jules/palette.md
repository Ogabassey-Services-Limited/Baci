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

## 2026-05-23 - Add aria-pressed to toggle buttons
**Learning:** Toggle buttons (like favorite hearts, color swatches) that modify a boolean state without expanding/collapsing content require `aria-pressed` to accurately inform screen readers of their toggled state.
**Action:** Always bind `aria-pressed={state}` to any button functioning as a two-state toggle switch that does not expand content.

## 2026-05-23 - Add aria-controls to aria-expanded toggles
**Learning:** Elements using `aria-expanded` should ideally be paired with `aria-controls` pointing to the ID of the expanded/collapsed container for complete screen reader support.
**Action:** Always add `aria-controls="id-of-container"` to toggle buttons and ensure the corresponding dropdown containers have matching `id` attributes.

## 2026-05-23 - Suboptimal ARIA label on color swatches
**Learning:** Using `aria-label={"Select color " + colorName}` alongside `aria-pressed` is redundant because `aria-pressed` already conveys the stateful nature of the button.
**Action:** Use cleaner labels like `aria-label={colorName}` when using `aria-pressed`.

## 2026-05-23 - Conditionally apply aria-controls for unmounted elements
**Learning:** If the target of an `aria-controls` attribute is conditionally unmounted (e.g., `return null` when closed instead of hidden via CSS), having a static `aria-controls="id"` on the toggle button will point to a non-existent DOM element, causing an accessibility violation.
**Action:** When the controlled element is conditionally unmounted, conditionally apply the attribute: `aria-controls={isOpen ? "id-of-container" : undefined}`.
