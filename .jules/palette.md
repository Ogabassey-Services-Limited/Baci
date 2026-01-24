## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2026-02-18 - Hidden Interactive Elements

**Learning:** "Quick View" buttons that appear only on hover (`opacity-0` -> `hover:opacity-100`) are invisible to keyboard users who tab through the page. They receive focus but the user sees no change, leading to a confusing "lost focus" experience.
**Action:** Always add `focus-visible:opacity-100` (and `focus-visible:ring`) to any interactive element that is visually hidden by default but remains in the tab order.
