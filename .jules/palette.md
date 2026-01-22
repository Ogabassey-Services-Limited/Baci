## 2024-05-23 - Accessibility in QuickViewModal
**Learning:** Interactive elements like thumbnails and variant selectors often get overlooked for accessibility because they are visual-first. Adding `aria-label` to thumbnails and `role="radio"` to custom variant buttons significantly improves the screen reader experience without changing the visual design.
**Action:** When creating custom selection controls (like color swatches), always consider them as radio buttons or tabs and apply appropriate ARIA roles.
