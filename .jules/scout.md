## 2026-06-30 — Testing simple config hooks
**Learning:** Because React Compiler is enabled, testing hooks outside of a React dispatcher (via \`renderHook\`) violates the Rules of Hooks and causes "Invalid hook call" runtime errors.
**Action:** Always use \`@testing-library/react\`'s \`renderHook\` to test all hooks, even simple configuration hooks like \`useIndustryTheme\`.
**Source:** Found during CI review and ADR-004 React Compiler enablement.
