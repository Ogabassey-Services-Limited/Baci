## 2026-05-12 - Missing ARIA Labels on Interactive Icon Buttons
**Learning:** Icon-only buttons (like Plus/Minus for quantity, heart for favorites, X for close) in interactive product components often miss `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always ensure `lucide-react` icons used as primary interaction points are wrapped in `<button>` tags with explicit, descriptive `aria-label` attributes.

## 2026-05-13 - Explicit type="button" for icon buttons
**Learning:** Interactive icon-only buttons without explicit `type="button"` can accidentally trigger form submissions.
**Action:** Always ensure `<button>` tags that don't submit forms have `type="button"` explicitly defined.
