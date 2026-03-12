# Xcode Cloud Workflow Filters

Use Xcode Cloud start conditions to prevent both iOS workflows from running on every commit to `main`.

Official Apple docs:
- [Configuring start conditions](https://developer.apple.com/documentation/xcode/configuring-start-conditions)

## Storefront workflow

Workflow scheme:
- `Ogabassey`

Start condition:
- Branch changes on `main`

Specific files and folders:
- `apps/mobile-storefront/**`
- `packages/shared/**`
- `ci_scripts/**`
- `patches/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.nvmrc`

## Admin workflow

Workflow scheme:
- `Baci`

Start condition:
- Branch changes on `main`

Specific files and folders:
- `apps/mobile-admin/**`
- `packages/shared/**`
- `ci_scripts/**`
- `patches/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.nvmrc`

## Why shared paths are included

Both mobile apps depend on:
- shared workspace code in `packages/shared/**`
- root dependency resolution in `package.json` and `pnpm-lock.yaml`
- bootstrap logic in `ci_scripts/**`
- root patch-package overrides in `patches/**`

If those paths are excluded, Xcode Cloud can skip builds that should have run.

## Repo-side fallback

This repository also includes a fallback guard in `ci_scripts/should_run_xcode_cloud.sh`.
It fails fast when a workflow starts for an unrelated commit.

That fallback reduces wasted build time inside the workflow, but it does not stop
Xcode Cloud from creating the build record.
App Store Connect start conditions are still the primary fix if you want
irrelevant builds to stop showing up at all.
