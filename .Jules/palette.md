## 2024-05-22 - Focus Management in TagInput
**Learning:** `TagInput` component lost focus after deleting a tag, causing accessibility issues for keyboard users.
**Action:** When implementing deletable lists, always manage focus to the next/previous item or fallback input using `useRef` and `useEffect`.
