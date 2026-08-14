# Quiz Timing Modes and Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every quiz timer authoritative and unambiguous, always leave the playable screen at zero, and automatically show the player's final score, rank, and final leaderboard after the universal close.

**Architecture:** First merge a docs-only bootstrap PR so every clean execution worktree contains this plan. Then ship eight independently reviewable implementation PRs. PR A repairs the current contract-v2 web and mobile expiry paths; PR B dark-launches contract-v3 database/API support; PR C ships dormant authoring; PR D deploys dual-stack web/mobile clients; PR E adds resilient post-game results; PR F reduces finalization latency; PR G is a migration-only test-mode cutover; and PR H is a later migration-only live-mode cutover after a released mobile build is verified. Privileged timing, finalization, and cutover authority remain in PostgreSQL/server code.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase/PostgreSQL, Expo React Native, Zustand, Vitest, Jest/React Native Testing Library, Biome, pnpm/Turborepo, Bash/VPS cron.

## Global Constraints

- Baseline re-reviewed on 2026-08-09 against remote `main` SHA `dace33db7aa585f840cd306335d95ae291c204fe`; GitHub and the cached `origin/main` agreed at review time, and no planned runtime path changed between the prior `acbe0e9faeaed9aa8abb7c5c6049009ca9c5eb6c` baseline and this SHA. Fetch again at execution time because this recorded SHA is evidence, not a branch pin.
- Before execution, fetch `origin/main` again and create a clean isolated worktree with `superpowers:using-git-worktrees`; never implement in the dirty repository root.
- There are two independent dirty overlap sources: the repository root (`perf/ogabassey-hero-in-shell`) and the existing `codex/quiz-username-modal-redesign` worktree. At this review, each has 11 uncommitted exact plan-target overlaps; the username count includes this untracked plan as its canonical source. The root also has local-only duration/generation/activation helpers, while the username worktree owns overlapping mobile quiz UI, result-panel, rules, and v2-start-route changes. Before PR A, fetch `origin/main` and inventory each source in three separate buckets so branch divergence is never mislabelled as user work: (1) uncommitted tracked edits with `git -C <source> diff --name-status HEAD -- <scopes>` plus untracked files from `git -C <source> ls-files --others --exclude-standard` filtered to the same scopes; (2) source-branch commits with `source_base=$(git -C <source> merge-base HEAD origin/main)` followed by `git -C <source> diff --name-status "$source_base"..HEAD -- <scopes>`; and (3) incoming-main drift with `git -C <source> diff --name-status HEAD..origin/main -- <scopes>`. Here `<scopes>` is `apps/mobile-storefront apps/web/src/app/dashboard/quiz apps/web/src/app/api/merchant/quiz apps/web/src/app/api/quiz apps/web/src/components/storefront/ogabassey/pages apps/web/src/lib/quiz apps/web/src/scripts/process-quiz-finalization.ts apps/web/src/env.ts packages/shared supabase/migrations vps-workers docs/ops/vps-workers.md docs/superpowers/plans/2026-08-08-quiz-timing-modes-and-expiry.md`. Record a redacted overlap-disposition table for buckets 1 and 2 with one row per differing path and exactly one outcome: `already_on_main`, `superseded`, `port_reviewed_diff`, or `land_separately`; bucket 3 is baseline drift to re-review, not user-owned work. The plan path must have an explicit `port_reviewed_diff` canonical-source row. Record the source branch/SHA and source path for every port. Never copy an entire dirty branch, overwrite or discard user work, or independently recreate an overlap without disposition evidence.
- The migration filenames in this plan are candidate names verified collision-free on the recorded baseline, not permission to create an out-of-order migration later. Immediately before each migration PR, fetch `origin/main`, inventory top-level numeric migrations on main and every open quiz PR, and require every new timestamp to be unique and strictly greater than the greatest observed timestamp. If any candidate no longer satisfies that invariant, stop and merge a docs-only amendment that replaces the affected filename and every command/test reference before creating SQL. Never use `--include-all` or an equivalent force option to push an older migration version.
- Do not depend on ambient global CLIs. Rehearsed commands pin `SUPABASE_CLI_VERSION=2.95.4` and `EAS_CLI_VERSION=18.0.1` and invoke them through `pnpm dlx`; record `--version` output in Task 0. Upgrading either version requires a docs-only amendment and a fresh local replay/release-command rehearsal.
- PRs ship in order: bootstrap docs, A expiry repair, B v3 database/API dark launch, C dormant authoring, D dual-stack clients, E post-game results, F worker latency, G test-mode cutover, then H live-mode cutover only after the store build release gate passes. Each PR must be independently testable, deployable, and reversible without requiring an unpublished sibling PR.
- Existing contract-v2 events, timestamps, grace windows, RPCs, projections, and strict clients remain valid. Do not rewrite v2 rows to satisfy v3 timing rules.
- Contract v3 is additive. Header `X-Baci-Quiz-Contract: 2` continues to receive v2 behavior; header `3` receives v3 behavior; unsupported versions receive `426 QUIZ_APP_UPDATE_REQUIRED`.
- V3 cutover flags gate discoverability, activation, and new starts by event mode. Turning a flag off hides that mode from new entrants and rejects new starts, but must not strand an attempt that already started: resume, answer, expiry reconciliation, result publication, and final leaderboard access remain available under the stored contract version.
- The browser storefront and Expo storefront are equal player surfaces. A contract-3 test event cannot become discoverable until both clients can list, start, answer, expire, resume, and render it. A contract-3 live event additionally requires a verified released mobile build at or above the configured minimum version; Metro/dev-build acceptance never enables live mode.
- The signed live-eligible storefront build must come from an exact source SHA containing both PR D playback and PR E post-game recovery/leaderboard work. A build cut from PR D alone is never eligible, even if it reports the candidate semantic version.
- `appVersion` is client-reported and therefore only a compatibility/rollout gate. It is not signed-build attestation and must never be described as an anti-cheat or anti-tamper proof; existing device/integrity signals remain separate and advisory unless a later attestation project explicitly upgrades them.
- The database is authoritative for starts, deadlines, expiry, scoring, rank, publication, and prize settlement. Client timers only display server-derived time and trigger reconciliation.
- Per-question mode duration is exactly `questionCount * secondsPerQuestion`. Total mode duration is exactly `totalSeconds`. New v3 events have no separately editable end or grace window.
- Late entrants start at question 1 and receive only the universal time remaining. They are not advanced to a universal question index.
- Late entry must not create a speed tie-break advantage. V3 ranks by score first, then a normalized ranking duration: a fully answered attempt uses its server elapsed duration capped at the event duration; an attempt terminalized with unanswered questions receives the full event duration. Remaining deterministic ties use submission time and attempt id. V2 ranking remains unchanged.
- Tapping an answer locks and submits immediately. In per-question mode, an unanswered question timeout records an incorrect answer and advances unless the universal event has ended.
- Universal expiry wins any race with question expiry or an in-flight answer. The app must submit/reconcile at most once and must never remain playable at `0s`.
- Leaderboard rows remain hidden until `results_published_at` is set. The post-game leaderboard is final, not live; obtain one successful post-publication response with bounded retries rather than polling provisional standings.
- Never expose service-role credentials, finalizer RPCs, answer keys, provisional ranks, customer email/name, or raw answer details to the mobile client.
- Existing migrations are append-only. Generate/check database types from a clean disposable local replay; never hand-edit generated Supabase declarations.
- Every new or significantly changed runtime file gets a colocated test. Keep new hand-authored TypeScript, TSX, and JavaScript runtime files at or below 300 lines and one primary responsibility. For a pre-existing hand-authored file already above 300 lines, place all new behavior in a below-300-line tested extraction; the legacy file may receive composition-only wiring, must not gain inline feature logic, and must not increase in line count. Record before/after counts in the slice review. Generated `apps/web/src/types/supabase.ts` and append-only SQL migrations are exempt from the line ceiling; generated declarations must still be reproduced from the declared source, and SQL must remain responsibility-bounded and covered by migration tests.
- Use TDD: add the exact failing regression, run it and confirm failure, implement the smallest correct change, then rerun and confirm pass.
- After every PR, run focused tests plus `pnpm turbo lint`, `pnpm turbo typecheck`, and `pnpm turbo test`; run `coderabbit review --agent -t uncommitted` before committing.

---

## Execution Bootstrap

### Task 0: Publish the reviewed plan before implementation

**Files:**

- Create on a clean docs branch: `docs/superpowers/plans/2026-08-08-quiz-timing-modes-and-expiry.md`

**Interfaces:**

- Consumes the reviewed source at `/Users/mac/Baci-app/.worktrees/metro-current-main-20260808/docs/superpowers/plans/2026-08-08-quiz-timing-modes-and-expiry.md`.
- Produces the same byte-for-byte plan on `main`, so every later clean worktree can execute it without depending on an untracked file or dirty worktree.

- [ ] Create a clean docs-only worktree from freshly fetched `origin/main`, copy this exact plan into the same repository path, and verify byte identity with `cmp`.
- [ ] Inventory both dirty overlap sources using the Global Constraints commands. Preserve the disposition table in the PR execution log, verify every exact plan-target overlap has an owner, and block PR A until no row is unclassified.
- [ ] Revalidate migration ordering with `git ls-tree -r --name-only origin/main -- supabase/migrations` plus open-PR migration inventories. Confirm the four recorded candidate timestamps are unique and greater than the maximum, or amend this plan before implementation.
- [ ] Prove the pinned tool entrypoints are reproducible without ambient globals:

  ```bash
  SUPABASE_CLI_VERSION=2.95.4
  EAS_CLI_VERSION=18.0.1
  pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" --version
  pnpm dlx "eas-cli@${EAS_CLI_VERSION}" --version
  ```
- [ ] Stage only the copied plan with `git add -- docs/superpowers/plans/2026-08-08-quiz-timing-modes-and-expiry.md`, then run `git diff --cached --check` and confirm `git diff --cached --name-only` prints exactly that one path. Also require `git status --short` to contain no other staged or unstaged path before committing.
- [ ] Commit `docs(quiz): publish timing and expiry plan`, open a docs-only PR, pass required checks, and merge it before creating PR A's worktree.

## Agent Execution Protocol

- The orchestrator owns scope, overlap resolution, integration, and final critique. Use a fresh Terra implementation agent per PR; use separate fresh review agents for specification review and code-quality review at each passing task boundary.
- Every implementation task follows the same five checkpoints: write only that task's named red tests, run and record the intended failure, implement only that task's interfaces, rerun focused tests to green, then commit. Never commit a knowingly red cross-task test and never hand the next agent a branch whose focused suite fails.
- The numbered tasks are PR-level feature groups. Any group over 15 named paths must execute as the disjoint slices below. One fresh implementation agent owns one slice, writes/runs that slice's tests, receives specification and quality review, and creates its own passing commit before the next slice begins. The orchestrator may not hand all files in an oversized group to one agent or collapse slice evidence into a single aggregate commit.

  | Feature group | Required execution slices (disjoint path ownership) | Maximum paths |
  | --- | --- | ---: |
  | 3 | 3A mobile v2 expiry: the first nine mobile-storefront paths; 3B web v2 expiry: the remaining ten web paths | 10 |
  | 4 | 4A shared v3 timing contracts: all 13 `packages/shared` paths; 4B web authoring schemas: the four `apps/web/src/schemas` paths | 13 |
  | 6 | 6A negotiation/list/start: shared contract/projection, events, and start-route paths; 6B active/answer/result/leaderboard: the remaining attempt and leaderboard paths | 12 |
  | 7 | 7A timing/schedule/launch presentation: authoring form through launch-dialog paths; 7B admin orchestration: admin-actions, admin-client, page, and response-schema paths; 7C merchant generation/activation adapter: merchant API and launch-v3 paths | 12 |
  | 9 | 9A v3 request/schema/core service; 9B attempt/result/leaderboard/recovery services; 9C store orchestration; 9D start/lobby/rules UI; 9E live playback/timers | 12 |
  | 11 | 11A mobile results/leaderboard/version metadata; 11B web results/leaderboard | 9 |
  | 13 | 13A worker loop/alert/env; 13B VPS wrapper/service/deploy/promotion; 13C secure production provisioning and acceptance | 12 |

- Before an oversized feature group starts, copy its existing **Files** list into the execution log and label every path with exactly one slice above. Fail the preflight on an unlabelled or multiply-owned path. Each slice uses a commit subject suffixed with its slice, for example `fix(quiz): complete v2 timer transitions (3A)`; the feature-group subject in the table below describes the resulting series, not a license to squash it.
- PR A is a vertical-slice exception to the old numbering: Task 1 is an uncommitted red-test checkpoint, Tasks 2 and 3 own the implementations that make their respective tests green, and commits are created only at the passing Task 2 and Task 3 boundaries. The PR A agent must keep all Task 1 test edits local until the owning implementation is green.
- Preserve task commits during review. The exact commit subjects are:

  | Task | Commit subject |
  | --- | --- |
  | 0 | `docs(quiz): publish timing and expiry plan` |
  | 2 | `refactor(quiz): isolate terminal expiry actions` |
  | 3 | `fix(quiz): complete v2 timer transitions` |
  | 4 | `feat(quiz): define contract v3 timing types` |
  | 5 | `feat(quiz): add contract v3 database runtime` |
  | 6 | `feat(quiz): add contract v3 API negotiation` |
  | 7 | `feat(quiz): prepare dormant v3 authoring` |
  | 8 | `feat(quiz): add dual-stack web quiz client` |
  | 9 | `feat(quiz): add dual-stack mobile quiz client` |
  | 10 | `feat(quiz): persist post-game recovery context` |
  | 11 | `feat(quiz): show final standings automatically` |
  | 12 | `feat(quiz): add finalization wake-state probe` |
  | 13 | `perf(quiz): run adaptive finalization worker` |
  | 14 | `feat(quiz): enable contract v3 test events` |
  | 15 | `feat(quiz): enable contract v3 live events` |

- A PR-ending task opens the PR after its own passing commit; it does not create a second aggregate commit or squash earlier task evidence.

## PR A — Current v2 Timer Expiry Repair

### Task 1: Capture the question-zero and event-zero failures without committing red state

**Files:**

- Modify: `apps/mobile-storefront/components/quiz/QuizLiveQuestionCard.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-question-timer.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store-v2-retry.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-countdown.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.test.tsx`

**Interfaces:**

- Consumes: current `useQuizQuestionTimer`, `useQuizEventTimer`, `QuizLiveQuestionCard`, and `createQuizV2StoreActions` behavior from contract v2.
- Produces: local failing evidence on both player surfaces for one timeout submission, server-clock/event-end capping, universal-expiry reconciliation, and submit-versus-expiry arbitration. Each test remains uncommitted until Task 2 or Task 3 makes its owning slice pass.

- [ ] Write `unanswered_timeout_submits_once`: render an unanswered v2 question, advance past `deadlineAt`, and expect `onAnswer('__timeout_no_answer__')` exactly once.
- [ ] Write `event_end_caps_question_timer_with_server_offset`: set `eventEndsAt` earlier than `deadlineAt` with a non-zero `serverClockOffsetMs` and expect expiry at the server-adjusted event end. It must fail while `QuizLiveQuestionCard` omits those inputs.
- [ ] Write `universal_end_requests_recovery`: cross the universal end and expect one authenticated active-attempt recovery request instead of the current no-op.
- [ ] Write `expiry_epoch_ignores_stale_submit`: begin `lockAndSubmitAnswer`, trigger universal expiry before resolution, return an obsolete in-progress response, and assert the store remains terminal.
- [ ] On web v2, write `event_end_caps_question_countdown`, `web_universal_end_requests_active_recovery`, `web_expiry_wins_over_in_flight_answer`, and `web_foreground_after_end_reconciles`. They must fail while `QuizQuestionPanel` uses only `question.deadlineAt` and `quiz.tsx` has no event-expiry recovery/arbitration path.
- [ ] Run the red tests:

  ```bash
  pnpm --filter @baci/mobile-storefront test -- --runInBand \
    components/quiz/QuizLiveQuestionCard.test.tsx \
    components/quiz/QuizScreen.test.tsx \
    components/quiz/use-quiz-question-timer.test.ts \
    stores/quiz-store-v2-retry.test.ts
  pnpm --filter @baci/web exec vitest run \
    src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx \
    src/components/storefront/ogabassey/pages/use-quiz-countdown.test.ts \
    src/components/storefront/ogabassey/pages/quiz.test.tsx
  ```

- [ ] Confirm failures occur at the intended boundaries: omitted event/clock inputs, no-op event callback, and stale answer response reopening state. Record the failing test names in the task log, do not commit, and proceed immediately to the owning Task 2 or Task 3 implementation.

### Task 2: Add a dedicated terminal expiry transition

**Files:**

- Modify: `apps/mobile-storefront/stores/quiz-recovery-envelope.ts`
- Create: `apps/mobile-storefront/stores/quiz-v2-store-actions.ts`
- Create: `apps/mobile-storefront/stores/quiz-v2-store-actions.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store-v2-retry.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempt-recovery.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempt-recovery.test.ts`

**Interfaces:**

- Consumes: `recoverActiveQuizAttempt(input): Promise<QuizActiveAttemptResponse>`.
- Produces:

  ```ts
  type QuizTerminalContext = {
    attemptId: string;
    eventId: string;
    contractVersion: 2 | 3;
  };

  expireActiveEvent(
    reconciler: () => Promise<QuizActiveAttemptResponse>
  ): Promise<void>;

  retryLockedAnswer(
    submitter: (optionId: string) => Promise<QuizV2Attempt>
  ): Promise<void>;
  ```

- [ ] Move `createQuizV2StoreActions` out of the already-300-line `quiz-recovery-envelope.ts` into `quiz-v2-store-actions.ts`; leave the recovery module responsible only for storage, schemas, and shared state/action contracts. Update `quiz-store.ts` to import the factory from the new module and keep both files below 300 lines.
- [ ] Extend `QuizV2StoreState` with `terminalContext: QuizTerminalContext | null`, initialized to `null` and populated with `contractVersion: 2` whenever a v2 attempt leaves `in_progress`. Task 9 reuses the same type for v3.
- [ ] Add an internal lifecycle epoch to the extracted `createQuizV2StoreActions`. `lockAndSubmitAnswer` captures it; `expireActiveEvent` increments it before reconciliation; a response from an older epoch is ignored.
- [ ] Implement `expireActiveEvent` separately from `reconcileLifecycle`. It must run from `question` or `submitting`, even when an answer is locked, bypass the 15-second background-reconciliation throttle, and use its own in-flight guard.
- [ ] Apply reconciliation outcomes exactly: `active` restores the authoritative question only when the event is genuinely still open; `pending_results` stores terminal context and enters `result/pending_results`; `cancelled` enters `result/event_cancelled`.
- [ ] Preserve the persisted locked answer on network failure and expose `retryLockedAnswer`; do not clear it or silently leave the player at zero.
- [ ] Write tests named `expiry_applies_active_response`, `expiry_enters_pending_results`, `expiry_enters_cancelled`, `expiry_deduplicates_concurrent_calls`, `expiry_preserves_locked_answer_on_network_error`, `expiry_ignores_stale_submit_response`, and `retry_locked_answer_resubmits_once`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/mobile-storefront test -- --runInBand \
    stores/quiz-v2-store-actions.test.ts \
    stores/quiz-store-v2-retry.test.ts \
    services/quiz-attempt-recovery.test.ts
  ```

- [ ] Confirm all Task 2-owned regressions are green before committing `refactor(quiz): isolate terminal expiry actions`; no Task 3-only red test may be staged in this commit.

### Task 3: Wire expiry and visible progress into the current question screen

**Files:**

- Modify: `apps/mobile-storefront/components/quiz/QuizLiveQuestionCard.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizLiveQuestionCard.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.styles.ts`
- Modify: `apps/mobile-storefront/components/quiz/quiz-answer-handlers.ts`
- Modify: `apps/mobile-storefront/components/quiz/quiz-answer-handlers.test.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-expiry-reconciliation.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-expiry-reconciliation.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-countdown.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-countdown.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-v2-playback.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-v2-playback.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.test.tsx`

**Interfaces:**

- Consumes: `expireActiveEvent`, `retryLockedAnswer`, `recoverActiveQuizAttempt`, `attempt.eventEndsAt`, and `calculateQuizServerClockOffset`.
- Produces `useQuizExpiryReconciliation`, which owns authenticated recovery input construction, the universal-expiry callback, in-flight/error state, and retry wiring so the already-272-line `QuizScreen.tsx` remains below 300 lines, plus:

  ```ts
  type QuizExpiryReconciliationState = {
    expire(): Promise<void>;
    retry(): Promise<void>;
    status: 'idle' | 'saving' | 'error';
  };

  useQuizExpiryReconciliation(input: {
    attempt: QuizV2Attempt;
    baseUrl: string;
    expectedUserId: string;
    deviceFingerprint: string | null;
    expireActiveEvent(
      reconciler: () => Promise<QuizActiveAttemptResponse>
    ): Promise<void>;
  }): QuizExpiryReconciliationState;

  interface QuizLiveQuestionCardProps {
    attempt: QuizV2Attempt;
    isSubmitting: boolean;
    lockedOptionId: string | null;
    onAnswer(optionId: string): void;
    onEventExpire(): void;
    onRetryLockedAnswer(): void;
    styles: QuizStyles;
  }

  recoverQuizV2Attempt(eventId: string): Promise<QuizV2ActiveAttemptResponse>;

  useQuizV2Playback(input: {
    attempt: QuizAttemptResponse;
    currentUserId: string;
    submitAnswer(answer: string): Promise<QuizResultResponse>;
    recoverAttempt(): Promise<QuizV2ActiveAttemptResponse>;
    onAttempt(attempt: QuizAttemptResponse): void;
    onTerminal(result: QuizResultResponse | 'pending_results' | 'cancelled'): void;
    onError(error: unknown): void;
  }): {
    selectedAnswer: string | null;
    phase: 'question' | 'submitting' | 'expiring' | 'error';
    select(optionId: string): void;
    submit(): Promise<void>;
    autoSubmit(): Promise<void>;
    expire(): Promise<void>;
    retry(): Promise<void>;
  };
  ```

- [ ] Pass `attempt.eventEndsAt` and the calculated server offset to `useQuizQuestionTimer`.
- [ ] Replace the event timer's `onExpire: () => undefined` with `onEventExpire`; keep the event timer active during both `question` and `submitting` states.
- [ ] Implement `useQuizExpiryReconciliation` to build the reconciler from the current authenticated user, event id, integrity/device context, and `recoverActiveQuizAttempt`, then expose the callback that invokes `expireActiveEvent` at universal zero. Keep lifecycle orchestration out of `QuizScreen.tsx` and verify the screen remains below 300 lines.
- [ ] Give universal expiry precedence: once `onEventExpire` starts, question expiry must not enqueue a second timeout answer; the store epoch remains the final duplicate/stale-response guard.
- [ ] While timeout submission or expiry reconciliation is running, disable every answer and show `Time's up — saving your answer…`. On failure show `We couldn't save the timeout yet.` plus an accessible `Retry` button wired to `retryLockedAnswer`.
- [ ] Write tests named `question_timeout_advances_once`, `final_question_timeout_enters_pending`, `event_expiry_wins_during_submit`, `foreground_after_end_reconciles`, `locked_timeout_retry_succeeds`, `locked_timeout_retry_remains_visible_on_failure`, and `expiry_sends_one_request`.
- [ ] Add `recoverQuizV2Attempt` to `quiz-page-data.ts` using the authenticated `/api/quiz/attempts/active?eventId=...` route and strict `quizV2ActiveAttemptResponseSchema`; invalid responses never change UI state.
- [ ] Extract the web v2 question lifecycle from `quiz.tsx` into `useQuizV2Playback`. The hook owns selected-answer state, submit/expiry in-flight guards, and a lifecycle epoch. Universal expiry increments the epoch before recovery, so a late answer response cannot restore a playable question; apply `active`, `pending_results`, `cancelled`, `none`, and `unavailable` explicitly. Preserve a failed locked/forfeit answer for accessible retry, and reject responses after the authenticated user changes.
- [ ] Extend web `useQuizCountdown` with `eventEndsAt`, `serverClockOffsetMs`, and a separate `onEventExpire`. Cap the displayed deadline at the earlier server-adjusted event end; when boundaries coincide, universal expiry wins and no answer/forfeit request is enqueued. Pass `attempt.serverNow`/`eventEndsAt` through `QuizQuestionPanel`, and on `visibilitychange` back to visible run active recovery before enabling answers.
- [ ] Add web regressions named `event_end_caps_question_countdown`, `event_expiry_beats_question_expiry`, `web_universal_end_requests_active_recovery`, `web_expiry_wins_over_in_flight_answer`, `web_foreground_after_end_reconciles`, `web_foreground_recovery_failure_keeps_answers_disabled`, `web_invalid_active_response_preserves_terminal_state`, and `web_locked_timeout_retry_remains_available`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/mobile-storefront test -- --runInBand \
    components/quiz/QuizLiveQuestionCard.test.tsx \
    components/quiz/QuizScreen.test.tsx \
    components/quiz/quiz-answer-handlers.test.ts \
    components/quiz/use-quiz-expiry-reconciliation.test.ts
  pnpm --filter @baci/web exec vitest run \
    src/components/storefront/ogabassey/pages/quiz-page-data.test.ts \
    src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx \
    src/components/storefront/ogabassey/pages/use-quiz-countdown.test.ts \
    src/components/storefront/ogabassey/pages/use-quiz-v2-playback.test.ts \
    src/components/storefront/ogabassey/pages/quiz.test.tsx
  ```

- [ ] Confirm every remaining Task 1/Task 3 regression is green before committing `fix(quiz): complete v2 timer transitions`.

- [ ] After the two passing Task 2–3 commits exist and repository gates pass, open PR A without squashing them:

  ```bash
  git log --oneline origin/main..HEAD
  ```

## PR B — Contract-v3 Database and API Dark Launch

### Task 4: Define v3 timing types without changing v2

**Files:**

- Modify: `packages/shared/src/constants/quiz.ts`
- Modify: `packages/shared/src/constants/quiz.test.ts`
- Create: `packages/shared/src/schemas/quiz-answer-timing.ts`
- Create: `packages/shared/src/schemas/quiz-answer-timing.test.ts`
- Create: `packages/shared/src/schemas/quiz-contract-v3.ts`
- Create: `packages/shared/src/schemas/quiz-contract-v3.test.ts`
- Create: `packages/shared/src/constants/quiz-v3-rules.ts`
- Create: `packages/shared/src/constants/quiz-v3-rules.test.ts`
- Create: `packages/shared/src/utils/quiz-server-clock-anchor.ts`
- Create: `packages/shared/src/utils/quiz-server-clock-anchor.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Modify: `apps/web/src/schemas/quiz-schema-authoring.ts`
- Modify: `apps/web/src/schemas/quiz-schema-authoring.test.ts`
- Modify: `apps/web/src/schemas/quiz-schema-launch.ts`
- Modify: `apps/web/src/schemas/quiz-schema-launch.test.ts`

**Interfaces:**

- Consumes: unchanged `quizV2EventSchema`, `quizV2AttemptResponseSchema`, and contract version `2` exports.
- Produces:

  ```ts
  export const QUIZ_V2_CONTRACT_VERSION = 2 as const;
  export const QUIZ_V3_CONTRACT_VERSION = 3 as const;
  /** Compatibility alias for existing v2 imports; do not retarget it to 3. */
  export const QUIZ_CONTRACT_VERSION = QUIZ_V2_CONTRACT_VERSION;
  export const QUIZ_LATEST_CONTRACT_VERSION = 3 as const;
  export const QUIZ_SUPPORTED_CONTRACT_VERSIONS = [2, 3] as const;
  export const QUIZ_MIN_TOTAL_TIME_SECONDS = 10;
  export const QUIZ_MAX_TOTAL_TIME_SECONDS = 3600;
  export const QUIZ_V3_TEST_RULES_VERSION = 'test-v3';
  export const QUIZ_V3_LIVE_RULES_VERSION = 'live-v3';

  export type QuizAnswerTiming =
    | { kind: 'per_question'; secondsPerQuestion: number }
    | { kind: 'total'; totalSeconds: number };

  export function getQuizDurationSeconds(
    questionCount: number,
    answerTiming: QuizAnswerTiming
  ): number;

  export function getQuizV3RuleLines(input: {
    answerTiming: QuizAnswerTiming;
    durationSeconds: number;
    maxAttempts: number;
    mode: 'test' | 'live';
  }): readonly string[];

  export type QuizServerClockAnchor = {
    observedMonotonicMs: number;
    serverNowMs: number;
  };

  export type QuizObservedResponse<T> = {
    data: T;
    requestStartedMonotonicMs: number;
    responseObservedMonotonicMs: number;
  };

  export function createQuizServerClockAnchor(
    serverNow: string,
    requestStartedMonotonicMs: number,
    responseObservedMonotonicMs: number
  ): QuizServerClockAnchor;

  export function getAnchoredServerNowMs(
    anchor: QuizServerClockAnchor,
    currentMonotonicMs: number
  ): number;

  export type QuizV3FinalResult = {
    availability: 'final';
    attemptId: string;
    rankingAttemptId: string;
    attemptScore: number;
    bestScore: number;
    isBestAttempt: boolean;
    rank: number;
    totalQuestions: number;
    availableAt: string;
    claim?: { expiresAt: string; token: string };
  };

  export type QuizV3Result =
    | QuizV3FinalResult
    | {
        availability: 'pending';
        attemptId: string;
        availableAt: string | null;
      }
    | {
        availability: 'unavailable';
        attemptId: string;
        reason?: 'event_cancelled' | 'not_found' | 'tester_revoked';
      };
  ```

- [ ] Keep every v2 schema and validation rule byte-compatible in behavior, including its existing grace-window allowance.
- [ ] Add the v3 answer-timing discriminated union with per-question bounds 5–60 seconds and total bounds 10–3600 seconds.
- [ ] Add v3 event fields `contractVersion: 3`, `answerTiming`, and `durationSeconds`; require `endsAt - startsAt === durationSeconds`.
- [ ] Add v3 launch-policy rules versions `test-v3` and `live-v3` without changing existing `test-v1`/`live-v1`. The v3 rules copy must disclose: free entry, selected timing mode, universal close, late entrants starting at question 1 with reduced remaining time, immediate answer locking, unanswered per-question timeout behavior, no timer pause while backgrounded, score-first normalized-duration ranking, full-duration penalty for incomplete attempts, deterministic remaining tie-breaks, and final-only leaderboard publication.
- [ ] Implement that disclosure once in `getQuizV3RuleLines`; web and mobile render the returned lines rather than maintaining divergent prose. Include mode-accurate attempt/prize text: test mode may allow its configured attempts and awards no prize, while live mode uses one eligible attempt and the displayed prize.
- [ ] Implement the server-clock anchor with a validated offset-aware `serverNow` and finite monotonic request/response observations. Require `responseObservedMonotonicMs >= requestStartedMonotonicMs`, set the anchor observation to their midpoint, and treat `serverNow` as observed at that midpoint; at response receipt the estimated server time has therefore advanced by half the measured round trip instead of granting the whole response-transit delay. `getAnchoredServerNowMs` returns `serverNowMs + (currentMonotonicMs - observedMonotonicMs)` and rejects non-finite or backwards inputs. After an anchor is created, countdown code must not consult the mutable wall clock again. API responses and foreground/visibility reconciliation replace the anchor with a fresh one. The estimate changes display/reconciliation timing only; server `clock_timestamp()` still accepts or rejects every answer.
- [ ] Add v3 attempt field `answerTiming`. Every v3 event-list, start, resume, answer, active-attempt, and expiry-recovery success projection carries one required offset-aware `serverNow`; every playable attempt carries `eventEndsAt`. In per-question mode, `question.timeLimitSeconds` is 5–60; in total mode it is `null`, while `question.deadlineAt` equals the universal event end. Strict schemas reject a playable response without either authoritative timestamp.
- [ ] Define v3 final results for multiple-attempt test quizzes explicitly. `attemptId` is the owned attempt used to request/recover the result; `rankingAttemptId` is that customer's best eligible attempt selected by v3 ranking; `attemptScore` belongs to the requested attempt; `bestScore` and `rank` belong to `rankingAttemptId`; `isBestAttempt` is exact id equality. For one-attempt live quizzes both ids and both scores are equal. Pending/unavailable states expose none of these score/rank fields.
- [ ] Define launch input as `launchRequestId` plus `answerTiming` and `timing: { kind: 'immediate' } | { kind: 'scheduled'; startsAt: string }`. There is no client-supplied end. Require a UUID `launchRequestId`; the dashboard creates it once when confirmation opens and retains it across uncertain transport retries.
- [ ] Change authoring input to carry `answerTiming`; do not send a fake `timeLimitSeconds` for total mode.
- [ ] Write tests named `derives_200_seconds_for_20_by_10`, `accepts_30_second_total_mode`, `rejects_hybrid_timing_payload`, `rejects_end_not_equal_to_duration`, `keeps_v1_rules_constants_unchanged`, `renders_complete_per_question_v3_rules`, `renders_complete_total_timer_v3_rules`, `uses_mode_accurate_attempt_and_prize_copy`, `anchors_server_time_to_monotonic_elapsed`, `midpoint_compensates_half_round_trip`, `rejects_backwards_request_observation`, `rejects_backwards_monotonic_time`, `wall_clock_change_does_not_change_anchor`, `rejects_playable_v3_response_without_server_now`, `parses_best_attempt_v3_result`, `rejects_pending_v3_result_with_score`, and `parses_every_existing_v2_fixture_unchanged`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/shared exec vitest run \
    src/constants/quiz.test.ts \
    src/constants/quiz-v3-rules.test.ts \
    src/utils/quiz-server-clock-anchor.test.ts \
    src/schemas/quiz-answer-timing.test.ts \
    src/schemas/quiz-contract.test.ts \
    src/schemas/quiz-contract-v3.test.ts
  pnpm --filter @baci/web exec vitest run \
    src/schemas/quiz-schema-authoring.test.ts \
    src/schemas/quiz-schema-launch.test.ts
  ```

### Task 5: Add an isolated v3 database runtime

**Files:**

- Create: `supabase/migrations/20260808170000_quiz_timing_contract_v3.sql`
- Create: `supabase/migrations/tests/quiz_timing_contract_v3.sql`
- Create: `apps/web/src/lib/quiz-timing-contract-v3-migration.test.ts`
- Modify generated output: `apps/web/src/types/supabase.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

**Interfaces:**

- Consumes: existing v2 tables and private ranking/prize helpers.
- Produces these new database functions while preserving all v2 signatures:

  ```text
  public.quiz_runtime_contract_versions() -> jsonb [2,3]
  public.quiz_v3_cutover_state() -> jsonb {
    "testEnabled": false,
    "liveEnabled": false,
    "minimumLiveMobileVersion": null
  }
  public.activate_quiz_event_v3(
    p_event_id uuid,
    p_launch_request_id uuid,
    p_launch_timing_kind text,
    p_mode text,
    p_starts_at timestamptz,
    p_rules_version text,
    p_question_count integer,
    p_answer_timing_kind text,
    p_time_per_question_seconds integer,
    p_duration_seconds integer,
    p_time_zone text,
    p_max_attempts integer,
    p_regulatory_basis text,
    p_regulatory_jurisdiction text,
    p_regulatory_evidence_ref text
  ) -> jsonb
  public.list_quiz_events_v3(uuid, integer, integer)
  public.start_quiz_attempt_v3(
    uuid, text, text, boolean, uuid, text, text, jsonb, uuid
  )
  public.start_quiz_attempt_with_device_v3(
    uuid, text, text, jsonb, jsonb, text, boolean, uuid, text, text, uuid
  )
  public.resume_quiz_attempt_v3(uuid, text)
  public.submit_quiz_answer_v3(uuid, uuid, text, jsonb, uuid, timestamptz)
  public.get_quiz_attempt_result_v3(uuid)
  public.get_quiz_leaderboard_public_v3(uuid)
  private.quiz_attempt_state_v3(uuid, timestamptz)
  private.quiz_ranked_candidates_v3(uuid)
  private.terminalize_quiz_event_attempts_v3(uuid, timestamptz)
  private.quiz_semver_at_least_v3(text, text) -> boolean
  private.start_quiz_attempt_v3_core(
    uuid, text, text, boolean, uuid, text, text, jsonb, uuid, boolean
  )
  public.promote_due_scheduled_quiz_events_service_v3()
  public.finalize_due_test_quiz_events_v3()
  public.terminalize_due_live_quiz_events_v3()
  public.finalize_due_live_quiz_events_v3(boolean, boolean)
  ```

- [ ] Expand `quiz_events_contract_version_check` to allow `3`; do not alter existing v2 rows or timestamps.
- [ ] Create `quiz_v3_cutover_state()` with the exact strict JSON shape shown above. Its non-sensitive state may be executable by authenticated callers, but it grants no mutation authority. Apply one shared mode-gate rule in `list_quiz_events_v3`, `activate_quiz_event_v3`, both v3 start entrypoints, and the private start core: a disabled test/live flag hides matching events from lists and rejects activation/new start with `QZ049`. Do not apply the flag to resume, submit, attempt-state, result, leaderboard, terminalization, or finalization paths, because rollback must not strand already-started attempts.
- [ ] Add nullable `answer_timing_kind`. Drop `time_per_question_seconds` NOT NULL only so v3 total rows can store `NULL`; replace `quiz_events_v2_runtime_check` with separate branches: the original v2 invariant unchanged, and a v3 invariant requiring exact duration and mode-consistent timing columns.
- [ ] Preserve the existing draft lifecycle: an unlaunched v3-intended draft remains `contract_version = 1` and stores `settings.target_quiz_contract_version = 3` plus its validated answer-timing configuration. Only `activate_quiz_event_v3` may atomically change it to contract 3 while setting every required runtime field. Contract-3 rows are never allowed to remain in `draft` status with partial/null runtime timing.
- [ ] Replace the existing `quiz_attempt_questions_time_limit_ms_check` and `quiz_attempt_answers_answered_in_ms_check` bounds with `0..3600000`-compatible checks (`time_limit_ms` remains strictly positive when non-null). Existing v2 RPCs must continue clamping/writing at most `60000`; only v3 total mode may store a larger value. Assert both constraint definitions through `pg_get_constraintdef` in the SQL regression.
- [ ] In v3 per-question rows set `maximum_play_seconds = live_window_seconds = question_count * time_per_question_seconds`. In v3 total rows set `time_per_question_seconds = NULL` and `maximum_play_seconds = live_window_seconds = total seconds`.
- [ ] Implement `activate_quiz_event_v3` as the only v3 draft-to-scheduled/active transition. Lock the owned contract-1 draft, require `settings.target_quiz_contract_version = 3` and settings timing equal to the reviewed activation input, read `quiz_v3_cutover_state()`, and reject disabled test/live modes with `QZ049` before changing data. Verify reviewed answers and exact slot count and require `test-v3` for test mode or `live-v3` for live mode. Require `p_starts_at IS NULL` for `immediate`, otherwise require the scheduled timestamp to be future; set `v_starts_at = clock_timestamp()` only for the first immediate transition, then derive `ends_at = v_starts_at + make_interval(secs => p_duration_seconds)`. Atomically set contract 3 and every runtime field. Persist `launchRequestId` and a canonical activation-input fingerprint in settings. The fingerprint includes a scheduled start, but for immediate launch excludes only the server-generated start timestamp while retaining timing kind, duration, mode, rules, answer timing, attempt cap, and regulatory inputs. Enforce attempt caps and return the event projection. Test mode requires all regulatory arguments to be `NULL`; live mode requires valid regulatory arguments and the existing reserved-prize readiness checks. A replay with the same request id and fingerprint returns the original projection without recalculating immediate time; a different request id or changed fingerprint fails with `QZ046`.
- [ ] Order activation checks so a locked already-activated contract-3 row compares request id/fingerprint and returns its projection before draft-only cutover, future-schedule, prize-reservation, or regulatory validation. This keeps a successful scheduled launch replayable after its start time and keeps an immediate launch replayable after a cutover rollback. Only a first transition from contract-1 draft evaluates those mutable gates.
- [ ] Implement v3 state/start/resume/submit functions. Per-question deadlines are `LEAST(issued_at + secondsPerQuestion, ends_at)`; total-mode question deadlines are `ends_at`. All scoring uses `clock_timestamp()`, first-write locking, and the universal end.
- [ ] Implement `private.quiz_semver_at_least_v3` for strict `major.minor.patch` numeric comparison; malformed values return false. In `start_quiz_attempt_v3` and its device wrapper, require this comparison against `minimumLiveMobileVersion` only when the event is live and platform is `ios` or `android`; web is not compared to a mobile version. The database returns stable code `QZ050` for stale/malformed mobile builds; HTTP mapping belongs to Task 6. While the minimum is null, live-v3 activation remains disabled.
- [ ] Preserve late-entry semantics: every entrant starts logical question 1, but no issued deadline exceeds `ends_at`.
- [ ] Remove the 60-second `answered_in_ms` truncation only inside v3 total timing; cap at `LEAST(p_duration_seconds * 1000, 3600000)`. Keep v2 ranking behavior and its 60000 clamp unchanged.
- [ ] Implement `private.quiz_ranked_candidates_v3` instead of reusing the v2 helper. Rank each customer's best eligible attempt by score descending, then normalized ranking duration ascending. A row with answers for every attempt question uses `LEAST(submitted_at - started_at, event.maximum_play_seconds)`; a row terminalized with any unanswered question uses exactly `event.maximum_play_seconds`. Break remaining ties by `submitted_at`, then attempt id. Return this normalized value as `total_time_seconds` in v3 result/leaderboard projections.
- [ ] In `get_quiz_attempt_result_v3`, first resolve the requested attempt through the authenticated non-deleted customer, then resolve that customer's row from `private.quiz_ranked_candidates_v3(event_id)`. Return the requested attempt's score as `attemptScore` and the ranking row's attempt id/score/rank as `rankingAttemptId`, `bestScore`, and `rank`; never return `unavailable` merely because the requested test attempt was not the customer's best. A live winner claim is resolved from the ranking attempt's award after proving the requested attempt belongs to the same customer. No caller-selected customer/ranking id enters the function.
- [ ] Implement v3 list/result/leaderboard projections with the same identity, tester, regulatory, privacy, and publication gates as v2. Preserve the current two-part test-event rule precisely: the caller must have a non-deleted customer row for that merchant, and must additionally be either the merchant owner/active staff through `has_merchant_access(event.merchant_id)` or an unrevoked event tester. Merchant access bypasses only the tester invitation, never customer/readiness checks; a platform-admin flag by itself grants no cross-merchant player access. The list applies the current mode cutover flag before returning an event; result and leaderboard do not. Result resolves only an attempt owned by the authenticated customer's user id, and leaderboard resolves only the requested event after the same customer/test visibility checks. Before publication leaderboard v3 returns `live_hidden` with empty rows.
- [ ] Leave every existing v2 promotion, terminalization, ranking, and finalization function behavior unchanged. Add v3-specific service-role functions listed above; they select only `contract_version = 3`, call the v3 terminalization/ranking helpers, and preserve the same prize reservation, regulatory approval, idempotency, lock ordering, and publication gates. Task 12 adds these v3 functions to the worker sequence before cutover.
- [ ] Revoke PUBLIC/anon access to every new state-changing v3 function; grant only the same least-privilege roles as the corresponding v2 function. Keep private cores inaccessible to authenticated users.
- [ ] Write SQL assertions named by comments `v2_rows_unchanged`, `v2_ranking_definition_unchanged`, `v3_intended_draft_remains_contract_one`, `v3_rejects_missing_target_contract_marker`, `v3_activation_sets_contract_and_runtime_atomically`, `v3_rejects_v1_rules_version`, `v3_requires_mode_specific_rules_version`, `v3_immediate_launch`, `v3_scheduled_launch`, `v3_per_question_mode`, `v3_total_mode`, `v3_late_entry_question_one`, `v3_incomplete_late_entry_gets_full_duration_penalty`, `v3_complete_late_entry_uses_actual_duration`, `v3_timeout_advance`, `v3_universal_expiry`, `v3_duplicate_answer_first_write_wins`, `v3_cutover_off_hides_events`, `v3_cutover_off_blocks_new_start`, `v3_cutover_off_allows_existing_resume_submit`, `v3_result_publication`, `v3_non_best_attempt_returns_best_rank`, `v3_live_result_ids_and_scores_match`, `v3_live_claim_uses_ranking_attempt`, `v3_leaderboard_hidden_before_publication`, `v3_semver_numeric_comparison`, `v3_semver_rejects_malformed`, `v3_merchant_customer_dual_role_can_test`, `v3_invited_customer_tester_can_test`, `v3_merchant_without_customer_cannot_play`, `v3_platform_admin_without_merchant_access_cannot_play`, `v3_revoked_tester_cannot_play`, `v3_result_attempt_owner_only`, `v3_cross_merchant_leaderboard_denied`, `v3_cross_user_denied`, and `v3_exact_function_grants`.
- [ ] Add activation replay assertions named `v3_immediate_retry_same_request_returns_original_window`, `v3_scheduled_retry_same_request_returns_original_window`, `v3_changed_activation_fingerprint_fails`, and `v3_different_launch_request_id_fails`.
- [ ] Run the SQL regression inside a transaction. Assert false/false/null first, then replace only the cutover-state function inside that transaction with true/true and a concrete minimum version to exercise activation/start/runtime cases; restore/rollback at the end and reassert the migration's installed false/false/null definition from a fresh session. Test code must never leave a cutover override installed in the replay database.
- [ ] Run the clean replay and SQL regression against a loopback-only database:

  ```bash
  pnpm --filter @baci/web db:replay:chronological
  case "$LOCAL_DATABASE_URL" in
    postgresql://127.0.0.1:*|postgresql://localhost:*) ;;
    *) echo "LOCAL_DATABASE_URL must point to disposable local Postgres" >&2; exit 1 ;;
  esac
  /opt/homebrew/opt/libpq/bin/psql "$LOCAL_DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -f supabase/migrations/tests/quiz_timing_contract_v3.sql
  ```

- [ ] Regenerate types from that replayed local schema and verify no manual drift:

  ```bash
  generated_types="$(mktemp)"
  SUPABASE_CLI_VERSION=2.95.4
  pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
    --db-url "$LOCAL_DATABASE_URL" \
    --schema public > "$generated_types"
  cp "$generated_types" apps/web/src/types/supabase.ts
  rm "$generated_types"
  git diff --check -- apps/web/src/types/supabase.ts
  ```

### Task 6: Negotiate v2 and v3 at the web boundary

**Files:**

- Modify: `apps/web/src/app/api/quiz/_shared/quiz-v2-contract.ts`
- Modify: `apps/web/src/app/api/quiz/_shared/quiz-v2-contract.test.ts`
- Create: `apps/web/src/app/api/quiz/_shared/quiz-v3-projection.ts`
- Create: `apps/web/src/app/api/quiz/_shared/quiz-v3-projection.test.ts`
- Modify: `apps/web/src/app/api/quiz/events/route.ts`
- Create: `apps/web/src/app/api/quiz/events/v3-route.ts`
- Create: `apps/web/src/app/api/quiz/events/v3-route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/start/route.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/start/v2-route.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/start/v2-route.test.ts`
- Create: `apps/web/src/app/api/quiz/attempts/start/v3-route.ts`
- Create: `apps/web/src/app/api/quiz/attempts/start/v3-route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/active/route.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/active/route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/route.ts`
- Create: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/v3-route.ts`
- Create: `apps/web/src/app/api/quiz/attempts/[attemptId]/answers/v3-route.test.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/result/route.ts`
- Modify: `apps/web/src/app/api/quiz/attempts/[attemptId]/result/route.test.ts`
- Modify: `apps/web/src/app/api/quiz/leaderboard/route.ts`
- Modify: `apps/web/src/app/api/quiz/leaderboard/route.test.ts`

**Interfaces:**

- Consumes: supported versions `[2, 3]`, unchanged v2 RPCs, and new v3 RPCs.
- Produces `readQuizContractVersion(request): 2 | 3 | null` and version-specific route dispatch.

- [ ] Keep no-header legacy routing unchanged. Dispatch header `2` to current v2 handlers and header `3` to v3 handlers; reject every other value with 426.
- [ ] Preserve `quiz_runtime_contract_version() = 2` checks for v2. Require `quiz_runtime_contract_versions()` to contain `3` before any v3 mutation.
- [ ] Use distinct route-proof actions ending in `_v3`; never let a v2 proof authorize a v3 RPC or vice versa.
- [ ] Before adding v3, verify the reviewed overlapping v2 start-route change is present: in production phase it calls the existing shared `enforceEventPrizeGuard`, then `enforceQuizAgeGate`, and maps those failures through the bounded friendly responses. If that change has not landed independently, port its exact reviewed implementation and regression into this task. Apply the same production-phase guard sequence to both v3 start entrypoints before creating route/device proofs or calling a start RPC. Do not invent a second age calculation or weaken test/live behavior in this timing plan; the shared guards remain the source of truth.
- [ ] Map database `QZ050` only on v3 start routes to HTTP `426` with `{ error: 'Update the app to join this quiz.', code: 'QUIZ_APP_UPDATE_REQUIRED' }`. Do not leak the configured version through database error text; the safe v3 event/launch projection may supply the required version for intentional UI copy.
- [ ] Map database `QZ049` on player v3 starts to HTTP `503` with `{ error: 'This quiz is not accepting new players right now.', code: 'QUIZ_V3_NOT_ACCEPTING_ENTRIES' }`. V3 list routes normally omit disabled events rather than returning an error. Resume/answer/result/leaderboard routes must never translate a cutover rollback into `QZ049`.
- [ ] Parse v3 database projections with v3 schemas before returning JSON. Keep logs bounded to stable event/attempt ids and validation issue metadata.
- [ ] Add route tests for no header, v2, v3, unsupported version, runtime-not-ready, auth, CSRF, identity mismatch, production prize guard ordering, production age-gate friendly mapping, no start RPC after either guard rejects, phase-1a behavior unchanged, `QZ049` new-entry pause mapping, `QZ050` friendly update mapping, existing-attempt access after cutover-off, a non-best owned attempt returning the best-attempt rank projection, another user's attempt remaining unavailable without existence leakage, non-cutover RPC errors, sanitized logs, and successful projections.
- [ ] Run:

  ```bash
  pnpm --filter @baci/web exec vitest run \
    src/app/api/quiz/_shared/quiz-v2-contract.test.ts \
    src/app/api/quiz/_shared/quiz-v3-projection.test.ts \
    src/app/api/quiz/events \
    src/app/api/quiz/attempts \
    src/app/api/quiz/leaderboard/route.test.ts
  ```

- [ ] After Tasks 4–6 have their three protocol commits and repository gates pass, open PR B without squashing them:

  ```bash
  git log --oneline origin/main..HEAD
  ```

## PR C — Dormant Atomic Authoring and Activation Adapter

### Task 7: Redesign authoring and launch around one timing choice

**Files:**

- Modify: `apps/web/src/app/dashboard/quiz/quiz-authoring-form.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-authoring-form.test.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-answer-timing-fields.tsx`
- Create: `apps/web/src/app/dashboard/quiz/quiz-answer-timing-fields.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-plan-summary.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-plan-summary.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-datetime-local.ts`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-datetime-local.test.ts`
- Create: `apps/web/src/app/dashboard/quiz/quiz-schedule-summary.ts`
- Create: `apps/web/src/app/dashboard/quiz/quiz-schedule-summary.test.ts`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-launch-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-launch-dialog.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-actions.ts`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-actions.test.ts`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-client.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/quiz-admin-client.test.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/page.tsx`
- Modify: `apps/web/src/app/dashboard/quiz/page.test.tsx`
- Modify: `apps/web/src/app/api/merchant/quiz/generate/route.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/generate/route.test.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/activate/route.ts`
- Modify: `apps/web/src/app/api/merchant/quiz/activate/route.test.ts`
- Create: `apps/web/src/app/api/merchant/quiz/activate/quiz-launch-v3.ts`
- Create: `apps/web/src/app/api/merchant/quiz/activate/quiz-launch-v3.test.ts`
- Modify: `apps/web/src/schemas/quiz-schema-response.ts`
- Modify: `apps/web/src/schemas/quiz-schemas-response.test.ts`

**Interfaces:**

- Consumes: `QuizAnswerTiming`, `getQuizDurationSeconds`, and `activate_quiz_event_v3`.
- Produces `QuizDraftConfiguration.answerTiming`, v3 activation payloads with derived timestamps, and:

  ```ts
  type QuizV3CutoverState = {
    testEnabled: boolean;
    liveEnabled: boolean;
    minimumLiveMobileVersion: string | null;
  };

  quizDatetimeLocalToIso(
    value: string,
    timeZone: string
  ): { iso: string; status: 'valid' } | {
    iso: null;
    status: 'invalid' | 'nonexistent' | 'ambiguous';
  };

  formatQuizScheduleSummary(input: {
    startsAt: string;
    endsAt: string;
    timeZone: string;
    locale?: string;
  }): string;
  ```

- [ ] Extract timing controls so `quiz-authoring-form.tsx` remains below 300 lines.
- [ ] Present exactly two accessible choices: `Time each question` and `One timer for the whole quiz`.
- [ ] For per-question mode show one 5–60 second input. For total mode show minute and second inputs that normalize to 10–3600 total seconds. Hidden mode values must not enter the request.
- [ ] Keep launch timing separate: `Launch now` or `Schedule start`. Remove editable live-window and scheduled-end controls.
- [ ] Harden the existing `quizDatetimeLocalToIso` conversion instead of using the browser's local zone or one guessed offset. Parse the wall-clock fields strictly, validate the IANA zone, sample that zone's offsets at six-hour intervals from 48 hours before through 48 hours after the wall-clock-as-UTC value, deduplicate those offsets, derive one UTC candidate per offset, and retain only candidates that `Intl.DateTimeFormat` round-trips to every exact entered year/month/day/hour/minute field. Accept exactly one candidate; return `nonexistent` for zero matches, `ambiguous` for two or more, and `invalid` for malformed input/zone. Do not silently shift a nonexistent time or choose an ambiguous occurrence; show `Choose another start time because this local time changes twice or does not exist in {timeZone}.` and send no activation request.
- [ ] Render scheduled confirmation/summary text only from the validated absolute `startsAt`, derived `endsAt`, and event `timeZone` through `formatQuizScheduleSummary`. Never call `new Date(datetimeLocalValue).toLocaleString()` because that reinterprets the merchant wall clock in the admin browser's zone. Include the zone abbreviation/name in the visible summary and an accessible full date/time label.
- [ ] Derive duration from the reviewed answer-key question count on the server. For immediate launch pass timing kind `immediate` with `p_starts_at = NULL`; `activate_quiz_event_v3` captures database `clock_timestamp()` only during the first draft transition. For scheduled launch pass the validated future start. Send no end timestamp; the RPC derives it under the event lock.
- [ ] Generate one `launchRequestId` when the launch confirmation opens and retain it until activation succeeds, the merchant cancels, or the reviewed draft changes. Reuse it for CSRF/network retries. The route passes the same identity and canonical input to `activate_quiz_event_v3`; it must not generate a replacement id or synthesize an immediate start timestamp.
- [ ] Persist `answerTiming` in draft settings so reload/review cannot revert it. When the selected mode's v3 flag is false, render the existing v2 timing form and send only the existing v2 payload. When that mode's flag is true, render the new timing-mode fields and v3 summary. Do not expose a total-mode control that can only launch through v2.
- [ ] For a v3-enabled generation request, create the database row as a contract-1 draft and persist `target_quiz_contract_version: 3` plus the normalized answer timing in settings. The generation route must never write a contract-3 draft directly. V2 generation payloads retain their current settings and contain no v3 target marker.
- [ ] When the merchant changes Mode between a v3-enabled mode and a v2-only mode before generation, discard timing fields that are invalid for the destination contract and initialize that contract's defaults. A previously selected total timer must never leak into a live-v2 generation payload while only test-v3 is enabled.
- [ ] Implement the dormant `launchMerchantQuizDraftV3` adapter to call `activate_quiz_event_v3` for both test and live activation. Pass null regulatory fields for test mode and validated fields for live mode; no v3 direct-table update path may exist. The RPC remains the final authority for prize readiness, regulatory readiness, idempotency, mode, timing, and derived end.
- [ ] Parse `quiz_v3_cutover_state()` through a strict Zod schema inside the page and activation route. A false/missing/error flag keeps v2 requests working but rejects a v3 payload for that mode with `503 QUIZ_V3_CUTOVER_NOT_READY`; it must never fall back and reinterpret that payload as v2. When live is enabled, display the configured minimum released mobile version in the confirmation dialog.
- [ ] Summary copy examples must be exact: `20 questions • 10 seconds each • Total 3m 20s • Closes 09:03:20` and `20 questions • One 5-minute timer • Closes 09:05`.
- [ ] Confirmation copy must include `Late players start at question 1 with only the remaining quiz time.`
- [ ] Write tests named `renders_per_question_controls`, `renders_total_timer_controls`, `switching_timing_kind_removes_hidden_value`, `switching_test_v3_to_live_v2_resets_total_mode`, `v3_generation_persists_contract_one_with_target_three`, `v2_generation_omits_v3_target_marker`, `summarizes_20_by_10`, `summarizes_30_second_total`, `derives_immediate_start_only`, `submits_scheduled_start_without_end`, `rejects_past_start`, `converts_unique_lagos_wall_clock`, `rejects_new_york_spring_gap`, `rejects_new_york_fall_ambiguity`, `summary_uses_event_zone_not_browser_zone`, `immediate_retry_reuses_launch_request_id`, `cancel_then_reopen_creates_new_launch_request_id`, `changed_review_creates_new_launch_request_id`, `replays_identical_activation`, `requires_auth_and_csrf`, and `maps_activation_rpc_failure`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/web exec vitest run \
    src/app/dashboard/quiz \
    src/app/api/merchant/quiz/generate \
    src/app/api/merchant/quiz/activate \
    src/schemas/quiz-schema-authoring.test.ts \
    src/schemas/quiz-schema-launch.test.ts \
    src/schemas/quiz-schemas-response.test.ts
  ```

- [ ] After Task 7 has its protocol commit and repository gates pass, open PR C:

  ```bash
  git log --oneline origin/main..HEAD
  ```

## PR D — Dual-Stack Web and Mobile Cutover

### Task 8: Render v3 timing correctly on the web storefront

**Files:**

- Create: `apps/web/src/components/storefront/ogabassey/pages/quiz-contract-request.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/quiz-contract-request.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-countdown.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-countdown.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-v3-playback.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-v3-playback.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/quiz-rules-dialog.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pages/quiz-rules-dialog.test.tsx`

**Interfaces:**

- Consumes: shared v3 schemas, `fetchWithCsrf`, and the header-3 API routes from Task 6.
- Produces:

  ```ts
  export async function requestQuizContract<T>(
    contractVersion: 2 | 3,
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit
  ): Promise<QuizObservedResponse<T>>;

  export function getQuizWebAppVersion(env?: {
    NEXT_PUBLIC_POSTHOG_RELEASE_VERSION?: string;
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?: string;
  }): string;

  type QuizV3PlaybackState = {
    lockedOptionId: string | null;
    phase: 'question' | 'submitting' | 'expiring' | 'error';
    answer(optionId: string): Promise<void>;
    expire(): Promise<void>;
    retry(): Promise<void>;
  };

  useQuizV3Playback(input: {
    attempt: QuizV3Attempt;
    expectedUserId: string;
    submitAnswer(optionId: string): Promise<QuizV3AttemptResponse>;
    recoverAttempt(): Promise<QuizV3AttemptResponse>;
  }): QuizV3PlaybackState;
  ```

- [ ] Write failing request tests proving version 2 and 3 requests carry the matching `X-Baci-Quiz-Contract` value, preserve CSRF on mutations, capture finite request-start/response-receipt monotonic observations around the actual fetch, derive bounded non-empty web app metadata, and reject a response that fails the selected version's schema before state changes.
- [ ] Implement `requestQuizContract` with `fetchWithCsrf`; capture `performance.now()` immediately before the fetch and immediately after its response settles, set the selected contract header after merging caller headers, use `cache: 'no-store'`, parse bounded API errors, validate successful JSON with the supplied versioned schema, and return the validated data plus both observations. Failed/invalid responses never install a clock anchor.
- [ ] Implement `getQuizWebAppVersion` using the existing public release identifier, then public Vercel commit SHA, then literal `web-local`; trim and bound the value to the start schema's maximum. Web is exempt from the mobile semantic-version gate, but every start still records non-empty deployment metadata.
- [ ] Replace the no-header calls in `quiz-page-data.ts` with dual-stack helpers. Event loading requests v2 and v3 lists independently, merges by event id, sorts by start time, and retains `contractVersion` on every row. A `426`/`503` v3-readiness response before cutover contributes an empty v3 list without hiding successful v2 events; any other one-sided list failure preserves the successful list and renders `Some quizzes may be temporarily unavailable` with retry, while failure of both lists renders the normal full error state. Start/active/answer/result/leaderboard calls use the event or attempt's stored version. Never retry a failed mutation under another version because that could consume an attempt or duplicate an answer.
- [ ] Add an accessible `QuizRulesDialog` before any versioned web start. It renders the event's exact accepted-rules version and, for v3, the lines from `getQuizV3RuleLines`; v2 keeps its existing v2 rules wording. Require an unchecked-by-default `I have read the rules and agree to the terms and conditions` checkbox, link to `https://usebaci.com/terms`, and disable `Accept & play` until checked. Closing the dialog sends no request.
- [ ] Change the web start helper to require `{ eventId, expectedUserId, acceptedRulesVersion, termsAccepted: true, appVersion, platform: 'web', integrityTier, startRequestId }`. Generate one stable `startRequestId` when the dialog opens and reuse it for transport retries; do not generate a second attempt identity after an uncertain response. Assert the selected event's `rulesVersion` is non-empty before enabling acceptance.
- [ ] Implement `useQuizV3Playback` to own v3 `answerTiming`, `eventEndsAt`, the monotonic server-clock anchor, locked-answer state, lifecycle epoch, and authenticated expiry reconciliation. Keep this orchestration out of the already-276-line `quiz.tsx` and verify that file remains below 300 lines. Per-question mode shows the question countdown capped by the universal end; total mode mounts only the universal countdown.
- [ ] Replace web countdown wall-clock arithmetic with `QuizServerClockAnchor` created from each parsed attempt response's request/response observations. A `Date.now()` jump must not add time, and a slow response must advance the displayed server time by half its measured round trip. On `visibilitychange` back to visible, disable answers, call the authenticated active-attempt endpoint, install its fresh anchor, then render/enable only the returned authoritative state; an offline reconciliation keeps answers disabled with a retry action rather than displaying a stale playable timer.
- [ ] Through `useQuizV3Playback`, make answer taps lock and submit immediately. At universal zero disable answers and call the authenticated active-attempt endpoint; apply `active`, `pending_results`, and `event_cancelled` exactly once using an in-flight guard and lifecycle epoch equivalent to PR A.
- [ ] Add tests named `v3_not_ready_preserves_v2_events`, `one_list_failure_shows_partial_warning`, `both_list_failures_show_full_error`, `rules_dialog_blocks_unchecked_start`, `rules_dialog_closes_without_start`, `accepted_start_sends_rules_and_stable_request_id`, `v3_rules_render_shared_mode_copy`, `wall_clock_rollback_does_not_add_time`, `slow_response_uses_midpoint_server_time`, `visible_reconciliation_disables_answers_until_success`, and `visible_reconciliation_failure_requires_retry`, plus fake-timer tests for both timing modes, late entry, answer auto-advance, selected-answer submission, unanswered timeout, universal expiry during submission, background-tab clock jump, and no duplicate request.
- [ ] Run:

  ```bash
  pnpm --filter @baci/web exec vitest run \
    src/components/storefront/ogabassey/pages/quiz-contract-request.test.ts \
    src/components/storefront/ogabassey/pages/quiz-page-data.test.ts \
    src/components/storefront/ogabassey/pages/use-quiz-countdown.test.ts \
    src/components/storefront/ogabassey/pages/use-quiz-v3-playback.test.ts \
    src/components/storefront/ogabassey/pages/quiz-rules-dialog.test.tsx \
    src/components/storefront/ogabassey/pages/quiz-question-panel.test.tsx \
    src/components/storefront/ogabassey/pages/quiz.test.tsx
  ```

### Task 9: Render v3 timing correctly on mobile

**Files:**

- Modify: `apps/mobile-storefront/app.config.ts`
- Modify: `apps/mobile-storefront/app.config.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-request.ts`
- Create: `apps/mobile-storefront/services/quiz-request.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-types.ts`
- Modify: `apps/mobile-storefront/schemas/quiz-schemas.ts`
- Modify: `apps/mobile-storefront/schemas/quiz-schemas.test.ts`
- Modify: `apps/mobile-storefront/schemas/quiz-schemas.test-support.ts`
- Modify: `apps/mobile-storefront/services/quiz.ts`
- Modify: `apps/mobile-storefront/services/quiz.test.ts`
- Modify: `apps/mobile-storefront/services/quiz.test-support.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempts.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempts.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempt-recovery.ts`
- Modify: `apps/mobile-storefront/services/quiz-attempt-recovery.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-results.ts`
- Modify: `apps/mobile-storefront/services/quiz-results.test.ts`
- Modify: `apps/mobile-storefront/services/quiz-leaderboard.ts`
- Modify: `apps/mobile-storefront/services/quiz-leaderboard.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-recovery-envelope.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store-v2-retry.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store.test.ts`
- Create: `apps/mobile-storefront/stores/quiz-v3-store-actions.ts`
- Create: `apps/mobile-storefront/stores/quiz-v3-store-actions.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/useQuizStartFlow.ts`
- Modify: `apps/mobile-storefront/components/quiz/useQuizStartFlow.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-v3-playback.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-v3-playback.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/QuizEventsList.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizEventsList.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizLobbyEventCard.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizLobbyEventCard.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizRulesModal.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizRulesModal.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizLiveQuestionCard.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizLiveQuestionCard.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-question-timer.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-question-timer.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-event-timer.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-event-timer.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-server-clock.ts`
- Modify: `apps/mobile-storefront/components/quiz/use-quiz-server-clock.test.ts`

**Interfaces:**

- Consumes: v3 event/attempt/result/leaderboard schemas and PR A expiry actions.
- Produces `requestQuizV3`, v3 service methods, `createQuizV3StoreActions`, `useQuizV3Playback`, and mode-correct start/recovery/lobby/rules/question/terminal rendering.

- [ ] Keep `requestQuizV2` and add `requestQuizV3`, both returning the internal `QuizObservedResponse<T>` envelope around schema-validated data. Capture `performance.now()` immediately around the actual fetch, not later in a component. Load both event lists independently, merge successful response data by event id, and persist `contractVersion` into event, active-attempt, recovery, result, and leaderboard requests. Treat pre-cutover v3 `426`/`503` as an empty v3 list; preserve a successful one-sided list with `Some quizzes may be temporarily unavailable` plus retry; show the full request error only when both lists fail. Dispatch each mutation once under its stored version; never retry under the other contract.
- [ ] Keep PR D unreleased and test-mode-only. It may expose the current app version/build metadata to start requests, but it must not reserve, bump, upload, or advertise the live candidate because PR E still changes post-game runtime code. Validate PR D through web and Metro/dev builds while both v3 cutover flags are false.
- [ ] Do not normalize total mode to a fake per-question value. Preserve `answerTiming` through service types, schemas, store state, and recovery.
- [ ] Add a first-class contract-3 branch to `useQuizStartFlow`; a selected v3 event must call only the v3 start service with its stable request id/rules metadata and must never fall into the legacy or v2 starter. Resume uses the persisted contract version and v3 active-attempt service. Keep username/DOB/readiness gates shared, but preserve the selected event id and flow generation across every modal boundary.
- [ ] Extract `createQuizV3StoreActions` so `quiz-store.ts` remains below 300 lines. Store the discriminated active attempt as v2 or v3, route answer/recovery/expiry exactly once through its stored version, retain v3 `answerTiming` and observed-response clock metadata, and populate `terminalContext` before clearing a v3 playable attempt. A v3 mutation may never retry through v2/legacy after an uncertain response.
- [ ] Mount `useQuizV3Playback` from `QuizScreen.tsx` for only a contract-3 playable attempt. It owns lock/submit/timeout/expiry epochs and hands terminal outcomes to the store; `QuizScreen` only selects the versioned presenter. Keep legacy and v2 rendering unchanged and keep the screen below 300 lines by extracting a versioned playable panel if required.
- [ ] Introduce `QuizPublishedResult = QuizV2Result | QuizV3Result` and rename the store action to `setQuizResult(result: QuizPublishedResult)`. Update every caller and test in the same PR; do not leave a v3 result flowing through a v2-only type. Preserve all v3 best-attempt fields through mobile/web service parsing and restored post-game state; never coerce `attemptScore` into `bestScore`.
- [ ] Lobby and rules show only the selected mode: `10s per question` or `5 minutes total`.
- [ ] Refactor `QuizRulesModal` to render v3 lines from `getQuizV3RuleLines` and submit the event's exact `rulesVersion`; retain v2 copy for v2 events. Keep the checkbox unchecked whenever the modal opens, send no start request on close/scroll, and reuse the same `startRequestId` for an uncertain start retry.
- [ ] Per-question mode mounts both timers, but shows the universal timer separately only when it expires sooner than a full remaining question sequence.
- [ ] Total mode does not mount `useQuizQuestionTimer`; it shows one universal timer and advances immediately after each tapped answer.
- [ ] At universal zero use PR A's `expireActiveEvent`, disable answers, and move to pending results. Foregrounding recomputes from server time and cannot pause either mode.
- [ ] Replace the mobile timers' repeated `Date.now() + offset` arithmetic with the shared monotonic `QuizServerClockAnchor` created from each service response's request/response observations. On `AppState` return to `active`, disable answers and run authenticated recovery before re-enabling or rendering a playable state. A failed foreground recovery retains a non-playable retry state; changing the device wall clock cannot add question or event time, and response transit advances the estimate by half the measured round trip.
- [ ] Write tests named `loads_and_merges_v2_v3_events`, `v3_not_ready_preserves_v2_events`, `one_list_failure_shows_partial_warning`, `both_list_failures_show_full_error`, `persists_contract_version`, `v3_start_never_calls_v2_or_legacy`, `v3_resume_uses_persisted_contract`, `v3_store_routes_answer_once`, `v3_terminalizes_before_clearing_attempt`, `quiz_screen_mounts_v3_playback`, `renders_per_question_mode`, `renders_total_mode`, `renders_shared_v3_rules_copy`, `rules_reopen_unchecks_acceptance`, `start_retry_reuses_request_id`, `late_entry_starts_question_one`, `wall_clock_rollback_does_not_add_time`, `slow_response_uses_midpoint_server_time`, `foreground_disables_answers_until_recovered`, `foreground_recovery_failure_requires_retry`, `foreground_recomputes_server_time`, `tap_submits_and_advances`, `universal_expiry_enters_pending`, and `does_not_duplicate_submission`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/mobile-storefront test -- --runInBand \
    services/quiz-request.test.ts \
    services/quiz.test.ts \
    services/quiz-attempts.test.ts \
    services/quiz-attempt-recovery.test.ts \
    services/quiz-results.test.ts \
    services/quiz-leaderboard.test.ts \
    schemas/quiz-schemas.test.ts \
    stores/quiz-store.test.ts \
    stores/quiz-v3-store-actions.test.ts \
    components/quiz/useQuizStartFlow.test.ts \
    components/quiz/use-quiz-v3-playback.test.ts \
    components/quiz/QuizScreen.test.tsx \
    components/quiz/QuizEventsList.test.tsx \
    components/quiz/QuizLobbyEventCard.test.tsx \
    components/quiz/QuizRulesModal.test.tsx \
    components/quiz/QuizLiveQuestionCard.test.tsx \
    components/quiz/use-quiz-question-timer.test.ts \
    components/quiz/use-quiz-event-timer.test.ts \
    components/quiz/use-quiz-server-clock.test.ts
  ```

- [ ] After Tasks 8–9 have their two protocol commits and both player surfaces pass repository gates, open PR D without squashing them:

  ```bash
  git log --oneline origin/main..HEAD
  ```

## PR E — Automatic Final Results and Leaderboard

### Task 10: Preserve terminal identity and poll only the result

**Files:**

- Create: `apps/mobile-storefront/components/quiz/use-quiz-post-game.ts`
- Create: `apps/mobile-storefront/components/quiz/use-quiz-post-game.test.ts`
- Create: `apps/mobile-storefront/stores/quiz-post-game-context.ts`
- Create: `apps/mobile-storefront/stores/quiz-post-game-context.test.ts`
- Modify: `apps/mobile-storefront/stores/quiz-recovery-envelope.ts`
- Modify: `apps/mobile-storefront/stores/quiz-store-v2-retry.test.ts`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.test.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-post-game.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-post-game.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-page-data.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz.test.tsx`

**Interfaces:**

- Consumes: `terminalContext`, `fetchQuizResult`, `fetchQuizLeaderboard`, and `setQuizResult`.
- Produces:

  ```ts
  type QuizPostGameState =
    | { status: 'idle' | 'loading' }
    | { status: 'delayed'; message: string }
    | { status: 'cancelled' }
    | {
        status: 'final';
        result: QuizPublishedResult;
        leaderboard: QuizLeaderboard | null;
        leaderboardStatus: 'loading' | 'ready' | 'error';
      };

  type QuizPostGameController = {
    state: QuizPostGameState;
    checkAgain(): void;
    retryLeaderboard(): void;
    dismiss(): void;
  };

  useQuizPostGame({
    attemptId,
    eventId,
    contractVersion,
    expectedUserId,
    enabled,
  }): QuizPostGameController;
  ```

  The web hook exposes the same `QuizPostGameState` contract but stores terminal identity in `localStorage` under `baci:quiz-post-game:v1:<userId>:<eventId>` so a closed/reopened tab can recover like a restarted mobile app; mobile uses the typed AsyncStorage module listed above. Both persisted records also include `savedAt` as an ISO timestamp for bounded cleanup. The attempt id is only a recovery locator, never authorization; every read still authenticates and rechecks ownership server-side.

- [ ] Keep `terminalContext` when expiry reconciliation clears the active attempt, when the app restarts into pending results, and when final result state is applied.
- [ ] Mount the post-game hooks from `QuizScreen.tsx` and web `quiz.tsx` without moving polling/storage logic into either screen. Recheck both line counts after integration and keep each below 300 lines.
- [ ] Persist `{ attemptId, eventId, contractVersion, userId, savedAt }` with `quiz-post-game-context.ts` on mobile and the scoped local-storage key on web before clearing active attempt state. Restore only for the same authenticated user, validate `contractVersion` as literal `2 | 3`, require a valid `savedAt` no older than seven days, and dispatch result/leaderboard requests through that version. On logout or account change, remove every terminal-context key belonging to the departing user before rendering another account; never enumerate or restore another user's key as the incoming account. Remove malformed, cross-user, expired, or cancelled contexts immediately. Do not remove a final context while leaderboard loading/retry remains unfinished; clear it only after both the authoritative result and final leaderboard are ready, or after the player explicitly dismisses the post-game view.
- [ ] Poll only the authenticated attempt-result endpoint: start at 2 seconds, back off through 4, 6, 8, then cap at 10 seconds. Stop on final, cancellation/unavailable, unmount, account change, or after 2 minutes.
- [ ] After a final result arrives, fetch that event's leaderboard under the persisted contract version. Do not request it while results are pending. Retry only transport errors, 5xx responses, and invalid-success payloads after `0`, `2000`, `4000`, and `8000` milliseconds; stop immediately on success, auth/authorization failure, cancellation, account change, or unmount.
- [ ] After four failed leaderboard attempts, retain the final score and persisted post-game context, set `leaderboardStatus: 'error'`, show `We couldn't load the final standings.`, and expose `Retry standings`. A manual retry starts the same bounded sequence; the hook accepts only the first successful final response and never polls a live/provisional board.
- [ ] If result publication exceeds 2 minutes, show `Your answers are safe. Results are taking longer than expected.` and an accessible `Check again` action.
- [ ] Wire `checkAgain` to restart bounded result polling from the delayed state, `retryLeaderboard` to restart only the final-board retry sequence, and `dismiss` to cancel timers and remove the persisted context. None of these actions may restart or mutate the quiz attempt.
- [ ] Add equivalent fake-timer tests on both clients named `polls_result_until_final`, `uses_persisted_contract_version_after_restart`, `web_restores_after_tab_reopen`, `logout_removes_departing_user_context`, `never_restores_another_users_context`, `retains_context_when_result_final_but_leaderboard_pending`, `restores_final_result_after_leaderboard_failure`, `clears_context_after_result_and_leaderboard_ready`, `expires_context_after_seven_days`, `retries_final_leaderboard_0_2_4_8_seconds`, `stops_leaderboard_retry_after_success`, `shows_retry_after_four_failures`, `stops_on_account_change`, and `includes_current_player_outside_top_100`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/mobile-storefront test -- --runInBand \
    components/quiz/use-quiz-post-game.test.ts \
    components/quiz/QuizScreen.test.tsx \
    stores/quiz-store-v2-retry.test.ts
  pnpm --filter @baci/web exec vitest run \
    src/components/storefront/ogabassey/pages/use-quiz-post-game.test.ts \
    src/components/storefront/ogabassey/pages/quiz-page-data.test.ts \
    src/components/storefront/ogabassey/pages/quiz.test.tsx
  ```

### Task 11: Show the final leaderboard automatically

**Files:**

- Modify: `apps/mobile-storefront/app.config.ts`
- Modify: `apps/mobile-storefront/app.config.test.ts`
- Create: `apps/mobile-storefront/components/quiz/QuizPostGameLeaderboard.tsx`
- Create: `apps/mobile-storefront/components/quiz/QuizPostGameLeaderboard.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizResultsPanel.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizResultsPanel.test.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizScreen.styles.ts`
- Modify: `apps/mobile-storefront/components/quiz/QuizLeaderboardScreen.tsx`
- Modify: `apps/mobile-storefront/components/quiz/QuizLeaderboardScreen.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-result-panel.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-result-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-leaderboard-panel.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/quiz-leaderboard-panel.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-leaderboard.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/use-quiz-leaderboard.test.ts`
- Modify: `apps/web/src/app/api/quiz/leaderboard/route.test.ts`

**Interfaces:**

- Consumes: final `QuizPostGameState` and existing `QuizLeaderboardEntry` fields.
- Produces `QuizPostGameLeaderboard({ leaderboard, styles })`, rendered directly below the player's score/rank.

- [ ] Pending state says `Calculating results…` and never shows a provisional score or board.
- [ ] Final state shows the player's score, total questions, highlighted rank, prize outcome, and final standings without another tap. For a v3 result where `isBestAttempt` is false, make `Best score {bestScore}/{totalQuestions}` the ranked headline and show `This attempt: {attemptScore}/{totalQuestions}` as secondary copy; when true, show one score only. Live results always use the one-score presentation.
- [ ] Apply the same pending/final transition and information hierarchy to the web result panel; neither client may require a manual leaderboard refresh after publication.
- [ ] Render top entries plus `currentPlayer` when they are outside the top list. Show username, rank, score, and deterministic total time; do not show email, legal name, submission timestamp, or answers.
- [ ] Keep `View all leaderboards` as a secondary link for past quizzes. The current event's board is already visible and does not require navigation.
- [ ] Preserve the server's existing `live_hidden` behavior in route tests. An active/finalizing event must return no entries; only a published event may return rows.
- [ ] Write component tests named `renders_calculating_without_score`, `renders_delayed_message`, `renders_cancelled`, `renders_winner`, `renders_non_winner`, `renders_best_and_current_test_attempt_scores`, `renders_one_score_for_best_attempt`, `highlights_current_player_in_top_list`, `appends_current_player_outside_top_list`, `renders_empty_final_board`, `renders_leaderboard_retry`, and `exposes_accessible_rank_labels`.
- [ ] Only after all Task 10–11 mobile tests pass, recheck App Store Connect, Google Play, `app.config.ts`, and `eas.json`. Keep `cli.appVersionSource: "remote"` and production `autoIncrement: true`; Expo documents those remote values—not local `android.versionCode` or `ios.buildNumber` defaults—as the production native-build source of truth. Run `(cd apps/mobile-storefront; EAS_CLI_VERSION=18.0.1; pnpm dlx "eas-cli@${EAS_CLI_VERSION}" build:version:get -p all -e production --json --non-interactive)` and preserve the redacted pre-build output as release evidence.
- [ ] If user-facing version `2.0.2` remains unused, change the checked-in storefront semantic/runtime version from `2.0.1` to `2.0.2`; otherwise choose the next unused semantic version. Update app-config tests for that semantic/runtime version. Do not claim or reserve Android `742` or iOS `10` from the checked-in defaults: production EAS builds assign developer-facing numbers remotely. This commit changes source metadata only and must not upload a signed build from an unmerged PR branch.
- [ ] Run:

  ```bash
  pnpm --filter @baci/mobile-storefront test -- --runInBand \
    components/quiz/QuizResultsPanel.test.tsx \
    components/quiz/QuizPostGameLeaderboard.test.tsx \
    components/quiz/QuizLeaderboardScreen.test.tsx
  pnpm --filter @baci/web exec vitest run \
    src/components/storefront/ogabassey/pages/quiz-result-panel.test.tsx \
    src/components/storefront/ogabassey/pages/quiz-leaderboard-panel.test.tsx \
    src/components/storefront/ogabassey/pages/use-quiz-leaderboard.test.ts \
    src/app/api/quiz/leaderboard/route.test.ts
  ```

- [ ] After Tasks 10–11 have their two protocol commits and repository gates pass, open PR E without squashing them:

  ```bash
  git log --oneline origin/main..HEAD
  ```

- [ ] After PR E merges and its web deployment is verified, create iOS and Android signed candidates from one clean exact source SHA at or after that PR-E merge, containing PR D and PR E with no dirty files. Allow EAS `autoIncrement` to assign the native build identifiers. After both builds finish, query the build records and record source SHA, semantic version, actual EAS-assigned iOS build number, actual EAS-assigned Android version code, application ids, artifact/build service identifiers, and creation timestamps. If either store rejects an assigned build number or any mobile runtime change lands afterward, create new auto-incremented builds (and choose a new semantic version when store state requires it), update this plan through a docs-only amendment, rebuild both platforms from one new exact SHA, and invalidate the earlier candidate for PR H.

## PR F — Bounded Low-Latency Finalization Worker

### Task 12: Add a lightweight next-transition probe

**Files:**

- Create: `supabase/migrations/20260808171000_quiz_worker_next_transition.sql`
- Create: `supabase/migrations/tests/quiz_worker_next_transition.sql`
- Create: `apps/web/src/lib/quiz-worker-next-transition-migration.test.ts`
- Modify generated output: `apps/web/src/types/supabase.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`
- Create: `apps/web/src/lib/quiz/quiz-worker-wake-state.ts`
- Create: `apps/web/src/lib/quiz/quiz-worker-wake-state.test.ts`
- Modify: `apps/web/src/lib/quiz/finalize-due-quiz-events.ts`
- Modify: `apps/web/src/lib/quiz/finalize-due-quiz-events.test.ts`

**Interfaces:**

- Consumes: unchanged v2 service-role finalizers plus `promote_due_scheduled_quiz_events_service_v3`, `finalize_due_test_quiz_events_v3`, `terminalize_due_live_quiz_events_v3`, and `finalize_due_live_quiz_events_v3` from Task 5.
- Produces service-only `public.quiz_worker_wake_state()` returning `{ "databaseNow": timestamptz, "transitionAt": timestamptz | null }` and:

  ```ts
  type QuizWorkerWakeDecision = {
    due: boolean;
    delayMs: number;
    degraded: boolean;
  };

  getNextQuizWorkerWakeDecision(input?: {
    signal?: AbortSignal;
  }): Promise<QuizWorkerWakeDecision>;

  finalizeDueQuizEvents(input?: {
    signal?: AbortSignal;
  }): Promise<QuizFinalizationResponse>;
  ```

- [ ] The probe must consider scheduled starts, active ends, due unpublished test/live events, and award expiry. It returns no customer or event data—only database time and one nullable transition timestamp.
- [ ] Extend `finalizeDueQuizEvents()` with the four v3 service-role steps while preserving every v2 step and its order. Run v3 promotion before v3 test/live terminalization, and v3 live terminalization before v3 live award finalization. One v2 or v3 RPC failure increments the bounded failure count but does not prevent the other idempotent queues from running.
- [ ] Thread an optional `AbortSignal` through both the wake-state probe and every finalizer RPC using Supabase's query abort support. Check `signal.aborted` before issuing each subsequent RPC; an abort stops the sequence, returns/throws only the stable worker-aborted condition, and never logs raw database errors. This is cooperative cancellation for Task 13's process watchdog, not a claim that every network stack will settle after abort.
- [ ] Exclude already published/cancelled events. For blocked live finalization, return no earlier than `updated_at + 60 seconds` so a blocked event cannot create a hot loop.
- [ ] Revoke PUBLIC/anon/authenticated execute and grant service role only.
- [ ] Parse the RPC JSON through a strict Zod schema requiring an offset-aware `databaseNow` and nullable offset-aware `transitionAt`. A transport error or missing/invalid payload emits only stable code `QUIZ_WORKER_WAKE_STATE_INVALID` and returns `{ due: true, delayMs: 5000, degraded: true }`, causing a bounded full finalizer sweep rather than silently idling and stranding results.
- [ ] `getNextQuizWorkerWakeDecision` calls the probe once. A valid no-work response returns `{ due: false, delayMs: 5000, degraded: false }`; a due transition returns `{ due: true, delayMs: 0, degraded: false }`; a future transition returns `{ due: false, delayMs: clamp(transitionAt - databaseNow, 250, 5000), degraded: false }`. Obtain `databaseNow` in the same RPC payload as `transitionAt` so host clock skew cannot change the decision.
- [ ] Write tests named `runs_v2_and_v3_finalizers_in_order`, `v3_failure_does_not_skip_v2_queues`, `abort_signal_reaches_probe`, `abort_signal_reaches_each_finalizer`, `abort_stops_later_finalizers`, `invalid_probe_requests_degraded_sweep`, `probe_transport_error_requests_degraded_sweep`, `returns_idle_when_no_work`, `returns_future_scheduled_start`, `returns_active_event_end`, `returns_due_test_event`, `backs_off_blocked_live_event`, `returns_award_expiry`, `withholds_probe_from_non_service_roles`, and `bounds_delay_using_database_clock`.
- [ ] Run a clean chronological replay against the loopback-only database, execute the SQL test, and regenerate database types:

  ```bash
  pnpm --filter @baci/web db:replay:chronological
  case "$LOCAL_DATABASE_URL" in
    postgresql://127.0.0.1:*|postgresql://localhost:*) ;;
    *) echo "LOCAL_DATABASE_URL must point to disposable local Postgres" >&2; exit 1 ;;
  esac
  /opt/homebrew/opt/libpq/bin/psql "$LOCAL_DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -f supabase/migrations/tests/quiz_worker_next_transition.sql
  generated_types="$(mktemp)"
  SUPABASE_CLI_VERSION=2.95.4
  pnpm dlx "supabase@${SUPABASE_CLI_VERSION}" gen types typescript \
    --db-url "$LOCAL_DATABASE_URL" \
    --schema public > "$generated_types"
  cp "$generated_types" apps/web/src/types/supabase.ts
  rm "$generated_types"
  pnpm --filter @baci/web exec vitest run \
    src/lib/quiz-worker-next-transition-migration.test.ts \
    src/lib/quiz/quiz-worker-wake-state.test.ts \
    src/lib/quiz/finalize-due-quiz-events.test.ts
  ```

### Task 13: Run one supervised adaptive worker with a flocked fallback

**Files:**

- Create: `apps/web/src/lib/quiz/quiz-finalization-operations-alert.ts`
- Create: `apps/web/src/lib/quiz/quiz-finalization-operations-alert.test.ts`
- Create: `apps/web/src/lib/quiz/quiz-finalization-worker-env.ts`
- Create: `apps/web/src/lib/quiz/quiz-finalization-worker-env.test.ts`
- Modify: `apps/web/src/env.ts`
- Modify: `apps/web/src/env.test.ts`
- Modify: `apps/web/src/scripts/process-quiz-finalization.ts`
- Modify: `apps/web/src/scripts/process-quiz-finalization.test.ts`
- Modify: `turbo.json`
- Modify: `vps-workers/bin/process-quiz-finalization.sh`
- Modify: `vps-workers/bin/direct-web-worker-wrappers.test.mjs`
- Create: `vps-workers/install-quiz-finalization-service.sh`
- Create: `vps-workers/install-quiz-finalization-service.test.mjs`
- Modify: `vps-workers/deploy.sh`
- Create: `vps-workers/promote-direct-worker-checkout.sh`
- Create: `vps-workers/promote-direct-worker-checkout.test.mjs`
- Modify: `vps-workers/lib/prepare-worker-release.sh`
- Modify: `vps-workers/jobs/deploy-crontab.test.mjs`
- Modify: `vps-workers/jobs/preflight-direct-web-workers.mjs`
- Modify: `vps-workers/jobs/preflight-direct-web-workers.test.mjs`
- Modify: `vps-workers/README.md`
- Modify: `docs/ops/vps-workers.md`

**Interfaces:**

- Consumes: `finalizeDueQuizEvents()` and `getNextQuizWorkerWakeDecision()`.
- Produces:

  ```ts
  runQuizFinalizationLoop({
    runJob,
    getWakeDecision,
    delay,
    signal,
    logger,
    hardExit,
  }): Promise<number>;

  runQuizFinalizationOnce({
    runJob,
    getWakeDecision,
    logger,
  }): Promise<number>;
  ```

- [ ] Install `baci-quiz-finalization.service` as the one normal scheduler. Its unit uses `After=network-online.target`, `WorkingDirectory=/home/bassey/baci-workers`, `Environment=NODE_ENV=production`, `Environment=BACI_WORKER_PROFILE=quiz-finalization`, and `ExecStart=/usr/bin/flock -n /home/bassey/baci-workers/locks/quiz-finalize.lock /home/bassey/baci-workers/bin/process-quiz-finalization.sh --loop`; set `Restart=always`, `RestartSec=1`, `KillMode=control-group`, and `TimeoutStopSec=2`. Before daemon reload, follow the repository's durable event-worker pattern: run `loginctl enable-linger "$CURRENT_USER"` when needed and fail the installer unless `loginctl show-user "$CURRENT_USER" -p Linger --value` is exactly `yes`. Enable the unit under `default.target`. The long-running process owns the existing flock for its lifetime, so there is no minute-boundary handoff gap or overlap.
- [ ] Retain exactly one once-per-minute cron entry only as a degraded fallback: it attempts the same flock and runs `timeout --signal=TERM --kill-after=5s 50s .../process-quiz-finalization.sh --once`. While the service is healthy the flock makes this cron a no-op; after a service crash it may perform one bounded sweep while systemd restarts. Neither path may use a different lock or run a second continuous loop.
- [ ] On each loop iteration call `getWakeDecision`. If `due` is false, await `delayMs` and probe again without running finalizers. If `due` is true and `degraded` is false, call `finalizeDueQuizEvents` once and probe again. If `degraded` is true, run one full sweep, then always await its 5-second `delayMs` before probing again so a broken probe cannot create a hot loop. Never call all finalizer RPCs every 5 seconds while a valid probe reports idle. Pass one iteration-scoped `AbortSignal` to both probe and job.
- [ ] Add an exact `QUIZ_FINALIZATION_ITERATION_TIMEOUT_MS = 7000` watchdog around each probe-plus-optional-job iteration. At the deadline, abort the shared controller and mark the process unhealthy. If the iteration settles during a one-second grace period, exit nonzero immediately; if it remains unsettled, invoke the injected/default hard-exit path with code `124` at 8 seconds. Do not continue the loop after a watchdog fires. This bounds flock retention by a hung JavaScript/database operation; systemd then restarts after one second and the cron fallback can acquire the same lock whenever the service is absent. Ordinary thrown/`>=500` iterations that occur before the watchdog retain the five-second retry behavior.
- [ ] `runQuizFinalizationOnce` probes once and runs at most one sweep when due/degraded, making the fallback cron and manual invocation bounded. It uses the same seven-second iteration watchdog and one-second hard-exit grace. `runQuizFinalizationLoop` starts with an immediate probe and otherwise continues until `SIGTERM`/`SIGINT` or watchdog failure. Abort an in-progress delay immediately, do not begin another probe/job after abort, and on an operator signal allow the issued call only through `TimeoutStopSec`; watchdog expiry always takes the bounded nonzero-exit path.
- [ ] Treat a thrown job and a resolved job with `status >= 500` as failed loop iterations. Log one bounded failure and retry after 5 seconds without terminating or spinning. Aggregate only numeric counters and never log customer data or database error detail.
- [ ] Add server-only `QUIZ_OPERATIONS_ALERT_WEBHOOK_URL`, accepting only HTTPS. Put the quiz-worker environment shape and cross-field production requirement in the new below-300-line `quiz-finalization-worker-env.ts`, with direct unit coverage; `env.ts` may only import/compose that contract and must finish with no line-count increase and no inline quiz-worker validation. It is optional while `QUIZ_PHASE=1a`, but the direct-worker preflight must reject `QUIZ_PHASE=production` with `QUIZ_PRODUCTION_APPROVED=true` when it is missing or invalid. Keep it out of every `NEXT_PUBLIC_*` surface, add it to the validated server environment and Turborepo build environment, and never print its value. Record `wc -l` before/after for `env.ts` and fail the slice if the final count grew.
- [ ] Change `process-quiz-finalization.sh` to append `"$@"` when delegating to `run-web-script.sh`; the generic runner already forwards its remaining arguments to `tsx`. Permit only no argument (backward-compatible alias for `--once`) or one of the single exact flags `--loop`, `--once`, and `--test-alert`; reject every other/extra argument before preflight or network/database work, and add wrapper tests proving exact argument forwarding without shell evaluation.
- [ ] Add `promote-direct-worker-checkout.sh` as the mandatory first PR-F release step. It accepts one full 40-character reviewed application SHA, resolves the configured `BACI_REPO_DIR` only on the VPS without printing the path or environment, rejects a dirty/non-git checkout, fetches the exact commit, verifies it is reachable from the reviewed PR-F/main history, records only the previous SHA, checks out the requested SHA detached, and runs `corepack pnpm install --frozen-lockfile` in that checkout. It must never reset, clean, stash, or delete files. If dependency preparation fails, restore the previous detached SHA and reinstall; if rollback fails, stop deployment and emit only a stable operator code. Tests cover invalid SHA, dirty checkout rejection, exact-SHA verification, no secret/path output, successful promotion, dependency-failure rollback, and rollback-failure stop.
- [ ] Send a Slack-compatible operations message when an iteration throws, resolves with `status >= 500`, or reports `liveAwaitingGate > 0` in a production-approved worker. The payload contains only a stable alert kind, numeric counters, worker SHA, and UTC timestamp—no event/customer/merchant identifiers, database error text, headers, or webhook URL. Alert delivery failure must preserve the original nonzero worker outcome and emit only `QUIZ_FINALIZATION_ALERT_DELIVERY_FAILED`; it must never mark finalization successful.
- [ ] Bound alert noise with at most one in-memory send attempt per alert kind inside each durable cooldown window and the exact durable cooldown file `/home/bassey/baci-workers/state/quiz-finalization-alerts.json`. In `prepare-worker-release.sh`, add `--exclude='state'` to both staging/promotion deletion boundaries, then create the persistent `$remote_dir/state` after promotion with mode `0700`; never copy staged state into it. The worker writes a same-directory temporary file, `fsync`s/closes it, atomically renames it, and keeps the final file at `0600`. Treat malformed state as absent and overwrite it only through the same atomic path. Send one recovery message after the first subsequent clean production-approved iteration. Provide an explicit `--test-alert` mode that bypasses cooldown, sends a redacted test payload, and does not run finalizers or mutate cooldown state. A successful deploy alone is not alert proof: record a 2xx test-alert receipt timestamp from the reviewed operations channel before PR H.
- [ ] Add fake-clock tests for due wake-up, exact future-transition wake-up, idle polling, a transition immediately after the old second-55 boundary, degraded probe sweep with five-second backoff, resolved-500 backoff, thrown-job backoff, signal-cancelled delay, signal during an issued job, one failed iteration followed by recovery, cooperative timeout exit, uncooperative timeout hard-exit at eight seconds, no post-timeout iteration, bounded `--once`, one lifetime flock, lock release after watchdog exit, fallback acquisition after watchdog exit, fallback exclusion while service holds the lock, and sanitized summaries.
- [ ] Add alert/service tests named `production_approved_requires_alert_webhook`, `phase_1a_does_not_require_alert_webhook`, `env_composes_quiz_worker_contract_without_inline_validation`, `alerts_on_resolved_500`, `alerts_on_throw`, `alerts_when_live_waits_for_gate`, `deduplicates_alert_within_cooldown`, `malformed_state_fails_safe`, `writes_state_atomically_with_private_mode`, `deploy_preserves_persistent_state_directory`, `wrapper_forwards_modes_exactly`, `rejects_unknown_cli_arguments_before_work`, `service_requires_and_enables_linger`, `service_uses_same_flock_as_fallback`, `service_restarts_after_failure`, `fallback_is_once_only`, `alerts_on_recovery`, `test_alert_bypasses_cooldown_without_mutation`, `test_alert_does_not_run_finalizers`, `rejects_non_https_alert_url`, and `never_includes_sensitive_fields`.
- [ ] Run:

  ```bash
  pnpm --filter @baci/web exec vitest run \
    src/scripts/process-quiz-finalization.test.ts \
    src/lib/quiz/finalize-due-quiz-events.test.ts
  pnpm --dir vps-workers test
  ```

- [ ] Before production-approved worker deployment, the owner provisions `QUIZ_OPERATIONS_ALERT_WEBHOOK_URL` directly on the VPS through an interactive secret editor or approved secret manager under `umask 077`; never place the value in a command argument, shell history, task log, patch, or artifact. Verify the environment file is owner-only `0600`, then run preflight and record only `PRESENT_VALID_HTTPS` or a stable failure code. The currently observed VPS state is `MISSING`, so PR-F code may merge but production-approved deployment and PR H remain blocked until this checkpoint passes.
- [ ] Promote then deploy in this exact order from a clean local checkout at the reviewed PR-F SHA: `bash vps-workers/promote-direct-worker-checkout.sh "$APP_SHA"`, verify the remote application checkout reports exactly `APP_SHA` and clean without revealing its path, then run `bash vps-workers/deploy.sh`. `deploy.sh` must independently reject a remote application SHA mismatch. Verify linger is `yes`; `baci-quiz-finalization.service` is enabled and active on that exact SHA; it has one long-lived PID holding `quiz-finalize.lock`; and it wakes across the old second-55 boundary. Verify crontab contains exactly one same-lock `--once` fallback and that a forced fallback invocation cannot overlap the service. Run `--test-alert` and record the reviewed operations-channel 2xx receipt timestamp without payload or URL. Inject a hanging RPC in the bounded acceptance harness, prove the process exits/releases the flock no later than eight seconds and systemd restarts it, then stop the service in a controlled window and prove the fallback performs one bounded sweep. Before PR G, schedule an owner-approved VPS maintenance reboot, reconnect, and prove from boot/service timestamps that the lingered user unit became active without an interactive login. Main/Vercel deployment alone is not proof that this worker release is installed.

- [ ] After Tasks 12–13 have their two protocol commits and repository/VPS gates pass, open PR F without squashing them:

  ```bash
  git log --oneline origin/main..HEAD
  ```

## PR G — Migration-Only Test-Mode Cutover

### Task 14: Enable v3 test events after web and Metro acceptance

**Files:**

- Create: `supabase/migrations/20260808172000_enable_quiz_v3_test_cutover.sql`
- Create: `supabase/migrations/tests/quiz_v3_test_cutover.sql`
- Create: `apps/web/src/lib/quiz-v3-test-cutover-migration.test.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

**Interfaces:**

- Consumes the false/false `quiz_v3_cutover_state()` from Task 5 and the fully deployed clients/results/worker from PRs D–F.
- Produces exactly `{ "testEnabled": true, "liveEnabled": false, "minimumLiveMobileVersion": null }`.

- [ ] Write migration-source and SQL tests named `enables_test_without_live`, `rejects_live_v3_activation`, `allows_test_v3_activation`, `lists_test_v3_events`, `preserves_v2_contracts`, `preserves_v3_grants`, and `replays_idempotently`.
- [ ] Re-run web and Metro acceptance while both flags are false, then merge this migration-only PR. The normal production workflow may apply it immediately because all required code is already deployed and live mode remains disabled.
- [ ] After production application, create one v3 test quiz and complete both timing modes on web and the dev build. Record event id, deployed web SHA, database migration version, the exact mobile source checkout SHA served by Metro, dev-client application id/version/build number, device platform/OS, and acceptance timestamp; record no customer PII. Do not call Metro a signed or immutable bundle artifact.
- [ ] If acceptance fails, merge a new append-only migration returning both flags to false. Its regression must prove new v3 test events disappear from lists and new starts receive `QZ049`, while an attempt started before rollback can still resume, answer, expire, retrieve its published result, and retrieve its final leaderboard. Never edit or reverse the applied migration in place.
- [ ] Commit `feat(quiz): enable contract v3 test events` and open PR G with no web/mobile runtime files.

## PR H — Migration-Only Live-Mode Cutover

### Task 15: Enable v3 live events after signed mobile release proof

**Files:**

- Create: `supabase/migrations/20260808173000_enable_quiz_v3_live_cutover.sql`
- Create: `supabase/migrations/tests/quiz_v3_live_cutover.sql`
- Create: `apps/web/src/lib/quiz-v3-live-cutover-migration.test.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-quiz-live-pending-sources.test-support.ts`

**Interfaces:**

- Consumes the true/false test cutover and the verified signed iOS/Android storefront release produced only after Task 11/PR E (candidate `2.0.2` if still unused).
- With the currently reserved candidate, produces exactly `{ "testEnabled": true, "liveEnabled": true, "minimumLiveMobileVersion": "2.0.2" }`. If Task 11 or store submission selects a later release, update this plan in a docs-only amendment before implementing PR H so the migration always contains one reviewed literal value.

- [ ] Do not create or merge PR H until App Store Connect and Google Play both show the exact post-PR-E release version/builds available to the intended production audience, their recorded source SHA contains PR D and PR E, production web plus those exact installed builds pass v2 and v3 read-only smoke tests, and the PR-F VPS worker has delivered a successful redacted `--test-alert` to the reviewed operations channel. Record store version/build identifiers, source SHA, installed application ids, deployed web/worker SHAs, database migration version, alert receipt timestamp, and acceptance timestamps without customer PII.
- [ ] With candidate `2.0.2`, write tests named `enables_live_with_minimum_2_0_2`, `rejects_android_2_0_1`, `rejects_ios_2_0_1`, `accepts_android_2_0_2`, `accepts_ios_2_0_2`, `does_not_apply_mobile_version_to_web`, `preserves_test_cutover`, and `replays_idempotently`; if Task 11/store submission selected a later version, rename the version-specific tests and fixtures to the exact preceding/current versions.
- [ ] Merge this migration-only PR only after regulatory/prize production gates and the worker alert-delivery gate are independently green. Logs without a verified delivered alert are not sufficient for live prize operation. The normal deployment may apply it immediately because every compatible runtime is already released.
- [ ] After application, launch one short production-approved live event, verify stale mobile versions receive `426 QUIZ_APP_UPDATE_REQUIRED`, and verify web plus released mobile complete timing, final score, prize outcome, and final leaderboard.
- [ ] If live acceptance fails, merge a new append-only migration setting `liveEnabled` false while leaving `testEnabled` true. Its regression must prove live v3 disappears for new entrants and new starts receive `QZ049`, while existing live v3 attempts continue through answer, expiry, finalization, prize outcome, result, and leaderboard. Never edit the applied live migration.
- [ ] Commit `feat(quiz): enable contract v3 live events` and open PR H with no web/mobile runtime files.

## Per-PR Verification and Rollout

- [ ] Before each PR, refresh `origin/main`, rebase the isolated branch, verify no migration timestamp collision, and rerun the PR's focused tests.
- [ ] Run repository gates from the worktree root:

  ```bash
  pnpm turbo lint
  pnpm turbo typecheck
  pnpm turbo test
  coderabbit review --agent -t uncommitted
  git diff --check
  ```

- [ ] PR B deployment order is the contract-v3 database migration first, then the dark web/API handlers. Verify header 2 still works and `quiz_v3_cutover_state()` returns false/false/null; do not change player clients or authoring yet.
- [ ] PR C deploys the dormant authoring adapter while both mode flags are false. Verify existing v2 generation/activation remains unchanged and forged v3 test/live activations receive `503 QUIZ_V3_CUTOVER_NOT_READY`.
- [ ] PR D deployment order is web dual-stack client, then mobile/Metro dual-stack bundle. While both mode flags are false, verify both clients still discover and play v2 events and can perform a v3 read-only API smoke without enabling authoring.
- [ ] PR E deploys web post-game UI and the mobile/Metro post-game bundle while both v3 mode flags remain false. Verify v2 post-game behavior and v3 read-only response parsing on both clients; PR E contains no cutover migration. Signed iOS/Android candidates may be created only from a clean exact post-merge SHA containing this deployment.
- [ ] PR F deployment order is database probe migration, web worker artifact, secure alert-secret provisioning, exact application-checkout promotion with `bash vps-workers/promote-direct-worker-checkout.sh "$APP_SHA"`, independent remote clean/SHA verification, then `bash vps-workers/deploy.sh`. Record the deployed SHA and alert receipt timestamp; verify the enabled systemd user service has one long-lived PID holding `quiz-finalize.lock`, crosses minute boundaries without a scheduling gap, and shares that same lock with exactly one bounded once-per-minute cron fallback. PR G remains blocked until this proof exists.
- [ ] Before PR H, run the deployed worker's `--test-alert` mode and verify the reviewed operations destination received the stable redacted payload. A cron log line, HTTP transport attempt, or local 2xx without destination receipt is not alert-delivery proof.
- [ ] PR G and PR H are migration-only cutovers. Because the repository applies migrations before web deployment, they must not contain runtime code and must merge only after their prerequisite runtime/release evidence is already live.
- [ ] Never tell the user to test contract v3 until PR G is applied and `testEnabled` is confirmed true alongside the database runtime, web deployment, and Metro bundle. Never describe live v3 as ready until PR H and the exact post-PR-E mobile release are independently confirmed.
- [ ] Run web and device acceptance with one v3 test quiz of 3 questions × 5 seconds: derived duration 15 seconds, unanswered timeout advances, universal zero exits play, results appear automatically, and final score/rank/leaderboard render without another tap.
- [ ] Run web and device acceptance with 3 questions and one 30-second total timer: no per-question timer, immediate answer advance, late entry starts question 1 with only remaining time, and universal zero exits play.
- [ ] Schedule one test event in `Africa/Lagos` while the admin browser runs in a different system time zone and verify the confirmation, database instant, lobby opening, and displayed close all describe the same event. Unit regressions must separately reject a known DST gap and repeated minute even though production acceptance uses Lagos.
- [ ] Background each mode for longer than its remaining duration and foreground it; the app must reconcile immediately rather than resume a paused timer.
- [ ] Verify v2 historical quizzes and leaderboards remain readable through header 2 and are not rewritten by the v3 migration.
- [ ] After PR F production deployment, verify worker logs and database timestamps demonstrate healthy-dependency test publication within 5 seconds and healthy-dependency live publication within 10 seconds. Separately prove a synthetic hung RPC releases the flock by eight seconds and the service restarts; do not claim the publication SLO while PostgreSQL/network dependencies are unavailable. If the live compliance/prize gate blocks, show the friendly delayed-results state and keep the board hidden.
- [ ] Run identity acceptance with the merchant-owner account that also has an Ogabassey customer row, an invited customer tester, and an unrelated authenticated account. The first two may enter the test event; the unrelated account and a platform-admin-only account without merchant ownership/staff/test invitation may not. Verify a caller cannot retrieve another customer's attempt result or a leaderboard from another merchant.
- [ ] In the production-phase acceptance environment, verify both contract-2 and contract-3 starts pass through the same prize and age guards and render the same friendly correction state. Phase-1a/test acceptance must remain consistent with the currently approved shared-guard policy; this timing rollout must not silently create a second eligibility policy.
- [ ] For a v3 test event permitting at least two attempts, complete a higher-scoring attempt followed by a lower-scoring attempt. Let the event close from the second attempt and verify the automatic result shows the second attempt separately, uses the first attempt's best score/rank for standings, and does not enter the unavailable/error state.

## Acceptance Criteria

- A current v2 question timeout advances or completes exactly once; universal zero always exits the playable state.
- Existing contract-v2 events and clients retain their original timing behavior.
- V3 test activation remains disabled until PR G; v3 live activation remains disabled until PR H and rejects mobile versions below the exact signed post-PR-E release version recorded after Task 11.
- A new 20-question per-question quiz at 10 seconds each lasts exactly 200 seconds (3 minutes 20 seconds).
- A new total-mode quiz has one universal timer and no per-question countdown.
- Admins cannot separately configure a contradictory duration or universal end.
- Late entrants start at question 1 with only universal time remaining.
- Backgrounding or screen recording does not pause the server-authoritative timer; no automatic disqualification is introduced in this scope.
- At close, the app shows `Calculating results…`, then automatically shows authoritative score, rank, prize outcome, and final leaderboard.
- No score, rank, correct answer, provisional leaderboard row, or prize result appears before publication.
- The leaderboard is final rather than live; the client accepts one successful post-publication response, with the current player highlighted even outside the top list.
- A transient final-leaderboard failure retries on the bounded 0/2/4/8-second schedule and leaves a manual retry without hiding the authoritative score.
- A non-best test attempt still resolves after publication: the UI distinguishes that attempt's score from the customer's best score and leaderboard rank.
- Privileged finalization remains service-only, idempotent, non-overlapping, and normally publishes within the verified latency targets.
- Live prize cutover is impossible until the exact VPS worker release has delivered a redacted test alert to the reviewed operations channel; logs alone never satisfy this gate.
