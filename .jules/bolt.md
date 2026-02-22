## 2024-05-23 - pnpm install ENOENT Fix
**Learning:** `pnpm install` in this monorepo fails with `ENOENT` due to `esbuild` race conditions unless `esbuild` version is pinned via `pnpm.overrides`. This requires temporarily modifying `package.json`.
**Action:** When encountering this error, apply the override to install dependencies, run tests, then revert `package.json` changes before submission to avoid committing unauthorized configuration changes.
