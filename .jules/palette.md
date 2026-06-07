## 2026-06-07 - Add `accessibilityState` to auth loading buttons
**Learning:** React Native's `ActivityIndicator` visually indicates loading, but screen readers require `accessibilityState={{ disabled: true, busy: true }}` explicitly set on the parent interactive element (e.g., `Pressable`) to accurately announce the busy state and prevent double-activation during async operations.
**Action:** When adding an `ActivityIndicator` to a button for loading states, ensure the parent button correctly implements `accessibilityState={{ disabled: isLoading, busy: isLoading }}`.
