## 2024-03-22 - [Add ARIA labels to icon-only buttons]
**Learning:** [UX/a11y insight] Icon-only buttons (like `Trash2` for delete or `Sparkles` for AI submit) without `aria-label` are inaccessible to screen readers.
**Action:** [How to apply next time] Always add a descriptive `aria-label` (e.g., `aria-label="Delete image"`) to any button that uses an icon instead of text, especially when using the `<Button size="icon">` pattern.
