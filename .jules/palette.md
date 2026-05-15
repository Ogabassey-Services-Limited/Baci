## 2026-05-12 - Missing ARIA Labels on Interactive Icon Buttons
**Learning:** Icon-only buttons (like Plus/Minus for quantity, heart for favorites, X for close) in interactive product components often miss `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always ensure `lucide-react` icons used as primary interaction points are wrapped in `<button>` tags with explicit, descriptive `aria-label` attributes.
## 2026-05-12 - Missing ARIA Labels on View Toggle Buttons
**Learning:** Icon-only buttons used for layout toggling (e.g. Grid vs List view using `LayoutGrid` and `List` icons) often rely only on the `title` attribute for tooltips but lack explicit `aria-label` attributes. This makes them less accessible to screen readers.
**Action:** Always verify that layout toggle buttons utilizing icon-only content have both `title` for visual tooltips and `aria-label` for screen reader accessibility.
