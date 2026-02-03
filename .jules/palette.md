## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2025-02-18 - Missing labels on dynamic inputs
**Learning:** Complex inputs like `TagInput` often have dynamic sub-components (remove buttons) that are visually clear but invisible to screen readers. We must explicitly label these dynamic actions.
**Action:** When creating list-based inputs, ensure every item's "remove" or "edit" action has a unique `aria-label` (e.g., "Remove [Item Name]").
