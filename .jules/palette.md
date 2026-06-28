## 2024-05-18 — Password Toggle ARIA

**Learning:** When using `aria-pressed` to indicate a toggle state (like a password visibility button), the `aria-label` should remain static (e.g., "Show password") rather than changing dynamically. Changing both creates confusing, redundant screen reader announcements (e.g., "Hide password, toggle button, pressed").

**Action:** Ensure toggle buttons with state convey their state *only* through `aria-pressed` and keep their accessible name static.

**Source:** W3C ARIA Authoring Practices Guide (APG) for toggle buttons.
