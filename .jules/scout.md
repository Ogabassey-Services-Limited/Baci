## 2024-05-18 — Testing simple config hooks
**Learning:** Config hooks with statically defined fallbacks like `useIndustryTheme` are straightforward to test without any DOM, API, or Context dependencies.
**Action:** Use vitest purely to check input vs output on these functions instead of spinning up unnecessary complex react-testing-library renders.
**Source:** Found manually when exploring `useIndustryTheme.ts`.
