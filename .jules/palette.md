## 2024-05-29 - [Forgot Password Screen Accessibility]
**Learning:** Mobile React Native forms lacking `returnKeyType` or `accessibilityRole="button"` and `accessibilityState` attributes create high friction for keyboard and screen reader users.
**Action:** Always ensure `returnKeyType="done"` with `onSubmitEditing`, use `accessibilityRole="button"`, and set `accessibilityState={{ disabled: true, busy: true }}` on disabled/loading buttons to improve a11y on interactive UI.
