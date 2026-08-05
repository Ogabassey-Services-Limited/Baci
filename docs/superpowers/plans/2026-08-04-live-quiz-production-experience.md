# Live Quiz Production Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-safe live quiz that merchants can author and schedule from the dashboard, private testers can experience in the installed mobile app, and customers can play under one universal event end plus a configurable per-question timer.

**Architecture:** Additive, versioned database contracts make PostgreSQL authoritative for event visibility, immutable launch timing, question deadlines, rules acceptance, result publication, ranking, prize reservation, and the single winner award. The web backend remains the authenticated/validated API boundary; authenticated clients do not receive broad quiz-table read/write authority. The admin dashboard creates reviewed variant pools and atomically launches either restricted test events or compliance-gated live events. Both the mobile and web storefronts use an explicit v2 contract, consume server time, lock answers on tap, and retrieve scores, standings, and claims only after server-side publication.

**Tech Stack:** PostgreSQL/Supabase with RLS and security-definer RPCs, Next.js 16 App Router, React 19, TypeScript, Zod, Vitest/React Testing Library, Expo 57/React Native 0.86, Zustand, Jest/React Native Testing Library, `expo-image`, Biome, pnpm/Turborepo.

**Design specification:** `docs/superpowers/specs/2026-08-04-live-quiz-production-experience-design.md`

**Planning baseline:** remote `origin/main` at `8ce55c67703370f460767f2ddcd8f487db466050` on 2026-08-04.

## Rereview Record

The latest 2026-08-04 rereview verified remote `main` directly at `8ce55c67703370f460767f2ddcd8f487db466050`. The two commits since the prior baseline change deployment/migration-repair machinery but no quiz runtime file. Source grounding found and closed seven remaining execution gaps in this artifact: every new migration now participates in the current hash-bound replay registry; an in-progress attempt can survive a reload or killed app without creating a second attempt; a merchant can edit or regenerate a bad AI variant and every approval is bound to the full canonical variant content; large generation now uses Baci's existing leased AI-job/VPS-worker pattern instead of betting 150 variants on one 120-second web request; quiz-generation checkpoints are hidden from direct authenticated `ai_jobs` reads behind a safe-status RPC; scheduled zero-player events reach an explicit no-winner terminal state; and cancellation now has an authenticated admin/API surface that is permitted only before the universal end, releases one hold, and cannot be used to evade final ranking. Historical leaderboard handles are immutable under an ordinary rename but can still be privacy-suppressed to an anonymous alias without changing rank or award evidence. The plan is technically converged subject to Task 1's disk/worktree preflight. Test-mode delivery does not require live legal approval; live activation/canary remains blocked until Task 20 approvals are complete.

## Global Constraints

- Execute from an isolated worktree created from the then-current `origin/main`. The current root contains unrelated user work and an uncommitted quiz prototype; do not rebase, reset, clean, or overwrite it.
- Before creating the worktree, pass a disk-space preflight with enough room for the worktree, frozen dependency install, local build artifacts, and tests. The first review found about 260 MiB free; the final rereview check found about 12 GiB free, which is improved but still below the 20 GiB execution target. Free any remaining space only through owner-approved, non-destructive cleanup. Do not delete caches, worktrees, `.git` content, or user files without resolving exact targets and authorization.
- Re-fetch `origin/main` before implementation. If it has moved, reread every touched current-main file and update this plan's file map before changing code.
- Preserve `supabase/migrations/20260803000000_quiz_promote_due_scheduled_events.sql` byte-for-byte. It was already applied remotely and is currently untracked locally. Reconcile the exact file into source control; never edit its applied body.
- Existing migrations are append-only. Every new table must enable RLS, have explicit grants/policies, and include relevant indexes.
- Current main's history-replay verifier rejects an unregistered SQL file. In the same commit as every migration created or reconciled by Tasks 1, 3, 4, 5, 6, 7A, 9, 10, 10A, and 18: compute the final file's SHA-256; add the exact path/hash in lexical order to `PENDING_SOURCES` in `apps/web/tools/db/supabase-history-replay-sources.ts`; add the same pair to the dedicated `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts` cohort; and run the source, manifest, and verifier tests. Task 1 creates the cohort helper, wires it into `expected-pending-sources.test-support.ts`, and replaces the verifier's hard-coded pending count with the concrete expected cohort length. Never register a hash until the SQL bytes are final, and never change the SQL without updating both registries before the migration is applied.
- RLS is not an API-only safeguard. Replace or constrain every existing permissive quiz policy that would otherwise expose test events, live scores, answer deltas, variants, permit fields, or refresh logs. PostgreSQL permissive policies combine with `OR`; adding one tester policy does not override an older broad customer policy.
- Revoke broad authenticated quiz authoring writes after callers have switched to v2 boundaries. Full-draft persistence uses only Task 9's private leased-worker function. Review, corrective revision, cancel, reset, tester, invite, and launch mutations use narrow `SECURITY DEFINER` RPCs that derive identity from `auth.uid()`, check staff permission, fix `search_path`, validate tenant ownership, validate an action/payload/user-bound server route proof for material mutations, and expose only required execute grants.
- Protected API routes authenticate first, then validate with Zod, then perform tenant-scoped queries. Do not use `select('*')` or a service-role client for user-facing operations.
- Do not modify `proxy.ts`, `.env*`, or existing migration files.
- Browser mutations use the shared CSRF client. Do not add raw browser `fetch` calls for POST/PATCH/DELETE.
- Preserve current-main account-switch generation guards, DOB correction behavior, route proof, hashed-device handling, free-entry marker, identity/device caps, replay recovery, and prize voucher security.
- Permit at most one `started` attempt per event/customer. A repeated Start while that attempt exists resumes it rather than creating another; a new test attempt is possible only after the prior attempt is terminal and uses a new `startRequestId`.
- Use one documented lock order for v2 lifecycle mutations: event, then attempt/question rows, then reservation/award rows. Start/resume/answer, cancellation, test reset/tester revocation, and finalization must follow it so boundary races cannot deadlock or leave an awardable answer after termination.
- Treat reload, browser refresh, process death, and mobile cold start as supported recovery paths. Persist only the minimum account-bound recovery envelope; never persist question text, answer keys, DOB, username, raw device signals, invite tokens, or claim tokens.
- New player-visible events use `contract_version = 2`. Updated web/mobile clients send `X-Baci-Quiz-Contract: 2`; legacy clients can continue reading legacy archives during a bounded compatibility window but cannot discover or start v2 events.
- Live prize starts require a usable device binding and fail closed if device resolution/binding infrastructure fails. Test mode may fail soft with a visible diagnostic so QA can continue. Cookie-authenticated web uses the existing first-party device cookie; bearer-authenticated mobile must supply its validated hash input.
- Keep source files below 300 lines and one primary export per file. Split components, hooks, schemas, and helpers as each task specifies.
- Add a colocated regression/feature test for every new or materially changed source file. Test both success and failure/edge behavior.
- Do not expose answer values, DOB, email, raw device fingerprints, signed invite tokens, permit references, or usernames in analytics/log payloads.
- Do not enable live prize production flags as part of implementation. Test mode must work while live prize mode remains fail-closed.
- Treat full quiz-draft generation as durable queued work. The web route authenticates, validates, authorizes spend, enqueues, and returns `202`; it never waits for the full provider batch set. Only the dedicated leased worker may process a server-authorized quiz job, and quiz tables receive one complete atomic draft or nothing. A one-variant corrective regeneration may remain a bounded single-provider route because failure preserves the existing draft.
- Default admin mode is **Test quiz**. Live mode is an explicit merchant choice and still cannot activate without every production gate.
- Do not pull the full Vercel production environment into local development. Kuda and VTU are outside quiz scope.
- Do not run `vercel build` or a cloud-building deployment. Production uses the approved prebuilt VPS flow only after all release gates pass.
- After every code-bearing task, run the focused tests listed in that task. Immediately before each code commit, run `coderabbit review --agent -t uncommitted`, fix every critical/high finding, and rerun affected tests. Before handoff, run the full repository quality gates and a final CodeRabbit review.

## Dependency Order

```text
Current-main reconciliation
  -> shared contracts and database foundation
  -> universal timing, result publication, and finalization RPCs
  -> safe player projections and backend APIs
  -> v2 admin authoring, review receipts, and atomic launch
  -> web and mobile client compatibility
  -> mobile lobby/readiness/gameplay
  -> leaderboard archive
  -> private production test
  -> legal and operational live canary gate
```

Do not begin mobile gameplay implementation against guessed response shapes. Complete and test the database and backend contracts first.

---

## Task 1: Establish an Isolated Current-Main Worktree and Reconcile Existing Quiz Work

**Files:**

- Preserve from dirty root: `supabase/migrations/20260803000000_quiz_promote_due_scheduled_events.sql`
- Create: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-pending-sources.test-support.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.test.ts`
- Modify: `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`
- Compare, then selectively port from dirty root:
  - `apps/web/src/app/dashboard/quiz/quiz-duration.ts`
  - `apps/web/src/app/dashboard/quiz/quiz-generation-form.tsx`
  - `apps/web/src/app/dashboard/quiz/quiz-launch-dialog.tsx`
  - `apps/web/src/app/dashboard/quiz/quiz-prize-product-picker.tsx`
  - `apps/web/src/app/dashboard/quiz/quiz-topic-input.tsx`
  - `apps/web/src/app/api/merchant/quiz/generate/quiz-activation-helpers.ts`
  - their colocated tests
- Do not copy unrelated dirty files.

- [ ] **Step 1: Pass the disk-space and repository preflight**

Record `df -h`, `git status --short`, existing worktrees, and the largest top-level consumers without printing secrets. Do not continue while free space is insufficient for a second worktree, `pnpm install --frozen-lockfile`, local builds, and test output. The owner decides what can be removed.

- [ ] **Step 2: Fetch and create the worktree**

```bash
git fetch origin main
git worktree add ../Baci-quiz-live-production -b codex/quiz-live-production origin/main
```

Record the exact starting SHA in the implementation handoff.

- [ ] **Step 3: Bootstrap the isolated worktree**

```bash
pnpm install --frozen-lockfile
```

Use the repository's configured pnpm version. Do not borrow a mutable `node_modules` tree from the dirty root.

- [ ] **Step 4: Capture the prototype as evidence without mutating it**

From the dirty root, inspect scoped diffs only:

```bash
git diff -- apps/web/src/app/dashboard/quiz apps/web/src/app/api/merchant/quiz apps/web/src/schemas/quiz.ts
shasum -a 256 supabase/migrations/20260803000000_quiz_promote_due_scheduled_events.sql
```

Do not stage or commit the dirty root.

- [ ] **Step 5: Reconcile and replay-register the applied migration exactly**

Add the exact 53-line scheduled-promotion migration to the isolated worktree. Verify its SHA-256 is `eea69756a8a7c290a2d958724a5b9ee46a15724e44dd9e3fad1f1c0017ddbd30`, matching the dirty-root copy. Do not modify its SQL to add universal closure; that belongs in a later migration.

Create the quiz-live expected-source cohort, spread it into `EXPECTED_PENDING_SOURCES`, and register this exact path/hash in current main's `PENDING_SOURCES`. Add a focused assertion that the cohort is unique and lexically ordered. Refactor the replay verifier's hard-coded pending-source count to compare with `EXPECTED_PENDING_SOURCES.length`, preserving the concrete path/hash equality test in `supabase-history-replay-manifest.test.ts`.

- [ ] **Step 6: Verify migration history and baseline tests**

```bash
bash .github/scripts/check-migration-versions.test.sh
bash .github/scripts/apply-pending-migrations.test.sh
bash .github/scripts/check-migration-versions.sh
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
pnpm --filter @baci/web exec vitest run src/app/api/quiz src/app/api/merchant/quiz src/app/dashboard/quiz
```

Expected: baseline passes before feature changes. If it does not, stop and record the existing failure separately.

- [ ] **Step 7: Commit only the reconciliation**

```bash
git add supabase/migrations/20260803000000_quiz_promote_due_scheduled_events.sql apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts apps/web/tools/db/expected-pending-sources.test-support.ts apps/web/tools/db/supabase-history-replay-sources.test.ts apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts
git commit -m "chore(quiz): reconcile scheduled event promotion migration"
```

---

## Task 2: Define Shared Quiz Modes, Limits, Timing Math, and Wire Contracts

**Files:**

- Modify: `packages/shared/src/constants/quiz.ts`
- Modify: `packages/shared/src/constants/quiz.test.ts`
- Create: `packages/shared/src/schemas/quiz-contract.ts`
- Create: `packages/shared/src/schemas/quiz-contract.test.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Modify: `apps/web/src/schemas/quiz.ts`
- Create: `apps/web/src/lib/quiz/quiz-rules-version.ts`
- Create: `apps/web/src/lib/quiz/quiz-rules-version.test.ts`
- Modify: `apps/web/src/schemas/quiz-schemas-input.test.ts`
- Modify: `apps/web/src/schemas/quiz-schemas-query.test.ts`
- Modify: `apps/web/src/schemas/quiz-schemas-response.test.ts`
- Modify: `apps/mobile-storefront/schemas/quiz-schemas.ts`
- Modify: `apps/mobile-storefront/schemas/quiz-schemas.test.ts`

- [ ] **Step 1: Write failing shared-contract tests**

Cover:

- `test | live` event mode;
- 1–20 questions per topic and 50 logical questions total;
- 5–60 seconds per question;
- default mode is test, test defaults to 1 reviewed variant and permits 1–3, and live is fixed to 3 variants for v1 launch policy;
- test attempts default to 10 and permit 1–50; reset attempts remain auditable and do not consume that cap; live maximum attempts is fixed at 1;
- `maximumPlaySeconds = questionCount × timePerQuestionSeconds`;
- suggested window rounds `maximum + 90s` up to a minute;
- normal live minimum `maximum + 30s` and maximum `maximum + 120s`;
- 20 × 10 seconds returns 200 seconds and a 300-second suggestion;
- a named 15-second active-attempt reconciliation cadence lets foreground clients observe cancellation without an unbounded poll loop;
- a named safe default permits at most 10 newly authorized full-draft generation jobs per merchant in a rolling 24-hour window, with one active job at a time;
- rules version, server time, event end, prize condition, and product image fields;
- a client-generated `startRequestId` UUID makes one deliberate Start action idempotent without collapsing later permitted test retries;
- one active attempt is resumable after refresh/process death, a second Start while it is active returns that attempt, and only a terminal test attempt permits a new deliberate try;
- explicit client contract version 2 and `finalizing`/publication states;
- explicit `cancelled`/`event_cancelled` terminal states that never expose a score, rank, award, or claim;
- pending-results response does not require score/prize fields, while a published result has a separate typed result contract.
- a versioned rules registry distinguishes test-usable draft text from counsel-approved live text; no version is treated as live-approved merely because it exists.

Run:

```bash
pnpm --filter @baci/shared test -- quiz
pnpm --filter @baci/web exec vitest run src/schemas/quiz
pnpm --filter @baci/mobile-storefront test -- quiz-schemas.test.ts
```

Expected: new assertions fail because the contracts do not exist.

- [ ] **Step 2: Add constants and pure timing helpers**

Add named constants for every bound and default, including the 15-second active-attempt reconciliation cadence. Do not duplicate numeric limits in web and mobile. Export pure helpers for maximum play time and suggested/allowed windows so admin tests do not reimplement formulas.

Add the minimal rules-version registry used by later activation. It exposes immutable version metadata and an explicit `approvedForLive` flag; initial test content can be exercised without asserting legal approval, and live launch fails closed until counsel authorizes a version.

- [ ] **Step 3: Evolve schemas compatibly**

Add the new fields while accepting legacy event rows that lack them during the rollout window. New admin creation/activation inputs are strict; player response parsing may supply safe legacy defaults only for old events.

- [ ] **Step 4: Run focused tests and format**

```bash
pnpm --filter @baci/shared test -- quiz
pnpm --filter @baci/web exec vitest run src/schemas/quiz
pnpm --filter @baci/mobile-storefront test -- quiz-schemas.test.ts
pnpm exec biome check packages/shared/src/constants/quiz.ts packages/shared/src/schemas/quiz-contract.ts apps/web/src/schemas/quiz.ts apps/web/src/lib/quiz/quiz-rules-version.ts apps/mobile-storefront/schemas/quiz-schemas.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src apps/web/src/schemas apps/web/src/lib/quiz/quiz-rules-version.ts apps/web/src/lib/quiz/quiz-rules-version.test.ts apps/mobile-storefront/schemas
git commit -m "feat(quiz): define live event contracts and timing limits"
```

---

## Task 3: Add Event Mode, Tester Isolation, Attempt Snapshots, and Acceptance Storage

**Files:**

- Create: `supabase/migrations/20260804090000_quiz_live_event_foundation.sql`
- Create: `supabase/migrations/tests/quiz_live_event_foundation.sql`
- Modify generated output after applying migration: `apps/web/src/types/supabase.ts`
- Modify: `apps/web/src/lib/quiz-migration-contract.test.ts`
- Create: `apps/web/src/lib/quiz-live-foundation-migration.test.ts`
- Create: `apps/web/src/lib/quiz-direct-access-contract.test.ts`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing SQL/static contract tests**

Assert the migration must contain:

- `quiz_events.mode` with `test | live` check and legacy-safe default;
- `quiz_events.contract_version` with legacy rows/default classified as 1 and all newly created v2 events explicitly set to 2;
- `quiz_events.results_published_at`;
- `quiz_event_testers` with event/user uniqueness, foreign keys, RLS, indexes, and no anonymous access;
- `quiz_test_invites` with token digest, expiry, single-use timestamp, tenant ownership, RLS, and no raw token column;
- `quiz_attempts.leaderboard_username`, `rules_version`, `terms_accepted_at`, `app_version`, and `platform`;
- `quiz_attempts.start_request_id` with an event/customer/request uniqueness invariant;
- a partial uniqueness invariant allowing at most one `started` attempt per event/customer, including test mode;
- a non-awarding attempt terminal state for event cancellation/reset/revocation that cannot be ranked as clean;
- `customers.username_changed_at`;
- stable option-order storage on `quiz_attempt_questions`;
- replacement visibility policies for `quiz_events`, `quiz_question_slots`, `quiz_question_variants`, `quiz_attempts`, `quiz_attempt_questions`, `quiz_attempt_answers`, awards, and `leaderboard_refresh_log`;
- direct authenticated reads cannot expose a v2 test event to a non-tester or expose score, correctness, `score_delta`, answer payload, ranking, winner, permit, or claim before `results_published_at`;
- legacy contract-v1 visibility remains compatible while old clients are supported;
- explicit grants and policies with an inventory of every pre-existing quiz grant/policy being replaced or intentionally retained;
- no `select('*')`, no client-readable device/test-token secrets, and no edit to earlier migrations.

- [ ] **Step 2: Implement the additive migration**

Use `IF NOT EXISTS` where safe. Backfill legacy events to `live` only as a compatibility classification; do not publish them or infer compliance. Leave legacy attempt snapshots nullable.

Because permissive PostgreSQL policies combine with `OR`, drop/recreate or safely replace the existing broad customer quiz policies; do not merely add another permissive tester policy. V2 test visibility must require either:

- the caller's `auth.uid()` in `quiz_event_testers`; or
- an authorized staff relationship to the event merchant plus an existing storefront customer relationship.

Do not rely on a body-supplied merchant ID for authority.

Add restrictive publication guards for direct reads of v2 attempt/answer rows so an owner cannot read live score/correctness through PostgREST even though the row belongs to them. Prefer dedicated safe RPC projections for v2 player state; do not expose answer keys in any direct grant. Preserve contract-v1 behavior only for the documented compatibility window.

- [ ] **Step 3: Add one-time invite redemption RPC**

The RPC hashes the supplied token, locks the matching unexpired unused row, verifies authenticated identity, inserts the tester row, marks the invite used, and returns the event ID. Invites expire after 30 minutes, are single-use, and can be revoked before redemption. The raw token is returned only once by the authenticated merchant creation route added later; it is never stored or logged.

- [ ] **Step 4: Validate migration and regenerate types**

Apply against the approved disposable/branch database first, run the SQL test, then regenerate `apps/web/src/types/supabase.ts` using the repository's Supabase type-generation workflow. Never hand-edit generated declarations.

```bash
bash .github/scripts/check-migration-versions.sh
pnpm --filter @baci/web exec vitest run src/lib/quiz-live-foundation-migration.test.ts src/lib/quiz-direct-access-contract.test.ts src/lib/quiz-migration-contract.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/lib/quiz-live-foundation-migration.test.ts apps/web/src/lib/quiz-direct-access-contract.test.ts apps/web/src/lib/quiz-migration-contract.test.ts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): add live modes testers and attempt snapshots"
```

---

## Task 4: Introduce Server-Authoritative Universal Deadline v2 RPCs

**Files:**

- Create: `supabase/migrations/20260804100000_quiz_universal_deadlines_v2.sql`
- Create: `supabase/migrations/tests/quiz_universal_deadlines_v2.sql`
- Modify: `apps/web/src/app/api/quiz/_shared/quiz-question-deadline.ts`
- Modify: `apps/web/src/app/api/quiz/_shared/quiz-question-deadline.test.ts`
- Create: `apps/web/src/lib/quiz-universal-deadline-migration.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing timing regressions**

SQL tests use fixed timestamps and prove:

- a 9:04 entrant to a 9:00–9:05 event starts at logical question 1;
- the attempt retains event end 9:05;
- a question issued at 9:04:55 with a 10-second setting has an effective deadline of 9:05:00;
- an answer after the event end scores zero even if the per-question window would otherwise remain;
- no question is issued after event end;
- event end finalizes an attempt with unanswered positions;
- duplicate/replayed answer submission remains idempotent;
- a retried start with the same `startRequestId` returns the same attempt, while a deliberate later test replay uses a new request ID and consumes one remaining attempt;
- a new `startRequestId` while the same customer already has a `started` attempt resumes that attempt instead of creating a concurrent test/live attempt;
- resuming before the current question deadline returns the same question, stable option order, issued time, and deadline without extending time;
- resuming after the current question deadline forfeits only that issued question and atomically issues the next question when universal time remains;
- resuming after event end returns a terminal/pending-result state and no question;
- an answer accepted before a lost response is recovered as already locked and advances exactly once;
- test and live modes use identical timing;
- live keeps one attempt per customer/email/device, while test permits the configured 1–50 non-reset attempts for the same customer/device and still rejects a different customer reusing that event-bound device;
- event and question closure use database time, not `clientAnsweredAt`.

- [ ] **Step 2: Add versioned start RPCs**

Create `start_quiz_attempt_v2` and `start_quiz_attempt_with_device_v2` rather than replacing the old signatures during schema-first rollout. They must:

- enforce status/start/end;
- require accepted rules version and literal acceptance;
- require a UUID `startRequestId`, persist it, and return the existing attempt for an exact authenticated replay;
- verify the accepted version equals the event's authoritative version;
- snapshot username, acceptance timestamp, app version, and platform;
- preserve free entry, route proof, expected-user behavior, age/username guards, identity cap, and atomic device binding;
- make the identity/device cap mode-aware: test retries for the same bound identity count only non-reset attempts up to `max_attempts`, reset never unbinds the device, and cross-account reuse remains blocked; live stays exactly one;
- use database `clock_timestamp()`/`now()` for every start/end decision instead of trusting an application-generated launch or answer timestamp;
- fail closed for a live v2 event when a stable web cookie/mobile fingerprint cannot be resolved or the binding RPC fails; test events may continue with an explicit `deviceBindingDiagnostic` for QA;
- assign variants and stable option order per attempt;
- return `serverNow` and `eventEndsAt`.

Under the same event/customer advisory lock, first look for an existing `started` attempt. If one exists and its identity/device binding remains valid, return it as `resumed: true` regardless of whether a crashed client retained the original request ID. Do not attach the new request ID to that row. A fresh test attempt may be created only after the prior attempt reaches a terminal status.

Do not create the player runtime readiness marker yet. It is intentionally added only after result publication and safe leaderboard/event projection RPCs exist, so a partially applied v2 schema can never advertise itself as ready.

- [ ] **Step 3: Add versioned answer RPC**

Create `submit_quiz_answer_v2` backed by one universal-end-aware scoring function. It must:

- lock the event before the attempt/question rows and recheck playable status under that lock;
- lock the attempt/question row;
- compute the effective deadline with `LEAST(question deadline, event ends_at)`;
- lock the first answer permanently;
- treat timeout/late answers as incorrect without stalling;
- finalize at event end and issue no next question;
- return `submitted_pending_results` without score/prize while the event is not published;
- preserve replay recovery for already-submitted attempts;
- never return correctness/explanations or mint/sign a product prize in the answer path.

- [ ] **Step 4: Add an owner-safe resume RPC**

Create `resume_quiz_attempt_v2(event_id, device proof as applicable)`. It derives the customer from `auth.uid()`, verifies the event-bound device for live mode, locks the event before the single active attempt, and returns only its current playable state. If the issued question is still open, return the same question and unchanged effective deadline. If it expired, record its timeout once and issue the next question at database time. If an answer already committed but the response was lost, return the already-issued next question. If the event ended or was cancelled, terminalize safely and return pending/unavailable with no score, correctness, answer key, or claim. A caller cannot enumerate another customer's attempts or choose an attempt ID as authority.

- [ ] **Step 5: Update the web deadline helper**

Change its lookup to include the event end and cap the attached `deadlineAt`. Fallback logic must also cap at `eventEndsAt`; a lookup failure must never grant time beyond the universal end.

- [ ] **Step 6: Regenerate types and validate**

Apply the migration to the approved disposable/branch database, then regenerate `apps/web/src/types/supabase.ts` with the repository workflow. Never hand-edit RPC declarations.

```bash
pnpm --filter @baci/web exec vitest run src/app/api/quiz/_shared/quiz-question-deadline.test.ts src/lib/quiz-universal-deadline-migration.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
bash .github/scripts/check-migration-versions.sh
```

Also execute `supabase/migrations/tests/quiz_universal_deadlines_v2.sql` against the disposable/branch database and retain the receipt.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/app/api/quiz/_shared/quiz-question-deadline.ts apps/web/src/app/api/quiz/_shared/quiz-question-deadline.test.ts apps/web/src/lib/quiz-universal-deadline-migration.test.ts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): enforce universal event deadlines"
```

---

## Task 5: Finalize Due Attempts and Award One Product Prize at Event End

**Files:**

- Create: `supabase/migrations/20260804110000_quiz_final_results_and_product_winner.sql`
- Create: `supabase/migrations/tests/quiz_final_results_and_product_winner.sql`
- Modify: `apps/web/src/app/api/quiz/finalize/route.ts`
- Modify: `apps/web/src/app/api/quiz/finalize/route.test.ts`
- Modify: `apps/web/src/lib/quiz/finalize-due-quiz-events.ts`
- Modify: `apps/web/src/lib/quiz/finalize-due-quiz-events.test.ts`
- Modify: `apps/web/src/scripts/process-quiz-finalization.ts`
- Modify: `apps/web/src/scripts/process-quiz-finalization.test.ts`
- Create: `apps/web/src/lib/quiz-final-results-migration.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Reuse unchanged: `vps-workers/bin/process-quiz-finalization.sh`
- Reuse unchanged: the existing once-per-minute `quiz-finalize.lock` schedule in `vps-workers/deploy.sh`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing finalization tests**

Cover:

- all `started` attempts become terminal at `ends_at`;
- a scheduled event that nobody ever opens is still terminalized after `ends_at`, records no winner, and releases its live hold exactly once;
- the service worker can promote due scheduled events without depending on `auth.uid()`, while the existing customer-scoped promotion RPC remains tenant-bounded;
- event closure records `attempts_terminalized_at` and a bounded finalization state (`pending | blocked | awarded | no_winner | test_published`) independently from result publication;
- answered scores persist; unanswered slots count as zero;
- final ranking matches score, speed, earlier submission, deterministic ID;
- exactly one product-backed award is created for a one-winner event;
- two perfect players do not both receive the product;
- a partial unique database invariant permits at most one `ranked_product_v2` award per event, independent of application idempotency;
- one launch creates at most one active `quiz_prize_reservations` row for an event and repeated launch is idempotent;
- finite aggregate and serialized inventory cannot be double-reserved;
- test events create zero awards, orders, vouchers, notifications, and inventory reservations;
- database guards reject any reservation or award row whose event mode is test, even if an internal function is called incorrectly;
- due test events close, rank privately, and publish test results while `QUIZ_PHASE=1a` and production approval is false;
- non-compliant live events remain fail-closed;
- repeated finalizer calls are idempotent;
- no eligible attempt records a terminal no-winner outcome;
- results publish only after finalization reaches an award or no-winner terminal state;
- the owner-safe result RPC returns `pending` while unpublished, returns score/rank after publication, signs no test claim, and never exposes another player's attempt;
- cancellation, no-winner, and unclaimed-expiry paths release the exact reservation once and preserve audit history.

- [ ] **Step 2: Move product-prize award ownership to event finalization**

The v2 answer path must never mint immediate awards. Add separate, idempotent finalization entry points so test safety is not coupled to production approval:

- `finalize_due_test_quiz_events_v2` always terminalizes due test attempts, computes private test ranking, publishes test results, and has no code path or execute grant that can reserve inventory, create an award/order/voucher, or notify a winner. Database triggers/constraints also reject a test-mode reservation/award as defense in depth.
- `finalize_due_live_quiz_events_v2` remains service-worker-only and fails closed unless production phase, production approval, event compliance, approved permit/reference, rules, and prize reservation all pass.

An always-safe closure step still terminalizes attempts at `ends_at`, records `attempts_terminalized_at`, and moves the event's finalization state to pending/blocked without exposing raw errors. Its due-event selection includes both `active` and never-opened `scheduled` v2 events, so a zero-player scheduled event cannot strand a reservation. If live award gates are unavailable, the player-facing event remains `finalizing`, keeps its reservation, publishes no standings, and raises a bounded operations outcome; it must not be silently converted to no-winner. Already-existing unclaimed-award expiry/release also continues regardless of whether new live awards are enabled, because it cannot create a new entitlement.

The live finalizer:

1. locks due events with `FOR UPDATE SKIP LOCKED`;
2. terminalizes started attempts at the universal end;
3. ranks clean attempts using the same candidate CTE as the leaderboard;
4. creates exactly one `ranked_product_v2` award for the top-ranked eligible player;
5. transfers the launch hold into the existing reserved-order/voucher fulfillment path for the exact snapshotted product/variant/condition and, for serialized stock, the exact reserved unit;
6. sets `results_published_at` only after award/no-winner completion;
7. writes an auditable refresh/finalization record.

The same migration adds owner-safe `get_quiz_attempt_result_v2`, returning only pending/final/unavailable plus post-publication score/rank and award metadata needed for server-side claim signing. It derives ownership from `auth.uid()` and never returns another player's row, answer correctness, permit data, or a test award.

- [ ] **Step 3: Add launch-time prize reservation or durable hold**

Add a dedicated `quiz_prize_reservations` table with event and merchant ownership, product/variant/condition snapshots, optional serialized-unit linkage, quantity fixed to one, `reserved | transferred | released` state, release reason, and timestamps. Enforce one active reservation per event with constraints/indexes, deny direct anonymous/authenticated writes, and expose only private hold/transfer/release functions.

At atomic live activation, reserve exactly one unit: increment the aggregate reserved quantity under lock or bind one available serialized unit. At winner finalization, call a v2 wrapper around the existing `private.create_quiz_product_prize_award_with_inventory` path that consumes this reservation instead of selecting stock again, links/creates the winner's reserved order, and marks the hold transferred in the same transaction. Unlimited inventory records an auditable no-decrement hold. Test events never reserve. Do not create a fake customer/order at launch.

- [ ] **Step 4: Persist and enforce the claim lifecycle**

Add `quiz_awards.award_source`, `claim_expires_at`, and the ranked-event uniqueness invariant without changing legacy award semantics. The approved claim-window duration is snapshotted onto the live event at activation and converted to an exact `claim_expires_at` when the winner award is created. The API signs only that persisted expiry; it does not recalculate the current seven-day helper default on each request.

The existing direct minute worker expires unclaimed ranked awards, cancels/releases any corresponding reserved order/item through the established inventory path, releases the reservation, and records the reason. Claimed awards remain immutable. V1 performs no automatic next-rank re-award; any replacement is a separately authorized, audited operations action allowed by the approved terms. A live launch fails closed until counsel/operations supplies an approved claim-window value and unclaimed-prize policy; the code must support the approved values but must not invent them.

- [ ] **Step 5: Extend the existing direct minute worker**

Do not add another cron. Current main already runs `apps/web/src/scripts/process-quiz-finalization.ts` directly from the VPS every minute through `vps-workers/bin/process-quiz-finalization.sh`, protected by `flock`. Extend `finalizeDueQuizEvents` and its CLI summary so service-only scheduled promotion, safe attempt closure (including never-opened scheduled events), test publication, and existing-award expiry/release run in phase `1a`, while creation of a new live winner award/publication remains behind `QUIZ_PHASE=production`, `QUIZ_PRODUCTION_APPROVED`, `compliance_verified`, permit, rules, and reservation checks. Return/log bounded counts by scheduled-promoted, test-closed, zero-player-closed, live-terminalized, live-awaiting-gate, awarded, no-winner, expired/released, skipped-live, and failed. Never log player PII. Keep `/api/quiz/finalize` as the authenticated manual fallback using the same helper.

- [ ] **Step 6: Regenerate types and validate**

Apply the migration to the approved disposable/branch database and regenerate `apps/web/src/types/supabase.ts` before compiling any TypeScript caller.

```bash
pnpm --filter @baci/web exec vitest run src/app/api/quiz/finalize src/lib/quiz-final-results-migration.test.ts src/lib/quiz/finalize-due-quiz-events.test.ts src/scripts/process-quiz-finalization.test.ts src/app/api/quiz/attempts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
```

Execute the SQL regression against the disposable/branch database.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/app/api/quiz/finalize apps/web/src/lib/quiz/finalize-due-quiz-events.ts apps/web/src/lib/quiz/finalize-due-quiz-events.test.ts apps/web/src/lib/quiz-final-results-migration.test.ts apps/web/src/scripts/process-quiz-finalization.ts apps/web/src/scripts/process-quiz-finalization.test.ts apps/web/src/app/api/quiz/attempts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): finalize live standings and product winner"
```

---

## Task 6: Snapshot Leaderboard Names and Enforce Username Change Policy

**Files:**

- Create: `supabase/migrations/20260804120500_quiz_leaderboard_username_snapshots.sql`
- Create: `supabase/migrations/tests/quiz_leaderboard_username_snapshots.sql`
- Create: `supabase/migrations/20260804121000_quiz_safe_player_projections_v2.sql`
- Create: `supabase/migrations/tests/quiz_safe_player_projections_v2.sql`
- Regenerate after applying migrations: `apps/web/src/types/supabase.ts`
- Modify: `apps/web/src/schemas/quiz-leaderboard.ts`
- Modify: `apps/web/src/schemas/quiz-leaderboard.test.ts`
- Modify: `apps/web/src/lib/quiz/map-quiz-leaderboard-rows.ts`
- Modify: `apps/web/src/lib/quiz/map-quiz-leaderboard-rows.test.ts`
- Modify: `apps/web/src/app/api/quiz/leaderboard/route.ts`
- Modify: `apps/web/src/app/api/quiz/leaderboard/route.test.ts`
- Modify: `apps/web/src/app/api/storefront/customer/username/route.ts`
- Modify: `apps/web/src/app/api/storefront/customer/username/route.test.ts`
- Modify: `apps/mobile-storefront/stores/auth-helpers.ts`
- Modify: `apps/mobile-storefront/stores/auth-store-account.ts`
- Modify: `apps/mobile-storefront/stores/auth-store.test.ts`
- Modify: `apps/mobile-storefront/components/profile/ProfileUsernameSection.tsx`
- Modify: `apps/mobile-storefront/components/profile/ProfileUsernameSection.test.tsx`
- Modify with both migrations' final path/hash pairs: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same pairs: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing leaderboard/name tests**

Prove:

- a profile rename does not alter a prior attempt's display name;
- a soft-deleted customer or an audited privacy/moderation suppression keeps the attempt's rank and award evidence but replaces the public handle with the same stable anonymous alias;
- legacy null snapshots produce a stable anonymous alias, never full name/email;
- first username creation succeeds;
- a rename inside 30 days fails with a friendly next-eligible date;
- a rename while the customer has a started attempt fails;
- the same normalized username remains merchant-scoped and unique;
- top 100 stays ordered;
- the caller receives a separate `currentPlayer` row when rank 101+;
- leaderboard requests before results publication return `live_hidden` with no entries;
- event discovery returns only safe fields, never permit/compliance internals, and one invalid live event cannot fail the complete list;
- the owner result projection returns `pending`, `final`, or `unavailable` without leaking score/rank/claim before publication;
- `quiz_runtime_contract_version()` is generated and typed here but returns 1; Task 7A upgrades it to 2 only after direct-access lockdown.

- [ ] **Step 2: Add safe v2 player projection RPCs**

Add, rather than overwrite, `list_quiz_events_v2`, `get_quiz_leaderboard_public_v2`, and the owner result RPC introduced in Task 5. `list_quiz_events_v2` derives the authenticated customer/merchant relationship, applies test allowlisting and live compliance visibility per event, and returns only the mobile/web contract projection. It never returns `nlrc_permit_ref` or raw compliance data.

The leaderboard uses `quiz_attempts.leaderboard_username` first. For legacy rows, a soft-deleted customer, or an attempt whose public identity was suppressed by an audited self-service/privacy/moderation operation, derive a stable non-PII alias from an irreversible/event-scoped digest. Ordinary profile renames never rewrite the snapshot; privacy suppression changes only the public projection and does not delete or reorder attempt/award evidence. Ranking must not inner-join away a soft-deleted customer. Keep the richer internal ranking projection service-worker-only. Return top 100 and the caller's best row separately without unbounded reads. Harden the legacy public RPC so active/unpublished events return no ranks and its real-name fallback becomes the same anonymous alias, while preserving the old response shape for completed archives.

Create a typed `quiz_runtime_contract_version()` deployment sentinel returning 1. Universal timing, start/resume/answer, final result, safe event discovery, and leaderboard RPCs now exist, so generated callers can compile, but v2 routes accept only integer 2 and remain fail-closed until Task 7A revokes the legacy direct projections and upgrades the marker.

- [ ] **Step 3: Harden username writes**

Update the authoritative username RPC/route with 30-day cooldown and active-attempt guard. Return machine-readable codes and `nextEligibleAt`. Preserve blank/reserved/confusable/uniqueness handling.

Add a private, audited display-suppression operation with no broad table grant. Soft-deleting a customer automatically makes public leaderboard projections use the event-scoped alias; the explicit operation supports an approved privacy/moderation workflow without deleting attempt/rank/award evidence. Ordinary merchant or player calls cannot rewrite a historical snapshot, rank, or award through this operation.

- [ ] **Step 4: Update mobile profile behavior**

Load `username_changed_at`, show current handle and next eligible date, and keep state merge protections so a concurrent profile response cannot clobber a new username.

- [ ] **Step 5: Regenerate types and validate**

Apply both migrations to the approved disposable/branch database and regenerate `apps/web/src/types/supabase.ts` before Task 7.

```bash
pnpm --filter @baci/web exec vitest run src/app/api/quiz/leaderboard src/lib/quiz/map-quiz-leaderboard-rows.test.ts src/app/api/storefront/customer/username src/schemas/quiz-leaderboard.test.ts
pnpm --filter @baci/mobile-storefront test -- auth-store.test.ts ProfileUsernameSection.test.tsx
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
```

Execute the SQL regression and compare ranking parity with product-award finalization.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/schemas/quiz-leaderboard.ts apps/web/src/schemas/quiz-leaderboard.test.ts apps/web/src/lib/quiz apps/web/src/app/api/quiz/leaderboard apps/web/src/app/api/storefront/customer/username apps/mobile-storefront/stores apps/mobile-storefront/components/profile apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): freeze leaderboard handles and return player rank"
```

---

## Task 7: Switch Player APIs to the New Event, Start, Answer, and Result Contracts

**Files:**

- Modify: `apps/web/src/app/api/quiz/events/route.ts`
- Modify: `apps/web/src/app/api/quiz/events/route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/start/route.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/start/route.test.ts`
- Create: `apps/web/src/app/api/quiz/attempts/active/route.ts`
- Create: `apps/web/src/app/api/quiz/attempts/active/route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/route.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/route-replay.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/submit-answer-helpers.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/submit-answer-helpers.test.ts`
- Create: `apps/web/src/app/api/quiz/attempts/[attemptId]/result/route.ts`
- Create: `apps/web/src/app/api/quiz/attempts/[attemptId]/result/route.test.ts`
- Create: `apps/web/src/lib/quiz/quiz-result-claim.ts`
- Create: `apps/web/src/lib/quiz/quiz-result-claim.test.ts`
- Create: `apps/web/src/app/api/quiz/test-invites/claim/route.ts`
- Create: `apps/web/src/app/api/quiz/test-invites/claim/route.test.ts`
- Modify: `apps/web/src/app/api/quiz/route-contracts.test.ts`
- Modify: `apps/web/src/app/api/quiz/route-failure-contracts.test.ts`

- [ ] **Step 1: Write failing route-contract tests**

Cover:

- events response carries `serverNow`, mode, timezone, timing, rules version, max attempts, publication state, full prize product/image/condition;
- ordinary customers cannot discover test events;
- allowlisted testers can discover only their merchant's test events;
- production-invalid live events remain hidden/fail-closed without blocking valid test events;
- requests without `X-Baci-Quiz-Contract: 2` receive only compatible contract-v1 events, and an old client attempting a v2 start receives `QUIZ_APP_UPDATE_REQUIRED`;
- start requires literal terms acceptance and the current rules version;
- start requires a UUID `startRequestId`; replaying it returns the same attempt and a new ID is required for a deliberate additional test attempt;
- a second Start or active-attempt lookup resumes the caller's one `started` attempt without consuming the cap, changing its question/deadline, or exposing another account's attempt;
- an active-attempt lookup after a lost answer response returns the committed next state, while an expired issued question is forfeited exactly once;
- a missing or non-v2 `quiz_runtime_contract_version()` response returns a bounded `503 QUIZ_RUNTIME_NOT_READY` before a v2 mutation is attempted;
- account-switch mismatch is rejected before mutation;
- test start bypasses prize approval but not auth, username, DOB, rules, timing, identity, or device guards;
- answer uses v2 RPC and never returns live score/prize;
- event end returns pending/final status without a next question;
- event cancellation returns a bounded unavailable/cancelled state, terminalizes the attempt, and never returns score/rank/claim;
- replay returns the same locked outcome;
- result retrieval remains pending during `finalizing`, returns the authenticated owner's aggregate score/rank only after publication, never returns answer keys/per-question correctness/explanations, and signs a claim only for an unexpired live winner award;
- test results return score/rank after private publication but never award/order/voucher/claim data;
- test invite claim is authenticated, expiring, one-time, and tenant-scoped.

- [ ] **Step 2: Implement event projection and filtering**

Call scheduled promotion in a customer-scoped way, then call `list_quiz_events_v2`; do not directly select permit/compliance columns. Filter test visibility both in the safe RPC and through RLS. Guard each live event independently so one invalid event cannot turn the whole event list into an unrelated 500. Return `finalizing` when `ends_at` has passed but `results_published_at` is still null. Never return permit data to a player client.

- [ ] **Step 3: Switch start, resume, and answer routes to v2 RPCs**

Keep auth first, Zod validation, route proof, CSRF, device cookie/fingerprint, and friendly error mapping. Probe `quiz_runtime_contract_version()` before v2 mutations; anything other than integer `2` fails closed with `503 QUIZ_RUNTIME_NOT_READY` instead of calling a missing or mismatched RPC. Require contract header 2 for a v2 event. `GET /api/quiz/attempts/active?eventId=...` authenticates first and calls only `resume_quiz_attempt_v2`; its event ID is a selector, never ownership authority. Replace direct attempt/question/award/compliance lookups with owner-safe/guard RPCs so later grant revocation cannot break the routes.

- [ ] **Step 4: Add the dedicated result endpoint and claim signer**

`GET /api/quiz/attempts/[attemptId]/result` authenticates first, resolves ownership inside the safe RPC, and returns `pending` until publication. After publication it returns the caller's score/rank and, only for the live winner, a claim token whose signed expiry exactly equals persisted `claim_expires_at`. It never signs for test, expired, released, cancelled, non-winner, or unpublished awards. Answer replay returns only the locked submission/finalization status and directs the client to this endpoint; product claims no longer originate from the v2 answer route. Keep legacy voucher behavior only for contract-v1 events during the compatibility window.

- [ ] **Step 5: Implement and test invite claim routing**

The claim route strips the raw token from URLs/log context as early as possible, validates authentication, tenant/event/mode, scheduled-or-active/non-ended status, expiry, revocation, and single-use state, and maps replay/revocation errors without revealing whether another account consumed it.

- [ ] **Step 6: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/quiz
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/quiz apps/web/src/lib/quiz/quiz-result-claim.ts apps/web/src/lib/quiz/quiz-result-claim.test.ts apps/web/src/schemas/quiz.ts apps/web/src/schemas/quiz-*.test.ts
git commit -m "feat(quiz): expose universal timing and private test events"
```

---

## Task 7A: Revoke Legacy Direct Player Projections After the v2 API Cutover

**Files:**

- Create: `supabase/migrations/20260804122000_quiz_player_direct_access_lockdown.sql`
- Create: `supabase/migrations/tests/quiz_player_direct_access_lockdown.sql`
- Create: `apps/web/src/lib/quiz-player-direct-access-lockdown.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Prove the application no longer depends on direct reads**

Run static and route tests showing v2 event, start, active-attempt resume, answer, result, and leaderboard paths use only approved RPCs. Retain any direct query needed by contract-v1 routes only in an explicitly named legacy adapter.

- [ ] **Step 2: Add the post-cutover grant/policy migration**

Revoke authenticated table-level `SELECT` grants that expose `quiz_attempts.score`, `quiz_attempt_answers.score_delta`/payload, award internals, and leaderboard refresh data. Revoke direct access to `nlrc_permit_ref` and `compliance_verified`, grant only minimal legacy-safe columns still required, and remove obsolete permissive policies. After those checks, replace the typed `quiz_runtime_contract_version()` sentinel so it returns 2 and grant only the required probe execution. SQL tests impersonate ordinary customer, tester, merchant staff, and unrelated authenticated roles and prove no pre-publication/test/permit leakage through direct PostgREST-equivalent SQL.

- [ ] **Step 3: Deploy as a distinct schema-hardening checkpoint**

Do not bundle this revocation ahead of the Task 7 caller switch. Deploy the v2 backend first (it safely returns `QUIZ_RUNTIME_NOT_READY` while the typed marker is 1), confirm no current route uses the old projections, then apply this migration to unlock v2. Rollback is a new forward migration, never an edit to the applied file.

- [ ] **Step 4: Validate and commit**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/quiz src/lib/quiz-player-direct-access-lockdown.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
bash .github/scripts/check-migration-versions.sh
```

Execute the SQL role matrix against the disposable/branch database, regenerate types, and commit the migration, SQL test, static test, generated output, and both replay-registry files in the same commit.

```bash
git add supabase/migrations/20260804122000_quiz_player_direct_access_lockdown.sql supabase/migrations/tests/quiz_player_direct_access_lockdown.sql apps/web/src/lib/quiz-player-direct-access-lockdown.test.ts apps/web/src/types/supabase.ts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "fix(quiz): lock down v2 player projections"
```

---

## Task 8: Build Full-Inventory Prize Search with Variant and Condition Selection

**Files:**

- Modify: `apps/web/src/app/api/merchant/quiz/prize-products/route.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/prize-products/route.test.ts`
- Create: `apps/web/src/schemas/quiz-prize-product.ts`
- Create: `apps/web/src/schemas/quiz-prize-product.test.ts`
- Modify: `apps/web/src/app/dashboard/quiz/page.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/page.test.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-prize-product-picker.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-prize-product-picker.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-prize-product-result.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-prize-product-result.test.tsx`

- [ ] **Step 1: Write failing search tests**

Cover authentication first, permission denial, Ogabassey tenant scope, query validation, pagination/cursor, debounced search, aborting stale searches, product 101+, variant requirement, variant image precedence, condition, availability, empty/error/loading states, keyboard selection, and no cross-merchant rows.

- [ ] **Step 2: Implement server-side search using the existing ranked catalog RPC**

Accept validated `search`, `cursor`/`offset`, and bounded `limit`. Reuse current main's indexed `search_products_v2` for ranked, merchant-scoped candidate IDs instead of adding an unindexed `ILIKE` scan. Hydrate only those IDs through an authenticated, tenant-scoped projection that returns the exact product, variant, condition, image, and effective-stock fields required by the picker. Revalidate merchant ownership server-side rather than trusting an RPC `merchant_id_param` from the request. Do not perform an unbounded in-memory search.

- [ ] **Step 3: Implement the accessible picker**

Use a combobox/listbox pattern with thumbnail, product, variant, condition, price, and availability. Require exact variant selection for variant-backed products. Preserve the initial small page for fast first paint, then query on input.

- [ ] **Step 4: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/merchant/quiz/prize-products src/app/dashboard/quiz/quiz-prize-product src/app/dashboard/quiz/page.test.tsx src/schemas/quiz-prize-product.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/merchant/quiz/prize-products apps/web/src/app/dashboard/quiz apps/web/src/schemas/quiz-prize-product.ts apps/web/src/schemas/quiz-prize-product.test.ts
git commit -m "feat(quiz): search prize inventory and variants"
```

---

## Task 9: Add Topic Tags, 20-per-Topic Support, Totals, and Durable v2 Variant-Pool Generation

**Files:**

- Create: `supabase/migrations/20260804130000_quiz_authoring_variant_pools_v2.sql`
- Create: `supabase/migrations/tests/quiz_authoring_variant_pools_v2.sql`
- Create: `apps/web/src/lib/quiz-authoring-variant-pools-migration.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-duration.ts`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-duration.test.ts`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-topic-input.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-topic-input.test.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-generation-form.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-generation-form.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-client.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-client.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-actions.ts`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-actions.test.ts`
- Modify: `apps/web/src/lib/quiz/gemma-question-prompt.ts`
- Modify: `apps/web/src/lib/quiz/gemma-question-prompt.test.ts`
- Modify: `apps/web/src/lib/quiz/gemma-question-generator.ts`
- Modify: `apps/web/src/lib/quiz/gemma-question-generator-ollama.test.ts`
- Create: `apps/web/src/lib/quiz/quiz-variant-batches.ts`
- Create: `apps/web/src/lib/quiz/quiz-variant-batches.test.ts`
- Create: `apps/web/src/lib/quiz/quiz-generation-job-authorization.ts`
- Create: `apps/web/src/lib/quiz/quiz-generation-job-authorization.test.ts`
- Create: `apps/web/src/lib/quiz/process-quiz-generation-job.ts`
- Create: `apps/web/src/lib/quiz/process-quiz-generation-job.test.ts`
- Create: `apps/web/src/schemas/quiz-generation-job.ts`
- Create: `apps/web/src/schemas/quiz-generation-job.test.ts`
- Modify: `apps/web/src/schemas/ai-jobs.ts`
- Modify: `apps/web/src/schemas/ai-jobs.test.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/generate/route.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/generate/route.test.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/generate/quiz-generate-helpers.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/generate/quiz-generate-helpers.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/generation-jobs/[jobId]/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/generation-jobs/[jobId]/route.test.ts`
- Modify: `apps/web/src/app/api/ai-jobs/route.ts`
- Modify: `apps/web/src/app/api/ai-jobs/route.test.ts`
- Create: `apps/web/src/app/dashboard/quiz/quiz-generation-job-status.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-generation-job-status.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/use-quiz-generation-job.ts`
- Create: `apps/web/src/app/dashboard/quiz/use-quiz-generation-job.test.ts`
- Create: `apps/web/src/scripts/process-quiz-generation-jobs.ts`
- Create: `apps/web/src/scripts/process-quiz-generation-jobs.test.ts`
- Modify: `apps/web/package.json`
- Create: `vps-workers/bin/process-quiz-generation-jobs.sh`
- Modify: `vps-workers/bin/run-web-script.test.mjs`
- Modify: `vps-workers/deploy.sh`
- Modify: `vps-workers/jobs/deploy-crontab.test.mjs`
- Modify: `vps-workers/README.md`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing UI/math tests**

Cover Enter/comma tags, duplicate rejection, backspace removal, 10-topic cap, 80-character cap, one topic × 20 questions, total 50 cap, label “Time limit per question (seconds),” 20 × 10 summary, mode-based variant defaults, and invalid input clamping.

- [ ] **Step 2: Write failing generator tests**

Prove each logical slot receives exactly the requested variants, all variant prompts are distinct after normalization, incomplete batches fail atomically, option IDs remain valid, and output is grouped by topic/ordinal instead of array coincidence. Prompt/tests require variants in one slot to test the same factual objective at equivalent difficulty with one unambiguous correct answer; this is also a human approval criterion because semantic equivalence cannot be trusted to string similarity alone.

Prove `POST /api/merchant/quiz/generate` returns `202` with a job ID without invoking a provider. The generic `/api/ai-jobs` creator rejects `quiz_variant_generation` and its list endpoint excludes quiz rows. Only the proof-gated enqueue RPC can write this job type: it validates the existing short-lived quiz proof immediately and records an immutable authorization receipt containing the signed payload hash, job ID, actor, merchant, and purpose. The worker recomputes that payload hash from the immutable normalized input with the same shared canonicalizer before provider use; route/worker hash parity is tested across object-key order and normalized topic/input forms. A database trigger rejects direct insert and any later input/identity/receipt mutation, even through the legacy generic `ai_jobs` insert policy. Replace the current authenticated `ai_jobs` SELECT policy so its broad merchant-owner branch excludes `quiz_variant_generation`; do not add a direct staff/owner SELECT policy for quiz jobs. Add a permission-checked safe-status RPC that returns only job ID, bounded status/progress/retryability, and final draft ID. Role-matrix tests prove owner and authorized staff can call that RPC while direct PostgREST SELECT returns no quiz row, and unrelated/anonymous callers receive nothing. Preserve the existing distributed five-per-minute route limit; under a merchant advisory lock, the RPC additionally enforces one active job and the named default of 10 authorized jobs per rolling 24 hours. Exact idempotent replay returns the same job without consuming quota again.

Exercise 20 logical questions × 3 variants and the 50 × 3 upper bound with deterministic provider fakes. Every provider batch stays below the current 8,192-token completion ceiling, uses a bounded per-call timeout and small named concurrency, and writes a validated checkpoint before its lease heartbeat. Prove cancellation between batches, retry/backoff, stale-lease reclaim, crash recovery from the last valid checkpoint, invalid-checkpoint rejection, no duplicate slot/variant, no PII/question content in logs, and at most one final draft. A lost completion update after draft persistence must recover the same `generation_job_id`, not create a second draft. Completion, terminal failure, and cancellation compact the job to authorization receipt/input digest/counts/status/draft ID or bounded error metadata and erase checkpointed question content; no reusable proof signature is ever stored.

Add a SQL regression proving the current `create_merchant_quiz_draft` contract rejects multiple variants per slot, while a private worker-only v2 persistence function consumes one locked authorized job and atomically persists 1–3 variants for every logical slot. It rejects mixed/incomplete counts, mismatched job input/merchant/actor, a lost worker lease, and a second draft for the same job; it creates `contract_version = 2` in test mode by default. Authenticated roles cannot execute it. Preserve the legacy RPC unchanged for contract-v1 callers.

- [ ] **Step 3: Implement topic and summary components**

Port only the useful prototype behavior onto current main. Keep each component below 300 lines. The admin client owns form state; pure helpers own calculations.

- [ ] **Step 4: Add durable queue and atomic draft persistence contracts**

Extend the existing `ai_jobs` lease model for `quiz_variant_generation` with a partial queue index, active merchant/type/idempotency uniqueness, and nullable typed authorization-receipt fields required by the worker. Narrow the current combined authenticated SELECT policy to exclude quiz-generation rows from its broad owner branch, preserve the existing non-quiz/storefront behavior, and expose quiz status only through `get_merchant_quiz_generation_job_status_v2`, which derives the actor, checks merchant ownership or the existing `marketing/edit` staff permission used by current quiz authoring, and returns a fixed safe projection. Do not grant authenticated roles direct quiz-row SELECT or add the type to the generic job-creation union. Add an immutable `generation_job_id` link/uniqueness invariant on the generated draft.

Add `enqueue_quiz_generation_job_v2`. The quiz route preallocates the job UUID and supplies an existing five-minute route proof with purpose `enqueue_quiz_generation`, subject job ID, authenticated user, and payload containing the merchant, idempotency key, and normalized input. The RPC derives `auth.uid()`/merchant permission, validates the proof immediately, uses a transaction-local private insertion marker, and records only proof ID/signed payload hash/actor/merchant/authorized-at—not the signature. A guard trigger rejects creation/conversion of a quiz-generation row unless that marker is present and rejects later changes to its input, merchant, actor, idempotency key, or authorization receipt. Thus the older generic insert policy cannot create worker-consumable spam. Revoke direct execution except the narrow authenticated enqueue RPC.

The worker claims only rows bearing that database authorization receipt, recomputes the signed payload hash with the same TypeScript canonicalizer used by the route, and revalidates the actor's current merchant/staff permission both before spend and before persistence. It never needs the expired route proof.

Add a private, service-worker-only atomic persistence function that locks the claimed job/lease, revalidates the assembled output against the immutable job input, inserts the draft/slots/variants once, records `generation_job_id`, and returns the existing draft on exact replay. Revoke public/anon/authenticated execute. Apply the migration on the disposable/branch database and regenerate `apps/web/src/types/supabase.ts` before changing callers.

- [ ] **Step 5: Implement enqueue, status, cancellation, and leased processing**

The POST route authenticates first, validates with Zod/CSRF, checks merchant permission, relies on the existing distributed five-per-minute route limiter, normalizes input, creates the short-lived enqueue proof, calls only `enqueue_quiz_generation_job_v2`, and returns `202 { jobId, status: "queued" }`. The RPC enforces the database-authoritative one-active/rolling-daily merchant quota. The route does no provider work. `GET /api/merchant/quiz/generation-jobs/[jobId]` calls only the safe-status RPC and returns owner/staff-safe status, bounded progress, retryability, and final draft ID; it never selects the raw job or returns input, checkpoint/output, authorization receipt, lease data, or partial answer content. `DELETE` uses a separate proof-gated cancellation RPC, is idempotent for queued/processing work, and cannot delete a completed draft. The generic AI-jobs API neither creates nor lists quiz jobs. Direct authenticated PostgREST reads of this job type return no rows.

The worker extends prompt input with logical slot identity and variant batch index. It claims only receipt-authorized jobs with a lease, uses bounded provider concurrency and per-call timeouts, validates each batch, rejects duplicate/near-duplicate variants within a slot, checkpoints only validated batches, refreshes its lease after progress, and stops between batches when cancellation is requested. One processing attempt has a bounded ten-minute budget and retry/backoff; a stale worker cannot persist after losing its lease. Quiz tables remain untouched until every expected slot/variant validates and the private function commits the complete pool. On completion, terminal failure, or cancellation, compact the job to the authorization receipt/input digest/counts, status, draft ID or bounded error metadata and erase checkpointed question content. The audit row remains, and no proof signature is ever stored.

The dashboard writes the returned job ID into non-secret navigation state, shows queued/generating progress, and polls status at a bounded three-second cadence while visible, backing off on errors and pausing when the tab is hidden. It resumes after reload, offers Cancel/Retry where valid, and opens the structured `slots[] -> variants[]` review when the draft is complete. It never calls 60 variants “60 questions.”

- [ ] **Step 6: Add the direct VPS worker and local development entry point**

Add `worker:quiz-generation` to `apps/web/package.json`, a tested direct TypeScript worker CLI with one-shot and local `--watch` modes, and the `vps-workers/bin/process-quiz-generation-jobs.sh` wrapper. Install a once-per-minute VPS cron entry protected by both `ollama-workload.lock` and `quiz-generation.lock`; do not add a Vercel Cron or perform long generation in a Vercel request. Extend the worker README with names-only environment requirements and operational metrics. The worker logs job IDs, counts, timings, provider class, and bounded error codes only—never prompts, answers, authorization signatures, or merchant/player PII.

- [ ] **Step 7: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/app/dashboard/quiz src/app/api/merchant/quiz/generate src/app/api/merchant/quiz/generation-jobs src/lib/quiz/gemma-question src/lib/quiz/quiz-variant-batches.test.ts src/lib/quiz/quiz-generation-job-authorization.test.ts src/lib/quiz/process-quiz-generation-job.test.ts src/scripts/process-quiz-generation-jobs.test.ts src/schemas/quiz src/schemas/quiz-generation-job.test.ts src/schemas/ai-jobs.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
pnpm --dir vps-workers test
bash .github/scripts/check-migration-versions.sh
```

Execute `supabase/migrations/tests/quiz_authoring_variant_pools_v2.sql` against the disposable/branch database. In the pre-production provider smoke, require 20 × 3 and 50 × 3 jobs to complete within the documented ten-minute attempt budget, including one forced worker-restart/checkpoint-resume case; failure stops release rather than reducing the advertised limits silently.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/app/dashboard/quiz apps/web/src/app/api/merchant/quiz/generate apps/web/src/app/api/merchant/quiz/generation-jobs apps/web/src/app/api/ai-jobs/route.ts apps/web/src/app/api/ai-jobs/route.test.ts apps/web/src/lib/quiz apps/web/src/schemas/quiz.ts apps/web/src/schemas/quiz-*.test.ts apps/web/src/schemas/ai-jobs.ts apps/web/src/schemas/ai-jobs.test.ts apps/web/src/scripts/process-quiz-generation-jobs.ts apps/web/src/scripts/process-quiz-generation-jobs.test.ts apps/web/package.json vps-workers/bin/process-quiz-generation-jobs.sh vps-workers/bin/run-web-script.test.mjs vps-workers/deploy.sh vps-workers/jobs/deploy-crontab.test.mjs vps-workers/README.md apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): generate variant pools through durable jobs"
```

---

## Task 10: Build Scrollable Variant Review and Complete Launch Dialog

**Files:**

- Create: `supabase/migrations/20260804140000_quiz_review_and_atomic_activation_v2.sql`
- Create: `supabase/migrations/tests/quiz_review_and_atomic_activation_v2.sql`
- Create: `apps/web/src/lib/quiz-review-activation-migration.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-question-review.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-question-review.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-result.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-result.test.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-launch-dialog.tsx`
- Port/modify: `apps/web/src/app/dashboard/quiz/quiz-launch-dialog.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-launch-summary.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-launch-summary.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-tester-input.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-tester-input.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-event-actions.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-event-actions.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-variant-editor.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-variant-editor.test.tsx`
- Create: `apps/web/src/schemas/quiz-variant-revision.ts`
- Create: `apps/web/src/schemas/quiz-variant-revision.test.ts`
- Create: `apps/web/src/schemas/quiz-event-cancellation.ts`
- Create: `apps/web/src/schemas/quiz-event-cancellation.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/variants/[variantId]/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/variants/[variantId]/route.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/variants/[variantId]/regenerate/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/variants/[variantId]/regenerate/route.test.ts`
- Port/modify: `apps/web/src/app/api/merchant/quiz/generate/quiz-activation-helpers.ts`
- Port/modify: `apps/web/src/app/api/merchant/quiz/generate/quiz-activation-helpers.test.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/activate/route.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/activate/route.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/events/[eventId]/cancel/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/events/[eventId]/cancel/route.test.ts`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing review tests**

Cover all variants rendered, 60vh inner scroll region, per-variant review progress, stale-draft reset, launch disabled until all variants reviewed, sticky/bounded footer, and no whole-page expansion dependency. Each card offers **Approve**, **Edit**, and **Regenerate**; invalid edits, ambiguous/missing correct answers, sibling duplicates, and failed regeneration preserve the prior variant. Editing/regenerating one variant invalidates only its current receipt (or every receipt in the slot when shared slot metadata changes) and returns review progress to incomplete.

Add SQL coverage proving each active variant has its own canonical-content hash/reviewer/timestamp receipt. The hash covers draft/event ID, slot ID and review-relevant slot metadata, prompt, ordered option IDs and labels, the protected `answer_key_hash`, and explanation—not merely a client-supplied answer letter. The database computes/recomputes the hash from stored rows; it does not trust a client-supplied digest. When an authorized merchant review response needs the marked option after a reload, a server-only/definer boundary resolves the one stored option ID whose hash matches `answer_key_hash`; it never stores a new plaintext correct-answer column or exposes the hash/resolved answer through a customer endpoint. The current slot-wide answer-key receipt RPC cannot authorize a pool whose variants differ and remains legacy-only.

- [ ] **Step 2: Write failing launch tests**

Cover immediate/scheduled modes, localized merchant timezone, database-clock immediate launch, immutable UTC conversion, required universal end, default five-minute window for 20 × 10, minimum/maximum validation, late-entry summary, test/live mode summary, bounded test attempts/variants, live fixed attempts/variants, prize condition, tester allowlist, compliance error copy, claim-window requirement, idempotent retry, overlapping-window rejection, concurrent launch, stock race, and launch/scheduled success dialog. Also cover scheduled and active cancellation before `ends_at`, one-time hold release, non-ranking attempt terminalization, no standings/award, completed-or-awarded refusal, database-time refusal at/after `ends_at` or once finalization starts, idempotent repeat cancellation, and concurrent answer/cancel plus cancel/finalizer races under the common event-first lock order.

- [ ] **Step 3: Implement review UI**

Render logical slots with nested variant cards. Track reviewed variant IDs, not just a global checkbox. Every card shows the source topic/difficulty and an explicit review checklist: same fact/objective as its siblings, equivalent difficulty, unambiguous wording, exactly one correct answer, and an accurate explanation. The authenticated merchant review/status response may return the server-resolved `correctOptionId` and explanation, but its customer-facing counterpart must omit both the answer-key hash and any resolved correct answer. Persist one server-side review receipt per variant using `record_merchant_quiz_variant_review_v2` with a server route proof bound to the review action; the RPC derives and stores the canonical content hash, draft ID, variant ID, reviewer, and timestamp.

`PATCH /api/merchant/quiz/variants/[variantId]` validates a complete edited variant, authenticates/authorizes first, signs a payload/user/variant-bound route proof, and calls `revise_merchant_quiz_variant_v2`. The RPC permits draft-only changes, locks the slot/variant, rejects duplicates and invalid correct-option references, writes an audit revision, and invalidates affected receipts atomically. The regenerate route uses Task 9's provider-timeout, route-rate, validation, and sibling-deduplication controls to request exactly one bounded replacement, then persists it through the same revision RPC. It does not enqueue a full-draft job for one card. A generation/provider failure leaves the approved stored content untouched. Reject launch if any active variant is missing, stale, changed after review, or reviewed under a different stored content revision.

- [ ] **Step 4: Implement activation rules**

Use one `activate_merchant_quiz_v2` RPC. The API authenticates first, checks the environment gate for live mode, validates with Zod/CSRF, and creates an existing-pattern server route proof bound to user, event, mode, launch kind, scheduled UTC instants or immediate window duration, rules, and prize. The RPC validates that proof before mutation, derives `auth.uid()` and staff permission, locks the draft/variants/prize rows, and either commits every launch effect or none. A merchant calling Supabase directly cannot bypass the web environment gate. Activation must:

- revalidate merchant ownership and all reviewed variants;
- for immediate launch, compute both `starts_at` and `ends_at` from the database clock plus the proof-bound window duration; for scheduled launch, validate the proof-bound UTC instants; require start before end and enforce allowed bounds;
- snapshot timezone, rules version, max attempts, and variant settings;
- resolve tester identities for test mode;
- reserve prize inventory, require the approved snapshotted claim-window value, and enforce environment/event/legal compliance for live mode;
- for test mode, validate owned active product/variant/condition/image, report stock as a live-readiness diagnostic, and make reservation/award side effects impossible even when stock is available;
- acquire a merchant-scoped transaction/advisory lock and reject overlap against every scheduled/active merchant quiz window, including supported legacy rows; the later direct-write revocation makes this race-free check the only activation path;
- set `scheduled` or `active` idempotently and make `starts_at`, `ends_at`, rules, prize, mode, and ranking inputs immutable after launch.

Add `POST /api/merchant/quiz/events/[eventId]/cancel`. It authenticates first, validates the event ID and bounded reason with Zod/CSRF, probes authoring readiness, signs the action/user/event/reason-bound route proof, and calls only `cancel_merchant_quiz_v2`. The dashboard exposes a destructive “Cancel quiz” action only for scheduled/active events and confirms the exact effect: current play stops, no standings/winner are published, and any untransferred hold is released. It never presents cancellation as available after the universal end.

The permission-checked, route-proofed `cancel_merchant_quiz_v2` RPC locks the event and reads database time. It accepts only `scheduled` or `active` events while `clock_timestamp() < ends_at` and before any finalization/award transition. It then locks attempts and reservation rows in the shared event-first order. At or after `ends_at`, finalization owns the outcome even if a worker has not advanced the visible status yet; cancellation fails without releasing the hold. A concurrent answer either commits before cancellation and is then terminalized as non-ranking, or waits and observes cancellation; it cannot remain awardable afterward. The RPC releases an untransferred live reservation exactly once, records the bounded cancellation reason/audit actor, and has no direct table-write fallback.

Create a typed `quiz_authoring_contract_version()` deployment sentinel returning 1. Task 9's private generated-draft persistence and the revision/review/activation/cancellation v2 RPCs now exist, so route callers can compile, but activation and cancellation accept only integer 2 and remain fail-closed until Task 10A revokes the legacy direct writes and upgrades the marker. Regenerate Supabase types before compiling route callers.

Cancellation is also atomic. Cancelling a scheduled event before its end releases its untransferred reservation and makes it unavailable. Cancelling an active event before its end additionally terminalizes every `started` attempt as non-ranking `event_cancelled`, prevents later answer/resume/finalizer award paths, publishes no standings, and makes owner result/leaderboard calls return a bounded cancelled/unavailable state. Clients already in gameplay stop on the next response, refresh, bounded status poll, or app resume. Repeated cancellation is idempotent; an ended, finalizing, completed, or already-awarded event cannot be cancelled through this RPC.

- [ ] **Step 5: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/app/dashboard/quiz src/app/api/merchant/quiz/activate src/app/api/merchant/quiz/events src/app/api/merchant/quiz/variants src/app/api/merchant/quiz/generate/quiz-activation-helpers.test.ts src/schemas/quiz-variant-revision.test.ts src/schemas/quiz-event-cancellation.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
bash .github/scripts/check-migration-versions.sh
```

Execute `supabase/migrations/tests/quiz_review_and_atomic_activation_v2.sql`, regenerate `apps/web/src/types/supabase.ts`, and prove a missing/non-2 `quiz_authoring_contract_version()` makes activation or cancellation return `503 QUIZ_AUTHORING_NOT_READY` before mutation. Draft/review may be prepared during the cutover, but no event can launch until lockdown is complete.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/lib/quiz-review-activation-migration.test.ts apps/web/src/app/dashboard/quiz apps/web/src/app/api/merchant/quiz apps/web/src/schemas/quiz-variant-revision.ts apps/web/src/schemas/quiz-variant-revision.test.ts apps/web/src/schemas/quiz-event-cancellation.ts apps/web/src/schemas/quiz-event-cancellation.test.ts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): review variants and schedule universal quiz windows"
```

---

## Task 10A: Remove Direct Merchant Quiz Writes After the Authoring Cutover

**Files:**

- Create: `supabase/migrations/20260804141000_quiz_authoring_write_lockdown.sql`
- Create: `supabase/migrations/tests/quiz_authoring_write_lockdown.sql`
- Create: `apps/web/src/lib/quiz-authoring-write-lockdown.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Prove every authoring mutation uses a v2 RPC**

Static and route tests must show full-draft persistence is reachable only through the authorized leased worker/private function, while review, corrective revision, cancellation, and activation use authenticated, permission-checked RPCs. No browser or server user client may directly insert/update/delete `quiz_events`, `quiz_question_slots`, or `quiz_question_variants` for contract-v2 events. Later tester/reset operations use their own private tables/RPCs and inherit no write grant from these authoring tables.

- [ ] **Step 2: Revoke broad writes and prove immutability**

In a distinct post-caller-cutover migration, revoke the existing authenticated `INSERT, UPDATE, DELETE` grants and obsolete merchant-write policies on quiz authoring tables. Grant only the exact v2 RPC executions. After those revocations and their assertions, replace the typed `quiz_authoring_contract_version()` sentinel so it returns 2; this is the only marker activation routes accept. SQL tests impersonate a merchant/staff JWT and prove direct writes cannot change `ends_at`, status, mode, rules, compliance, permit, prize, variants, or review receipts, while authorized RPCs still work and unrelated tenants fail.

- [ ] **Step 3: Deploy, regenerate, and validate**

Deploy Task 10 callers first and verify they return `QUIZ_AUTHORING_NOT_READY` while the typed marker is 1; then apply this lockdown migration as a separate schema checkpoint and verify marker 2 unlocks only the RPC path. Regenerate types, run the merchant quiz route/dashboard suites and SQL role matrix, and commit the forward-only hardening migration.

- [ ] **Step 4: Run the checkpoint tests and commit**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/merchant/quiz src/app/dashboard/quiz src/lib/quiz-authoring-write-lockdown.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
bash .github/scripts/check-migration-versions.sh
```

Execute `supabase/migrations/tests/quiz_authoring_write_lockdown.sql`, regenerate types, and commit only the lockdown migration, tests, generated output, and its two replay-registry updates.

```bash
git add supabase/migrations/20260804141000_quiz_authoring_write_lockdown.sql supabase/migrations/tests/quiz_authoring_write_lockdown.sql apps/web/src/lib/quiz-authoring-write-lockdown.test.ts apps/web/src/types/supabase.ts apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "fix(quiz): lock down v2 authoring writes"
```

---

## Task 11: Add Versioned Rules Content and Terms Page

**Files:**

- Create: `apps/web/src/lib/quiz/quiz-rules.ts`
- Create: `apps/web/src/lib/quiz/quiz-rules.test.ts`
- Modify from Task 2: `apps/web/src/lib/quiz/quiz-rules-version.ts`
- Modify from Task 2: `apps/web/src/lib/quiz/quiz-rules-version.test.ts`
- Create: `apps/web/src/schemas/quiz-rules.ts`
- Create: `apps/web/src/schemas/quiz-rules.test.ts`
- Create: `apps/web/src/app/(storefront)/[slug]/(utility)/quiz/terms/page.tsx`
- Create: `apps/web/src/app/(storefront)/[slug]/(utility)/quiz/terms/page.test.tsx`
- Modify: `apps/web/src/app/api/quiz/events/route.ts`
- Modify: `apps/web/src/app/api/quiz/events/route.test.ts`
- Create: `docs/legal/quiz-live-launch-approval-checklist.md`

- [ ] **Step 1: Write failing structured-rules tests**

Verify the rules payload contains free entry, 18+, question/time fields, universal end, late-entry semantics, answer lock, attempt limit, ranking, publication time, exact prize/condition, approved versioned claim/cancellation text, privacy purposes, and a full terms URL.

- [ ] **Step 2: Implement a versioned rules source**

Keep product-controlled structured facts separate from counsel-approved static legal text. Connect the content to the registry introduced in Task 2; test events may use a clearly draft-marked version, while only written counsel approval changes `approvedForLive`. The event snapshots the approved version. Do not allow a draft to launch live with an unknown/unapproved version.

- [ ] **Step 3: Build the storefront terms page**

Render plain, readable, merchant-scoped terms with no `dangerouslySetInnerHTML`. Include product condition and event-specific values when an event query is present. Add metadata and accessible headings.

- [ ] **Step 4: Write the approval checklist**

Include FCCPC promotion registration, clear-language/material-term review, used/reconditioned disclosure, NDP Act/privacy review, permit reference, claim window, cancellation policy, geographic eligibility, inventory reservation, and operations sign-off. Mark legal approval as a release gate, not a code assertion.

- [ ] **Step 5: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/lib/quiz/quiz-rules.test.ts src/schemas/quiz-rules.test.ts 'src/app/(storefront)/[slug]/(utility)/quiz/terms/page.test.tsx' src/app/api/quiz/events
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/quiz/quiz-rules.ts apps/web/src/lib/quiz/quiz-rules.test.ts apps/web/src/lib/quiz/quiz-rules-version.ts apps/web/src/lib/quiz/quiz-rules-version.test.ts apps/web/src/schemas/quiz-rules.ts apps/web/src/schemas/quiz-rules.test.ts 'apps/web/src/app/(storefront)/[slug]/(utility)/quiz/terms' apps/web/src/app/api/quiz/events docs/legal/quiz-live-launch-approval-checklist.md
git commit -m "feat(quiz): publish versioned rules and prize terms"
```

---

## Task 11A: Bring the Existing Web Storefront onto the v2 Player Contract

**Files:**

- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-attempt-start.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-attempt-start.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-result-panel.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-result-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/fetch-quiz-leaderboard.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/fetch-quiz-leaderboard.test.ts`
- Create small rules/readiness/server-clock helpers and colocated tests as required to keep each file below 300 lines.

- [ ] **Step 1: Write failing web parity tests**

Cover contract header 2, v2 event parsing, test visibility, rules/terms acceptance, username and DOB remediation, one `startRequestId` retained across transport retry, first-party device cookie, late entry, universal/question countdowns, one-tap locked answer with no Submit button, same-answer retry, refresh/tab crash recovery through the active-attempt endpoint, coalesced foreground cancellation reconciliation no more than once per 15 seconds, cancelled-event termination, finalizing/pending result, post-publication result retrieval, live claim versus no test claim, and final leaderboard. Prove an old web bundle cannot discover/start a v2 event.

- [ ] **Step 2: Implement behavioral parity**

Use the same shared contracts and backend routes as mobile. Web must not retain an immediate-score/award path or bypass username because it previously lacked a username UI. Retain only the minimum account/event-bound recovery pointer in first-party storage and resume from server state after reload; never cache question text, answer keys, claims, or identity fields. While gameplay is foregrounded, coalesce answer/start traffic with a bounded active-attempt reconciliation no more than once per the shared 15-second cadence; pause it when hidden and stop it on terminal state. Add the minimum accessible rules/readiness experience needed to satisfy the same server gates; visual A+C lobby redesign remains mobile-specific unless separately approved.

- [ ] **Step 3: Validate and commit**

```bash
pnpm --filter @baci/web exec vitest run src/components/storefront/ogabassey/pages/quiz src/components/storefront/ogabassey/pages/fetch-quiz-leaderboard.test.ts src/components/storefront/ogabassey/pages/use-quiz-attempt-start.test.ts
```

Commit only after the web flow uses result/leaderboard publication and no v2 endpoint has a legacy web bypass.

```bash
git add apps/web/src/components/storefront/ogabassey/pages
git commit -m "feat(quiz): align web storefront with v2 live flow"
```

---

## Task 12: Update Mobile Services and Store for Server Time and Locked Submission

**Files:**

- Modify: `apps/mobile-storefront/services/quiz-types.ts`
- Modify: `apps/mobile-storefront/services/quiz-types.test.ts`
- Modify: `apps/mobile-storefront/services/quiz.ts`
- Modify: `apps/mobile-storefront/services/quiz.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempts.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempts.test.ts`
- Create: `apps/mobile-storefront/services/quiz-attempt-recovery.ts`
- Create: `apps/mobile-storefront/services/quiz-attempt-recovery.test.ts`
- Create: `apps/mobile-storefront/services/quiz-results.ts`
- Create: `apps/mobile-storefront/services/quiz-results.test.ts`
- Create: `apps/mobile-storefront/services/quiz-leaderboard.ts`
- Create: `apps/mobile-storefront/services/quiz-leaderboard.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store-retry.test.ts`
- Create: `apps/mobile-storefront/stores/quiz-recovery-envelope.ts`
- Create: `apps/mobile-storefront/stores/quiz-recovery-envelope.test.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-server-clock.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-server-clock.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-question-timer.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-question-timer.test.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-event-timer.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-event-timer.test.ts`

- [ ] **Step 1: Write failing service tests**

Cover contract header 2, product image preservation, event mode, condition, timezone, timing summary, rules version, stable `startRequestId` per deliberate Start, `serverNow`, `eventEndsAt`, owner-safe active-attempt recovery, pending/finalizing/cancelled parsing, dedicated result retrieval, published score/rank/live claim, no test claim, leaderboard availability/current-player row, literal acceptance request, app version/platform, required live device fingerprint, and friendly update/global-end errors.

- [ ] **Step 2: Write failing store/timer tests**

Cover server clock skew, 9:04 late join, question deadline capped at 9:05, event end mid-question, background/resume, full process death/cold start, start retry returns the same attempt, a new Start while active resumes rather than consuming a test attempt, a deliberate test replay rotates `startRequestId` only after terminal completion, one locked answer, duplicate tap suppression, same-answer recovery after transport failure or process death, a foreground cancellation observed through coalesced active-attempt reconciliation no more than once per 15 seconds, pending/finalizing/cancelled result states, bounded result refresh/poll after close, account-switch reset, and no client deadline extension.

- [ ] **Step 3: Implement typed services**

Preserve bearer auth/CSRF behavior and existing error mapping. Send `X-Baci-Quiz-Contract: 2` on every v2 quiz request and keep the existing expected-user/device-fingerprint protections. Capture app version from Expo constants without placing it in analytics. Add result and leaderboard/archive services; answer responses never become the source of a prize claim.

- [ ] **Step 4: Evolve store state**

Replace “selected then submit” with `lockAndSubmitAnswer(optionId, submitter)`. Preserve the locked option through retry, clear it only on next question, and add `pending_results` and `event_cancelled` states. Keep monotonic generation guards for sign-out/account switch.

Persist a minimal recovery envelope keyed by authenticated user and event: attempt ID, original start request ID, current question ID, pending locked option ID when one exists, and generation/version metadata. Write the locked option before sending the answer. On cold start, refresh, or app resume, call the active-attempt endpoint and reconcile server-first: resend the same locally locked answer only when the server still reports that question as unanswered; otherwise accept the server's committed next/terminal state. Clear the envelope on terminal result, reset, sign-out, account switch, or event mismatch. Do not persist question/option text, answer keys, username, DOB, device fingerprint, invite token, or claim token.

While gameplay is foregrounded, use the same owner-safe active-attempt endpoint for cancellation reconciliation at question transitions and no more than once per the shared 15-second cadence when no newer start/answer/resume response has already refreshed state. Pause while backgrounded or another quiz request is in flight, resume with one immediate reconciliation, and stop permanently on terminal state. This poll observes lifecycle only; it never extends either deadline or becomes scoring authority.

- [ ] **Step 5: Implement dual timer hooks**

Both hooks consume the same server-clock offset. The event timer triggers terminal UI once. The question timer fires at its effective server deadline and cannot exceed event end.

- [ ] **Step 6: Validate**

```bash
pnpm --filter @baci/mobile-storefront test -- quiz-types.test.ts quiz.test.ts quiz-attempts.test.ts quiz-attempt-recovery.test.ts quiz-results.test.ts quiz-leaderboard.test.ts quiz-store quiz-recovery-envelope.test.ts use-quiz-server-clock.test.ts use-quiz-question-timer.test.ts use-quiz-event-timer.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile-storefront/services apps/mobile-storefront/stores apps/mobile-storefront/components/quiz/use-quiz-*.ts apps/mobile-storefront/components/quiz/use-quiz-*.test.ts
git commit -m "feat(quiz): consume server time and lock answers on tap"
```

---

## Task 13: Redesign the Mobile Prize Lobby

**Files:**

- Modify: `apps/mobile-storefront/app/quiz/index.tsx`
- Modify: `apps/mobile-storefront/__tests__/app/quiz/index.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.styles.ts`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.styles.test.ts`
- Replace/refactor: `apps/mobile-storefront/components/quiz/QuizEventsList.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizEventsList.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizPrizeHero.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizPrizeHero.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizLiveEventCard.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizLiveEventCard.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizEventSections.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizEventSections.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/quiz-prize-kicker.ts`
- Create: `apps/mobile-storefront/components/quiz/quiz-prize-kicker.test.ts`
- Create: `apps/mobile-storefront/assets/quiz/product-fallback.png`

- [ ] **Step 1: Write failing visual behavior tests**

Verify:

- native title is “Quiz” and trophy action exists;
- no repeated large “Super Quiz” body heading;
- no Entry panel;
- Today/Tonight/Tomorrow/weekday copy from `serverNow` plus event start in the event timezone, including active 4:59/5:00 PM and a morning view of an event scheduled for 8:00 PM that day;
- “Win an iPhone XR” style headline;
- `expo-image` uses the backend image, contain fit, cache, fallback, and roughly 9-degree transform;
- used/open-box/refurbished condition is prominent;
- active card shows LIVE/TEST, close countdown, exact end, three timing facts, “Play for free,” “Every second counts,” and “View rules”;
- a caller with a recoverable active attempt sees “Resume quiz” in place of “Play for free” and returns directly to server state without accepting rules again;
- a lobby left open across `startsAt` or `endsAt` refreshes against server time and transitions scheduled -> playable -> closed/finalizing without requiring an app restart;
- per-question duration appears once;
- closed card is muted and not orange/actionable;
- past event links to leaderboard;
- loading, error, empty, scheduled-only, live, and test states.

- [ ] **Step 2: Implement small lobby components**

Use `expo-image`, theme colors, safe-area/native header behavior, and responsive layouts. Do not mutate or pre-skew catalog images.

- [ ] **Step 3: Keep active event primary**

Select one current active event for the spotlight. Group scheduled and completed events below with bounded pagination/load-more behavior. Schedule a bounded server refresh at the next event start/end and refresh on app foreground; do not infer authoritative status from device time or wait for the minute worker.

- [ ] **Step 4: Validate**

```bash
pnpm --filter @baci/mobile-storefront test -- QuizPrizeHero.test.tsx QuizLiveEventCard.test.tsx QuizEventSections.test.tsx QuizEventsList.test.tsx QuizScreen.test.tsx index.test.tsx quiz-prize-kicker.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-storefront/app/quiz apps/mobile-storefront/__tests__/app/quiz apps/mobile-storefront/components/quiz apps/mobile-storefront/assets/quiz
git commit -m "feat(quiz): redesign mobile lobby around the live prize"
```

---

## Task 14: Replace Sequential Gates with Rules and Unified “Ready to Play?” Sheet

**Files:**

- Create: `apps/mobile-storefront/components/quiz/QuizRulesSheet.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizRulesSheet.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizReadySheet.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizReadySheet.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizReadySheet.styles.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-ready-flow.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-ready-flow.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/useQuizStartFlow.ts`
- Modify: `apps/mobile-storefront/components/quiz/useQuizStartFlow.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.dob-gate.test.tsx`
- Reuse: `apps/mobile-storefront/components/account/UsernamePrompt.tsx`
- Reuse current DOB validation/save logic from `useQuizDateOfBirthGate.ts`
- Remove old quiz-only gate modals only after migrated tests pass:
  - `QuizUsernameGateModal.tsx` and styles/tests
  - `QuizDateOfBirthGateModal.tsx` and styles/tests

- [ ] **Step 1: Write failing rules-sheet tests**

Cover event-specific free entry, 18+, counts/timers, universal end, late entry, answer lock, attempts, ranking, publication, prize/condition, privacy purposes, and full terms link.

- [ ] **Step 2: Write failing readiness-flow tests**

Cover returning username, new username, edit/cooldown error, missing DOB, invalid/under-18 DOB, rules checkbox initially unchecked, disabled Start, no attempt on sheet open, attempt created only on Start, an existing active attempt bypassing new acceptance and resuming directly, cancel while async username/DOB saves, account switch, stale completion generation, server age correction, event expiring/cancelling while the sheet is open, and rules version mismatch.

- [ ] **Step 3: Implement one coordinator**

The coordinator sequences username save first when required, DOB save second when required, and attempt start last, while the user sees one sheet. Preserve current-main expected-user snapshots and generation refs so cancel/account switch cannot start a stale event. Re-read global time before final Start; close the sheet with “Quiz has ended” if necessary.

- [ ] **Step 4: Send acceptance with start**

Pass the authoritative rules version shown in the sheet, literal checkbox consent, app version, and platform. Do not precheck consent based on prior marketing/privacy choices.

- [ ] **Step 5: Validate**

```bash
pnpm --filter @baci/mobile-storefront test -- QuizRulesSheet.test.tsx QuizReadySheet.test.tsx use-quiz-ready-flow.test.ts useQuizStartFlow.test.ts QuizScreen.test.tsx QuizScreen.dob-gate.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile-storefront/components/quiz
git commit -m "feat(quiz): unify rules identity and age readiness"
```

---

## Task 15: Implement One-Tap Gameplay, Dual Countdowns, and Pending Results

**Files:**

- Modify: `apps/mobile-storefront/components/quiz/QuizQuestionCard.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizQuestionCard.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizGameplayHeader.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizGameplayHeader.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizPendingResults.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizPendingResults.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizFinalResult.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizFinalResult.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.styles.ts`

- [ ] **Step 1: Write failing gameplay tests**

Cover tap locks and submits, no Submit button, all options disabled after first tap, haptic called once, next question advances after response, duplicate taps do not send, retry keeps same answer, timeout forfeits, event end stops the attempt, merchant cancellation stops the attempt without results/claim, both countdowns render, global urgency threshold, question deadline shorter than configured near event end, background/resume, killed-app recovery before and after a lost answer response, and accessible timer announcements.

- [ ] **Step 2: Implement one-tap answer cards**

On press, call the store's single lock-and-submit action. Display selected/locked state and an inline progress indicator. Do not permit changing answers while pending.

- [ ] **Step 3: Implement pending and final result screens**

Show “Answers locked” and localized standings availability while pending/finalizing. Do not show score, correctness, explanation, rank, winner, or prize claim before publication. Refresh on explicit action, app resume, and a bounded post-close polling interval against the dedicated result endpoint; stop polling after publication, terminal unavailability, sign-out/account switch, or a bounded timeout. The final result renders score/rank and, only for an eligible live winner, the server-issued claim action. Test results stay watermarked and never render a claim; while the test event remains active, offer a return-to-lobby/try-again action only when the server reports remaining test attempts. Live mode never offers replay.

- [ ] **Step 4: Validate**

```bash
pnpm --filter @baci/mobile-storefront test -- QuizQuestionCard.test.tsx QuizGameplayHeader.test.tsx QuizPendingResults.test.tsx QuizFinalResult.test.tsx QuizScreen.test.tsx use-quiz-question-timer.test.ts use-quiz-event-timer.test.ts quiz-store
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-storefront/components/quiz apps/mobile-storefront/stores/quiz-store.ts apps/mobile-storefront/stores/quiz-store*.test.ts
git commit -m "feat(quiz): advance on answer and hide live results"
```

---

## Task 16: Add Leaderboard Archive and Final Board to Mobile

**Files:**

- Create: `apps/mobile-storefront/app/quiz/leaderboards/index.tsx`
- Create: `apps/mobile-storefront/app/quiz/leaderboards/[eventId].tsx`
- Create: `apps/mobile-storefront/__tests__/app/quiz/leaderboards/index.test.tsx`
- Create: `apps/mobile-storefront/__tests__/app/quiz/leaderboards/[eventId].test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizLeaderboardArchive.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizLeaderboardArchive.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizLeaderboard.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizLeaderboard.test.tsx`
- Modify: `apps/mobile-storefront/app/quiz/index.tsx`
- Modify: `apps/mobile-storefront/__tests__/app/quiz/index.test.tsx`
- Add/modify backend archive endpoint:
  - Create: `apps/web/src/app/api/quiz/leaderboard/events/route.ts`
  - Create: `apps/web/src/app/api/quiz/leaderboard/events/route.test.ts`

- [ ] **Step 1: Write failing archive API tests**

Cover auth first, merchant scope, completed/published live events only, newest-first pagination, prize/winner projection, test event exclusion for public archive, and private tester access to test results.

- [ ] **Step 2: Write failing mobile tests**

Cover trophy navigation, archive loading/error/empty states, past quiz selection, final top 100, highlighted current player, pinned “Your position” outside top 100, no real names, live-hidden state, test watermark, and accessible rank labels.

- [ ] **Step 3: Implement archive and final board**

Use virtualized lists for potentially large archives/boards. The API remains authoritative for result availability; do not infer “final” from the device clock alone.

- [ ] **Step 4: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/quiz/leaderboard
pnpm --filter @baci/mobile-storefront test -- QuizLeaderboardArchive.test.tsx QuizLeaderboard.test.tsx leaderboards index.test.tsx quiz-leaderboard.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/quiz/leaderboard apps/mobile-storefront/app/quiz apps/mobile-storefront/__tests__/app/quiz apps/mobile-storefront/components/quiz apps/mobile-storefront/services/quiz-leaderboard*
git commit -m "feat(quiz): add past quiz leaderboards and player rank"
```

---

## Task 17: Suppress Global Overlays in the Quiz Funnel and Add Privacy-Safe Analytics

**Files:**

- Modify: `apps/mobile-storefront/components/navigation/RootLayoutNav.tsx`
- Modify: `apps/mobile-storefront/components/navigation/RootLayoutNav.test.tsx`
- Create: `apps/mobile-storefront/components/navigation/is-quiz-funnel-route.ts`
- Create: `apps/mobile-storefront/components/navigation/is-quiz-funnel-route.test.ts`
- Create: `apps/mobile-storefront/services/quiz-analytics.ts`
- Create: `apps/mobile-storefront/services/quiz-analytics.test.ts`
- Modify relevant quiz components from Tasks 13–16 to call typed analytics helpers.

- [ ] **Step 1: Write failing route-overlay tests**

Verify ChatWidget and DrawerMenu are absent for `/quiz`, `/quiz/leaderboards`, `/quiz/test-invite`, and active quiz descendants, but remain unchanged elsewhere. Connectivity and error handling remain available.

- [ ] **Step 2: Write failing analytics privacy tests**

Assert the quiz event property allowlist rejects/removes answer, DOB, username, email, device fingerprint, permit, and token fields. Cover lobby, rules, ready, start, answer outcome category, timeout, event end, results, leaderboard, and claim funnel events.

- [ ] **Step 3: Implement route-aware suppression and analytics**

Use Expo Router's current pathname at the root. Do not hide overlays globally or alter their feature flags. Analytics records timing buckets and error codes, not sensitive values.

- [ ] **Step 4: Validate**

```bash
pnpm --filter @baci/mobile-storefront test -- RootLayoutNav.test.tsx is-quiz-funnel-route.test.ts quiz-analytics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-storefront/components/navigation apps/mobile-storefront/services/quiz-analytics* apps/mobile-storefront/components/quiz
git commit -m "feat(quiz): isolate the quiz funnel and add safe analytics"
```

---

## Task 18: Add Test-Mode Admin Operations and a Reproducible Mobile QA Runbook

**Files:**

- Create: `supabase/migrations/20260804150000_quiz_test_operations_v2.sql`
- Create: `supabase/migrations/tests/quiz_test_operations_v2.sql`
- Create: `apps/web/src/lib/quiz-test-operations-migration.test.ts`
- Regenerate after applying migration: `apps/web/src/types/supabase.ts`
- Create: `apps/web/src/schemas/quiz-test-operations.ts`
- Create: `apps/web/src/schemas/quiz-test-operations.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/testers/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/testers/route.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/test-invites/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/test-invites/route.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/test-reset/route.ts`
- Create: `apps/web/src/app/api/merchant/quiz/test-reset/route.test.ts`
- Create: `apps/web/src/app/dashboard/quiz/quiz-test-controls.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-test-controls.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-result.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-result.test.tsx`
- Create: `apps/mobile-storefront/app/quiz/test-invite.tsx`
- Create: `apps/mobile-storefront/__tests__/app/quiz/test-invite.test.tsx`
- Create: `apps/mobile-storefront/services/quiz-test-invites.ts`
- Create: `apps/mobile-storefront/services/quiz-test-invites.test.ts`
- Create: `docs/ops/quiz-mobile-test-mode.md`
- Modify with this migration's final path/hash: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify with the same path/hash: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

- [ ] **Step 1: Write failing admin operation tests**

Cover marketing/edit permission, merchant scope, test-only restriction, tester add/remove by existing customer email, no arbitrary user-ID authority, 30-minute invite creation/revocation/one-time claim, reset only before an active test event's universal end/publication, no award/inventory mutation, audit record, CSRF, and idempotence. Prove reset changes the prior attempt to `test_reset` instead of deleting it; reset rows remain auditable but are excluded from test ranking and the 1–50 configured attempt cap. A reset racing an answer follows the event-first lock order and cannot leave that attempt rankable. Before publication, removing an allowlisted tester terminalizes all of that tester's active or otherwise rank-eligible attempts as non-ranking `tester_revoked` without affecting other players; a concurrent answer cannot survive the revocation as rankable. After publication, removal revokes access/future starts but does not rewrite the frozen private board. Completed/published test and all live resets are impossible; the admin offers clone/relaunch for another completed-event run.

Assert the migration creates `quiz_test_operations_contract_version()` returning 2 only after tester, invite, and reset RPCs exist. Routes probe it and return `503 QUIZ_TEST_OPERATIONS_NOT_READY` before mutation when schema deployment is incomplete.

- [ ] **Step 2: Implement test controls**

Implement permission-checked, route-proofed RPCs and thin routes for tester management, invite create/revoke, and reset. Reset and tester removal lock event then attempt rows; before publication, removing a tester terminalizes only that customer's active/rank-eligible test attempts as non-ranking `tester_revoked`. After publication it revokes access without rewriting the frozen board. The invite table stores only a digest; the authenticated merchant route returns the raw token once. Admin can copy a test invite, add/remove testers, reset their test attempts, view test event status, and open the mobile deep link. Live events expose none of these destructive test controls.

The mobile deep-link route requires sign-in, treats the raw token as a short-lived bearer secret, exchanges it once, and immediately replaces navigation with the token-free quiz event URL. Application code never forwards it to logs, error reporting, analytics, or persistent storage. Revoked, expired, replayed, wrong-tenant, live-event, and account-switch cases are tested.

- [ ] **Step 3: Write the runbook**

Include:

```bash
# Web backend with quiz test behavior; use only the existing local quiz/Supabase values.
QUIZ_PHASE=1a pnpm --filter @baci/web dev

# Separate terminal: durable quiz generation worker for local queued drafts.
pnpm --filter @baci/web worker:quiz-generation -- --watch

# Installed storefront dev client; package script owns Metro port 8082.
QUIZ_BACKEND_ORIGIN="http://$(ipconfig getifaddr en0):3000"
EXPO_PUBLIC_API_URL="$QUIZ_BACKEND_ORIGIN" pnpm --filter @baci/mobile-storefront android:metro
pnpm --filter @baci/mobile-storefront android:launch
```

Also document iOS dev-client connection, physical-device LAN requirements, signed-in tester prerequisites, how to distinguish quiz errors from VTU/Kuda console noise, and why the full Vercel environment must not be pulled locally.

List the minimal quiz-only environment names required by the current env schema, including phase, Supabase public/server values used by the selected local path, route-proof secret, and device-hash pepper where applicable, but never include values. Test activation still uses a signed route proof; “test” means no prize side effects, not an unprotected mutation endpoint.

- [ ] **Step 4: Add production-hosted private-test instructions**

Document creating a test event in production admin, allowlisting the mobile account, confirming the TEST QUIZ watermark, repeating/resetting, and verifying zero `quiz_awards`, reserved orders, inventory holds, and public archive rows.

- [ ] **Step 5: Validate**

```bash
pnpm --filter @baci/web exec vitest run src/app/api/merchant/quiz src/app/dashboard/quiz src/schemas/quiz-test-operations.test.ts
pnpm --filter @baci/mobile-storefront test -- quiz test-invite.test.tsx quiz-test-invites.test.ts
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
bash .github/scripts/check-migration-versions.sh
```

Execute `supabase/migrations/tests/quiz_test_operations_v2.sql` and regenerate Supabase types before final validation.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations apps/web/src/types/supabase.ts apps/web/src/lib/quiz-test-operations-migration.test.ts apps/web/src/schemas/quiz-test-operations.ts apps/web/src/schemas/quiz-test-operations.test.ts apps/web/src/app/api/merchant/quiz apps/web/src/app/dashboard/quiz apps/mobile-storefront/app/quiz/test-invite.tsx apps/mobile-storefront/__tests__/app/quiz/test-invite.test.tsx apps/mobile-storefront/services/quiz-test-invites.ts apps/mobile-storefront/services/quiz-test-invites.test.ts docs/ops/quiz-mobile-test-mode.md apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts
git commit -m "feat(quiz): add private mobile test operations"
```

---

## Task 19: Execute the Full QA Matrix

**Files:**

- Create: `docs/qa/quiz-live-production-qa-receipt.md`
- Update only tests/implementation files needed to fix discovered quiz regressions.

- [ ] **Step 1: Run all automated quality gates**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
pnpm --dir vps-workers test
bash .github/scripts/check-migration-versions.test.sh
bash .github/scripts/apply-pending-migrations.test.sh
bash .github/scripts/check-migration-versions.sh
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
pnpm --filter @baci/web db:replay:chronological
pnpm --filter @baci/web db:replay:production-effect
pnpm --filter @baci/web verify:quiz-assets
coderabbit review --agent -t uncommitted
```

Fix all critical/high findings and rerun affected gates. Do not report focused suites as the full suite.

- [ ] **Step 2: Run database scenarios against a disposable/branch database**

Record evidence for:

- scheduled promotion;
- scheduled zero-player closure/no-winner and exact reservation release;
- 20 × 10-second, five-minute event;
- 20 × 3 and 50 × 3 variant generation completes through the leased VPS worker within the documented ten-minute attempt budget; a forced worker restart resumes its validated checkpoint, and route latency remains enqueue-only;
- edit/regenerate of one bad variant invalidates the old full-content receipt, preserves sibling content, and requires reapproval before launch;
- 9:04 late join starts question 1;
- event ends mid-question;
- clock skew does not extend time;
- event closure succeeds even when the app sends no final timeout/answer request;
- concurrent answer replay;
- account switch during start/answer;
- concurrent Start with different request IDs resumes one active attempt rather than creating two;
- browser refresh and mobile process death recover the same current question/deadline; a lost accepted-answer response advances exactly once;
- scheduled and active cancellation before `ends_at` terminalizes safely under concurrent answer/finalizer races, publishes no standings, mints no award, and releases one hold; cancellation at/after `ends_at` is refused so finalization owns the outcome;
- identity/device/live attempt cap;
- live device resolution/binding failure is closed and test-mode failure is visibly diagnostic only;
- test reset;
- reset rows remain auditable and are excluded from test caps/ranking;
- no test award side effects;
- phase-1a direct worker closes/publishes due test events without enabling live award logic;
- live finalization and one-winner idempotence;
- launch-hold transfer, cancellation/no-winner release, persisted claim expiry, and unclaimed release;
- top 100 plus rank 101 current player;
- username rename and historical snapshot;
- soft deletion/privacy suppression keeps ranking evidence while replacing the public handle with a stable anonymous alias;
- ordinary customer/tester/staff/unrelated-role direct SQL matrix for test isolation, score/correctness hiding, permit secrecy, and authoring immutability;
- version-1 client cannot discover or start a version-2 event, while supported legacy archive behavior remains intact.

- [ ] **Step 3: Run client accessibility and resilience QA**

On iOS and Android development clients verify:

- light/dark themes;
- small and large text;
- VoiceOver/TalkBack labels and timer announcement thresholds;
- product image load/failure;
- Today/Tonight/timezone boundaries;
- rules/readiness keyboard behavior;
- answer one-tap lock;
- background/resume;
- force-kill/relaunch before an answer, during a pending answer, and after the server committed an answer;
- scheduled-to-live and live-to-closed lobby transitions while the screen remains open;
- active-event cancellation while gameplay is foregrounded and backgrounded;
- offline/reconnect and same-answer retry;
- universal end while backgrounded;
- test watermark on every funnel screen;
- no ChatWidget/DrawerMenu obstruction;
- leaderboard archive and current-player row;
- dedicated result refresh through pending/finalizing/final, with no test claim;
- the equivalent web storefront timing, readiness, one-tap, pending-result, and leaderboard flow.

- [ ] **Step 4: Run a production-infrastructure test event**

Use an allowlisted test account in the installed app. Confirm ordinary customer accounts cannot discover the event. Query bounded production evidence proving no award, voucher, order, notification, or inventory hold was created.

- [ ] **Step 5: Record the QA receipt**

Include exact SHA, device/build identifiers, backend origin, event IDs, timestamps, passed/failed scenarios, known non-quiz console alerts, and links to sanitized evidence. Do not include secrets or personal data.

- [ ] **Step 6: Commit QA fixes and receipt**

```bash
git add docs/qa/quiz-live-production-qa-receipt.md packages/shared/src apps/web/src/app/api/quiz apps/web/src/app/api/merchant/quiz apps/web/src/app/dashboard/quiz apps/web/src/lib/quiz apps/web/src/schemas/quiz* apps/mobile-storefront/app/quiz apps/mobile-storefront/__tests__/app/quiz apps/mobile-storefront/components/quiz apps/mobile-storefront/services/quiz* apps/mobile-storefront/stores/quiz-store* supabase/migrations/tests
git commit -m "test(quiz): verify live timing and private mobile flow"
```

---

## Task 20: Complete Legal/Operations Gates and Run One Live Canary

**Files:**

- Update: `docs/legal/quiz-live-launch-approval-checklist.md`
- Create: `docs/ops/quiz-live-canary-receipt.md`
- Modify configuration only through the approved deployment/secret-management process after owner authorization; never commit environment files.

- [ ] **Step 1: Obtain written approvals**

Require completed counsel/operations decisions for rules/terms, eligibility, promotion registration/permit, prize condition, inventory, claim window, cancellation policy, privacy processing, public-handle suppression/account deletion, quiz attempt/device/acceptance/test-invite retention periods, and the one-winner ranking rule.

- [ ] **Step 2: Run the existing production approval checker**

In the approved production CI/VPS context:

```bash
pnpm --filter @baci/web check:quiz-approval
```

Expected: it passes only after `QUIZ_PHASE=production`, `QUIZ_PRODUCTION_APPROVED`, permit, compliance tracker, event settings, and RPC secrets are correctly configured. Do not bypass a failure.

- [ ] **Step 3: Deploy through the prebuilt flow**

Use the repository's approved VPS prebuilt deployment. Never run a Vercel cloud build. Record deployed SHA separately from merged SHA.

- [ ] **Step 4: Launch one bounded canary**

Use one low-risk product, reserve it atomically at launch, and use a short approved event window plus the counsel-approved claim window. Observe v2 discovery, starts, answers, universal end, direct-worker attempt finalization, final leaderboard, single award, hold-to-reserved-order transfer, persisted-expiry claim, and inventory fulfillment/release.

- [ ] **Step 5: Verify and close the canary receipt**

Record:

- exact deployed SHA;
- event start/end and server closure;
- participant/attempt counts without PII;
- top rank and award count;
- one and only one product entitlement;
- no awards before publication;
- inventory reservation, transfer, persisted claim expiry, and release/claim state;
- worker/route errors;
- mobile analytics funnel counts;
- support/complaint path readiness.

Do not expand live access until the receipt is complete and no critical/high issue remains.

- [ ] **Step 6: Commit only documentation, not secrets**

```bash
git add docs/legal/quiz-live-launch-approval-checklist.md docs/ops/quiz-live-canary-receipt.md
git commit -m "docs(quiz): record live canary approval and outcome"
```

---

## Final Definition of Done

- [ ] Current-main reconciliation is isolated and the dirty root is untouched.
- [ ] Disk-space preflight passes before worktree creation, dependency install, or build; no user data is deleted implicitly.
- [ ] The already-applied scheduled-promotion migration is tracked byte-for-byte.
- [ ] Every reconciled/new quiz migration is hash-bound in both current-main replay registries in the same commit, and chronological plus production-effect replay pass.
- [ ] All new migrations are append-only, RLS-protected, and deployed schema-first.
- [ ] The admin supports inventory search, variants, conditions, topic tags, 20 questions on one topic, 50 total, mode, variant count, and complete timing summary.
- [ ] Every generated variant is reviewed inside a bounded scroll container.
- [ ] A merchant can edit or regenerate a bad variant; launch accepts only per-variant receipts matching the complete canonical stored content and equivalent-difficulty checklist.
- [ ] Maximum-size generation uses an authorized leased job with bounded provider calls, checkpoint/restart recovery, a ten-minute attempt budget, and all-or-nothing draft persistence; the web route returns `202` without doing provider work.
- [ ] Quiz-generation rows are excluded from direct authenticated `ai_jobs` reads; owner/staff status is available only through the bounded safe-status RPC, and generic AI-job APIs cannot create or list them.
- [ ] Launch requires start/end and displays the five-minute recommendation for 20 × 10 seconds.
- [ ] Universal and per-question deadlines are server-authoritative.
- [ ] Immediate/scheduled activation is one database transaction; launch fields are immutable and direct authenticated authoring writes are revoked after cutover.
- [ ] Late entrants begin at question 1 and stop at the shared end.
- [ ] Reload/process death resumes the single existing active attempt with unchanged question deadlines and same-answer recovery; it never consumes another attempt.
- [ ] One-tap answer lock advances without a separate Submit button.
- [ ] Live scores, answers, ranks, winners, and claims remain hidden until finalization.
- [ ] Direct authenticated database reads cannot bypass test isolation, result hiding, permit secrecy, or safe projections.
- [ ] One live product prize is minted by final ranking, not by every perfect response.
- [ ] The live hold transfers to at most one ranked award/order, claim tokens use persisted expiry, and cancellation/no-winner/unclaimed paths release inventory idempotently.
- [ ] Test mode defaults safely, is private, watermarked, audit-resettable, closes/publishes under phase 1a, and is structurally unable to award.
- [ ] A never-opened scheduled event and a merchant-cancelled event both reach explicit non-awarding terminal states and release inventory exactly once.
- [ ] Mobile lobby matches the approved A+C direction and uses the actual product image.
- [ ] Rules are accessible from the lobby; username, DOB, and consent are unified at Start.
- [ ] Historical handles are immutable under ordinary rename and legacy rows cannot reveal real names.
- [ ] Soft deletion or approved privacy/moderation suppression aliases the public handle without deleting rank/award evidence.
- [ ] Top 100 plus “Your position” works.
- [ ] Web and mobile use contract version 2; old clients cannot discover/start v2 events, and the existing web storefront cannot bypass readiness/timing/result rules.
- [ ] A dedicated owner result endpoint handles pending/finalizing/final and never returns a test claim.
- [ ] Live device binding fails closed; test-only fail-soft behavior is visible and non-awarding.
- [ ] Quiz route overlays do not obstruct play.
- [ ] Metro port 8082 QA and production-hosted private test both pass.
- [ ] Kuda/VTU are neither required nor misreported as quiz dependencies.
- [ ] Full lint, typecheck, test, migration, asset, CodeRabbit, mobile QA, production test, legal, and canary gates are evidenced.
- [ ] Final handoff states separately whether work is committed, pushed, merged, deployed, and released.
