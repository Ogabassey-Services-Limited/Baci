## 2025-02-18 - Avoid Buffer in Client Utilities
**Learning:** Using `Buffer` in utilities shared between server and client forces the bundler to include polyfills and is slower than native browser APIs.
**Action:** Use `window.btoa` when `typeof window !== 'undefined'` for base64 encoding in shared code.
