## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2026-03-04 - Accessible Hover Controls

**Learning:** "Quick View" buttons revealed on hover were implemented inside `Link` elements (invalid HTML) and lacked keyboard accessibility (invisible on focus).
**Action:** When implementing hover-only controls:
1. Ensure they are NOT nested inside other interactive elements (like `Link`).
2. Add `focus-visible:opacity-100` and `focus-visible:outline-none` so keyboard users can discover and use them.
3. Use a wrapper with `relative group` to coordinate hover effects across siblings.
