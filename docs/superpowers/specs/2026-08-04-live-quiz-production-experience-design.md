# Live Quiz Production Experience — Design

**Date:** 2026-08-04

**Status:** Proposed; latest rereview completed against remote `origin/main` on 2026-08-04

**Repo baseline:** remote `origin/main` at `8ce55c67703370f460767f2ddcd8f487db466050`

**Scope:** Merchant quiz authoring, server-authoritative timing, mobile storefront lobby and play flow, web storefront behavioral parity, rules and consent, username and leaderboard behavior, prize safety, test mode, database access controls, and production launch controls.

## Executive Decision

Baci will treat a quiz as a short, scheduled live event with two simultaneous clocks:

1. a universal event window shared by every player; and
2. a customizable per-question timer.

Every player starts at question 1, including late entrants. A late entrant does not jump to the question other players may be answering. Instead, the player sees the universal time remaining and receives at most the configured time for each question. The effective deadline for every question is:

```text
minimum(question issued time + time per question, universal event end)
```

For example, a quiz scheduled from 9:00 PM to 9:05 PM with 20 questions and 10 seconds per question has a maximum individual play time of 3 minutes 20 seconds. A player joining at 9:04 PM starts at question 1 but has only one minute before every attempt closes.

The server, not the phone, decides whether an answer is on time and when an event is over.

### Re-review Safety Invariants

Current-main review adds these non-negotiable boundaries:

- every new player-visible event is `contract_version = 2`, and old clients cannot discover or start it;
- launch is one database transaction using the database clock; a merchant client cannot directly edit status, start/end, compliance, prize, or reviewed answers;
- every reconciled/new migration is hash-bound into current main's replay source and expected-source registries in the same commit;
- test-event isolation and result hiding are enforced by grants/RLS and safe RPC projections, not only by API response shaping;
- there is at most one started attempt per event/customer, and refresh/process death resumes that attempt without extending its current question deadline or consuming another attempt;
- a review receipt is bound to the full canonical stored variant content; editing or regenerating any review-relevant content invalidates the receipt;
- full-draft generation is an authorized, leased, checkpointed worker job; the web request only enqueues it, and quiz tables receive one complete pool or nothing;
- quiz-generation rows/checkpoints are excluded from direct authenticated `ai_jobs` reads and are visible only through a bounded permission-checked status projection;
- answer submission never returns correctness, score, rank, winner, or claim while results are unpublished and never mints the v2 prize;
- a dedicated owner result endpoint is the only post-close score/rank/claim retrieval path;
- safe test closure/publication runs even when live production approval is disabled, while live award code remains fail-closed;
- never-opened scheduled events and merchant-cancelled events reach explicit non-awarding terminal states and cannot strand a prize hold;
- start/resume/answer, cancellation, test reset/tester revocation, and finalization share an event-first lock order, so boundary races cannot deadlock or leave post-termination awardable work;
- one launch hold becomes at most one ranked product award, with a database uniqueness invariant and persisted claim expiry;
- player and authoring schema readiness are separate markers created only after their complete RPC sets exist.

## Why This Design

An open-ended or excessively long live window makes it easy for one person to record questions and pass answers to another account. A synchronized universal question number would reduce that risk but would punish late entrants by dropping them into the middle of the quiz. The chosen design preserves a comprehensible late-entry experience while limiting the usefulness of replay and answer sharing.

The remaining anti-cheat protection comes from one attempt for live prize events, multiple reviewed variants per logical question, shuffled option order, hidden results until the universal end, identity/device caps, and server-authoritative timing.

## Goals

1. Let a merchant create, review, schedule, test, and launch a quiz entirely from the admin app.
2. Make every time field unambiguous, especially “Time limit per question (seconds).”
3. Support 20 questions on one topic and up to 50 logical questions in one event.
4. Make the prize picker search the merchant's full active inventory, including variants and product condition.
5. Keep large question reviews inside a bounded, scrollable review panel.
6. Give mobile players a polished prize-first lobby with an actual product image.
7. Explain event-specific rules without forcing a blocking modal before the player sees the lobby.
8. Collect username, age eligibility, and versioned rules acceptance in one “Ready to play?” step.
9. Preserve fair historical leaderboards even when a player later changes username.
10. Provide a safe production test mode that cannot award real prizes or appear to ordinary shoppers.
11. Keep live prizes fail-closed until operational and legal approvals are present.
12. Make the full flow testable on the installed development client through Metro on port 8082.
13. Keep the existing web storefront on the same v2 timing, readiness, answer-lock, result, and leaderboard rules so it cannot bypass mobile safeguards.
14. Prevent direct authenticated database access from revealing test events, live score/correctness, permit details, or mutable launch fields.
15. Let a merchant correct or regenerate a bad AI variant and require a fresh full-content approval before launch.
16. Recover the exact active question after browser refresh or mobile process death without consuming another attempt or extending time.

## Non-goals

- Charging loyalty points or requiring a purchase. Entry remains free.
- A universal synchronized question number. Late players always begin at question 1.
- Preventing screenshots or screen recording at the operating-system level. The design limits the value of recordings but does not claim to make recording impossible.
- Camera proctoring, invasive identity verification, or collecting unnecessary personal data.
- Making Kuda, VTU, or unrelated storefront services part of quiz availability.
- Weakening the production prize compliance guard to make development easier.
- Replacing Nigerian legal review with product copy or code.

## Product Terminology

- **Logical question:** One scored position in the quiz.
- **Variant:** One reviewed wording/options set that can fill a logical question slot.
- **Time per question:** The merchant-configured maximum time after a question is issued.
- **Maximum play time:** `logical question count × time per question`.
- **Live window:** `endsAt - startsAt`, shared by all entrants.
- **Universal end:** The event's immutable `endsAt` once launched.
- **Live mode:** Public, compliance-gated, prize-bearing production behavior.
- **Test mode:** Restricted, visibly watermarked behavior with no award side effects.

## Event Modes and State Model

Every new event has an explicit mode:

```text
mode: test | live
```

The admin defaults to **Test quiz**. Test events default to one variant per logical question and 10 attempts, with explicit bounds of 1–3 variants and 1–50 attempts. Live v1 events use three reviewed variants and exactly one attempt. A merchant must deliberately switch to Live and still satisfy every compliance and inventory gate.

The lifecycle remains:

```text
draft -> scheduled -> active -> completed
                         \-> cancelled
```

Rules:

- A draft is never player-visible.
- A scheduled event becomes active when `startsAt` passes and remains startable only before `endsAt`.
- An active event becomes completed at the universal end after in-progress attempts are finalized.
- The player-facing state between `endsAt` and `resultsPublishedAt` is `finalizing`; no score, rank, or claim is exposed in that state.
- A cancelled event cannot be started and cannot mint a prize.
- Cancellation is available only while database time is before the universal end and finalization has not started. All lifecycle mutations lock event, then attempt/question, then reservation/award rows. Cancelling a scheduled event releases its hold. Cancelling an active event atomically terminalizes started attempts as non-ranking, publishes no standings, and makes result/leaderboard access unavailable; a concurrent answer either commits first and is then made non-ranking or observes cancellation. Repeated cancellation is idempotent. At or after the universal end, finalization owns the outcome even if the worker has not yet advanced the displayed status.
- A scheduled event that nobody opens is still selected by the direct worker after `endsAt`, records no eligible winner, and releases its hold exactly once.
- Test events are visible only to authorized testers and merchant staff who also have a customer identity for the storefront.
- Live events are visible only when their event-level and environment-level compliance gates pass.
- Test events never reserve, mint, approve, or expose a redeemable prize award.
- First release permits only one scheduled/active quiz window per merchant at a time, including any still-supported legacy event. Non-overlapping future events are allowed; a database-backed overlap guard handles concurrent launches so the lobby never has to guess between simultaneous primary events.
- At most one attempt per event/customer may have status `started`. A repeated Start while one exists is a resume, not another attempt; a new test try is available only after the prior attempt is terminal.

## Timing Model

### Admin Inputs

The launch dialog collects:

- launch immediately or schedule for later;
- start date/time when scheduled;
- universal close date/time, or a live-window duration that computes it;
- merchant/event IANA timezone;
- time per question, configured earlier in seconds.

All timestamps are persisted as UTC instants. The admin sees and enters them in the merchant timezone, defaulting to `Africa/Lagos` for Ogabassey.

### Suggested Live Window

The admin UI calculates:

```text
maximumPlaySeconds = logicalQuestionCount × timePerQuestionSeconds
defaultLiveWindow = round up to a whole minute(maximumPlaySeconds + 90 seconds)
```

For 20 × 10 seconds:

```text
maximum play time = 200 seconds = 3m 20s
suggested live window = round up(200 + 90) = 5 minutes
```

The live window must be:

- at least maximum play time plus 30 seconds of network/join grace; and
- no more than maximum play time plus 2 minutes.

There is no live-mode override in the first release. Test mode may use shorter windows for QA but can never end before the first configured question window.

### Player Semantics

- A player may join at any point after `startsAt` and before `endsAt`.
- Every attempt starts at logical question 1.
- The global countdown always targets `endsAt`.
- The question countdown targets the earlier of its own deadline and `endsAt`.
- If the event ends while a question is visible, the question is forfeited, the attempt is finalized, and no further question is issued.
- If the app backgrounds, reconnects, or resumes, both countdowns are recomputed from server timestamps and a server-clock offset.
- Client clocks are display aids only. PostgreSQL time is authoritative for acceptance, scoring, event closure, and ranking.

### Server Time Contract

Event, start, and answer responses include `serverNow`. Start and answer responses also include `eventEndsAt`. The client derives a clock offset from `serverNow` and never extends a deadline because the device clock is wrong.

## Merchant Authoring Experience

### Form

The admin screen contains:

- Quiz title
- Prize product search
- Difficulty
- Time limit per question (seconds)
- Questions per topic
- Topic tags
- Mode: Test quiz or Live prize quiz
- Variants per logical question, defaulting to 1 in test mode and 3 in live mode
- Maximum attempts, fixed to 1 for live prize mode and configurable/resettable in test mode

Test attempts default to 10 and are bounded from 1 to 50. A reset preserves the old attempt as `test_reset` for audit, excludes it from the test cap/ranking, and is impossible for live events.

The form shows a live summary:

```text
20 questions
10 seconds per question
Maximum play time: 3 minutes 20 seconds
3 reviewed variants per question
1 attempt per player/device/email identity
```

### Topics

Topics are chips, not a multiline textarea.

- Placeholder: “Type a topic and press Enter”
- Enter and comma create a tag.
- Backspace removes the final tag when the input is empty.
- Duplicate tags are rejected case-insensitively.
- Maximum 10 topics, 80 characters each.
- “Questions per topic” is multiplied by the number of topic tags.
- One topic can have 20 questions.
- Total logical questions cannot exceed 50.

### Prize Product Search

The picker performs debounced, server-side search over the merchant's complete active inventory rather than loading only the latest 100 products.

Each result includes:

- thumbnail;
- product name;
- exact variant when applicable;
- price;
- condition (`new`, `used`, `open_box`, or `refurbished`);
- inventory availability;
- stock/inventory tracking mode.

Variant-backed products require an explicit variant. Image precedence is selected variant image, then product primary image, then a branded fallback. The selected name, variant, condition, and image URL are snapshotted onto the event so later catalog edits do not silently change an advertised prize.

Live launch revalidates product ownership, active status, variant relationship, condition, and stock. One prize unit is reserved for the event when inventory is finite. Test mode validates ownership, active product/variant identity, condition, and image but creates no inventory reservation or stock mutation; unavailable stock appears as a “would block live launch” diagnostic rather than making QA prize-bearing. A live event cannot launch if its promised prize cannot be reserved.

### Generation and Variant Pools

“Question count” always means logical question count. Live prize events generate three variants for every logical slot by default. Test events may use one variant for faster iteration.

The generator must:

- identify each logical slot by topic and ordinal;
- produce the requested number of distinct variants for that slot;
- keep every variant in one slot on the same factual objective and at equivalent difficulty;
- keep every prompt, option set, correct option, and explanation within the validated schema;
- reject duplicate or near-duplicate variants within the same slot;
- produce stable option IDs while allowing presentation order to be shuffled per attempt;
- fail the draft rather than silently create an incomplete variant pool.

Generation is batched so 50 logical questions × 3 variants cannot exceed one provider request's safe output budget, but the full pool does not run inside the existing 120-second web route. The authenticated route validates, passes the existing distributed five-per-minute route limiter, then calls a narrow enqueue RPC with the existing short-lived quiz proof bound to job ID, actor, merchant, idempotency key, and normalized input. Under a merchant lock, the RPC enforces one active job and a named default of 10 newly authorized jobs per rolling 24 hours, validates the proof immediately, and stores only an immutable database authorization receipt with the signed payload hash—never a reusable signature—before the route returns `202`. Exact replay returns the same job without consuming quota. A trigger rejects direct `quiz_variant_generation` inserts/conversions and later input/identity/receipt mutation. Existing owner access to `ai_jobs` is narrowed to exclude this type, no direct authenticated row policy is added for it, and a permission-checked safe-status RPC returns only bounded progress/status/final draft ID. Thus neither raw PostgREST nor the generic AI-jobs creator/list endpoint can create a quiz job or read its checkpoint, input, output, receipt, lease, or answer content.

A dedicated direct VPS worker reuses Baci's existing `ai_jobs` lease, retry, and backoff model. It accepts only rows with the database authorization receipt, recomputes the signed payload hash with the route's shared TypeScript canonicalizer, and revalidates the actor's current merchant permission before spend and persistence. It claims one job, uses small bounded provider concurrency and per-call timeouts, validates every batch, and checkpoints only complete schema-valid batches while extending its lease. A stale worker cannot persist after losing the lease. A cancelled or terminally failed job leaves no quiz draft; a reclaimed job resumes from its last valid checkpoint. One attempt has a ten-minute budget, and the pre-production smoke must prove both 20 × 3 and 50 × 3 behavior rather than assuming provider speed.

Only after every expected slot/variant is present, distinct, and valid does a private worker-only transaction persist the draft, slots, and variants and bind them to the unique generation job ID. An exact retry returns that draft instead of duplicating it. The admin shows queued/progress/failed/cancelled states, polls at a bounded three-second visible cadence with error backoff/hidden-tab pause, resumes after page reload, and opens review when the complete draft exists. Authorization receipts and partial answer content never appear in the status API or logs. Completion, terminal failure, and cancellation erase checkpoint content while retaining only bounded receipt/input-digest audit metadata and the final draft ID when applicable. A one-card corrective regeneration remains one bounded provider request and preserves the current card on failure.

### Human Review

Every generated variant is displayed with its AI-marked correct answer and explanation. The review list sits in a container with a maximum height of 60 viewport units and its own scrollbar. The page and launch controls do not move several screens below a large draft.

Review must be corrective, not a read-only acknowledgement. Every variant card provides:

- **Approve** after checking same objective/equivalent difficulty, unambiguous wording, exactly one correct answer, and an accurate explanation;
- **Edit** for prompt, option labels, correct option, and explanation; and
- **Regenerate** for one replacement variant in the context of its slot and existing siblings.

Invalid edits, duplicate replacements, or provider failures preserve the existing stored variant. A successful edit/regeneration creates an audit revision and invalidates the affected receipt. If shared slot metadata changes, every receipt in that slot is invalidated.

The footer beneath the review area remains visible and contains:

- review progress, for example “57 of 60 variants reviewed”;
- a derived “All current variants approved” state only when every active receipt matches the current stored revision/content hash; and
- “Launch quiz” button.

The launch button remains disabled until every variant has been explicitly reviewed. Review is tied to the draft ID, variant ID, stored revision, reviewer, and a database-computed canonical content hash covering slot review metadata, prompt, ordered option IDs/labels, the protected `answer_key_hash`, and explanation. The database does not add or expose a plaintext correct-answer column. For an authorized merchant review response after reload, a server-only/definer boundary may resolve the one option ID whose hash matches the stored answer hash; customer endpoints receive neither value. A client-supplied answer letter alone is insufficient. A global checkbox or receipt from older/different content cannot authorize launch.

### Launch Dialog

“Open now” is replaced by “Launch quiz.” Clicking it opens a confirmation dialog instead of changing status immediately.

The dialog shows:

- Test or Live mode
- quiz title
- prize and condition
- logical question count
- variants per question
- time per question
- maximum play time
- start time
- universal end time
- live-window length
- late-entry explanation
- attempt limit
- topics and difficulty
- merchant timezone
- compliance status for live mode
- tester allowlist for test mode
- approved claim window for live mode

Launch is one idempotent database transaction. The web route checks the live environment gate and signs a route proof bound to the authenticated user and normalized launch payload; scheduled payloads contain exact UTC instants, while immediate payloads contain a window duration and no client-authored start instant. The RPC verifies that proof so a direct Supabase call cannot bypass the gate. It derives the merchant/staff identity from `auth.uid()`, locks the draft, active variants, canonical-content review receipts, and prize stock, computes immediate start/end from the database clock, verifies every receipt and compliance input, reserves the prize only for live mode, and then writes immutable start/end/mode/rules/prize/ranking snapshots plus status. Any failure rolls back all launch effects.

The success state is a dialog/toast:

- “Quiz launched” for immediate events; or
- “Quiz scheduled for [localized date and time]”.

It includes actions to copy a test link where applicable and view the storefront quiz.

Scheduled and active event controls include a destructive “Cancel quiz” action with an impact confirmation. The authenticated route accepts a bounded reason and calls one permission-checked transaction. Cancellation succeeds only before the universal end; it releases one untransferred hold and, for an active event, ends current attempts without standings or an award. Once the universal end is reached, the action is unavailable and the server refuses it so the merchant cannot cancel after the scoring outcome is fixed.

## Web Storefront Compatibility

The existing Ogabassey web quiz remains supported and moves to the same v2 backend contract before v2 events become discoverable. It sends contract header 2, provides username/DOB/rules readiness, uses the first-party quiz device cookie, starts late entrants at question 1, displays both deadlines, submits and locks on the first answer tap, hides live results, retrieves the post-close result from the dedicated endpoint, and uses the final leaderboard RPC. An older web bundle receives only contract-v1 events and cannot bypass these gates. The A+C visual redesign is mobile-specific; web parity is behavioral and security-critical.

## Mobile Lobby Experience

The design combines the prize-led direction of concept A with the time-sensitive prize language of concept C.

### Navigation

- Native title: “Quiz”
- Back control on the left
- Trophy/leaderboard icon on the right
- The global chat/AI widget and drawer/settings floating controls are suppressed throughout the quiz funnel so they cannot cover quiz content.

### Prize Hero

The repeated body heading “Super Quiz” and the large “Entry / Free to enter” panel are removed.

The top of the lobby contains:

- a time-sensitive kicker;
- “Win a [product name]” headline;
- the real prize product image, tilted approximately 9 degrees with a restrained shadow;
- a prominent condition label when the prize is not new.

Time-sensitive kicker rules use `serverNow` and the event start in the event timezone:

- active now before 5:00 PM local: “Today's prize”
- active now from 5:00 PM local: “Tonight's prize”
- scheduled later today before 5:00 PM: “Today's prize”
- scheduled later today from 5:00 PM: “Tonight's prize”
- starts tomorrow: “Tomorrow's prize”
- later: “[Weekday]'s prize”

The image uses [`expo-image`](https://docs.expo.dev/versions/latest/sdk/image/), `contentFit="contain"`, memory/disk caching, a fade transition, and a fallback asset. The source image is not edited or permanently skewed; the view transform creates the angle.

### Active Event Card

One active event receives the spotlight treatment:

- LIVE or TEST QUIZ badge
- event title
- “Quiz closes in 04:32”
- exact “Ends 9:05 PM” line
- question count
- configurable seconds per question
- calculated maximum play time
- primary CTA: “Play for free”
- beneath the CTA: “Every second counts.” and “View rules”

When the signed-in customer already has a recoverable started attempt, the CTA becomes “Resume quiz” and returns directly to server state without showing a new acceptance/start flow. A lobby left open schedules a bounded server refresh at the next `startsAt`/`endsAt` and refreshes on app foreground, so scheduled, playable, and closed/finalizing states transition without restarting the app or waiting for the minute worker.

“10 seconds per question” appears only once in the facts. It is not repeated under the button.

Scheduled and closed events appear in compact sections below. Closed cards use muted controls, never an orange button that looks actionable. Past cards link directly to their final leaderboard.

## Rules and “Ready to Play?”

### Rules Placement

There is no mandatory rules popup before the lobby. Players must first be able to see the event, prize, timing, and availability.

- “View rules” opens an event-specific bottom sheet at any time.
- “Play for free” opens a unified “Ready to play?” sheet.
- Full terms remain reachable by link from both sheets.

### Rules Content

The event-specific rules explain:

- free entry and no purchase requirement;
- 18+ eligibility and any geographic restriction approved by counsel;
- question count;
- time per question;
- universal end and late-entry behavior;
- answers lock immediately when tapped;
- attempt limit;
- score-then-speed ranking and deterministic tie handling;
- result/leaderboard publication after the universal end;
- prize name, exact variant, and condition;
- claim window and fulfillment process;
- prohibited conduct and disqualification;
- cancellation/technical-failure policy;
- privacy purpose for username, date of birth, device anti-abuse signal, and acceptance receipt.

### Unified Readiness Sheet

The “Ready to play?” sheet replaces the current sequential username and DOB modals while preserving their server safeguards.

It shows:

- “Playing as @username” with Edit for returning players;
- username input and validation when missing;
- date of birth input only when a valid value is missing or rejected;
- a concise 18+ explanation;
- question count, time per question, global time remaining, and exact end;
- one-attempt rule;
- answer-lock behavior;
- score-then-speed ranking;
- required unchecked checkbox: “I agree to the Quiz Rules and Prize Terms & Conditions.”

“Start quiz” remains disabled until username, age eligibility, rules version, and the checkbox are satisfied. Opening the sheet does not create an attempt or start either timer. The attempt begins only when “Start quiz” is tapped.

Marketing consent is separate, optional, and never bundled into this checkbox.

### Acceptance Receipt

Each attempt snapshots:

- customer/attempt identity;
- accepted rules version;
- acceptance timestamp generated by the server;
- app version and platform;
- leaderboard username at start.

The system does not collect IP address solely for rules acceptance. If the rules version changes, a new attempt must accept the new version.

## Username Policy

- Usernames remain merchant-scoped, case-insensitively unique, 3–20 characters, and restricted to the existing safe character rules.
- A first username can be created immediately.
- A username change has a 30-day cooldown.
- A username cannot change during an active attempt.
- The profile UI shows the next eligible change date when blocked.
- An attempt snapshots the username used at start.
- Historical leaderboards render the snapshot, so changing a profile username does not rewrite past results.
- “Immutable” applies to ordinary profile renames, not to privacy/account-deletion or moderation obligations. A soft-deleted customer or audited public-display suppression renders the same stable anonymous alias while preserving internal ranking/award evidence.
- Legacy attempts without a snapshot display a stable anonymous alias. They never fall back to a full legal name or email on a customer-facing leaderboard.

## Gameplay

### Answer Interaction

Tapping an answer is the submission action.

1. The option immediately enters a selected/locked state.
2. All options become disabled.
3. A light haptic and short visual acknowledgement are shown.
4. The answer is sent once with an idempotent/replay-safe request.
5. On success, the next question replaces the current one immediately.

There is no separate “Submit answer” button. A player cannot change the selected answer while a request is pending. A transport failure retries the same locked answer; it never permits a second choice for the same question.

If no answer is tapped before the effective question deadline, the client sends the existing timeout sentinel when possible. The server still finalizes the question correctly if that request arrives late or never arrives.

### Reload and Process-Death Recovery

Browser refresh and mobile process death are supported gameplay paths. The database permits only one `started` attempt per event/customer. A repeated Start while it exists, or the owner-safe active-attempt endpoint, resumes that row instead of consuming another attempt.

The client persists only an account/event-bound recovery envelope: attempt ID, original start request ID, current question ID, and a pending locked option ID when needed. It writes the locked option before network submission and never persists question/option text, answer keys, username, DOB, raw device signal, invite token, or claim token. On recovery, server state wins:

- an unexpired issued question returns with its original issued time, option order, and deadline;
- an expired issued question is forfeited once and the next question is issued at database time when universal time remains;
- an answer already committed before a lost response returns the committed next state;
- a locally locked answer is resent only if the server still reports that exact question unanswered; and
- an ended, reset, revoked, or cancelled event returns a terminal state and no question.

Recovery never resets a per-question clock or changes a locked answer.

### Gameplay Header

The active question view displays:

- Question X of Y
- global “Quiz ends in” countdown
- per-question countdown
- progress indicator
- question and options

The global countdown becomes visually urgent near the universal end. The per-question timer remains the more immediate action cue. Screen-reader announcements are throttled to useful thresholds rather than every 250 ms tick.

### Results During a Live Event

Correct answers, explanations, score, rank, and winner identity remain hidden until the universal end. After an attempt finishes early, the player sees:

```text
Answers locked
Final standings will be available after 9:05 PM.
```

The live leaderboard shows “Standings available after close” and no rankings. Test mode follows the same behavior so it exercises the real production path.

When the event end has passed but finalization has not published, the UI says the quiz is finalizing and polls only on a bounded cadence. `GET /api/quiz/attempts/{attemptId}/result` remains `pending` until the authenticated owner's result is publishable. After publication it returns score and rank; only an unexpired live winner receives a claim token. An answer POST is never used to discover a delayed prize.

V1 does not publish answer keys, per-question correctness, or AI explanations to players even after close; those remain merchant-review data so completed quizzes do not become an answer bank for reused variants.

## Leaderboards

The trophy icon opens a leaderboard archive.

### Archive

- Lists completed quizzes newest first.
- Shows date, title, prize, winner username when publishable, and “View leaderboard.”
- Test events are excluded from the public archive.
- Testers can reach a test event's private results from its test card.

### Final Board

- Published only after the universal end and event finalization.
- Uses each customer's best clean, within-window attempt.
- Orders by highest score, then fastest completion, then earlier submission, then deterministic attempt ID.
- Shows top 100.
- Highlights the signed-in player.
- Returns a separate pinned “Your position” row when the player is outside the top 100.
- Uses snapshotted username or a stable anonymous alias, never a real-name fallback.
- Does not remove/reorder a historical result merely because its customer profile was soft-deleted; only the public display handle is suppressed.

## Prize Selection and Awarding

The advertised product is one event prize for one winner in the first release.

Live product prizes are not awarded immediately to every perfect scorer. At the universal end:

1. all started attempts are finalized;
2. clean attempts are ranked;
3. the top-ranked eligible player receives the only `ranked_product_v2` award for the event;
4. the launch-time hold is atomically transferred into the existing reserved-order/voucher fulfillment path for the exact snapshotted product, variant, condition, and serialized unit when applicable;
5. the event publishes final standings only after award finalization succeeds or reaches a clearly recorded no-winner state;
6. the signed claim expires at the persisted `claim_expires_at`, which is derived from the counsel-approved claim window snapshotted at launch.

Test mode never calls prize reservation, award minting, voucher signing, or claim APIs. Database guards also reject any reservation or award tied to a test event, so a future internal caller cannot accidentally make test mode prize-bearing.

If no eligible attempt exists, the event records “No eligible winner” and releases the hold. If an advertised finite-stock prize cannot be reserved at launch, the live event cannot launch. A permitted pre-end cancellation and unclaimed expiry release the exact hold/reserved order through existing inventory operations and retain an audit record; cancellation at or after the universal end is refused. Claimed awards remain immutable. V1 does not automatically promote the next-ranked player after claim expiry; any replacement requires an audited operations action permitted by the approved terms. A partial unique database index—not application logic alone—enforces at most one ranked v2 product award per event. The approved claim-window duration and unclaimed-prize policy remain owner/legal release inputs; the implementation does not invent them.

## Anti-cheat and Fairness Controls

Live prize defaults:

- one attempt per customer, normalized email identity, and device;
- three reviewed variants per logical question;
- random variant choice per attempt;
- stable shuffled option order per attempt/question;
- server-authoritative question and event deadlines;
- no answer correctness or score disclosure while live;
- no live ranked leaderboard;
- result ranking only from clean, within-window attempts;
- route-proof, expected-user, username, age, and device protections remain enforced;
- a live start requires successful device resolution and atomic binding: web uses the existing first-party device cookie and bearer-authenticated mobile supplies the validated device signal; infrastructure failure fails closed for live but may fail soft with a visible diagnostic in test mode;
- suspicious attempts may be disqualified before winner minting.

These controls reduce casual collaboration and multi-accounting. They are not represented to users as impossible-to-defeat proctoring.

## Data and API Contract

### Event Response

The mobile event response adds:

```text
serverNow
contractVersion: 2
event.mode
event.timeZone
event.timePerQuestionSeconds
event.maximumPlaySeconds
event.liveWindowSeconds
event.maxAttempts
event.rulesVersion
event.resultsPublishedAt
event.prizeProduct { id, variantId, name, imageUrl, condition }
```

The current backend already returns the product identity and image, but the mobile schema strips it. The new contract preserves it end to end.

### Start Request

The start request adds:

```text
acceptedRulesVersion
termsAccepted: true
startRequestId
appVersion
platform
```

The existing `expectedUserId`, integrity tier, and hashed device fingerprint remain.

`startRequestId` is generated once for a deliberate Start tap and retained across transport retries. The database uniqueness invariant returns the same attempt for that replay. A later permitted test try-again generates a new ID and consumes one additional test attempt.

If the customer already has a `started` attempt, Start returns that attempt with `resumed: true` instead of inserting another row, even when a crashed client supplies a new request ID. A new test request ID creates an attempt only after the previous attempt is terminal.

### Active Attempt Response

`GET /api/quiz/attempts/active?eventId=...` derives ownership from authentication and returns:

```text
availability: none | active | pending_results | cancelled | unavailable
attempt/current question only for the authenticated owner
serverNow
eventEndsAt
the unchanged issuedAt/deadlineAt for an open question
```

The event ID selects the event but confers no authority. The RPC never accepts a customer ID from the request and never returns score, correctness, answer keys, or claim data.

### Attempt/Answer Response

Start and answer responses add:

```text
serverNow
eventEndsAt
resultsAvailableAt
```

Answer status becomes one of:

```text
in_progress
submitted_pending_results
completed
event_cancelled
```

`submitted_pending_results` does not expose correctness or prize eligibility.

### Result Response

The owner-only result endpoint returns:

```text
availability: pending | final | unavailable
availableAt
score/rank only when final
claim only for an unexpired live winner award
```

Test mode may return a private score/rank after publication but never a claim. The endpoint validates attempt ownership in the database and never accepts a customer ID from the request as authority.

### Leaderboard Response

The endpoint returns:

```text
availability: live_hidden | finalizing | final | unavailable
availableAt
entries: top 100
currentPlayer: nullable row outside or inside top 100
```

During a live event, `entries` and `currentPlayer` are omitted or empty regardless of direct API access.

### Client Compatibility

Updated web and mobile clients send `X-Baci-Quiz-Contract: 2`. New events are explicitly created with `contract_version = 2`; legacy rows remain version 1. V2 clients may receive normalized completed version-1 archives, but new play uses only v2 events. A client without v2 support can view compatible legacy archives during the bounded rollout window but cannot discover or start a v2 event. If a stale client reaches a v2 start by an old link, the API returns a clear update-required error. The old public leaderboard shape remains temporarily available for completed version-1 archives but is hardened to hide active ranks and replace real-name fallback; old mutation RPCs are removed in a later cleanup release.

## Database Changes

Append-only migrations add or evolve:

- `quiz_events.mode` with `test | live` constraint and live default for legacy compatibility;
- `quiz_events.contract_version`, with legacy/default rows at 1 and all new v2 drafts explicitly at 2;
- `quiz_events.results_published_at`;
- `quiz_events.attempts_terminalized_at` plus bounded finalization status/error code so an ended event can be retried safely without publishing partial results;
- immutable launch snapshots for timezone, rules version, max attempts, variant count, ranking policy, and approved claim-window duration;
- `quiz_event_testers` with RLS and tenant-safe lookup;
- `quiz_attempts.leaderboard_username`;
- `quiz_attempts.rules_version`, `terms_accepted_at`, `app_version`, and `platform`;
- `quiz_attempts.start_request_id` with event/customer/request uniqueness for retry-safe starts;
- one partial uniqueness invariant for a single `started` attempt per event/customer plus an owner-safe resume RPC;
- `customers.username_changed_at`;
- public-leaderboard display suppression/soft-delete aliasing that preserves ranking and award evidence;
- per-attempt stable option order stored on `quiz_attempt_questions`;
- `quiz_prize_reservations` with one active event reservation, exact product/variant/condition snapshots, optional serialized-unit linkage, and private hold/transfer/release operations;
- `quiz_test_invites` with digest-only one-time tokens, expiry, tenant ownership, RLS, and no raw-token storage;
- `quiz_attempts.test_reset` lifecycle support (or equivalent reset marker) and an audit trail that is excluded from test cap/ranking without deleting history;
- `quiz_awards.award_source` and `claim_expires_at`, plus a partial unique invariant for one `ranked_product_v2` award per event;
- per-variant canonical-content review receipts and variant revision audit rows; the legacy slot-wide answer-key receipt remains contract-v1-only;
- `quiz_variant_generation` queue/index/idempotency support on the existing leased `ai_jobs` model, a safe status RPC with no direct authenticated row projection for this type, plus a unique draft `generation_job_id` and private worker-only all-or-nothing persistence function;
- a private `persist_quiz_generation_job_draft_v2` worker boundary, draft-only variant revision/regeneration RPCs, per-variant review v2, cancellation v2, and one atomic `activate_merchant_quiz_v2` RPC;
- universal-end-aware v2 start/answer/finalization RPCs;
- safe v2 event, owner-result, and final-leaderboard RPCs returning top 100 plus the caller's separate position;
- typed player/authoring readiness sentinels return 1 during caller cutover and are upgraded to the only accepted value, 2, only after the corresponding safe RPCs exist and legacy direct player/authoring access is revoked; a separate test-operations marker is created with tester/invite/reset RPCs;
- live product-prize finalization at event end;
- an always-safe test finalizer that can publish private test results in phase 1a and has no award capability;
- due scheduled-event promotion and due event closure.

Follow-up lockdown migrations run only after callers switch. They replace the existing permissive test-leaking policies, revoke direct authenticated score/answer/award/permit projections, and revoke broad merchant writes to quiz events/slots/variants. Safe RPCs become the only contract-v2 boundary. SQL role-matrix tests cover ordinary customer, tester, merchant staff, unrelated authenticated user, and service worker. This sequencing avoids falsely treating API field omission as database security while also avoiding a schema-first cutover outage.

Material merchant mutations (generation enqueue, answer review, corrective revision, cancellation, activation, tester/invite changes, and reset) also validate a purpose-separated server authorization/route proof bound to the action, normalized payload, authenticated user, and subject. Full-draft persistence additionally requires the valid leased job and is worker-only. Authenticated access to Supabase alone cannot bypass the web route's CSRF, environment, validation, spend, or audit boundary.

Security references: [PostgreSQL policy composition](https://www.postgresql.org/docs/current/sql-createpolicy.html), [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Supabase column-level privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

The already-applied local file `supabase/migrations/20260803000000_quiz_promote_due_scheduled_events.sql` must be preserved byte-for-byte and reconciled into source control before newer migrations are added. Existing migrations are never edited.

Current main's replay verifier hash-binds every current-tree migration and rejects an extra SQL file. Each reconciled/new quiz migration is therefore committed with its final SHA-256 in both `PENDING_SOURCES` and the dedicated expected quiz-live cohort. The source/manifest/verifier suites run on every migration-bearing task, and both chronological and production-effect replay run before handoff.

Versioned v2 RPCs are introduced before application callers switch, preserving the schema-first deployment contract. Legacy functions remain available through the compatibility window and are removed only in a later cleanup after old server revisions can no longer call them.

## Test Mode

Test mode is the supported way to experience the real mobile flow before live prize approval.

Properties:

- available in production infrastructure without enabling real prize claims;
- visible only to merchant staff and explicitly allowlisted signed-in tester accounts;
- visibly labeled “TEST QUIZ” on lobby, gameplay, result, and leaderboard screens;
- no real inventory reservation, award, voucher, claim, public result, or notification;
- 10 attempts by default, configurable from 1–50, with admin reset allowed;
- uses the same global timing, question timing, one-tap answer, DOB, username, rules, and result-hiding code paths;
- test events never appear to ordinary customers or public leaderboard archives.

While a test event is still active, a tester who finishes may return to the lobby and start another attempt until the configured cap; each completed attempt remains pending and reveals no correctness before the universal end. Private test ranking uses the tester's best clean, non-reset attempt. Live mode never offers replay.

The event-bound device may be reused for those retries only by the same customer identity. Reset does not erase the binding, and a second account cannot use that device to bypass the test/live identity model.

A signed test invite link adds an authenticated user to the tester allowlist through a one-time token that expires after 30 minutes. The raw token is returned once to the authorized merchant, never stored, and exchanged by an authenticated mobile deep-link screen that immediately removes it from navigation. Invites can be revoked before use. Before the universal end/publication, reset marks prior attempts as `test_reset`; it never deletes the audit trail or mutates awards/inventory. Before publication, removing a tester terminalizes only that tester's active or otherwise rank-eligible attempts as non-ranking `tester_revoked`; both reset and revocation share the event-first lock order with answer submission. After publication, removal revokes access/future starts but does not rewrite the frozen private board. Published/completed test events must be cloned/relaunched for another run, and reset is impossible for live events.

## Production Compliance

Live mode remains fail-closed. It requires:

- `QUIZ_PHASE=production`;
- `QUIZ_PRODUCTION_APPROVED` set to an approved truthy value;
- event `compliance_verified = true`;
- non-empty approved permit/reference data;
- approved rules and prize terms version;
- prize inventory validation/reservation;
- 18+ and username gates;
- successful production approval check.

The message “Quiz prizes are not approved for production use” is an intentional safety gate, not a VTU or Kuda failure. The admin UI should translate it into actionable launch requirements. Test mode bypasses only prize approval and does so by making award side effects structurally impossible.

The release checklist must include Nigerian counsel review. FCCPC guidance requires clear, understandable consumer information and conspicuous disclosure for used/reconditioned goods, and the FCCPC publishes a registration process for sales promotions. The Nigeria Data Protection Act governs processing of player identity and anti-abuse data. Product implementation must not infer that existing environment flags alone satisfy those obligations.

Official references:

- [FCCPC consumer rights and responsibilities](https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/)
- [FCCPC sales-promotion registration](https://fccpc.gov.ng/businesses/register-sales-promotion/)
- [Nigeria Data Protection Act 2023](https://www.ndpc.gov.ng/ndp-act-2023/)

## Local and Production QA

### Installed Development Client

The mobile storefront already uses Metro port 8082. The supported flow is:

```bash
pnpm --filter @baci/mobile-storefront android:metro
pnpm --filter @baci/mobile-storefront android:launch
```

For iOS, start the same Metro server and open the installed development client. `EXPO_PUBLIC_API_URL` points the client to the selected backend. A LAN IP is used for a physical device; Android emulator networking follows the repo launcher.

### Backend

Local QA runs the web backend with quiz test mode and only the environment required by the quiz path. It does not pull the complete Vercel production environment. The long-term production QA path uses a production-hosted test event and allowlisted tester, removing the need for a local backend to share live prize state.

Full draft generation is asynchronous. Local QA runs `pnpm --filter @baci/web worker:quiz-generation -- --watch` in a separate terminal; production uses the dedicated once-per-minute VPS worker guarded by both its quiz lock and the shared Ollama-workload lock. No Vercel request or Vercel Cron owns long generation.

Current main already schedules the direct VPS quiz-finalization worker once per minute with `flock`; `/api/quiz/finalize` is a manual fallback, not the normal scheduler. The implementation extends that worker rather than adding a second cron. Service-only scheduled promotion, safe attempt terminalization (including a scheduled event that nobody opened), test publication, and expiry/release of an already-existing unclaimed award continue under phase 1a. Creating/publishing a new live winner remains behind all live gates; when those gates are unavailable, a due live event stays `finalizing` with its reservation held and an operations signal instead of being silently declared no-winner.

VTU and Kuda errors are not quiz dependencies. Quiz QA should avoid mounting unrelated VTU prefetches on the quiz route and should classify unrelated console noise separately rather than importing payment credentials into local development.

## Accessibility and Resilience

- Minimum 44×44 touch targets.
- Correct roles/labels for prize, status, timers, options, rules links, checkbox, and leaderboard.
- Dynamic type and text wrapping supported.
- Color is never the only indicator of LIVE, TEST, selected, closed, or winning state.
- Reduced-motion users do not receive unnecessary image or transition animation.
- Timer announcements occur at meaningful thresholds.
- Network loss preserves the locked answer and retries idempotently.
- App background/resume recalculates from server time.
- Browser refresh/mobile process death resumes the one active attempt and original question deadline; an already-committed answer advances only once.
- Active-event cancellation stops gameplay on the next answer/timeout response, refresh/resume, or coalesced foreground status reconciliation (no more than once per 15 seconds) and cannot reveal standings or a claim.
- Product image failure renders a stable fallback without shifting layout.

## Analytics and Privacy

Track funnel and reliability events such as:

- quiz lobby viewed;
- rules opened;
- ready sheet opened;
- start attempted/succeeded/failed;
- answer locked/submitted/timed out;
- event ended during attempt;
- result pending viewed;
- leaderboard/archive viewed;
- prize claim opened/completed.

Never include answer values, date of birth, raw username, email, device fingerprint, permit references, or signed test tokens in analytics payloads or logs.

## Rollout Strategy

1. Resolve the disk-space blocker, then reconcile the uncommitted prototype and already-applied scheduled-promotion migration against current `origin/main` in an isolated worktree, including its exact history-replay path/hash registration.
2. Deploy additive foundation, timing, result, finalization, and safe event/leaderboard RPCs schema-first with a typed player sentinel returning 1.
3. Deploy v2 backend routes while retaining version-1 RPCs/events; they accept only marker 2 and therefore fail closed as not-ready until lockdown completes.
4. After route evidence shows no direct projection dependencies, deploy the player grant/RLS lockdown and final runtime marker as a distinct forward-only checkpoint, then enable web/mobile v2 discovery.
5. Deploy the authorized quiz-generation queue contract and direct VPS worker, then v2 draft/revision/full-content-review/atomic-activation RPCs and admin callers; deploy the separate authoring-write lockdown after caller verification.
6. Ship the mobile A+C lobby, unified readiness, one-tap gameplay, active-attempt recovery, private result, invite, and leaderboard screens to the development client.
7. Run private test events on production infrastructure with real tester accounts; verify test closure/publication and zero award/inventory/public-archive side effects.
8. Obtain legal/operations approval, including claim duration, and complete the production approval check.
9. Enable a single low-risk live canary event with one atomically reserved prize.
10. Verify closure, final standings, one winner award, persisted-expiry claim, fulfillment/release, metrics, and audit records; expand only after the canary receipt is complete.

## Acceptance Criteria

The feature is ready when all of the following are true:

- An admin can create 20 questions for one topic and sees the correct total and maximum play time.
- The time field explicitly says it is seconds per question.
- Inventory search finds products beyond the first 100 and requires an exact variant where applicable.
- All generated variants can be reviewed inside a bounded scroll area.
- A bad variant can be edited or regenerated, and any review-relevant change invalidates its database-computed full-content receipt until reapproved.
- Maximum-size generation returns an enqueue response promptly, completes through the leased/checkpointed worker within the tested ten-minute attempt budget, resumes safely after a worker restart, and persists no partial quiz draft.
- Launch requires a start and universal end and displays a complete summary.
- A 20 × 10-second event can default to a five-minute live window.
- A player joining at 9:04 starts question 1 and is forcibly finished at 9:05.
- Refresh/process death resumes the single active attempt with its unchanged current deadline and does not consume another attempt.
- A question issued near 9:05 receives less than 10 seconds when required.
- Tapping an option locks and advances without a separate submit button.
- Product image, condition, time-sensitive prize copy, countdown, and “Play for free” render on mobile.
- “Every second counts” appears beneath the CTA without repeating the per-question duration.
- Rules are available from the lobby and acceptance occurs in the unified readiness sheet.
- Attempt creation occurs only after the final Start tap.
- Username, DOB, rules version, expected-user, and device checks remain server-authoritative.
- Updated web and mobile clients send contract version 2; stale clients cannot discover/start v2 events.
- Live device resolution/binding fails closed, while a test-only diagnostic can fail soft without awarding.
- Historical leaderboard names do not change after a profile rename and never expose a real-name fallback.
- Soft deletion or approved display suppression aliases a historical handle without deleting/reordering rank or award evidence.
- Live rankings and scores are unavailable before the event closes.
- Direct authenticated SQL/PostgREST access cannot reveal live score/correctness, test events to non-testers, permit data, mutable launch fields, or quiz-generation input/checkpoint/answer content from `ai_jobs`.
- The top 100 plus “Your position” work after finalization.
- Test events are private, watermarked, repeatable, auditable after reset, close/publish under phase 1a, and are incapable of awarding a prize.
- A never-opened scheduled event cannot strand a hold; a pre-end cancelled scheduled/active event cannot mint/publish a winner; and cancellation at/after the universal end cannot bypass final ranking.
- Every quiz migration is hash-registered in the current replay manifest and passes chronological plus production-effect replay.
- One live launch hold produces at most one ranked product award; result claims use persisted expiry and release cleanly when unclaimed/cancelled.
- Live events remain blocked without environment, permit, event compliance, legal terms, and prize-stock gates.
- Quiz QA can run through Metro on port 8082 without requiring Kuda or VTU configuration.

## Open Approval Items

The product and technical choices are resolved; these owner/legal decisions remain explicit release approvals rather than implementation ambiguity:

1. Nigerian counsel approves the final rules, terms, geographic eligibility, claim window, cancellation policy, unclaimed/replacement-winner policy, public-handle suppression/account-deletion behavior, quiz attempt/device/acceptance/test-invite retention periods, and promotion/permit process.
2. Operations supplies the approved live permit/reference and production approval evidence.
3. The owner approves the default one-winner product-prize policy and five-minute window for the 20 × 10-second example.
4. The owner approves the 30-day username-change cooldown.
