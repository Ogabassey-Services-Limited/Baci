# Tooling waves

Coordination doc for major-version bumps where a single Dependabot PR can't land cleanly because the upgrade is wedged on transitive peer-dependency chains. Replaces the "leave the PR open as a bookmark" pattern, which costs CI time on every main-branch push and rots over time.

## Pattern

When Dependabot proposes a major-version bump that requires a coordinated wave:

1. **Don't merge the bot PR.** It's almost always a single-line `package.json` change without the migration code.
2. **Close it,** with a comment pointing here.
3. **Add an `ignore` entry to `.github/dependabot.yml`** so the bot stops reopening it — the version-decision-of-record now lives in config, not in an open PR.
4. **Add the wave to the table below.**
5. **When the wave is ready** (the trigger condition met), open a single hand-authored PR that does the whole migration coordinated, then delete the ignore entry.

This file is the registry. The `dependabot.yml` ignore section mirrors it.

## Active waves

| Package | Stuck-at | Target | Trigger to unblock | Notes |
|---|---|---|---|---|
| `@vitejs/plugin-react` | `5.x` | `6.x` | `vitest@5` releases | plugin-react@6 requires `vite ^8`; vitest@4 requires `vite ^6 \|\| ^7`. The whole vite/vitest/plugin-react triplet has to move together. |

## Closed waves (record)

_(none yet — first entry will populate when a wave is shipped)_

## Why the pattern

- **Open Dependabot PRs are not bookmarks.** They consume CI on every push to main (auto-rebase + re-run all checks). On a self-hosted runner setup, that's an active resource cost.
- **Multiple stale Dependabot PRs from the same wave silently fight each other.** When one lands, the others rebase and re-run; when none can land, all of them rebase forever.
- **Major waves are architectural decisions, not automatic.** The migration code (PostCSS plugin swap, theme syntax migration, breaking-API call-site rewrites) is hand-authored — separating that from the version-bump-line is deliberate.

## Handoff to a wave PR

When the trigger condition is met (e.g. `vitest@5` ships):

1. Open a single feature branch: `chore/<wave-name>-migration` (e.g. `chore/vite-8-wave-migration`).
2. Make all coordinated changes in one PR — the version bumps for *all* coupled packages plus any required code/config migrations.
3. Run the full quality gate: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test && pnpm turbo build`.
4. Open the PR, link back to the row in this doc.
5. After merge, delete the `ignore` entry in `dependabot.yml` and move the row from **Active waves** to **Closed waves**.

## Adjacent best practices captured here

- **Patches/minors auto-merge via groups** (`dependabot.yml` `groups:` blocks). Single weekly PR per group, not N independent PRs.
- **CI-action bumps grouped** the same way — no point in 4 separate PRs to bump 4 GitHub Action SHAs.
- **Lockfile-only updates** are configured via Dependabot's `versioning-strategy: lockfile-only` if the team chooses that direction later (currently every bump moves the spec).
