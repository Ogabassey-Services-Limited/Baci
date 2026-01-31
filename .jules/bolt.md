## 2024-05-24 - Intl.NumberFormat Caching
**Learning:** `new Intl.NumberFormat` is extremely expensive (~20-50x slower than .format()). In high-frequency render loops (like product grids), always cache the formatter instance.
**Action:** Use a module-level Map keyed by `locale-options` to cache instances in utility functions.
