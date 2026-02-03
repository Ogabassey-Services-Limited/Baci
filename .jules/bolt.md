## 2024-05-22 - Lazy Loading Client-Side Search Indices
**Learning:** Client-side search libraries like `Fuse.js` can be expensive to initialize (O(N*M)) on the main thread. In `StorefrontProductGrid`, this was happening on every product load, blocking the UI even if the user never searched.
**Action:** Use a `useRef` + `getFuseInstance` pattern to lazily initialize heavy search indices only when a search query is actually present. This moves the cost from "Initial Load" (critical) to "First Search Interaction" (acceptable latency).
