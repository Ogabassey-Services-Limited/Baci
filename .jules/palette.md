## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.
