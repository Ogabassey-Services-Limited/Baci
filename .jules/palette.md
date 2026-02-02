## 2024-05-23 - Accessibility Anti-Pattern: tabIndex={-1}

**Learning:** Developers previously added `tabIndex={-1}` to interactive elements (specifically the password toggle) with the comment "Skip tab index to keep flow natural". This indicates a misunderstanding that "natural flow" means skipping secondary actions, whereas true accessibility requires all interactive elements to be reachable.
**Action:** When auditing components, specifically check for `tabIndex={-1}` on buttons inside inputs or complex widgets. Remove it to restore keyboard accessibility and rely on logical DOM order instead.

## 2024-05-24 - Product Pricing Context

**Learning:** `StorefrontProductCard` previously lacked pricing context (original price, percentage off) compared to `QuickViewModal`, making it harder for users to identify deals and causing accessibility gaps for screen readers who only heard the current price.
**Action:** When displaying discounted prices, always include the original price (crossed out) and a specific percentage badge. Use `sr-only` text to explicitly label "Original price" and "Current price" to prevent confusion for screen reader users and ensure strict WCAG 2.1 compliance.
