# Web Zod v4 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `@baci/web` and its web-facing shared schemas from Zod v3 to Zod v4 in a clean isolated worktree, with per-surface documentation, full automated validation, and Browser QA before opening a PR.

**Architecture:** Treat this as a dependency-and-validation migration, not a Dependabot lockfile bump. The work must first align package peers, then run the codemod, then manually audit semantic Zod v4 behavior changes around defaults, custom errors, form resolvers, and shared schema ownership. Browser QA is required before PR creation because Zod drives user-facing forms and checkout validation.

**Tech Stack:** pnpm workspace, Turborepo, Next.js 16 App Router, React 19, React Hook Form, `@hookform/resolvers`, Zod v4, Vitest, Biome, in-app Browser.

---

## Current Baseline From `origin/main`

Worktree created for this migration:

```bash
cd /Users/mac/Baci-app
git worktree add /Users/mac/Baci-app/.worktrees/web-zod-v4-migration \
  -b codex/web-zod-v4-migration origin/main
```

Current worktree state:

```text
path: /Users/mac/Baci-app/.worktrees/web-zod-v4-migration
branch: codex/web-zod-v4-migration
initial base: origin/main at 91aab3ff35
final verified base before PR push: origin/main at f39994e25f
```

Initial package facts before migration:

```text
apps/web/package.json:
- @hookform/resolvers: ^5.4.0
- react-hook-form: ^7.76.1
- zod: ^3.25.76
- ai: ^6.0.193

packages/shared/package.json:
- imports Zod from source files, but currently declares no zod dependency
```

Current inventory from the clean worktree:

```text
215 tracked TypeScript files import Zod under apps/web/src, apps/web/mcp-server, and packages/shared/src
25 web source files use zodResolver
52 files contain .default(...) under apps/web/src or apps/web/mcp-server
166 files exist under apps/web/src/schemas
29 files contain useForm(...) or useForm<...>(...) under apps/web/src
```

Important migration facts verified from current docs/package metadata:

```text
Zod v4 latest stable checked: 4.4.3, published 2026-05-04
Zod canary checked: 4.5.0-canary.20260504T180558, intentionally not used
zod-v3-to-v4 latest checked: 1.21.2
@hookform/resolvers latest checked: 5.4.0
openai latest checked: 6.39.1
openai@6.39.1 peerDependencies: zod ^3.25 || ^4.0
current lockfile still includes openai@4.104.0 through LangSmith/LangChain/CopilotKit peer paths
Zod v4 docs checked: https://zod.dev/v4/changelog and https://zod.dev/v4
```

`openai 6.39.1` is not an OpenAI model version. It is the npm package version for the `openai` JavaScript SDK. It matters only because the currently locked `openai@4.104.0` has a Zod v3 peer path in the lockfile, while current `openai@6.39.1` declares compatibility with both Zod 3 and Zod 4.

## Surfaces That Must Be Documented During Implementation

Create and maintain this audit file while implementing:

```text
docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
```

The audit file must include these sections before the PR is opened:

```markdown
# Web Zod v4 Migration Audit

## Dependency Graph
- package.json changes
- lockfile peer changes
- whether openai changed, and why
- whether packages/shared now declares zod, and why

## Codemod Scope
- exact codemod command
- files changed by codemod
- files reverted from noisy codemod output

## Manual Zod Syntax Fixes
- required_error / invalid_type_error replacements
- errorMap option replacements, excluding ordinary local variables named errorMap
- ZodError .errors alias replacements with .issues
- z.record checks, including single-argument records and enum-key exhaustiveness
- z.partialRecord decisions for partial enum-key maps
- ctx.path removal inside refine/superRefine callbacks
- deprecated or changed Zod APIs, including z.nativeEnum and z.ostring/z.onumber/z.oboolean if present

## Defaults Audit
- every touched .default(...) location
- decision: keep .default or rewrite to .prefault
- reason for each .prefault rewrite

## React Hook Form Resolver Audit
- every zodResolver call site touched
- form generic changes
- before/after validation behavior for invalid inputs

## Runtime/API Schema Audit
- API route schemas touched
- AI/MCP/tool schemas touched
- checkout/payment-adjacent schemas touched

## Browser QA Evidence
- local URL
- scenarios executed
- screenshots captured
- console/runtime errors checked

## Automated Validation
- exact commands
- pass/fail summaries
- any known unrelated flakes and direct reruns
```

---

## Task 1: Prepare The Isolated Worktree And Baseline

**Files:**
- Modify: `docs/superpowers/plans/2026-05-31-web-zod-v4-migration.md`
- Create later: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Enter the isolated worktree**

```bash
cd /Users/mac/Baci-app/.worktrees/web-zod-v4-migration
git status --short
git branch --show-current
git rev-parse --short=10 HEAD
```

Expected:

```text
codex/web-zod-v4-migration
91aab3ff35 or newer origin/main commit
```

- [ ] **Step 2: Install from the current lockfile**

```bash
pnpm install --frozen-lockfile --prefer-offline
```

Expected:

```text
Lockfile is up to date
Done
```

- [ ] **Step 3: Run baseline web and shared checks before changing dependencies**

```bash
pnpm --filter @baci/shared typecheck
pnpm --filter @baci/shared test
pnpm --filter @baci/web typecheck
pnpm --filter @baci/web test
pnpm --filter @baci/web lint
```

Expected:

```text
All commands pass before migration changes.
```

If a baseline command fails before edits, stop and document the failure in the audit. Do not open a PR until the baseline is understood.

- [ ] **Step 4: Create the migration audit file**

```bash
cat > docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md <<'EOF'
# Web Zod v4 Migration Audit

## Dependency Graph

## Codemod Scope

## Manual Zod Syntax Fixes

## Defaults Audit

## React Hook Form Resolver Audit

## Runtime/API Schema Audit

## Browser QA Evidence

## Automated Validation
EOF
```

- [ ] **Step 5: Generate the initial inventory appendices**

```bash
git ls-files \
  'apps/web/src/*.ts' 'apps/web/src/*.tsx' \
  'apps/web/src/**/*.ts' 'apps/web/src/**/*.tsx' \
  'apps/web/mcp-server/*.ts' 'apps/web/mcp-server/**/*.ts' \
  'packages/shared/src/*.ts' 'packages/shared/src/**/*.ts' \
  | rg -v '(^|/)(assets|dist|build|coverage)/|\.backup$|\.log$' \
  > /tmp/web-zod-v4-tracked-ts-files.txt

xargs -n 100 rg -l "from ['\"]zod|import z from ['\"]zod|import \\{ z \\} from ['\"]zod" \
  < /tmp/web-zod-v4-tracked-ts-files.txt \
  | sort -u \
  > /tmp/web-zod-v4-zod-files.txt

{
  echo '## Initial Inventory'
  echo
  echo '```text'
  printf 'Zod import files: '
  wc -l < /tmp/web-zod-v4-zod-files.txt
  printf 'zodResolver files: '
  xargs -n 100 rg -l "zodResolver" < /tmp/web-zod-v4-tracked-ts-files.txt | sort -u | wc -l
  printf '.default files: '
  xargs -n 100 rg -l "\\.default\\(" < /tmp/web-zod-v4-zod-files.txt | sort -u | wc -l
  printf 'schema files: '
  find apps/web/src/schemas -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l
  echo '```'
  echo
  echo '## Zod Import Files'
  echo
  cat /tmp/web-zod-v4-zod-files.txt
  echo
  echo '## zodResolver Call Sites'
  echo
  rg -n "zodResolver|useForm<|useForm\\(" apps/web/src
  echo
  echo '## Default Call Sites'
  echo
  xargs -n 100 rg -n "\\.default\\(" < /tmp/web-zod-v4-zod-files.txt
  echo
  echo '## Removed Zod v4 Error Options'
  echo
  xargs -n 100 rg -n "required_error|invalid_type_error" < /tmp/web-zod-v4-zod-files.txt || true
  echo
  echo '## Dropped ZodError Aliases And Error Customizers'
  echo
  xargs -n 100 rg -n "\\.errors\\b|\\.formErrors\\b|errorMap|ctx\\.path" < /tmp/web-zod-v4-zod-files.txt || true
  echo
  echo '## z.record Call Sites'
  echo
  xargs -n 100 rg -n "z\\.record\\(" < /tmp/web-zod-v4-zod-files.txt
  echo
  echo '## Other Deprecated Or Changed Zod APIs'
  echo
  xargs -n 100 rg -n "z\\.nativeEnum|z\\.ostring|z\\.onumber|z\\.oboolean|\\.deepPartial\\(|\\.nonstrict\\(|z\\.function\\(|\\.args\\(|\\.returns\\(" < /tmp/web-zod-v4-zod-files.txt || true
} >> docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
```

- [ ] **Step 6: Commit the baseline audit shell only after it is populated**

```bash
git add \
  docs/superpowers/plans/2026-05-31-web-zod-v4-migration.md \
  docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
git commit -m "docs: add web zod v4 migration audit"
```

---

## Task 2: Align Dependencies For Zod v4

**Files:**
- Modify: `apps/web/package.json`
- Modify: `packages/shared/package.json`
- Modify: `pnpm-lock.yaml`
- Maybe modify: `package.json` only if TypeScript peer resolution still selects Zod 3 for resolver types
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Update direct Zod ownership**

Expected edits:

```json
// apps/web/package.json
{
  "dependencies": {
    "@hookform/resolvers": "^5.4.0",
    "react-hook-form": "^7.76.1",
    "zod": "^4.4.3"
  }
}
```

Add `zod` to `packages/shared/package.json` because shared source imports Zod and exports shared schemas:

```json
// packages/shared/package.json
{
  "dependencies": {
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.1.7"
  }
}
```

Do not downgrade `@hookform/resolvers`; it is already `^5.4.0`, which is above the advised `5.1.1+`.

- [ ] **Step 2: Refresh the lockfile**

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile --prefer-offline
```

Expected:

```text
zod 4.4.3 is selected for @baci/web and @baci/shared.
```

- [ ] **Step 3: Inspect peer graph**

```bash
pnpm --filter @baci/web why zod
pnpm --filter @baci/web why @hookform/resolvers
pnpm --filter @baci/web why openai
```

Decision rules:

```text
If @hookform/resolvers resolves Zod v4 cleanly, keep package.json minimal.
If resolver type declarations still reference Zod 3, add a root devDependency "zod": "^4.4.3" and document why.
If openai@4.104.0 creates only a peer warning but no install/type/runtime failure, do not upgrade openai in this PR.
If openai@4.104.0 creates a hard peer/type failure, stop and decide whether this PR also upgrades the OpenAI SDK to 6.39.1 or splits that as a prerequisite PR.
```

- [ ] **Step 4: Record dependency decisions in the audit**

```markdown
## Dependency Graph
- apps/web zod: ^3.25.76 -> ^4.4.3
- packages/shared zod: added ^4.4.3 because shared exports Zod-backed schemas
- @hookform/resolvers: stayed ^5.4.0 because already Zod v4 capable
- openai: unchanged or changed, with reason
- peer warnings: none / listed with explanation
```

- [ ] **Step 5: Commit dependency alignment**

```bash
git add apps/web/package.json packages/shared/package.json pnpm-lock.yaml docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
git commit -m "build: align web schemas on zod v4"
```

---

## Task 3: Run The Zod v3-to-v4 Codemod

**Files:**
- Modify: Zod call sites under `apps/web/src`
- Modify: Zod call sites under `apps/web/mcp-server`
- Modify: Zod call sites under `packages/shared/src`
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Run the codemod with pnpm, not npx**

Use `pnpm dlx` because this repo forbids npm/yarn tooling for agent work.
`zod-v3-to-v4@1.21.2` expects a `tsconfig.json` path as its non-interactive argument, so use a temporary scoped tsconfig instead of passing individual source files as positional arguments.

```bash
git ls-files \
  'apps/web/src/*.ts' 'apps/web/src/*.tsx' \
  'apps/web/src/**/*.ts' 'apps/web/src/**/*.tsx' \
  'apps/web/mcp-server/*.ts' 'apps/web/mcp-server/**/*.ts' \
  'packages/shared/src/*.ts' 'packages/shared/src/**/*.ts' \
  | rg -v '(^|/)(assets|dist|build|coverage)/|\.backup$|\.log$' \
  > /tmp/web-zod-v4-tracked-ts-files.txt

xargs -n 100 rg -l "from ['\"]zod|import z from ['\"]zod|import \\{ z \\} from ['\"]zod" \
  < /tmp/web-zod-v4-tracked-ts-files.txt \
  | sort -u \
  > /tmp/web-zod-v4-codemod-files.txt

cat > apps/web/tsconfig.zod-v4-codemod.json <<'EOF'
{
  "extends": "./tsconfig.json",
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "mcp-server/**/*.ts",
    "../../packages/shared/src/**/*.ts"
  ],
  "exclude": [
    "src/**/assets/**",
    "mcp-server/assets/**",
    "**/*.backup",
    "**/*.log",
    ".next",
    "node_modules"
  ]
}
EOF

pnpm dlx zod-v3-to-v4@1.21.2 apps/web/tsconfig.zod-v4-codemod.json
rm apps/web/tsconfig.zod-v4-codemod.json
```

Expected:

```text
Codemod applies standard Zod v4 rewrites only to files reachable from the scoped temporary tsconfig.
```

- [ ] **Step 2: Review the diff before manual edits**

```bash
git diff --stat
git diff -- apps/web/src apps/web/mcp-server packages/shared/src | sed -n '1,260p'
```

- [ ] **Step 3: Reject noisy or unsafe codemod output**

Do not accept changes that:

```text
- add `any`
- add `dangerouslySetInnerHTML`
- touch apps/web/src/proxy.ts
- touch existing supabase/migrations files
- rewrite unrelated formatting across large non-schema files
- change runtime behavior without a schema reason
- modify apps/web/mcp-server/assets, *.backup, generated output, logs, or built artifacts
- leave apps/web/tsconfig.zod-v4-codemod.json in the final diff
```

- [ ] **Step 4: Record codemod scope**

Append this to the audit:

```bash
{
  echo
  echo '## Codemod Changed Files'
  git diff --name-only
} >> docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
```

- [ ] **Step 5: Commit codemod output only after review**

```bash
git add apps/web/src apps/web/mcp-server packages/shared/src docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
git commit -m "chore: run zod v4 codemod for web"
```

---

## Task 4: Manually Fix Zod v4 Syntax And Semantics

**Files known before codemod:**
- Modify: `apps/web/src/schemas/staff-accept.ts`
- Modify: `apps/web/src/schemas/README.md`
- Likely modify: `apps/web/src/app/api/products/[id]/route.test.ts`
- Likely modify: `apps/web/src/app/api/products/route.test.ts`
- Likely modify: `apps/web/src/lib/schemas.ts`
- Audit: all files found by `rg -n "required_error|invalid_type_error|errorMap|\\.errors\\b|ctx\\.path|z\\.record\\(|\\.default\\(" apps/web/src apps/web/mcp-server packages/shared/src`
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Replace removed `required_error` and `invalid_type_error` usage**

Known current source:

```text
apps/web/src/schemas/staff-accept.ts
```

Expected Zod v4 pattern:

```ts
const inviteTokenSchema = z.string({
  error: (issue) =>
    issue.input === undefined ? 'Invitation token is required' : 'Invitation token is required',
});
```

If the field only needs one message for missing and invalid input, simplify to:

```ts
const inviteTokenSchema = z.string({ error: 'Invitation token is required' });
```

- [ ] **Step 2: Correct stale schema README guidance**

`apps/web/src/schemas/README.md` currently says `required_error` and `invalid_type_error` remain supported. That is false for Zod v4. Replace the guidance with:

````markdown
### 4. Custom Error Messages
- Zod v4 removed `required_error` and `invalid_type_error`.
- Use the unified `error` parameter for primitive constructors.
- Use an `error` callback when required and invalid-type messages need to differ.

```ts
const nameSchema = z.string({
  error: (issue) =>
    issue.input === undefined ? 'This field is required' : 'Not a valid string',
});
```
````

- [ ] **Step 3: Audit `z.record`**

Command:

```bash
xargs -n 100 rg -n "z\\.record\\(" < /tmp/web-zod-v4-codemod-files.txt
```

Expected:

```text
Every record schema should pass both key and value schemas, e.g. z.record(z.string(), z.unknown()).
Replace z.record(z.any()) or z.record(z.string(), z.any()) with z.record(z.string(), z.unknown()) unless a narrower value schema exists.
If the key schema is z.enum(...), Zod v4 requires all enum keys to exist. Use z.partialRecord(...) only when the old partial enum-key behavior is intended.
```

- [ ] **Step 4: Audit dropped Zod error APIs**

Command:

```bash
xargs -n 100 rg -n "\\.errors\\b|\\.formErrors\\b|errorMap|required_error|invalid_type_error|ctx\\.path" \
  < /tmp/web-zod-v4-codemod-files.txt
```

Decision rules:

```text
Replace ZodError.errors with ZodError.issues.
Replace Zod .formErrors with .flatten().
Replace Zod errorMap options with the unified error callback.
Do not change unrelated application objects or local variables named errors/errorMap.
Remove ctx.path usage inside refine/superRefine callbacks; add explicit path to ctx.addIssue when needed.
```

Known likely ZodError alias candidates:

```text
apps/web/src/app/api/products/[id]/route.test.ts
apps/web/src/app/api/products/route.test.ts
```

- [ ] **Step 5: Audit other deprecated or changed Zod APIs**

Command:

```bash
xargs -n 100 rg -n "z\\.nativeEnum|z\\.ostring|z\\.onumber|z\\.oboolean|\\.deepPartial\\(|\\.nonstrict\\(|z\\.function\\(|\\.args\\(|\\.returns\\(" \
  < /tmp/web-zod-v4-codemod-files.txt
```

Decision rules:

```text
Use z.enum(...) instead of z.nativeEnum(...) if the codemod does not already change it.
Replace z.ostring/z.onumber/z.oboolean with explicit z.string().optional(), z.number().optional(), or z.boolean().optional().
Treat .deepPartial(), .nonstrict(), and z.function().args().returns() as blockers for manual migration before typecheck.
Do not rewrite deprecated-but-working style APIs such as z.string().email() unless typecheck, runtime behavior, or a touched test requires it.
```

- [ ] **Step 6: Audit `.default()` and choose `.prefault()` only where needed**

Command:

```bash
xargs -n 100 rg -n "\\.default\\(" < /tmp/web-zod-v4-codemod-files.txt
```

Decision rule:

```text
Keep .default() when the default value is trusted and already valid, and it is acceptable that Zod v4 returns it without running transforms/refinements.
Use .prefault() when the old Zod v3 behavior is required: undefined input should first receive the fallback value and then still run trim/coerce/transform/refine/min/max validation.
Remember that Zod v4 also applies defaults inside optional object fields. Verify any optional nested field defaults still produce the intended output shape.
```

High-risk defaults to review manually:

```text
apps/web/src/env.ts
apps/web/src/schemas/bumpa-products.ts
apps/web/src/schemas/bumpa-orders.ts
apps/web/src/schemas/orders.ts
apps/web/src/schemas/products.ts
apps/web/src/schemas/ai-storefront-layout.ts
apps/web/src/schemas/builder.ts
apps/web/src/app/dashboard/products/add/add-product-form.tsx
apps/web/src/app/api/payments/initialize/route.ts
apps/web/mcp-server/agentic-checkout-client.ts
apps/web/mcp-server/agentic-ucp-client.ts
```

Audit format for each touched default:

```markdown
| File | Schema | Old | New | Reason |
| --- | --- | --- | --- | --- |
| apps/web/src/schemas/products.ts | productStatusSchema | `.default('draft')` | kept `.default('draft')` | default is a valid enum member and no transform must run |
```

- [ ] **Step 7: Avoid broad optional syntax churn**

Do not rewrite all `z.string().email()` to top-level `z.email()` unless required by typecheck or runtime behavior. That kind of style churn expands review risk and is not needed for a clean migration.

- [ ] **Step 8: Commit manual syntax and semantic fixes**

```bash
git add apps/web/src apps/web/mcp-server packages/shared/src docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
git commit -m "fix: adapt web schemas for zod v4 semantics"
```

---

## Task 5: Fix React Hook Form Resolver Type And Behavior Issues

**Files known before migration:**
- Audit all 25 files reported by `rg -n "zodResolver|useForm<|useForm\\(" apps/web/src`
- Likely touch form files only where typecheck or behavior requires it
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Run focused typecheck after syntax fixes**

Use the package script first:

```bash
pnpm --filter @baci/web typecheck
```

If the package script stalls on the local shebang, use the known direct fallback:

```bash
cd apps/web
node ../../node_modules/typescript/bin/tsc --noEmit --pretty false
```

- [ ] **Step 2: Fix resolver generic mismatches**

Expected pattern for transformed schemas:

```ts
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const form = useForm<FormInput, unknown, FormValues>({
  resolver: zodResolver(schema),
});
```

Do not keep casts like:

```ts
zodResolver(schema as any)
```

Replace them with correct input/output types or a narrow `Resolver<FormInput, unknown, FormValues>` annotation only when the resolver package cannot infer correctly.

- [ ] **Step 3: Check known form groups**

Audit and document each group:

```text
Auth:
- apps/web/src/components/auth/signup-form.tsx
- apps/web/src/components/auth/verify-form.tsx
- apps/web/src/app/(platform)/reset-password/page.tsx

Checkout:
- apps/web/src/app/checkout/page.tsx

Onboarding:
- apps/web/src/components/onboarding-form.tsx
- apps/web/src/components/onboarding/steps/*.test.tsx

Dashboard:
- apps/web/src/app/dashboard/products/add/add-product-form.tsx
- apps/web/src/app/dashboard/orders/create/create-order-form.tsx
- apps/web/src/app/dashboard/orders/[orderId]/fulfillment-dialog.tsx
- apps/web/src/app/dashboard/settings/components/settings-form.tsx
- apps/web/src/app/dashboard/settings/security/security-form.tsx
- apps/web/src/app/dashboard/staff/team-client.tsx

Marketplace/Jumia:
- apps/web/src/components/products/jumia-price-form.tsx
- apps/web/src/components/jumia/consignment/*.tsx

Storefront:
- apps/web/src/components/storefront/RepairBookingWizard.tsx
```

- [ ] **Step 4: Add or adjust tests only for changed behavior**

If a `.prefault()` decision changes parsing behavior or a form resolver type fix exposes a validation branch, add a colocated test for that exact behavior. Prefer existing test files where present.

Example schema test pattern:

```ts
import { describe, expect, it } from 'vitest';
import { schemaName } from './schema-file';

describe('schemaName', () => {
  it('keeps validating the fallback value for undefined input', () => {
    const result = schemaName.safeParse(undefined);

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 5: Commit resolver fixes**

```bash
git add apps/web/src docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
git commit -m "fix: align web forms with zod v4 resolver types"
```

---

## Task 6: Validate Automated Tests Before Browser QA

**Files:**
- Modify only if tests reveal migration bugs
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Run package typechecks**

```bash
pnpm --filter @baci/shared typecheck
pnpm --filter @baci/web typecheck
```

- [ ] **Step 2: Run schema and form-focused tests**

```bash
pnpm --filter @baci/shared test
pnpm --filter @baci/web exec vitest run src/schemas
pnpm --filter @baci/web exec vitest run \
  src/components/auth \
  src/components/onboarding \
  src/components/jumia \
  src/components/products \
  src/app/checkout \
  src/app/dashboard
```

If Vitest does not accept one of those paths because no tests exist there, rerun with actual test files discovered by:

```bash
find apps/web/src -path '*test.*' \
  | sed 's#^apps/web/##' \
  | rg 'schemas|auth|onboarding|jumia|products|checkout|dashboard'
```

- [ ] **Step 3: Run full web and shared tests**

```bash
pnpm --filter @baci/web test
pnpm --filter @baci/shared test
```

- [ ] **Step 4: Run lint**

```bash
pnpm --filter @baci/web lint
```

- [ ] **Step 5: Run monorepo gates before Browser**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Do not run `vercel build` or any cloud-building deploy command.

- [ ] **Step 6: Run CodeRabbit on the whole branch diff**

```bash
coderabbit review --agent --base origin/main
```

Fix all critical/high findings before proceeding. Do not use `-t uncommitted` here because the plan commits at task boundaries and uncommitted-only review would miss already committed migration changes.

- [ ] **Step 7: Commit test fixes and audit updates**

```bash
git add apps/web packages/shared docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md pnpm-lock.yaml package.json
git commit -m "test: verify web zod v4 migration"
```

---

## Task 7: Browser QA Before Opening A PR

**Files:**
- Modify only if Browser reveals bugs
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Start the local web app**

Before starting the app, verify the worktree is not pointed at production services for Browser QA:

```bash
find . -maxdepth 4 -type f -name '.env*' \
  -not -path './.git/*' \
  -not -path './node_modules/*' \
  -not -path './apps/web/.next/*' \
  -print \
  | while IFS= read -r env_file; do
      rg --line-number --only-matching \
        '^[[:space:]]*(export[[:space:]]+)?(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL|PAYSTACK|KORAPAY|KUDA|CREDIT_DIRECT|MONNIFY|VERCEL_ENV|NODE_ENV)[[:space:]]*=' \
        "$env_file" \
        | sed -E "s#^#${env_file}:#; s#=.*#=<redacted>#"
      if rg -q 'https://[^[:space:]]+supabase\\.co|production|sk_live|pk_live|live_' "$env_file"; then
        printf '%s: production-like marker present; restrict QA mutations unless this is a safe dev fixture\n' "$env_file"
      fi
    done \
  | sed -n '1,120p'
```

Expected:

```text
No production payment gateway keys or production Supabase URL are used for Browser mutation tests.
If only production-like env is available, restrict Browser QA to validation-only submits that do not cross API/payment boundaries and document the limitation.
```

```bash
pnpm --filter @baci/web dev
```

Use the printed localhost URL, usually:

```text
http://localhost:3000
```

- [ ] **Step 2: Connect Browser to the local app**

Use the in-app Browser plugin, not macOS `open` and not an external browser. Keep Browser in the background unless the user asks to watch.

- [ ] **Step 3: Verify unauthenticated form validation**

Browser scenarios:

```text
Reset password:
- open /reset-password or the current reset-password route
- submit empty/invalid values
- confirm Zod errors render
- fill valid-looking values without completing irreversible account changes

Signup:
- open the signup route
- submit invalid email, weak password, and mismatch confirmation
- confirm Zod errors render
- do not create a production user

Checkout:
- open /checkout
- test OTP auth form invalid phone/email values
- test shipping form missing required fields
- do not initialize a real payment
```

Evidence:

```text
- screenshot before submit
- screenshot after validation errors
- Browser console errors after each route
```

- [ ] **Step 4: Verify storefront/customer validation**

Browser scenarios:

```text
Repair booking wizard:
- open a route that renders RepairBookingWizard
- submit missing service/contact fields
- confirm validation errors

Storefront product/cart flow:
- open a public storefront product page available in local data
- add product to cart if data exists
- proceed to checkout validation without payment
```

If local data does not expose a public storefront route, document the blocker and cover the same schemas with Vitest. Do not claim Browser coverage for a route that was not exercised.

- [ ] **Step 5: Verify authenticated dashboard forms**

Use only a local/dev account that is already available to the environment. Do not ask the app to create real merchant or payment state in production.

Browser scenarios:

```text
Product add form:
- submit empty form
- confirm required-field errors
- fill minimum safe draft data if dev account exists

Create order form:
- submit empty form
- confirm customer/product/payment validation errors

Settings form:
- submit invalid phone/domain/settings values
- confirm validation errors

Staff invite:
- submit invalid email/role
- confirm validation errors

KYC forms:
- submit invalid BVN/NIN formats
- confirm validation errors

Jumia forms:
- submit invalid price/consignment/check-stock inputs
- confirm validation errors
```

If authenticated QA is blocked by missing safe credentials, stop before PR creation and ask for a dev login or explicit approval to use a known local test account.

Before any authenticated Browser submit that can create orders, products, staff invites, payment attempts, KYC submissions, or merchant settings, confirm the route is running against local/dev data. If that cannot be verified, perform only client-side invalid validation submits and document that no successful mutations were executed.

- [ ] **Step 6: Record Browser QA evidence**

Append to the audit:

```markdown
## Browser QA Evidence

| Route | Scenario | Result | Screenshot | Console errors |
| --- | --- | --- | --- | --- |
| /checkout | empty shipping submit | pass | screenshot path or final response image | none |
```

- [ ] **Step 7: Fix any Browser-discovered issues and rerun relevant tests**

For every Browser bug:

```bash
pnpm --filter @baci/web typecheck
pnpm --filter @baci/web exec vitest run <relevant-test-file>
```

- [ ] **Step 8: Commit Browser QA fixes**

```bash
git add apps/web packages/shared docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md
git commit -m "fix: harden zod v4 browser validation paths"
```

---

## Task 8: Final Verification And PR Creation

**Files:**
- No source edits unless final checks fail
- Update: `docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md`

- [ ] **Step 1: Rebase and confirm no accidental protected-file edits**

```bash
env -u GITHUB_TOKEN git fetch origin main
git rebase origin/main
git diff --name-only origin/main...HEAD | rg '(^|/)proxy\\.ts$|^supabase/migrations/' && exit 1 || true
```

Expected:

```text
No output.
```

- [ ] **Step 2: Run final gate**

```bash
pnpm install --frozen-lockfile --prefer-offline
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
coderabbit review --agent --base origin/main
```

- [ ] **Step 3: Review final diff**

```bash
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Expected categories:

```text
apps/web/package.json
packages/shared/package.json
pnpm-lock.yaml
Zod schema files
React Hook Form files only where required
schema/form tests
migration audit doc
```

- [ ] **Step 4: Push branch**

```bash
env -u GITHUB_TOKEN git push -u origin codex/web-zod-v4-migration
```

- [ ] **Step 5: Create the PR body file**

```bash
cat > /tmp/web-zod-v4-pr-body.md <<'EOF'
## Summary
- Migrates @baci/web and web-facing shared schemas to Zod v4.
- Aligns package ownership for Zod in @baci/shared.
- Documents defaults, resolver, and runtime schema audit in docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md.

## Validation
- pnpm install --frozen-lockfile --prefer-offline
- pnpm turbo lint
- pnpm turbo typecheck
- pnpm turbo test
- coderabbit review --agent --base origin/main
- Browser QA: routes and screenshots listed in the audit

## Risk Notes
- Zod v4 .default() short-circuits undefined input; audited .default/.prefault decisions are documented.
- React Hook Form resolver call sites were tested with invalid inputs.
- Browser QA used local/dev or validation-only flows; no real payment or production mutation flows were executed.
- No proxy.ts or existing migrations touched.
EOF
```

- [ ] **Step 6: Open PR only after Browser QA and local gates pass**

```bash
env -u GITHUB_TOKEN gh pr create \
  --base main \
  --head codex/web-zod-v4-migration \
  --title "build(deps): migrate web to zod v4" \
  --body-file /tmp/web-zod-v4-pr-body.md \
  --draft
```

PR body must include:

```markdown
## Summary
- Migrates @baci/web and web-facing shared schemas to Zod v4.
- Aligns package ownership for Zod in @baci/shared.
- Documents defaults, resolver, and runtime schema audit in docs/superpowers/reviews/2026-05-31-web-zod-v4-migration-audit.md.

## Validation
- pnpm install --frozen-lockfile --prefer-offline
- pnpm turbo lint
- pnpm turbo typecheck
- pnpm turbo test
- coderabbit review --agent --base origin/main
- Browser QA: routes and screenshots listed

## Risk Notes
- Zod v4 .default() short-circuits undefined input; audited .default/.prefault decisions are documented.
- React Hook Form resolver call sites were tested with invalid inputs.
- Browser QA used local/dev or validation-only flows; no real payment or production mutation flows were executed.
- No proxy.ts or existing migrations touched.
```

- [ ] **Step 7: Watch CI**

```bash
env -u GITHUB_TOKEN gh pr checks --watch --interval 30
```

If CI fails, fix in the same isolated worktree and rerun the relevant local command before pushing.

---

## Explicit Non-Goals

```text
- Do not touch apps/web/src/proxy.ts.
- Do not edit existing supabase/migrations files.
- Do not run vercel build.
- Do not deploy.
- Do not use npm, yarn, or npx for repo work; use pnpm and pnpm dlx.
- Do not upgrade OpenAI SDK unless Zod v4 peer/type resolution makes it necessary and the audit documents why.
- Do not open a PR before Browser QA is complete.
```

## Execution Recommendation

Use subagent-driven execution if available:

```text
1. Dependency and codemod subagent
2. Defaults/error-semantics audit subagent
3. React Hook Form resolver/form tests subagent
4. Browser QA subagent
5. Final PR/CI subagent
```

If executing inline, use the task boundaries above as commit checkpoints.
