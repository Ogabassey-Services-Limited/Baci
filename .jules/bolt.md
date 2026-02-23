# 2024-05-23 - pnpm install ENOENT Fix

**Learning:** `pnpm install` in this monorepo can fail with `ENOENT` due to `esbuild` post-install race conditions.

**Fix (pnpm v10+):** Add `"esbuild"` to the `onlyBuiltDependencies` array in `package.json`, or run `pnpm install --allow-build=esbuild`. The earlier `pnpm.overrides` workaround is no longer needed — the underlying race condition was fixed upstream (pnpm PR #7949).

**Action:** When encountering this error, apply the fix to install dependencies, run tests, then revert `package.json` changes before submission:
```bash
# After reverting package.json, verify the revert is clean:
git diff package.json  # must be empty before proceeding
git add -A
```
