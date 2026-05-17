## 2026-05-12 - Missing ARIA Labels on Interactive Icon Buttons
**Learning:** Icon-only buttons (like Plus/Minus for quantity, heart for favorites, X for close) in interactive product components often miss `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always ensure `lucide-react` icons used as primary interaction points are wrapped in `<button>` tags with explicit, descriptive `aria-label` attributes.

## 2026-05-16 - Missing hitSlop on Compact Action Buttons
**Learning:** Interactive components like icon menus in list cards often fall below the 44x44px mobile touch target requirement, causing tap inaccuracy.
**Action:** Always use `hitSlop` on `TouchableOpacity` elements when their visual constraints prevent them from meeting the minimum 44x44 target dimensions.
