## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2024-05-24 - Accessibility Anti-Pattern: Hover-Only Reveal

**Learning:** Components using `opacity-0 group-hover:opacity-100` to reveal actions (like delete buttons) often forget keyboard users. Tabbing into these actions leaves focus on an invisible element.
**Action:** Always pair `group-hover:opacity-100` with `group-focus-within:opacity-100` (or `focus-visible:opacity-100` on the child) to ensure actions are visible when focused.
