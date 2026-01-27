## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2026-01-27 - Accessibility: Focus Visibility for Overlay Actions
**Learning:** Actions that appear on hover (opacity-0 to opacity-100) are invisible to keyboard users. Using `group-hover:opacity-100` is insufficient.
**Action:** Always include `focus-within:opacity-100` (or `focus:opacity-100`) alongside hover states for overlay actions to ensure they become visible when a user tabs into them.
