## 2026-02-19 - [Middleware Performance]
**Learning:** Middleware runs on every request. Re-instantiating complex objects like RegExp inside the handler adds unnecessary overhead. Moving them to module-level constants avoids this.
**Action:** Always check middleware/proxy files for object instantiation in the main handler function.
