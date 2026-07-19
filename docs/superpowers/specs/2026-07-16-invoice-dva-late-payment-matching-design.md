# Invoice DVA Late-Payment Matching Design

Date: 2026-07-16

Last repo-grounded rereview: 2026-07-19 against `origin/main =
ac2564ff1ba76ecc179fda9ebedeb91d5b571936`.

## Problem

Paystack Dedicated Virtual Accounts can be reused for the same customer. Baci
currently distinguishes invoice payments using the receiving account identity, exact
amount, customer email, and a 90-minute payment window.

That time limit is not aligned with the invoice contract shown to customers.
The invoice DVA is presented as an automatic-confirmation account, and some DVA
records have no real expiry. A valid transfer can therefore arrive after 90
minutes, be verified successfully by Paystack, and still be classified as
having zero local candidates. The order remains unpaid and the customer email,
merchant push notifications, and settlement side effects never run.

The July 15 payment for `ORD-150726-F2D98D` demonstrated this failure:

- Paystack verified the exact NGN amount, customer email, and receiving DVA.
- The transfer arrived 2 hours 53 minutes after the DVA row was created.
- Baci rejected the otherwise unique match because it was outside 90 minutes.
- The webhook returned HTTP 200 after creating a silent reconciliation row.

## Goals

1. Automatically confirm a valid DVA payment while its invoice remains payable,
   regardless of whether it arrives hours or days after account assignment.
2. Never credit a cancelled, already-paid, or otherwise ineligible order.
3. Never count or credit a cancelled, paid, refunded, or otherwise terminal
   invoice as a payment candidate. Separately fail safe with
   `terminal_alias_conflict` when immutable history proves that stale payment
   instructions for such an order used the same customer DVA,
   provider-customer identity, and exact assignment-time or terminal-residual
   amount as the verified transfer. That veto protects the still-payable order;
   it does not try to match or reopen the terminal order.
4. Make every verified but unmatched Paystack payment operationally visible.
5. Preserve the invoice's original BAC transaction and fee data when it exists,
   instead of creating an orphan transaction or silently zeroing platform fees.
6. Make the paid-order ledger and document state agree: a fully paid invoice
   must have `amount_paid = total` and zero balance.
7. Make paid customer email, merchant payment-received push, and every
   payment-owned new-order push durable and retryable for Paystack, Korapay, a
   fresh Juicyway completion performed by the current wedge reconciler, and a
   post-cutover Juicyway retry performed by the failed-side-effect drain, all of
   which current `main` routes through `complete_order_gateway_payment`, and for
   internal-credit checkout after activation, through the paid-order side-effect
   pipeline.
   Preserve one immutable owner for a separate creation-owned new-order attempt
   independently of the order's mutable payment method. From the owner-expand
   bundle onward, no newly completed Paystack, Korapay, or shared-finalizer
   Juicyway payer may enter a permanent direct-only notification cohort; after
   activation the same is true for internal-credit completion.
8. Make claim and retry-marker persistence transaction-aware and monotonic so a
   later failure cannot reopen a completed side effect, steal a live claim, or
   execute transaction B through a row durably owned by transaction A.
9. Roll the owner and internal-credit changes out safely under the repository's
   schema-first production workflow, which applies every pending migration
   before deploying the corresponding application revision.
10. Make an emergency internal-credit pause transactionally safe: block every
    new checkout immediately, allow only already-registered checkout intents to
    drain under their captured generation, and never report the database as
    fully paused while an intent can still mutate an order or credit ledger.
11. Reverse inventory from immutable allocation-time evidence rather than
    mutable current product policy, including unlimited-stock, imported,
    edited, and deleted-catalog cases.
12. Preserve every DVA identity and payable snapshot Baci exposed as an
    immutable assignment epoch with the exact provider customer code and
    assignment email Baci used, plus one immutable assignment-intent transaction
    pointer, even after a replacement account becomes current for invoice
    display; differently priced captures use append-only link evidence.
13. Keep internal BAC references disjoint from provider replay ownership, make
    wallet DVA matching bank-aware with a real verified payment timestamp and a
    provider-proved quarantine repair path, and durably alert on captured
    payments that cannot reopen cancelled or refunded orders. Preserve one
    immutable, ledger-derived DVA terminal snapshot when an account-linked order
    first becomes non-payable so partial-payment residuals remain ambiguity
    evidence without becoming eligible payment candidates.
14. Generate or newly expose an order DVA only after Baci has durable evidence
    of the customer's express, purpose-specific consent. A merchant/staff action
    can request that consent or reuse an already-valid receipt, but cannot attest
    on the customer's behalf or silently create the receipt.
15. Preserve a retained wallet DVA as historical receiver-purpose evidence even
    when its local status is `pending_review` or `disabled`; those states may
    suppress wallet credit or require review, but can never make the receiver
    available for an invoice or silently reactivate the wallet account.

## Non-goals

- Creating a unique Paystack DVA for every invoice. Paystack can return an
  existing customer DVA, so Baci must safely support account reuse.
- Guessing between two open invoices with the same receiving account number and
  bank, immutable provider customer code, assigned customer email, and
  outstanding amount.
- Treating invoice creation, a merchant/staff click, or prior account reuse as
  the customer's consent to generate or newly expose a DVA.
- Treating an agentic checkout `human_confirmation` or `payment_mandate` as
  order-DVA consent. Those current signed payloads authorize checkout amount/
  currency but do not bind the Paystack DVA purpose, order, recipient-email
  hash, disclosure version, or payment terms. Re-enabling agentic Paystack bank
  transfer requires a separate reviewed post-order customer-consent state
  machine; this release fail-closes that payment method instead of accepting an
  agent's attestation.
- Automatically batch-reconciling historical reviews without individually
  verifying their Paystack references and intended orders.
- Automatically reactivating a disabled wallet DVA. Re-enable requires a
  separately reviewed workflow that preserves and resolves the original disable
  reason; provider replay or a new funding request is insufficient authority.
- Changing card, Korapay, BNPL, wallet allocation amounts/eligibility, or
  manual-payment matching behavior. Internal-credit orchestration and evidence
  are hardened for transaction safety, but recognized wallet business outcomes
  retain their current semantics. The wallet DVA order-alias safety guard must
  still be aligned with the new invoice-lifetime rule so it cannot misclassify
  an active invoice payment as a wallet top-up.
- Adding non-NGN Paystack DVA support. The existing order-DVA flow and platform
  fee cap are naira-denominated.
- Making the existing creation-time new-order push for invoices,
  pay-on-delivery, or fully covered quiz-voucher orders retryable. This design
  makes its ownership immutable and prevents a payment finalizer from sending a
  duplicate, but the current creation route remains a best-effort direct
  attempt. A durable order-created outbox is a separate follow-up design and is
  not part of the paid-order notification guarantee below.
- Migrating the primary Juicyway webhook's direct order-update branch, Klump,
  Credit Direct, or manual paid-order transitions to
  `complete_order_gateway_payment`. Current `origin/main` at
  `ac2564ff1ba76ecc179fda9ebedeb91d5b571936` retains the Juicyway wedge
  reconciliation and failed-side-effect recovery behavior introduced by
  `a332a97894e9d003cac083acc358bea21b02b702`: both use the shared finalizer.
  A fresh payer completed by the wedge reconciler is therefore in scope for
  `claimed_v1`; the drain is in scope only to retry rows durably seeded by a
  post-cutover completion. The primary Juicyway webhook's direct-success branch
  and the Klump, Credit Direct, and manual paths remain best-effort and require
  separate migrations. An already-paid pre-outbox Juicyway replay does not gain
  retrospective notification ownership merely because its recovery caller now
  uses the shared finalizer.
- Migrating the `CHAT-` webhook's atomic chat-order conversion and direct push
  delivery into `complete_order_gateway_payment`. Expand stamps its owner and
  immutable allocation evidence so later contracts remain correct, but its
  current best-effort direct notifications remain a separately identified
  follow-up.

## Considered Approaches

### Extend the time window

Increasing 90 minutes to 24 hours or several days would reduce failures but
would retain the same arbitrary cutoff. A valid invoice payment could still
arrive later and fail. This approach is rejected.

### Match while the invoice remains payable

Use the persisted DVA identity, immutable provider-customer identity, exact
outstanding amount, payment timestamp lower bound, and current order state. Do
not impose an upper time bound while the order remains eligible. This is the
selected approach.

### Require one DVA per invoice

This would simplify matching but conflicts with Paystack's customer-DVA reuse
behavior and adds provider and lifecycle complexity. It is not required when
the existing identity fields can produce a unique safe match.

## Matching Contract

The reservation RPC will load every immutable
`order_payment_account_epochs` row for the verified Paystack receiving
identity—provider, account number, and normalized receiving bank—joined through
its current `order_payment_accounts` projection to the order. It must load
superseded as well as display-current epochs and active as well as terminal
orders because any account Baci exposed to a payer remains payment evidence.
Cancelled and other terminal orders are never eligible payment candidates and
must never be reopened, but neither a terminal row nor a superseded identity
may be discarded before the separate terminal-alias safety veto is evaluated.

Paystack's DVA `charge.success` authorization supplies both
`receiver_bank_account_number` and `receiver_bank`; account numbers are not a
cross-bank identity. Add a shared checked receiver-identity parser used before
agentic, order, or wallet DVA matching. It compares the verified transaction
response with the already-signature-validated webhook payload when both carry
identity, rejects any disagreement, normalizes bank names with Unicode NFKC,
trim/lowercase, punctuation folding, and whitespace collapse, and returns no
fresh-match authority unless both account number and bank are present. The
signed payload may fill a field omitted by verification, but an unverified
request value never may. Missing or conflicting receiver bank identity skips
all fresh DVA mutation and is recorded in the final zero-candidate/conflict
review; exact external-reference replay remains independently resolvable.
The current account-number-only helper is retired. Agentic matching validates
the session's persisted `virtual_account_bank`, invoice matching validates
`order_payment_account_epochs.bank_name`, and wallet matching validates the persisted
wallet account bank name/slug evidence. None may preempt a later matcher using
account number alone; a legacy row with missing or contradictory bank evidence
is review-only until repaired.

The same verified Paystack transaction is also the only fresh authority for
provider-customer identity. The shared parser returns the normalized verified
Paystack customer email and exact Paystack customer code. When both the signed
payload and verification contain either field, they must agree; the signed
payload may corroborate but may not replace a field omitted by verification.
Post-cutover invoice matching requires both verified fields to equal the
immutable `assigned_customer_email` and `provider_customer_code` captured on
the assignment epoch. This includes the synthetic
`<order-id>@orders.usebaci.com` email used when an order has no customer email.
The mutable, nullable `orders.customer_email` remains a notification
destination and is never matching authority.

A legacy epoch may acquire missing provider-customer identity only through an
audited one-time repair backed by an exact linked transaction, exact provider
DVA assignment response, or verified external reference that proves the value.
The repair records the proof source and fingerprint. It must not copy the
order's current email or infer a provider customer code. A legacy epoch that
still lacks either identity field is `legacy_customer_identity_unresolved`: it
is never an eligible candidate. When its receiving identity, currency, time,
and any provable amount evidence otherwise overlap the transfer, it remains a
conservative ambiguity blocker and routes the transfer to review instead of
being discarded as irrelevant.

The database remains authoritative for order matching. The DVA reservation
module adds an ungranted immutable private bank-normalization helper using
the installed `extensions.unaccent`, lowercase, non-alphanumeric-to-space
folding, trim, and whitespace collapse. The reservation RPC receives the raw
verified receiver bank, recomputes its canonical value, and applies the same
helper to every stored `bank_name`; it does not trust a caller-supplied
canonical string. The TypeScript parser's NFKC/diacritic fold and the SQL helper
must pass one shared fixture matrix of Paystack bank-name variants before
deployment. Any value outside the resulting non-empty bounded canonical form
fails closed.

The matcher classifies rows into:

- **eligible candidates**, which may be paid automatically;
- **terminal alias conflicts**, which can explain the transfer but may never be
  credited;
- **wallet-purpose conflicts**, where an otherwise eligible invoice shares its
  verified receiving identity with a retained customer-wallet DVA and the
  transfer cannot prove which exposed purpose the payer intended;
- **unresolved historical conflicts**, whose missing immutable customer or
  terminal-balance proof prevents safe attribution and requires review; and
- **irrelevant rows**, which fail account-era, email, currency, or amount
  checks after immutable provider-customer identity is considered.

Classification deduplicates eligible results by order, not by epoch. Multiple
historical epochs for one order therefore cannot manufacture ambiguity with
itself. For transaction ownership, the RPC chooses the display-current epoch
when it matches the verified identity; otherwise it chooses the newest
historical epoch whose identity and assignment lower bound match, preferring a
single exact linked-transaction amount when one exists. The historical
`payable_amount` remains diagnostic and terminal-conflict evidence, not a rule
that can override an active order's locked current outstanding balance. Two
compatible epochs for the same order with contradictory exact links or evidence
are a contract conflict, not permission to choose a transaction heuristically.

An eligible candidate must satisfy all of the following:

1. The order has no `cancelled_at`, its shipping status is not `cancelled`,
   `canceled`, `returned`, or `failed`, and its payment status is `unpaid`,
   `pending`, or `partially_paid`.
2. The order is not fully paid, refunded, or otherwise terminal.
3. The order still has a positive outstanding balance.
4. The verified Paystack amount equals the invoice's exact outstanding amount
   within the existing one-kobo tolerance.
5. The verified Paystack customer code and normalized customer email equal the
   epoch's immutable provider-customer identity. The order's current customer
   email is not consulted.
6. The verified currency equals the order currency.
7. The Paystack `paid_at` timestamp is not earlier than the account assignment
   timestamp. `assigned_at` is preferred; `created_at` remains the legacy
   fallback.

Under the same receiving-account advisory lock, the reservation RPC also loads
every retained `customer_wallet_payment_accounts` row with the exact provider
and account number, regardless of whether its status is
`active`, `pending_review`, or `disabled`. Status is an availability control,
not proof that Paystack retired or reassigned a receiver Baci previously
retained. A matching row with the same immutable provider customer code is a
wallet-purpose conflict for an otherwise eligible invoice; a missing or
contradictory wallet customer code is an unresolved identity conflict, not
permission to choose the invoice. A same-provider/account row whose retained
bank aliases cannot produce one canonical identity is likewise unresolved and
blocks the invoice; only a different non-empty canonical bank proves that the
same number is irrelevant. This veto applies only when at least one invoice is otherwise
eligible for this exact transfer. If no eligible invoice exists, the webhook
continues to the wallet matcher, where only an `active` row may be credited;
`pending_review` or `disabled` receiver evidence is reviewed rather than
credited or treated as absent. The existing rule that a cancelled-only order
alias does not block a legitimate active-wallet top-up remains unchanged.

Cancelled, paid, and refunded rows remain ineligible even if every transfer
field matches. Such a row becomes a terminal alias conflict when:

1. it uses the same provider, receiving account number, and normalized bank;
2. its immutable provider customer code, assigned customer email, and currency
   match;
3. the verified amount equals either its assignment-time `payable_amount` or
   the exact `outstanding_amount` captured at the order's first terminal
   transition; and
4. its assignment timestamp is not later than `paid_at`.

The terminal residual comes only from the immutable
`order_dva_terminal_snapshots` row described below. Invoice total is not a
residual fallback. A historical terminal DVA row without provable immutable
provider-customer identity or a provable terminal residual snapshot is
`terminal_identity_unresolved`. If its other exact transfer fields overlap, it
conservatively blocks automatic attribution and creates a durable review item;
it is neither an eligible candidate nor an irrelevant row. An audited legacy
snapshot may be written only from reconstructible exact ledger evidence.

Therefore, one eligible invoice plus one indistinguishable cancelled invoice
still produces exactly one eligible candidate: the cancelled row is excluded
before candidate counting and is never matched or credited. A separate terminal-
alias safety veto then blocks automatic credit to the active invoice and files
review because the transfer does not prove that the payer intended the active
order rather than acting on stale cancelled-invoice instructions. This outcome
is `terminal_alias_conflict`, not a second candidate or a cancelled-order match.

There is no upper payment-age limit while those conditions remain true.
`expires_at` remains an invoice due-date, reminder, and cancellation-lifecycle
field. It must not invalidate a still-payable invoice for matching purposes.
Invoice retrieval must continue showing the DVA on an overdue but payable order
instead of hiding it solely because `expires_at` passed. Cancelled orders remain
hidden because of order state, not because the matcher trusts `expires_at`.

The authoritative outstanding balance is calculated inside the reservation RPC
after it has locked the receiving account and acquired the same per-order
advisory locks used by gateway and manual payment writes for every relevant
account-linked order:

1. Sum completed payment transactions.
2. Add any wallet amount not already represented by a completed wallet
   transaction, following the existing `record_manual_order_payment` ledger
   formula.
3. Resolve paid-to-date as the greater of that ledger result and
   `orders.amount_paid`.
4. Resolve outstanding as `orders.total - paid-to-date`, clamped at zero.

`order_payment_account_epochs.payable_amount` is an assignment snapshot and audit
value. It is used to recognize historical terminal-alias conflicts and diagnose
drift, but it must not override the current locked ledger balance for an active
invoice.

New DVA assignment epochs must persist:

- `assigned_at`
- the exact assignment-time `payable_amount`
- the exact normalized provider-assignment customer email, including any
  synthetic fallback, and the exact Paystack provider customer code
- `customer_identity_source` and
  `customer_identity_evidence_fingerprint`, identifying a live provider
  response or an audited legacy proof
- `customer_consent_id`, linking every post-consent-cutoff assignment to the
  exact immutable order-DVA consent receipt; only audited legacy epochs may
  remain null
- the receiving account number, Paystack-supplied bank name, and provider as
  the complete match identity
- `payment_transaction_id`, immutably linking the assignment to the original
  BAC assignment-intent transaction created for that DVA epoch

An exposed assignment is immutable payment evidence. The DVA epoch-schema
module deliberately preserves the baseline `unique_order_account`
constraint because the still-live old application performs
`upsert(..., { onConflict: 'order_id,provider' })` during schema-first rollout.
`order_payment_accounts` remains the single display-current compatibility
projection. It adds nullable current-epoch mirrors
`assigned_customer_email`, `provider_customer_code`, and
`customer_identity_source`, `customer_identity_evidence_fingerprint`,
`customer_consent_id uuid NULL REFERENCES order_dva_customer_consents(id) ON
DELETE RESTRICT`, and
nullable
`current_epoch_id uuid` with a database-generated UUID default and a
`REFERENCES order_payment_account_epochs(id) DEFERRABLE INITIALLY DEFERRED`
constraint, backfills it, installs the compatibility trigger topology below,
and sets it `NOT NULL` before releasing the migration lock. The projection
mirrors the current epoch's
immutable provider-customer identity and assignment-intent transaction pointer;
it is not a pointer to every later capture matched through that epoch. Legacy
rows may remain null only under the explicit unresolved/audited-repair contract;
every proof-gated post-cutover assignment writes the complete identity tuple and
consent mirror.

The DVA epoch-schema module creates the RLS-locked, service-owned
`order_payment_account_epochs` table with immutable order/payment-account,
provider, account number/name, bank, `assigned_at`, `payable_amount`, original
expiry, immutable `assigned_customer_email`, `provider_customer_code`,
`customer_identity_source`, `customer_identity_evidence_fingerprint`, nullable
legacy/non-null post-cutoff `customer_consent_id REFERENCES
order_dva_customer_consents(id) ON DELETE RESTRICT`, and
`payment_transaction_id` evidence plus
`superseded_at` and
`superseded_by_epoch_id`. The epoch-to-projection, projection-to-current-epoch,
and epoch self-reference foreign keys are all
`ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`; `RESTRICT` is not used
because PostgreSQL does not defer that referential action. Historical payment
evidence still cannot cascade away with a projection delete, while the two-way
pointer can reach its valid final transaction state;
the separate consent-receipt foreign keys are intentionally immediate
`RESTRICT` references because they are append-only and do not participate in
that pointer cycle. The epoch consent field is immutable after insert except for
the proof-gated, audited one-time legacy-current `NULL -> receipt` transition
defined below; a non-null value can never change;
a partial unique index on
`order_payment_account_id WHERE superseded_at IS NULL`, named
`order_payment_account_epochs_current_projection_uidx`, permits exactly one
display-current epoch per projection. Add full indexes for every epoch foreign
key plus the provider/account/order receiver lookup used by reservation; the
non-null transaction-link index remains unique. Existing projection rows are backfilled
as their initial current epochs. The migration does not invent history that the
old in-place schema already erased; its preflight reports contradictory rows
for manual repair rather than selecting evidence.

Customer identity is an all-or-nothing checked tuple. `live_provider` and
`audited_legacy` require a non-empty bounded Paystack customer code and a
canonical lowercase trimmed email plus a lowercase 64-character evidence
fingerprint; `legacy_unresolved` requires all three evidence values to remain
null. No partial tuple is valid. Only the proof-gated assignment RPC may
create `live_provider`; only the service-role repair RPC may perform the single
`legacy_unresolved -> audited_legacy` transition while writing the exact proof
fingerprint. All later changes are rejected by the immutable trigger, including
an attempt to follow an edit to `orders.customer_email`.

The same schema module creates the RLS-locked, append-only
`order_payment_account_epoch_capture_links` table for the narrow case where a
verified transfer uniquely matches an epoch but the epoch's immutable
assignment-intent transaction amount no longer equals the order's locked
outstanding balance. Each row stores one unique epoch id, one unique captured
transaction id, the immutable original assignment transaction id, exact match
reason `outstanding_balance_changed`, verified amount/currency/reference
fingerprint, and database timestamp. All three foreign keys use `ON DELETE
RESTRICT`; indexes cover the epoch and original-assignment foreign keys, while
the unique epoch and captured-transaction keys prove that one stale assignment
cannot authorize two replacement captures and one transaction cannot be
attributed to two epochs. Any later independent capture follows the existing
additional-capture/terminal-review contract and cannot append another automatic
match link or reopen the order. Direct writes are never granted.

The contract bundle also creates the RLS-locked, append-only
`order_dva_terminal_snapshots` table. It has exactly one row per order with any
DVA epoch once that order first enters the registered terminal-transition set;
active orders have no row. It records: `order_id`,
`terminalized_at`, previous and new payment/shipping statuses, `paid_to_date`,
`outstanding_amount`, currency, reason, source, actor, and a database-computed
ledger fingerprint. Its order foreign key is `ON DELETE RESTRICT`; direct
writes are never granted; and an immutable constraint trigger rejects update or
delete. Every registered terminalizer writes or validates this snapshot under
the same account, order, projection, epoch, capture-link, and terminal-snapshot
locks before changing terminal state. An idempotent replay must reproduce the same
fingerprint. A disagreement aborts terminalization for investigation rather
than rewriting evidence.

The epoch's `payment_transaction_id` remains the sole
`assignment_intent` pointer. It is set atomically for every new proof-gated
epoch; a legacy null may transition once through the proof-gated assignment or
reservation primitive, or through audited repair with exact evidence. Once
non-null it is immutable. A
capture-link row points to a separate transaction tagged
`metadata.dva_epoch_link_role = 'matched_capture'`. The original transaction is
tagged `assignment_intent`. Deferred contract checks require the epoch pointer
and assignment transaction metadata to be reciprocal, and independently require
every capture-link row and matched-capture transaction metadata to be
reciprocal. A matched capture can never replace the epoch pointer or the current
projection mirror.

A private compatibility trigger topology preserves schema-first compatibility
without performing append-only side effects during PostgreSQL's speculative
`INSERT ... ON CONFLICT DO UPDATE` insert phase:

1. A `BEFORE INSERT` normalizer validates or fills assignment/payable fields
   and preserves the database-preallocated `current_epoch_id`. It never inserts,
   supersedes, or mutates an epoch.
2. An `AFTER INSERT` trigger appends the initial epoch only when PostgreSQL
   actually inserted the projection row, using the stored projection id and
   preallocated pointer.
3. A `BEFORE UPDATE` trigger handles ordinary updates and the conflict-update
   path after PostgreSQL has identified and locked the existing projection.
   An identical payload is idempotent; expiry-only lifecycle changes do not
   append an epoch; an identity, provider-customer identity, or payable change
   supersedes the prior epoch, appends exactly one new unlinked legacy epoch,
   and sets `NEW.current_epoch_id` without recursively updating the projection.

The update/conflict trigger uses `pg_try_advisory_xact_lock` for sorted old/new
account keys and the order payment key and raises retryable SQLSTATE `40001` if
any is busy. That abort releases the row instead of deadlocking with a proof RPC
that already owns the advisory and is waiting for the projection. Because a
legacy payload cannot prove transaction or provider-customer ownership, the
new epoch is visibly unlinked and its customer identity remains unresolved
unless the exact provider fields are present in an allowed compatibility
payload; it never carries an old epoch's transaction or customer identity into
a new identity. Every post-cutover unresolved epoch is preserved for audit.

Every compatibility trigger function is PostgreSQL-owned and `SECURITY
DEFINER`, uses `SET search_path = ''`, schema-qualifies every table, sequence,
helper, and security-sensitive `pg_catalog` built-in, and rejects an unexpected
trigger schema, table, operation, or recursive invocation. Revoke `EXECUTE`
from `PUBLIC`, `anon`, `authenticated`, and `service_role`; the installed
triggers are their only invocation paths. The caller must still hold the existing
`order_payment_accounts` base-table privilege, and its RLS policy remains the
commit authority: a denied base write rolls back every privileged trigger side
effect. This is required because the live
generate-DVA and ship-on-credit routes insert through authenticated clients
while the epoch table intentionally grants them no direct write access.

After all nonblocking advisories succeed, the compatibility trigger may lock
the order row and compute the same authoritative outstanding balance. It fills
a missing legacy `assigned_at`, fills a missing `payable_amount`, and rejects a
provided amount that does not equal the locked NGN residual or a now-terminal
order. The epoch therefore records what the preparation application is allowed
to expose even when the old automatic-invoice payload omitted those fields; a
failure aborts and the already-live preparation response omits the account.

The already-live preparation application must treat that retryable legacy DVA
write failure as no persisted assignment: initialize/generate routes return a
retryable error without bank details, and optional invoice/ship-on-credit paths
omit the DVA exactly as described below. It removes the current initialize
branch that logs the failed upsert but still exposes the provider account. This
fail-closed compatibility behavior is live before the epoch migration can make
the trigger return `40001`.

The proof-gated append RPC performs the same transition with its new linked
assignment-intent transaction in one transaction. A private deferred constraint
trigger validates at commit that the old/new relationship is reciprocal,
acyclic, same-order/same-provider, the projection exactly mirrors the
unsuperseded epoch's immutable identity, assignment/payable, and
assignment-transaction-link fields, every optional capture link is reciprocal
without replacing that pointer, and exactly one current epoch remains. Lifecycle
`expires_at` is deliberately excluded from that mirror. Any failure rolls back
the projection, epochs, assignment link, and capture links together.
Post-enforcement callers cannot perform these steps directly.

Invoice retrieval and new DVA display use the current projection only after its
`current_epoch_id` and mirrored fields validate. Matching, cancellation,
refund, recovery, and audit paths load all epochs. Superseding an epoch hides it
from future invoice display but does not make a transfer sent to that previously
displayed account invalid: while the order remains payable it can still be the
unique eligible epoch, and after terminalization it remains conflict evidence.
Cancellation or refund expires the current projection and relies on terminal
order state for every epoch; it never deletes, rewrites, or excludes historical
epochs from classification.

Every order-DVA assignment path must follow this contract:

- `apps/web/src/app/api/payments/initialize/route.ts`
- `apps/web/src/app/api/orders/[id]/generate-dva/route.ts`
- `apps/web/src/app/api/orders/[id]/ship-on-credit/route.ts`
- the automatic invoice path in `apps/web/src/app/api/orders/route.ts`

Each path must reject a non-NGN order before creating or persisting a Paystack
DVA assignment.

All four paths use one `parse-paystack-dva-assignment-identity` boundary. The
general Paystack helper must preserve the validated customer create/fetch
response's exact customer code and normalized email and require any embedded
DVA customer identity to agree. The subaccount helper must return the same tuple
from its validated provider customer response instead of stripping it from
`DVAResponse`; if the DVA response omits customer identity, it performs one
bounded provider customer read by the already-proved customer code and requires
that response to agree before persistence. The parser also validates provider,
canonical bank/account/name, NGN currency, and optional provider account id. A
missing/malformed code or email, caller/request/order-email substitution,
customer/DVA disagreement, or unexpected currency is a stable unavailable
result before proof creation, assignment mutation, or account disclosure. The
synthetic order email remains valid only when it is the normalized email
returned by Paystack for that customer. No route may construct assignment
identity directly from its body or mutable `orders.customer_email`.

Agentic checkout is a fifth DVA creation/exposure surface but is not currently
an order-DVA assignment path. Current `main` calls
`createAgenticCheckoutPaymentAccount` from `checkout-payment-setup.ts`, stores
the returned account on `checkout_sessions`, creates the order only afterward,
and returns the account to the agent. It therefore cannot satisfy an
order-bound receipt merely by reusing `completion_authorization`; an agent,
merchant, payment mandate, or generic human checkout confirmation may not
attest to the fixed `order_dva_v1` disclosure for the customer.

The preparation application adds a server-only
`AGENTIC_PAYSTACK_DVA_MODE`, with exact values `enabled` or `paused` and no
production default. Production is set to `paused` before that revision is
deployed and remains paused for every later phase. When paused:

- `buildAgentCommerceManifest` omits only `paystack_bank_transfer`; the derived
  Agent Commerce, ACP, agent-native, and UCP documents therefore omit its
  handler/instrument too. Pay on delivery and independently configured Google
  Pay remain available because neither creates or exposes a DVA. If no payment
  method remains, checkout mutation links and capabilities disappear under the
  existing manifest rule. The five-minute public manifest cache must elapse and
  every discovery surface must be probed before the consent migration can
  proceed;
- a newly requested `payment_data.provider = paystack` may pass authentication,
  Zod parsing, replay lookup, and an exact already-stored idempotency replay, but
  for a session without a pre-existing exposed account it returns stable `409`
  code `AGENTIC_PAYSTACK_DVA_PAUSED` before payment-setup claim mutation,
  `createAgenticCheckoutPaymentAccount`, any Paystack call, order creation, or
  bank-detail response. UCP/ACP aliases normalize to the same rejection;
- an exact pre-cutoff session already durably in `payment_pending` with
  `order_id`, account number, buyer/payment snapshot, and the matching
  idempotency response is a finite grandfathered cohort. Read and same-response
  replay may continue exposing that already-exposed account, and webhook
  matching remains enabled, but no account identity, amount, buyer, order, or
  payment terms may be changed. This is legacy matching continuity, not a new
  consent receipt; and
- `claiming_payment`, `payment_account_ready`, and `order_finalizing` are not
  grandfathered display states. Before owner-expand, a checked service-role
  audit must identify each exact pre-pause row. A separate cutover drain is
  dry-run by default and accepts only an operator-supplied opaque session id,
  expected state, and evidence fingerprint: it may release a stale claim proved
  to have no account, or resume an already-created/stored account through the
  existing idempotent finalizer without another Paystack create/get call. It may
  not change buyer, amount, account, order, or terms. A state/evidence mismatch
  emits the existing operations alert, changes nothing, and blocks rollout for
  manual resolution; neither script prints account details. After the bounded
  grandfathered drain, all three transitional counts must be zero. No
  owner-expand migration or new DVA consent cutoff may commit while one remains.

This application gate is mandatory because the consent backstop on
`order_payment_accounts` cannot guard a provider call and account stored only on
`checkout_sessions`. A source-contract test inventories every raw Paystack
dedicated-account endpoint boundary—the two current `POST` implementations and
the existing-account `GET`—and every non-test call edge through
`generatePaymentAccount`, `getDedicatedAccounts`, `createDedicatedAccount`,
`createDedicatedAccountForWallet`, `createDedicatedVirtualAccount`, and
`createAgenticCheckoutPaymentAccount`. Its exact allowlist classifies the three
`generatePaymentAccount` callers plus payment initialization as order DVA, the
customer-wallet caller as wallet DVA, and checkout payment setup as agentic DVA.
It proves every order caller is dominated by the capability/receipt gate before
any local existing-account disclosure or provider get/create, the wallet caller remains inside its separate wallet
persistence contract, the agentic caller is dominated by the paused-mode check,
each lower-level helper has only its reviewed parent edges, and no other module
contains the dedicated-account endpoint. The agentic helper may remain for the
grandfathered drain but is not reachable from a new paused request. No feature
phase may set the mode back to `enabled`.

Paystack's DVA consent boundary is independent of payment matching. The
owner-expand consent bundle, installed after payment-orchestration proof
configuration and before the owner-expand gate, is split by concern:

- `20260719115886_order_dva_customer_consent_schema.sql` creates storage and
  cutoff state;
- `20260719115887_order_dva_customer_consent_challenge_rpc.sql` creates the
  no-data capability and guest mailbox-challenge boundary;
- `20260719115888_order_dva_customer_consent_recording_rpc.sql` creates the
  proof-gated consent-recording boundary and grants; and
- `20260719115889_order_dva_customer_consent_backstop.sql` installs persistence
  enforcement and catalog checks.

The schema module creates the RLS-locked, append-only
`order_dva_customer_consents` table, the RLS-locked short-lived
`order_dva_customer_consent_challenges` table, and a
single-row `order_dva_consent_contract_state` whose database timestamp is the
immutable consent cutoff. Each
receipt stores a database-generated id, order id with `ON DELETE RESTRICT`,
merchant/customer identity snapshots, lowercase SHA-256 of the normalized
recipient email rather than the raw address, consent source, exact disclosure
version, exact locked outstanding amount/currency, a canonical
`consent_subject_fingerprint` over order/merchant/customer-email hash, amount,
currency, provider, due/expiry terms, and disclosure version, database consent timestamp,
nullable authenticated-customer id,
nullable signed-link token digest, proof id, canonical evidence fingerprint,
and creation timestamp. Its source is exactly
`checkout_bank_transfer_action` or `invoice_acceptance_link`; there is no
merchant/staff-attestation source. A unique evidence fingerprint makes an exact
retry idempotent, while a receipt can authorize only its one order, customer
identity, provider, amount/currency, payment-terms fingerprint, and disclosure
scope. It cannot be copied to a
wallet DVA, another invoice, or another customer. No raw IP address, user agent,
email-link token, raw challenge code, or payment credential is stored. A guest
challenge stores only its id, order/merchant/recipient hashes, signed-link nonce
digest, domain-separated challenge-code HMAC, database expiry of at most ten
minutes, bounded attempt count, consumed timestamp, and creation time.
Challenges are single-use, scoped to one link nonce and disclosure, rate-limited
per order/recipient/consent-subject fingerprint in the database, and retained
only for the bounded audit/
abuse window. A service-role-only cleanup RPC deletes consumed or expired
challenges only after 30 days in batches of at most 500; the authenticated cron
route runs at most ten batches daily and never deletes consent receipts.

The challenge-RPC module adds the no-data
`get_order_dva_customer_consent_contract_version()` RPC, which returns exactly
`consent_v1`, plus route-proof-gated
`issue_order_dva_customer_consent_challenge`. The recording-RPC module adds
`record_order_dva_customer_consent`. Those functions use the exact
`issue_order_dva_customer_consent_challenge` and
`record_order_dva_customer_consent` actions already registered by the preceding
payment-orchestration proof-config module. The issue RPC locks and revalidates
the payable order, recomputes the authoritative outstanding balance and consent-
subject fingerprint, rejects drift from the signed link, enforces cooldown/
outstanding-challenge limits, stores only
the server-supplied HMAC digest, and returns the challenge id plus the locked
order's server-resolved delivery email only to the route's bounded internal
result parser. The route seals the challenge id, order id, link nonce digest,
and expiry into a `Secure`, `HttpOnly`, `SameSite=Strict` cookie scoped to the
exact consent path with a ten-minute maximum age; the public body and logs omit
both the id and email. The request/link cannot supply or override the delivery
address, and the route uses its
request-scoped anonymous/authenticated client rather than an admin client. Only
after commit does the server send the raw code to that recipient. A send failure
that is provably pre-dispatch leaves the challenge unused until expiry, exposes
no code or DVA, and permits a new challenge only under the same bounded database
cooldown. An accepted or transport-indeterminate send keeps that exact challenge
valid, returns only fixed non-enumerating copy, and never triggers an immediate
second code; the customer may request a replacement only after cooldown. The recording RPC locks and
revalidates the still-payable NGN order, derives
the authoritative outstanding balance, consent-subject fingerprint, and
merchant/customer/email evidence itself, requires either the authenticated
customer bound to that order or a proof-bound guest capability validated by the
server route. A guest capability additionally requires the same link nonce and
an unexpired challenge whose submitted code HMAC matches under lock; each wrong
attempt increments the committed bounded counter, and exhaustion invalidates
the challenge. Wrong attempts return structured `invalid_code` or
`challenge_exhausted` outcomes rather than raising away the counter; the route
maps them to fixed `400`/`429` responses and makes no provider call. Success
consumes it and inserts or returns the exact receipt in
one transaction before any Paystack
create/get call. Merchant owners and staff are explicitly rejected as consent
actors even when they own the order. `anon` and `authenticated` receive only
execute on the no-data capability plus the two proof-gated user-facing RPCs;
all direct consent/challenge table access and cleanup execution are revoked. A forged,
stale, cross-order, wrong-email, wrong-disclosure, or changed-source proof fails
without a receipt or provider call.

The prepared app treats only exact SQLSTATE `42883` or PostgREST `PGRST202`
absence naming `get_order_dva_customer_consent_contract_version` as the
pre-owner-expand unavailable state. Exact `consent_v1` enables recording; a
timeout, permission failure, malformed/empty result, stale schema-cache error,
or unknown version remains fail-closed before Paystack. The RPC migration emits
the committed PostgREST schema-reload notification, and crossing-request tests
allow one capability reread after an exact expected absence/write rejection but
never a blind provider retry. Effective order-DVA readiness additionally
requires the no-data payment-orchestration proof preflight to report a current
matching configuration. Until both checks pass, checkout hides/disables DVA,
merchant routes expose no account, and invoice mail contains only the ordinary
payment link and neutral instructions—no signed consent capability. Agentic
Paystack bank transfer remains independently paused and unadvertised even after
both checks pass; `consent_v1` does not re-enable a pre-order agent flow.

The preparation application containing this behavior must be deployed and its
old request generation drained before owner-expand. While the consent RPC/state
is absent, every order-DVA entrypoint fails closed before a Paystack create/get
call; ordinary invoice links and non-DVA payment methods remain available. The
backstop module then installs a compatibility trigger on
`order_payment_accounts`: every insert or receiving-identity change at or after
the consent cutoff must have one exact pre-existing receipt for the same locked
order, merchant, customer/email evidence, provider, currency, and disclosure.
The receipt's locked amount and consent-subject fingerprint must also equal the
current authoritative balance and terms; any order amount, recipient, due-date,
currency, provider, or disclosure change invalidates reuse and requires a new
customer action.
The same owner-expand module installs the shared canonical-bank fixture/helper,
acquires the provider/account advisory before its order and wallet-row locks,
and checks every retained same-provider/account wallet receiver, including
`disabled`, before allowing the legacy insert/update. A matching canonical bank
makes
the trigger atomically create/reuse the fingerprinted
`order_dva_wallet_assignment_conflict` review and operations alert, then return
`NULL` from the row trigger so no projection mutation commits. It does not raise
away its review. The preparation application requires exactly one returned
persisted row before using the provider result. Its initialize, generate-DVA,
and ship-on-credit legacy `insert` shapes and the automatic-invoice legacy
`upsert` shape all request the plural specific-column representation with
`.select('id, order_id, provider')`; the shared adapter validates that the
returned value is an array of exactly one row before exposure. It must not call
`.single()` or `.maybeSingle()` here: PostgREST condemns and rolls back a
mutation transaction when a singular representation has zero rows, which would
erase the trigger-created purpose review. A successful plural zero-row response
therefore commits the review, maps to the bounded wallet-purpose
conflict/omission behavior, and cannot fall through to a duplicate-read
fallback, an existing projection, or a raw Paystack response. More than one row
is an invariant failure with the same no-exposure behavior.
Thus the owner-expand database backstop closes the purpose race before the
later epoch-aware assignment RPC replaces it.
An uncanonicalizable retained wallet bank on the same provider/account follows
the same omission path with unresolved-identity review; only a distinct proved
canonical bank clears the alias.
This backstop rejects a stale pre-preparation request that crosses the migration
after its provider call, so it cannot persist or expose the account. The later
epoch-schema migration links each post-cutoff legacy projection to that exact
receipt; a missing or non-unique link is a contract blocker, while audited
pre-cutoff epochs remain nullable legacy evidence.

Direct checkout consent is an explicit customer action, not selection inferred
from a default payment method. The bank-transfer UI displays the fixed
`order_dva_v1` disclosure plus merchant identity, exact locked amount/currency,
and applicable due/expiry terms before its button. Its versioned substance is:
`By continuing, you authorize <merchant> and Baci to use your customer and email
details to request or retrieve a Paystack bank-transfer account for this invoice
of <amount/currency>. This does not authorize a debit.` Only that click submits
`dva_consent = true` and the exact disclosure version. The initialize route
records the receipt first, then may call Paystack. Missing or false consent,
an absent/mismatched disclosure version, or a non-customer merchant/staff caller
returns `ORDER_DVA_CUSTOMER_CONSENT_REQUIRED` without creating/retrieving a DVA,
constructing an admin client, or exposing existing bank details.

Merchant-created invoices and ship-on-credit orders send no automatic DVA.
Only after both readiness preflights pass may their invoice/payment message
contain a high-entropy signed consent link
whose HMAC payload binds action, order id, merchant slug, recipient-email hash,
locked outstanding amount/currency, consent-subject fingerprint, disclosure
version, nonce, issued-at, and a maximum seven-day expiry. The
server-only `ORDER_DVA_CONSENT_LINK_SECRET_CURRENT` and optional
`ORDER_DVA_CONSENT_LINK_SECRET_PREVIOUS` values are each at least 32 bytes,
never sent to the database or client, and previous-secret acceptance requires
the server-only `ORDER_DVA_CONSENT_LINK_SECRET_PREVIOUS_EXPIRES_AT` timestamp.
Production configuration fails closed when the current secret is absent or a
previous secret lacks a valid future expiry. The email link contains no raw
email and places its signed capability only in the URL fragment, never the
request path or query. Before posting the fragment, the bootstrap initializes
the repository's existing non-secret double-submit cookie through `GET
/api/csrf` and uses the existing API client to attach its matching header.
Fragment bootstrap, challenge issue, and consent submission each call
`checkCsrfProtection`, reject an `Authorization` header on this browser-only
action route, and require exact canonical `Origin` before reading or setting
either sealed capability cookie. Because
ZeptoMail configures click/open tracking at the
Agent level rather than per send, consent-link and challenge-code mail uses only
a dedicated platform-domain ZeptoMail Agent with both tracking modes disabled
and saved-email-content retention disabled, authenticated only by server-only
`ZEPTOMAIL_CONSENT_TOKEN`; it never passes through the generic
`sendEmail` transport or a merchant Agent that may rewrite links. Missing
configuration or a send whose controlled-inbox source does not preserve the
exact fragment URL fails closed without a DVA. If an invoice message contains
the capability, that entire message uses this dedicated transport; a message
sent through the existing generic confirmation path may contain only the
ordinary payment link and neutral bank-transfer instructions, never the signed
fragment. This transport choice does not broaden the design's explicit non-goal
for creation-time invoice-email durability. The dedicated helper still uses the
existing send-attempt audit and transport-outcome classifier, but its audit row
stores only message type, order/merchant ids, disclosure version, recipient
scope, provider message id, and bounded error metadata—never the signed href,
fragment, raw code, code HMAC, cookie, or request body. A minimal same-origin bootstrap
copies the fragment into memory once, synchronously clears it with
`history.replaceState` before any network call, initializes CSRF, posts the
copied token in a redacted request body to establish the link session, zeroes its
in-memory reference in `finally`, and receives only a `Secure`, `HttpOnly`,
`SameSite=Strict` cookie scoped to the exact consent path and bounded by the
link's remaining seven-day lifetime. The link always uses the canonical platform
origin and isolated `/auth/bank-transfer-consent/<order id>` route, which is
already protected from merchant-slug rewriting and receives the current proxy's
nonce-based auth CSP plus disabled camera/microphone policy; no `proxy.ts` change
is required. Merchant identity
remains signed in the capability rather than selecting a custom-domain origin.
Fragment bootstrap, challenge issue, and consent submission all post to the
child `/auth/bank-transfer-consent/<order id>/action` handler. Both sealed
cookies use path `/auth/bank-transfer-consent/<order id>` so they reach only that
page and child action, never the generic `/api` namespace or another order.
That route does not inherit the storefront layout. `RootDynamicBody` becomes a
client component that uses `usePathname()` and a segment-boundary-aware match
for exactly `/auth/bank-transfer-consent` and
`/auth/bank-transfer-consent/...`; it returns `null` before mounting
`PostHogClientBootstrap`, `PostHogPageviewTracker`, `WebVitalsReporter`, or
`DeferredPlatformInsights`. It must not use `headers()` or the proxy's
response-only `x-pathname`, must not make the root layout request-dynamic, and
requires no `proxy.ts` change. Every application-produced entry to or exit from
the consent surface uses an ordinary `href`/full-document navigation, never
`next/link`, `router.push`, or `router.replace`. This prevents the consent
document from inheriting a PostHog or platform-insights runtime already
initialized by a preceding single-page navigation; introducing SPA navigation
to this surface later requires a separately reviewed synchronous analytics
shutdown contract. On a direct consent load, the root imports may remain in the
compiled application graph, but none of the four reporters mounts, boots,
registers observers, drains queued telemetry, dynamically imports its analytics
SDK, or sends analytics traffic. The bootstrap response is `no-store`; the page
is `noindex,nofollow` with inherited canonical/verification metadata cleared,
emits `<meta name="referrer" content="no-referrer">` plus `Cache-Control:
private, no-store`, loads no runtime third-party analytics module or request, and
never logs the fragment. A scanner that performs only
the fragment-free `GET` sees a generic disclosure shell; even a scanner that
executes the bootstrap creates only its own inert browser session.
During rotation, the retired current secret becomes previous and its expiry is
at least seven days plus ten minutes after rotation so every already-issued link
and challenge can either complete or expire; verification computes the
domain-separated candidate HMAC under current and still-valid previous values
in constant time. New links/challenges use only current.
Its `GET`/session bootstrap performs no database/provider/email mutation, so
email scanners cannot consent or send a challenge. Every later action validates
the sealed link session, signature age, canonical origin, still-payable order,
recipient hash, locked amount/currency, consent-subject fingerprint, nonce, and
disclosure version. An authenticated customer still
bound to the order may use the explicit consent `POST` directly. A guest's first
explicit `POST` creates the
bounded challenge, and sends a fresh one-time code separately to the server-
resolved invoice email; it records no consent and makes no provider call. The
guest's second explicit `POST` carries only the code in the request body, never
the URL or logs; the server verifies the sealed challenge cookie and binds its
id into the recording proof. After the RPC atomically validates and consumes
that challenge, it clears the cookie, records the `invoice_acceptance_link`
receipt, and only
afterward may the route create/retrieve and persist the DVA. Possession of a
forwarded bearer link without access to the bound recipient mailbox is therefore
insufficient. A failed provider/persistence call leaves the consent receipt
safe for an idempotent retry. An expired link can be replaced by a newly signed
invoice message while the order remains payable; it is never extended by
trusting a client timestamp.

The merchant-only generate-DVA and ship-on-credit routes may use an existing
matching consent receipt but may not create one. Without a receipt,
generate-DVA returns HTTP `409` with
`ORDER_DVA_CUSTOMER_CONSENT_REQUIRED`; ship-on-credit still completes its
non-payment operation with `virtualAccount: null`. The automatic invoice path
may create a DVA only when the same customer/guest request carries the explicit
`order_dva_v1` action and its receipt commits; otherwise it sends the ordinary
payment link plus consent CTA without bank details. A legacy DVA exposed before
this cutoff remains immutable matching evidence, so a real captured transfer is
still reconciled, but it is not proof of consent and is not newly rendered or
returned until the customer records a receipt. The epoch migration links an
exact receipt already recorded for a legacy current projection during backfill;
after migration, only the proof-gated assignment RPC may perform one audited
`NULL -> customer_consent_id` transition on a still-current pre-cutoff epoch
before re-exposure. It can never replace a non-null link or change receiving
identity, `assigned_at`, payable snapshot, or transaction evidence. Missing consent never converts
received money into a zero-candidate or ambiguous payment outcome.

Every later customer- or merchant-visible DVA read goes through one server-only
batch-capable `get-renderable-order-dvas` wrapper. It calls a narrow
authenticated `SECURITY DEFINER` `get_renderable_order_dvas(uuid[])` RPC in
bounded chunks through the caller's scoped Supabase client; `anon` and `PUBLIC`
have no grant. The RPC independently derives `auth.uid()`, rejects an oversized
or malformed batch, and returns a row only when either the order's
merchant-scoped `customers.user_id` equals that identity or
`public.check_staff_permission(auth.uid(), order.merchant_id, 'orders',
'view')` returns true. The existing helper grants the owner path and requires an
active staff membership with the effective `orders.view` permission; merely
being active staff is insufficient. The RPC never trusts the caller's claim
that an order id is authorized and never returns a denial reason or conflicting
wallet identity. Internally it selects specific columns from
each current payment-account projection, its exact current epoch, and the linked
consent receipt; it returns bank details only when the
projection/epoch relationship is current and internally consistent, the order
remains payable with a positive authoritative balance,
and `customer_consent_id` points to the exact order/customer/provider/amount/
currency/terms/disclosure receipt. Under the same canonical receiving-identity
classification, it also requires no retained wallet DVA of any status at that
provider/bank/account and no same-provider/account wallet row with unresolved
bank identity; `disabled` does not erase historical purpose, so a purpose
collision or unresolved alias is hidden until reviewed.
It returns `null` for paid, cancelled, failed,
refunded, abandoned, returned, superseded, stale-identity, unlinked, or
scope-mismatched rows. Query or schema errors fail the route without details,
never fall back to a raw account join. Before this RPC's exact render-contract
capability exists, the preparation application returns no DVA rather than using
legacy direct reads. The chunked batch form prevents an N+1 query on the
storefront order list; single-document callers use the same projection with one
id.

The projection module exposes a no-data
`get_order_dva_render_contract_version()` capability. The wrapper accepts only
exact `render_v1`; exact named `42883`/`PGRST202` absence is the preparation
state and returns a null map, while timeout, permission, malformed, or unknown
responses fail the route without details. A request crossing installation may
reread capability once, but never falls back to direct tables or a service-role
client. The RPC has an empty search path, explicit schema qualification, a fixed
maximum of 100 unique order ids per call, deterministic deduplicated output,
and no side effect. The TypeScript wrapper chunks a larger already-authorized
order list and treats any chunk failure as a whole-response failure.

This projection replaces the current direct reads in merchant invoice download,
merchant payment reminders, customer storefront order list/detail, and the
shared storefront-account document data used by its JSON, invoice-PDF, and
receipt-PDF routes. Initial exposure from an explicit initialize/generate/
consent action may use only the successfully committed assignment RPC result;
all later retrieval uses this projection. The ordinary payment link and a
merchant's static settlement-bank instructions remain available, but neither is
mistaken for a customer-specific Paystack DVA. A source-contract test inventories
every non-test outward serializer of `order_payment_accounts` account number,
bank, or name and fails if it bypasses the committed-assignment result or this
projection. Matching, cancellation expiry, reconciliation, and service repair
reads are non-presentation paths and remain governed by their separate contracts.

The DVA epoch-schema module also adds the compatibility mirror
`order_payment_accounts.payment_transaction_id uuid NULL REFERENCES
transactions(id) ON DELETE RESTRICT`. The authoritative epoch column has the
same foreign key plus a partial unique index for non-null values, so one
transaction can belong to at most one order-DVA assignment epoch. The deferred
projection check requires the mirror to equal the unsuperseded epoch's pointer;
historical epochs retain their own pointers independently.

All four paths must replace their separate account-row and transaction writes
with one route-proof-gated `SECURITY DEFINER` RPC,
`persist_paystack_order_dva_assignment`. The route first validates its existing
merchant/staff or customer/guest order capability, creates or retrieves the
provider DVA, but does not yet expose the bank details. They share one
TypeScript wrapper so input normalization, fee-unit conversion, proof creation,
RPC result validation, and error mapping cannot drift between routes. The
wrapper creates a short-lived `payment-orchestration-rpc-proof:v1` HMAC with
action `persist_paystack_dva_assignment` only after
the Paystack result exists. Its canonical payload binds the proof id, issued-at,
action, order and merchant ids, normalized customer capability when applicable,
provider, full receiving-account identity, exact normalized provider-assignment
customer email, exact provider customer code, expiry, BAC reference, currency,
locked payable amount, fee inputs, exact `customer_consent_id`, and the
receipt's consent-subject and canonical evidence fingerprints. The wrapper then calls the RPC through
the request-scoped authenticated or anonymous Supabase client; it must not use
an admin/service-role client for this user-facing persistence. The RPC must:

1. validate the route proof, its exact canonical payload hash, fixed five-minute
   age window, current/previous secret rotation window, and constant-time
   signature before mutation; then authorize the locked order against either
   the authenticated merchant/staff/customer identity or the proof-bound guest
   capability. A direct caller cannot change any account, amount, fee,
   reference, consent receipt, or order field without invalidating the proof.
   The RPC locks the receipt and requires its order, merchant, provider,
   locked amount/currency, normalized-recipient-email hash, disclosure version,
   consent-subject fingerprint, and canonical evidence fingerprint to match the
   proof, freshly locked order, and assignment; merchant/staff
   identity can authorize the order operation but can never substitute for the
   receipt's customer actor;
2. acquire the account-scoped
   `baci_paystack_dva_account:<provider>:<account number>` advisory lock, then
   the existing `baci_order_payment:<order id>` advisory lock, and finally lock
   the order, current Paystack projection, all of its assignment epochs, and
   their capture links plus any terminal snapshot;
   this is the same account-before-order sequence used by reservation. A genuine identity
   replacement acquires both old and new provider/account advisory keys in
   sorted order before the payment/order locks;
3. after the target order lock and before assignment mutation, lock every
   retained wallet-account row with the same provider and account number. Any
   row with the same canonical bank, including `disabled`, is an immutable
   purpose collision even when merchant/customer/provider-customer identity
   agrees; missing or contradictory ownership is a stronger conflict, never a
   reason to repurpose the receiver. A row with missing or uncanonicalizable
   bank aliases is unresolved and follows the same fail-closed outcome; only a
   different proved canonical bank is irrelevant. Return the typed
   `wallet_purpose_conflict` outcome without persisting or exposing the order
   DVA, and atomically create/reuse the exact-fingerprint
   `order_dva_wallet_assignment_conflict` review plus one operations alert. Its
   metadata stores local order/wallet/merchant/customer ids and hashed receiver/
   provider-customer evidence, never raw bank details. This is the reciprocal
   of wallet assignment's payable-order collision guard and uses the same
   account-before-order-before-wallet-row lock order, so concurrent order and
   wallet assignment cannot both commit;
4. reject cancelled, paid, refunded, otherwise non-payable, non-NGN, or
   active-provider-cancellation-held orders;
5. calculate the authoritative outstanding balance using the locked ledger
   formula above rather than trusting a client-supplied amount;
6. preserve an idempotently retrieved current receiving and provider-customer
   identity, payable snapshot, and `assigned_at`. For a pre-cutoff current epoch
   whose consent link is still null, attach the exact locked receipt once before
   exposure and audit that transition without creating a replacement epoch;
   reject any attempt to replace a non-null link. When provider, account
   number, canonical bank, assigned customer email, provider customer code, or the
   assignment-time payable amount genuinely changes after exposure, append a
   new assignment epoch and atomically mark the previous current epoch with
   `superseded_at` and `superseded_by_epoch_id`, then update the compatibility
   projection and `current_epoch_id`; never update the old epoch's receiving or
   provider-customer identity, assignment timestamp, payable snapshot, or
   transaction link in place;
7. maintain exactly one current linked DVA intent pointer per assignment epoch
   and exactly one display-current epoch:
   - reuse the selected epoch's linked pending transaction when its order,
     merchant, amount, currency, fee values, and DVA metadata still match;
   - when the locked outstanding balance changed, follow step 6: append a new
     display-current epoch and link its correctly priced assignment-intent
     transaction. Never detach or replace the prior epoch's transaction
     pointer merely to reprice the invoice;
   - do not cancel or detach a prior epoch's pending intent merely because an
     identity or payable change appended a new display-current epoch; a later
     transfer based on the old exposed evidence must still resolve through that
     exact epoch or fail to review if its amount no longer equals the current
     outstanding balance;
   - reject rather than replace a linked processing, completed, externally
     referenced, differently owned, or non-DVA transaction; and
   - tag every new transaction with `payment_method = 'dva'`,
     `metadata.gateway_reference_role = 'internal_bac'`, and
     `metadata.dva_epoch_link_role = 'assignment_intent'`, and
     `order_payment_account_id = <current projection id>` plus
     `order_payment_account_epoch_id = <epoch id>`, along with the canonical
     receiving bank and provider-customer identity used by that epoch; every
     creation first acquires
     the existing BAC-reference advisory lock and rejects a BAC reference owned
     by another transaction;
8. preserve monotonic order payment state: an `unpaid` order may advance to
   `pending`, an existing `pending` order remains `pending`, and a
   `partially_paid` order must remain `partially_paid`; the RPC never accepts a
   caller-supplied payment status and never downgrades ledger evidence while
   creating or superseding a DVA intent;
9. write the epoch's immutable `payment_transaction_id` assignment-intent link
   and reciprocal transaction metadata in the same database transaction,
   including canonical bank evidence, normalized assigned customer email,
   provider customer code, identity source/fingerprint, and both explicit
   reference/link roles. The RPC derives the lowercase SHA-256 customer
   evidence fingerprint from the validated canonical proof payload; it does not
   accept a caller-selected fingerprint.
   Update the projection mirror only when that epoch is the unsuperseded current
   epoch; this RPC never writes a matched-capture link; and
10. return the display-current assignment epoch id, transaction id, BAC
   reference, exact persisted provider-customer identity, customer consent
   receipt id, and locked payable amount. An identical proof or route retry is
   idempotent; a validly signed
   payload whose proof-bound payable amount no longer equals the freshly locked
   amount fails stale rather than persisting changed evidence.

The payment-orchestration proof-config module creates the RLS-locked private current/previous
payment-orchestration secret configuration used by this proof and the
gateway-initialization actions below, following the repository's existing
quiz RPC-proof pattern, plus a no-data `payment_orchestration_rpc_secret_configured`
preflight and proof validator. No secret value is committed in a migration.
Its checked action/schema allowlist includes
`issue_order_dva_customer_consent_challenge`,
`record_order_dva_customer_consent`, `persist_paystack_dva_assignment`,
`persist_initialized_gateway_payment`, and `wallet_dva_account_persist` plus the
named gateway-initialization claim/finish actions; an unknown action or payload
schema is rejected before signature acceptance.
Production requires matching server-only
`PAYMENT_ORCHESTRATION_RPC_SECRET_CURRENT` and database current secret values; an
optional previous secret has an explicit expiry for rotation. The expand
application contains the proof helper and configuration check before the
contract bundle can install the new persistence body. Missing, mismatched,
expired, malformed, or stale proof configuration fails closed before a DVA is
shown. Only the checked-in service-role configuration/verification script may
write the private secret table; no user-facing route receives table access.

If any assignment or transaction write fails, the RPC rolls back both. The DVA
must not be returned, rendered, or included in an invoice until this RPC
succeeds. The explicit initialize and generate-DVA routes return a retryable
`5xx` with a stable application-owned code and no bank details or raw provider/
database message. The ship-on-credit route may still confirm the
credit order because DVA creation is optional, but must return
`virtualAccount: null` and log the failure rather than exposing an untracked
account. The automatic invoice path may send an invoice without DVA details
only when its ordinary payment link remains present; it must omit the bank
details and emit a structured error instead of embedding an untracked account.
A later explicit DVA request can safely repair the assignment through the same
atomic RPC.

The shared wrapper maps `wallet_purpose_conflict` to HTTP `409` code
`ORDER_DVA_WALLET_PURPOSE_CONFLICT` with fixed guidance to use another payment
method or contact support; it returns no account, wallet owner, customer, or
provider detail. Generate-DVA and initialize fail closed with that response.
Automatic invoice and ship-on-credit preserve their non-DVA operation exactly
as above but omit the account and emit only the bounded conflict code. An exact
retry reuses the same review and alert.

An idempotent existing-DVA response must also pass through
`persist_paystack_order_dva_assignment`. A linked valid transaction is reused.
An unlinked legacy current epoch receives a newly created, linked DVA
transaction and synchronized projection mirror; the route must not return the
existing account if that repair fails. Merely retrieving the same assignment
must not refresh `assigned_at`, because doing so could make an already-sent
transfer appear to predate its assignment.

A provider response that changes receiving identity appends a new epoch only
after its linked transaction commits. The old epoch remains matchable and is
never returned as the current invoice account. A retry with the same new
identity reuses that epoch; concurrent replacements serialize under the sorted
old/new account locks, epoch partial uniqueness, and the projection constraint
rather than creating two current epochs.

Existing rows retain their assignment timestamp and payable evidence, but they
are match-compatible only after their immutable provider-customer identity has
been proved. They are not assumed to own an arbitrary existing pending
transaction or the order's current email.

`/api/payments/initialize` currently constructs `createAdminClient()` and uses
it for the order snapshot, wallet/savings amount, merchant, feature settings,
and `create_payment_transaction`. Changing only its DVA branch would leave a
user-facing service-role bypass in the same modified route. The contract
application must remove that client and all direct privileged table reads from
the route.

Add a shared `createRequestScopedPaymentClient(request)` helper. It uses the
anon key for a guest, forwards a validated mobile Bearer token into a
request-scoped Supabase client, or uses the ordinary cookie-backed server client;
it never imports an admin/service client. Move the route's inline request Zod
objects to `schemas/payment-initialize.ts`. The route authenticates when a
session is present, but guest checkout retains the existing order-id plus
normalized-email capability. Cookie-authorized requests must pass the existing
CSRF contract; mobile Bearer and guest capability requests carry no ambient
cookie authority and remain subject to the route's rate limit and proof-bound
mutation checks.
Remove the current raw request-body console log, which includes customer PII.
Payment-initialize logs may contain only the redacted order/reference/error
fields already supported by the payment log sanitizer; they must never contain
the customer email/phone, account number, proof signature, secret generation,
claim token, or unsanitized provider response.
The shared order, wallet, and agentic Paystack dedicated-account helpers and all
of their route callers follow the same rule. Remove the current
`createDedicatedAccount` and generate-DVA success/error fields that log the raw
account number or provider customer code, and remove agentic masked-account
logging as well. No dedicated-account helper, order route, wallet route, agentic
route, audit, or drain may log a full or partial customer code/email/phone,
account number/name, raw provider payload/message, consent proof, or link/
challenge material. Operational logs may retain only opaque local order/session/
reference ids and bounded application-owned result/error codes. Tests exercise
success, provider failure, malformed response, fallback-bank, persistence
failure, and agentic conflict paths with canary values and assert that no
captured structured log contains any canary, account suffix, or raw response.

Replace the scattered privileged reads with one narrow `SECURITY DEFINER`
`get_payment_initialize_context(p_order_id uuid, p_email text)` RPC granted to
`anon`, `authenticated`, and `service_role`. With an empty search path it
acquires the payment advisory lock, locks the order, validates the exact guest
capability or authenticated customer/merchant/staff scope, and returns only the
server inputs already required by the route: authoritative order/merchant ids,
payable residual after existing wallet/savings evidence, currency, terminal
statuses, tracking token, merchant name/slug/Paystack subaccount configuration,
the checked gateway feature settings, and a canonical payment-configuration
fingerprint. It rejects terminal/non-payable
orders, active provider-cancellation holds, inconsistent redemption evidence,
merchant mismatch, and nonpositive
residual. The context is a snapshot for provider initialization, not mutation
authority; the persistence RPC must revalidate it under the same locks.

For ordinary non-DVA, non-internal-credit gateway initialization, add
`persist_initialized_gateway_payment`, using proof action
`persist_initialized_gateway_payment`. The route signs only after the provider
returns and binds the full canonical gateway, reference/session identity,
order/merchant/customer capability, amount/currency, fees, sanitized metadata,
expected order state, and the context's payment-configuration fingerprint. The
request-scoped client calls the RPC, which
relocks the order, recomputes the authoritative residual and feature policy,
validates the complete proof, rechecks that no provider-cancellation hold began
after context lookup, creates/replays the pending transaction, and
advances only the allowed payment status atomically. A stale amount or changed
order fails without exposing the provider checkout result; the orphan provider
session remains unreachable. After a valid proof but conflicting locked state,
the same RPC creates or reuses an exact provider-reference/fingerprint
`gateway_initialization_persistence_conflict` review and operations alert and
returns its review id without inserting a transaction. Invalid or forged proof
fails before review creation. The existing
`create_payment_transaction` signature remains for its separately authorized
merchant callers but is no longer called by this route.

The DVA branch calls only `persist_paystack_order_dva_assignment`, because that
RPC already creates and links its transaction. An internal-credit residual
calls only the gateway-initialization claim/finish contract, whose finish owns
its BAC transaction. Neither branch also invokes
`persist_initialized_gateway_payment`; tests must reject a double insert.

The late-payment contract bundle cannot immediately revoke direct
`order_payment_accounts` writes because Baci deploys migrations before the new
application and the still-live expand application uses the legacy direct path.
It therefore adds non-null `assignment_contract_touched_at` to the current
projection and `contract_touched_at` to every epoch. The compatibility capture
trigger refreshes them on every insert and every update that changes
order, provider/account-number/bank identity, assignment amount/time,
transaction linkage, projection pointer, or epoch supersession state, plus an RLS-locked
`order_payment_account_contract_state` singleton containing the database
cutoff. The migration first backfills existing projections and their initial
epochs with
`LEAST(COALESCE(assigned_at, created_at, v_cutoff - interval '1 microsecond'),
v_cutoff - interval '1 microsecond')` under its DDL lock, records that captured
`v_cutoff` as `legacy_direct_write_cutoff_at`, then installs the current-time default/NOT NULL and
trigger, and only then releases its DDL lock. An update that changes only
`expires_at` preserves the previous touch timestamp from this first trigger
version onward. A legacy application assignment upsert waiting behind the
migration therefore succeeds against the preserved baseline constraint but
creates a post-cutoff touched epoch, while cancellation of an old unlinked
instrument does not manufacture an unrepairable assignment. The proof-gated RPC
always writes the linked epoch, projection mirror, and transaction contract;
any legacy application identity/amount/linkage/current-state write during the
migration-first window is therefore visible as post-cutoff epoch evidence.

After the contract application is live and legacy assignment traffic has
drained for 15 minutes, a checked-in service-role audit/repair CLI examines
every Paystack projection or epoch touched at or after that cutoff. It repairs
an unlinked epoch only through the service-role-only
`repair_paystack_order_dva_epoch_link` RPC with fresh provider/account/bank and
provider-customer proof. That RPC takes the same
account/order/projection/epoch/capture-link/terminal-snapshot locks, accepts
only an unlinked epoch created by the compatibility trigger, verifies its
immutable receiving and provider-customer identity and exposure
snapshot, and creates one BAC-preserving `internal_bac` transaction: `pending`
only when the order is still payable, otherwise `cancelled` and explicitly
tagged `terminal_assignment_evidence` without changing the order. It links that
epoch and updates the projection transaction mirror only when the
epoch is current and never changes which epoch is current. Its amount and explicit fee inputs
must exactly match the epoch's NGN payable snapshot under the same fee contract;
it never adopts an arbitrary existing transaction. A repair accepts and
recomputes the exact current evidence fingerprint and atomically resolves only
that epoch's matching open contract review. An already-valid exact link is an
idempotent replay that may resolve its still-open matching review; a different
or contradictory link is never replaced. If repair cannot prove ownership, the CLI
emits a blocking exact-fingerprint review. A missing customer identity may be
filled exactly once only when the same evidence proves the precise normalized
provider-assignment email and Paystack customer code; the RPC records the proof
source/fingerprint and never copies `orders.customer_email`. It may create an
`audited_legacy` terminal snapshot only when the locked historical ledger
reconstructs the first terminal paid-to-date and residual exactly; otherwise
the unresolved terminal row remains a durable ambiguity blocker. It also
proves that every in-place
identity rewrite after the cutoff is absent, every superseded epoch points to
the new epoch and is not the projection target, every projection points to
exactly one unsuperseded same-order/provider epoch and mirrors those immutable
fields, and old epochs retain their original receiving identity,
provider-customer identity, assignment, payable, terminal snapshot, and linkage
evidence. The signed report must show zero
post-cutoff unlinked, reciprocal-metadata-mismatched, dual-current, orphaned-
supersession, projection-drifted, in-place-rewritten, capture-link-orphaned,
capture-link-role-mismatched, assignment-pointer-replaced,
customer-identity-missing/mismatched, or terminal-snapshot-missing/mismatched
rows. Unresolved pre-cutoff evidence is separately enumerated and must have a
durable review rather than being counted as safe.

A separate post-application enforcement bundle ending in
`20260719120220_order_payment_account_enforcement_cutover.sql` reruns that
database preflight, then revokes `INSERT`, `UPDATE`, and `DELETE` on
`order_payment_accounts` from `PUBLIC`, `anon`, and `authenticated` and removes
their write policies while preserving required scoped reads. It installs a
trigger requiring every future touched Paystack current epoch to have a valid
linked assignment transaction, reciprocal DVA metadata, valid append-only
capture links, and an exact immutable-field projection mirror.
Direct epoch-, capture-link-, or terminal-snapshot-table writes were never
granted. It rejects projection identity, provider-customer identity, payable,
assignment-time, or non-null assignment-pointer changes unless the
proof-gated append primitive atomically supersedes the old epoch and creates the
new linked epoch. Matched-capture transactions may be related only through the
reservation primitive and append-only capture-link table; they can never replace
an epoch pointer. At the same cutover it replaces the temporary compatibility trigger topology
with its enforced equivalent: private epoch insertion or changes to transaction
linkage/supersession receive a fresh touch timestamp and require the contract,
while an authorized lifecycle update that changes only projection `expires_at`
preserves the legacy touch timestamp. This keeps customer,
merchant, and provider cancellation able to expire a pre-cutoff unlinked DVA
without allowing its identity to be rewritten or displayed as newly assigned.
Every registered post-contract identity, linkage, and expiry writer must acquire
the canonical provider/account advisory lock before any order row; an identity
replacement acquires old and new keys in sorted order. The bounded legacy
compatibility trigger topology is the only migration-window exception and uses the nonblocking
abort contract above. Writers lock projection, epoch, capture-link, and
terminal-snapshot rows only after their
corresponding order rows, with the projection before sorted epoch rows and
sorted capture links and the single terminal snapshot last; enforcement tests
reject a lifecycle function that
retains the old order-then-unprotected-account write.
Only the proof-gated RPC, registered lifecycle functions, and explicit
service-role recovery remain mutation paths. This migration is deployed in its
own migration-focused PR, together with its required phase marker, replay
hashes/receipt, generated types, and tests, after the contract application is
proven live; it must not be present in the earlier contract deploy artifact.

The current `hasActivePaystackOrderDvaAlias` helper conflates two operations and
must be split. A shared pure classifier in `paystack-dva-order-alias.ts` may
define payable, terminal, and cancelled order-alias states, including the same
no-upper-age active-invoice rule, but it performs no database lookup and accepts
neither assignment nor transfer evidence.

The assignment-time contract,
`checkWalletDvaAssignmentOrderCollision`, runs from
`persistWalletPaymentAccount` before a newly created or fetched wallet DVA is
stored. It accepts only the provider-returned assignment identity available at
that point: provider, merchant/customer owner, canonical receiver account and
bank, exact provider customer code, merchant subaccount code, provider account
id when present, and the assignment observation time. It does not accept
amount, currency, `paid_at`, provider transaction reference, or any other
verified-transfer field because no payment exists.

Those fields have distinct roles. The immutable order-alias collision key is
exactly provider, canonical receiver bank, and receiver account number. For
every still-payable order-DVA epoch under that key, the RPC compares the epoch's
persisted `provider_customer_code` with the wallet provider response. An exact
code is `payable_order_alias`; a missing legacy epoch code is
`provider_identity_unresolved`; and a different non-empty code on the same
receiver key is `provider_identity_conflict`. The order's merchant is loaded
through the locked order row and retained as conflict diagnostics; a different
merchant never makes the same receiver key safe. Merchant subaccount code is
validated against the provider response and the locked merchant Paystack
configuration, while provider account id is validated and persisted as wallet-
object evidence and compared with an existing wallet row on replay/reactivation.
Neither field is an order-epoch join predicate, so the design does not invent
`provider_subaccount_code` or `provider_account_id` on
`order_payment_account_epochs`. A same number at a different canonical bank is
not an alias, and cancelled or otherwise terminal orders are excluded before
this classifier and never block wallet-account assignment.

The TypeScript module validates the bounded provider-returned input, creates the
`wallet_dva_account_persist` payment-orchestration proof described below, and
maps the typed database result. The actual private classifier and wallet-row
insert/reactivation execute atomically inside
`persist_customer_wallet_payment_account`; a pooled application connection may
not perform a query and later insert after releasing the lock. Before the
canonical provider/account advisory, the RPC acquires the owner-scoped
`baci_wallet_dva_owner:<merchant id>:<customer id>:<provider>` advisory. That
owner key is the range lock for the preserved customer/provider uniqueness
contract: it serializes insert, replay, reactivation, and repair even when no row
exists yet and concurrent Paystack responses contain different account numbers.
The global wallet-persistence order is owner advisory, provider/account
advisory, sorted order-payment advisories, locked still-payable order rows and
their projection/epoch rows, then the ascending-id union of the caller's
`(merchant_id, customer_id, provider)` row and every row with the same
provider/canonical-bank/account receiver key. Every contract wallet writer uses
that order. The only live legacy application mutation is the direct `INSERT`
proved by `persistWalletPaymentAccount`; `12015` therefore revokes direct
table privileges from every runtime role and regrants only RLS-scoped
authenticated `SELECT` plus service-role `SELECT` and the bounded legacy
`INSERT`. Service role therefore retains no `UPDATE`, `DELETE`, `TRUNCATE`,
`REFERENCES`, `TRIGGER`, or `MAINTAIN` privilege. Its PostgreSQL-owned before-write
compatibility trigger derives the
trusted `NEW` owner and account keys and calls `pg_try_advisory_xact_lock` for
owner then account. If either is busy it raises retryable SQLSTATE `40001`
before uniqueness checking can wait on an RPC. For a database-owner or security-
definer `UPDATE`, the trigger nonblockingly acquires the sorted union of `OLD`
and `NEW` owner keys first, then the sorted union of `OLD` and `NEW` account
keys; a proof-gated RPC already owns that complete set, so every call is
reentrant. Every other direct runtime-role operation is denied at the privilege boundary
before this trigger can run. Contract tests reject any writer that omits an old
or new key, takes an account key before every owner key, blocks on a trigger
advisory, or treats a possibly absent row as its serialization primitive. The
receiver-owner lookup is part of this
transaction and may not be deferred until a unique-index violation or performed
by the pooled caller.

The private classifier returns only `clear`, `payable_order_alias`,
`provider_identity_unresolved`, or `provider_identity_conflict`. The public RPC
never exposes `clear`; it returns exactly `inserted`, `exact_replay`, or
`reactivated` with the canonical active wallet-account row, or
`payable_order_alias`, `provider_identity_unresolved`,
`provider_identity_conflict`, `receiver_owner_conflict`,
`existing_identity_conflict`, or `pending_review` with a null account row and
the exact nullable review id. `payable_order_alias` creates no wallet row or
review and maps to
`WALLET_DVA_ORDER_ALIAS_CONFLICT`. Unresolved or contradictory order-provider
identity creates/reuses its exact fingerprint review and alert without creating
an active wallet row. `receiver_owner_conflict` means a different
merchant/customer wallet row already owns the same canonical receiver key; it
creates/reuses its dedicated review and alerts and never attempts the insert.
`existing_identity_conflict` means the already-active row for the requesting
merchant/customer/provider is not an exact immutable-identity replay after the
permitted alias normalization and legacy evidence enrichment. It creates/reuses
its dedicated review and alerts, leaves the existing active row byte-for-byte
unchanged, returns no account, and never attempts a replacement insert or
reactivation. One contradictory provider observation cannot silently replace,
disable, or rewrite a DVA that Baci previously exposed.
An existing quarantined customer/provider row remains unchanged and returns
`pending_review`; only the already-defined exact-identity repair can return
`reactivated`. An existing `disabled` customer/provider row is never an exact
replay or automatic reactivation candidate: regardless of whether the new
provider observation agrees, it remains byte-for-byte disabled, returns
`pending_review` with the exact
`wallet_dva_disabled_reactivation_required` review id, and exposes no account.
Re-enabling it requires a separate authenticated, reviewed workflow that proves
why it was disabled and is outside this change. Malformed input,
invalid/expired proof, or scope mismatch raises a fail-closed error before any
result or mutation.

Outcome precedence is deterministic after all rows are locked: a non-`clear`
order-alias classification returns first; otherwise a different receiver owner
returns `receiver_owner_conflict`; otherwise the caller's existing
customer/provider row is classified as disabled-review, exact replay,
reactivation, `existing_identity_conflict`, or `pending_review`; only a fully
clear request with no existing row inserts. A branch may create only its
specified review and alerts and cannot fall through to a later branch or
manufacture two public outcomes for one provider observation.

The route maps `provider_identity_unresolved`, `provider_identity_conflict`,
`receiver_owner_conflict`, `existing_identity_conflict`, and `pending_review` to
HTTP 409 with exactly
`code = WALLET_DVA_PENDING_REVIEW` and the fixed safe message `This bank transfer
account could not be activated and is being reviewed. Please try again later.`
It never forwards a database/provider error message or exposes another order,
merchant, customer, customer code, receiver owner, account fingerprint, or
review metadata. The legacy `WALLET_DVA_RECEIVER_CONFLICT` application code
remains recognized only for the bounded old-application compatibility branch
and maps to that same fixed response; the contract RPC never emits it.
The preparation application adds both
`WALLET_DVA_TEMPORARILY_UNAVAILABLE` and `WALLET_DVA_PENDING_REVIEW` to
`CustomerWalletPaymentAccountErrorCode` and
`WALLET_FUNDING_TELEMETRY.reasons`, even though only the temporary result is
reachable before the contract schema exists. Their existing compile-time
exhaustiveness guards must still pass. `resolveWalletFundingFailureReason`
preserves either code rather than collapsing it to `other`.
`wallet-funding-copy.ts` owns both identical safe customer messages, and
`WalletFundingPanel` selects them by code without rendering the response's
`error` field.

The preparation application, not only the later contract application, ships a
dual-schema wallet-persistence adapter before any wallet migration. Only an
exact SQLSTATE `42883` or PostgREST `PGRST202` undefined-function result that
names `get_wallet_dva_persistence_contract_version`, or an exact parsed
`legacy_direct_v0` capability, uses the bounded direct service-role path. A
timeout, permission failure, generic schema-cache message, malformed/empty
result, unexpected version, or any other probe failure returns the fixed
temporary-unavailable result without attempting direct DML. In the legacy path,
a SQLSTATE `23505` may return an existing account only after the
adapter compares merchant, customer, provider, canonical bank/account, provider
customer, subaccount, and provider account id with the provider response. The
nullable provider account id is exact only when both values are absent or both
are the same non-empty normalized value; a one-sided absence is a conflict. An
exact tuple is legacy idempotent replay only when the retained row is
`active`. An exact `pending_review` or `disabled` row, or any non-exact tuple,
returns
HTTP `503` with `code = WALLET_DVA_TEMPORARILY_UNAVAILABLE` and the fixed text
`This bank transfer account is temporarily unavailable. Please try again.` It
returns no account, raw database message, receiver evidence, or provider
payload and does not rewrite status. The old schema cannot create the later
durable disabled-reactivation review, so availability remains fail-closed until
`rpc_v1` can classify the same provider observation transactionally. The
preparation error-code, copy, and telemetry vocabularies include
that bridge result before migration; it is never represented as a successful
account or a durable review that the old schema cannot support.

The prepared POST route makes the client boundary explicit rather than passing
one privileged client through `ensureCustomerWalletPaymentAccount`. It first
resolves an already-active account through the authenticated request client and
may return that RLS-scoped row without a capability probe. Only when creation or
persistence is needed does it read the capability through that same request
client, after auth, CSRF, Zod, merchant/customer scope, and the feature flag but
before any Paystack create/get request. The adapter receives the request client
plus a lazy `getLegacyAdminClient` factory; it may invoke that factory only after
selecting the exact legacy branch and only for the bounded direct insert/readback.
An unavailable or invalid capability therefore creates neither an admin client,
provider-side DVA/customer side effect, nor database mutation. Under `rpc_v1`,
all wallet reads and the proof-gated persistence call use the request client and
the admin factory remains uncalled. The contract application deletes the factory
parameter, import, and legacy implementation entirely.

The current `OrderWalletFundingIntentRepository` also exposes a dormant
`ensureWalletPaymentAccount` method that delegates to the same ensure helper,
although the only production order-intent route passes `consent: undefined` and
explicitly promises not to create a DVA. The preparation application removes
that method, removes the unused `consent` creation branch and argument from
`createOrderWalletFundingIntent`, and keeps the order-intent route resolve-only.
When no account exists it continues returning `WALLET_DVA_CONSENT_REQUIRED` so
the customer must use the dedicated funding-account endpoint. No second caller
may inherit the lazy admin factory or invoke wallet persistence without the
dedicated route's auth, CSRF, feature, provider-proof, and capability contract.

Revoking table DML is insufficient while the baseline wallet-account owner
foreign keys still use `ON DELETE CASCADE`: deleting a merchant, customer, or a
parent auth identity can otherwise erase the receiver evidence without executing
a wallet-table DELETE statement. `12015` replaces exactly
`customer_wallet_payment_accounts_merchant_id_fkey` and
`customer_wallet_payment_accounts_customer_id_fkey` with validated
`ON DELETE RESTRICT` constraints over the same columns and referenced keys, and
catalog-verifies their names, actions, validation, and non-deferrability. The
preparation application updates `DELETE /api/customers/[id]` to recognize only
SQLSTATE `23503` carrying either exact wallet constraint and return HTTP `409`,
`code = CUSTOMER_PAYMENT_IDENTITY_RETENTION_REQUIRED`, and the fixed message
`This customer has retained payment-account evidence and cannot be deleted.` It
does not expose a bank account, provider customer, constraint, or database
message. Other foreign-key or database failures remain generic `500`. Merchant
or auth-user deletion is likewise blocked by the database while wallet evidence
exists. An approved anonymization/provider-deactivation and statutory-retention
workflow is a separate design; this payment rollout must not improvise one or
silently restore cascade deletion.

`20260719120015_wallet_dva_bank_identity_schema.sql` installs the no-data
capability RPC
`get_wallet_dva_persistence_contract_version()` returning exactly
`legacy_direct_v0`, revokes execution from `PUBLIC` and `anon`, and grants it
only to `authenticated` and `service_role`. That migration also revokes every
table privilege on `customer_wallet_payment_accounts` from `PUBLIC`,
`service_role`, `authenticated`, and `anon`, then regrants exactly `SELECT` to
`authenticated` and `SELECT, INSERT` to `service_role`. In the same transaction that
`20260719120020_wallet_dva_bank_identity_repair_rpcs.sql` finishes and catalog-
verifies the proof-gated persistence RPC, every wallet review branch, advisory
contract, result type, grant, and trigger, it replaces that capability with
exactly `rpc_v1` under the same no-data grant contract and revokes direct
`INSERT` on `customer_wallet_payment_accounts` from `service_role` and catalog-
verifies the exact final matrix: authenticated and service role retain only
`SELECT`, while `PUBLIC` and `anon` retain none; no runtime role has `INSERT`,
`UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `MAINTAIN`. The gate
checks `pg_class.relacl` through `aclexplode`, rather than relying only on an
information-schema view that may omit newer privilege kinds, and independently
uses `has_table_privilege` to reject an effective forbidden privilege inherited
through role membership. Database-owner
migrations and the security-definer persistence/repair
RPCs remain the only mutation paths. The preparation adapter calls the request-
scoped RPC path whenever it reads `rpc_v1`. If a request read legacy capability
immediately before the flip and its direct write then fails, it rereads
capability exactly once and retries the same already-validated provider response
through the proof-gated RPC; it never performs a second direct write. An
unchanged capability or failed RPC returns the fixed safe failure and does not
fall back. The final contract application removes the admin client and legacy
mutation branch only after this crossing-request matrix passes.

Both `12015` and `12020` issue `NOTIFY pgrst, 'reload schema'` after their final
function/grant definitions; PostgreSQL delivers the notification only when the
migration transaction commits. This reduces, but does not replace, the adapter's
fail-closed `PGRST202` handling. Migration-source tests require the exact reload
notification in both files. A clean authenticated test replay stopped after
`12015` waits for the Data API to return `legacy_direct_v0`; the same replay
continued through `12020` waits for `rpc_v1`. Production may apply both files
without an intermediate pause and therefore requires only the final `rpc_v1`
observation before wallet smoke verification. The checked
`verify-wallet-dva-persistence-contract.ts` script accepts the canonical
Supabase URL, one approved low-privilege project API key, and one short-lived
approved production test-customer access token only through environment
variables named exactly `WALLET_DVA_VERIFY_SUPABASE_URL`,
`WALLET_DVA_VERIFY_PROJECT_API_KEY`, and
`WALLET_DVA_VERIFY_USER_ACCESS_TOKEN`; it does not fall back to an admin or
application service-role variable. The API key is preferably an
`sb_publishable_...` key; a still-enabled legacy anon key is permitted only in
the `apikey` header during migration to publishable keys. The script sends the access token separately as
`Authorization: Bearer <user JWT>`, requires its decoded `role` claim to be
exactly `authenticated`, calls only the no-data capability RPC, requires exactly
`rpc_v1`, and never prints any credential. The project key identifies the
calling application but does not replace the user JWT or grant an anon/service-
role bypass. The script rejects a missing API key, a secret/service-role key, a
project key placed in `Authorization`, and an access token with any role other
than `authenticated`; it makes no provider or mutation call. No elapsed wait is
permission to use a different branch; the application remains on its fixed safe
response.

The review issue is exactly `wallet_dva_assignment_identity_unresolved` for a
same-receiver payable epoch missing provider-customer identity and
`wallet_dva_assignment_identity_conflict` for contradictory non-empty identity.
Their open partial unique index is
`(issue_type, metadata->>'requesting_merchant_id', metadata->>'customer_id',
metadata->>'evidence_fingerprint')` when the customer id and lowercase 64-
character fingerprint are non-empty and the requesting merchant id is a valid
UUID, under the stable name
`reconciliation_review_open_wallet_dva_assignment_identity_idx`. Bounded
metadata stores the requesting merchant id, canonical
receiver identity, wallet provider-customer/subaccount/provider-account
fingerprints, and every conflicting order/merchant/epoch id without raw provider
payload. The requesting merchant metadata is the stable deduplication scope;
`reconciliation_review.merchant_id` remains the alert-tenant field and is null
when the evidence spans merchants, so null uniqueness semantics cannot create
duplicate open reviews. `20260719120014_payment_review_contract_extensions.sql`
also recreates `reconciliation_review_open_by_order_idx` with all four wallet-
assignment issue types excluded alongside every earlier specialized type. The
four wallet fingerprint indexes are authoritative: an order-identity review may
store top-level `order_id` only when exactly one conflicting order exists, while
multi-order, receiver-owner, existing-identity, and disabled-reactivation
reviews keep it null, but no wallet review can collide through the broad
`(issue_type, order_id)` key. Catalog
tests assert the exact exclusion predicate. An identical fingerprint reuses the
open row and alerts; changed provider evidence for the same order or wallet id
creates the new fingerprint-scoped review.

The proof-gated wallet persistence RPC derives the issue type and calls the
private typed review-and-enqueue primitive after its own scope checks; no client
selects the issue type. It computes the distinct merchant set
from the requesting wallet owner plus every conflicting locked order. Exactly
one distinct merchant sets the review merchant and enqueues that merchant's
email and push;
evidence spanning multiple merchants sets the review merchant to null and
enqueues operations only. It never sends a customer payment-confirmation
notification.

A cross-wallet receiver-owner collision uses the distinct issue type
`wallet_dva_receiver_owner_conflict`. Its stable open partial unique index is
`reconciliation_review_open_wallet_dva_receiver_owner_idx` over
`(issue_type, metadata->>'receiver_owner_wallet_account_id',
metadata->>'requesting_customer_id', metadata->>'evidence_fingerprint')` when
all three metadata values are non-empty and the fingerprint is lowercase
SHA-256. Bounded metadata stores only wallet-account/customer/merchant ids and
provider, receiver, provider-customer, subaccount, and provider-account
fingerprints, never a raw account number or provider payload. The review and
operations alert commit in the same RPC transaction. Merchant email/push is
enqueued only when the requesting and existing receiver evidence identifies one
distinct merchant; a cross-merchant collision sets the review merchant to null
and remains operations-only. No customer notification is sent.

An active same-owner customer/provider row with contradictory immutable provider
identity uses the distinct issue type `wallet_dva_existing_identity_conflict`.
Its stable open partial unique index is
`reconciliation_review_open_wallet_dva_existing_identity_idx` over
`(issue_type, metadata->>'wallet_payment_account_id',
metadata->>'evidence_fingerprint')` when both metadata values are non-empty and
the fingerprint is lowercase SHA-256. The database computes that fingerprint
over the stored active identity and the bounded provider-response identity;
metadata contains only the wallet-account/customer/merchant ids and hashed
provider, receiver, provider-customer, subaccount, and provider-account evidence,
never a raw account number or provider payload. The review, operations alert,
and sole same-merchant email/push commit in the persistence RPC transaction while
the active row remains unchanged. Repeating the same contradiction reuses those
rows; changed provider evidence produces a new proved fingerprint. No customer
notification is sent.

An existing disabled same-owner customer/provider row uses the distinct issue
type `wallet_dva_disabled_reactivation_required`, whether the new provider
observation is exact or contradictory. Its stable open partial unique index is
`reconciliation_review_open_wallet_dva_disabled_reactivation_idx` over
`(issue_type, metadata->>'wallet_payment_account_id',
metadata->>'evidence_fingerprint')` when both metadata values are non-empty and
the fingerprint is lowercase SHA-256. The fingerprint covers the retained
disabled identity and bounded provider observation; metadata contains only the
wallet-account/customer/merchant ids, a prior bounded disable-reason code when
one exists, and hashed provider/receiver/customer/subaccount/account evidence.
The row stays disabled and unchanged. The review, operations alert, and sole-
merchant email/push commit atomically; no customer payment-confirmation
notification is sent, and no automatic path may resolve the review or
reactivate the row.

The webhook-time contract, `classifyWalletTransferOrderAlias`, runs only after
Paystack verification and must receive the verified amount and currency,
normalized assignment email, exact provider customer code, provider reference,
verified `paid_at`, and shared checked receiver account/bank identity. It uses
the epoch's immutable provider-customer identity and returns a payable-order
block only when that complete transfer could plausibly pay the order; terminal
aliases remain diagnostic. It passes the same complete receiver and customer
identity to `findCustomerWalletPaymentAccountByReceiver`; the account-number-
only signature is removed. That lookup loads retained same-number rows of every
status,
normalizes both persisted `bank_name` and optional `bank_slug` with the shared
fixture contract, and continues only when exactly one row agrees with the
verified receiver bank. Only an exact `active` row is creditable. A unique
`pending_review` or `disabled` receiver returns the bounded unresolved outcome
and durable review rather than falling through to an order, zero-candidate, or
new wallet assignment; missing, blank, contradictory, or multiply matching
bank evidence is likewise a durable final diagnostic review and cannot claim a
wallet transaction. When wallet matching creates its pending transaction,
`gateway_reference` is the verified provider reference and metadata marks the
role `external_provider`; it then converges through the same Paystack claim RPC
before wallet credit. Assignment-time code may not call this transfer
classifier, and webhook-time code may not downgrade to the assignment collision
result.

The wallet DVA bank-identity module adds canonical nullable `bank_identity` to
`customer_wallet_payment_accounts`, backfilled from the normalized Paystack
`bank_name`, with a check requiring every `active` row to have a non-empty
bounded value. An `active` row that cannot be safely backfilled is atomically
changed to `pending_review`; an already-`pending_review` row remains so, and an
already-`disabled` row remains disabled so the migration cannot erase its
reason. Every uncanonicalizable row retains a null identity and creates/reuses a
`wallet_dva_bank_identity_repair_required` review plus operations and sole-
merchant alerts. It is not wallet-creditable, but its same-provider/account
receiver remains unresolved historical-purpose evidence that blocks order
assignment, rendering, and automatic order matching until reviewed. Only a
different proved canonical bank clears that alias.
After a duplicate preflight, that module replaces the baseline global
`idx_customer_wallet_payment_accounts_provider_account` unique index with the
stable bank-aware unique index
`customer_wallet_payment_accounts_provider_bank_account_uidx` on
`(provider, bank_identity, account_number) WHERE bank_identity IS NOT NULL`.
It deliberately preserves and catalog-verifies
`idx_customer_wallet_payment_accounts_customer_provider` because one merchant
customer still owns at most one Paystack wallet account row.
New persistence derives
`bank_identity` from provider-returned bank evidence inside the checked database
contract: a private before-write trigger derives trusted keys, nonblockingly
tries the `NEW` owner then account for insert, and for update tries every sorted
old/new owner before every sorted old/new account. It raises SQLSTATE `40001` if
any key is busy, recomputes `bank_identity` from `bank_name`, and rejects a
conflicting caller value. Under `legacy_direct_v0`, service role already has only
`SELECT, INSERT` and authenticated has only RLS-scoped `SELECT`; once capability
is `rpc_v1`, the remaining direct insert is revoked too. Every allowed RPC write
already owns its complete key set and passes the reentrant trigger checks.
Persistence stores the original bank name and slug as aliases and uses the same
bank-aware key for conflicts. Before
insert it must return `receiver_owner_conflict`, rather than relying on SQLSTATE
`23505`, when that key belongs to a different wallet owner. The unique index is
still the final race-proof backstop. Under the owner advisory, an existing
same-owner row is classified as exact replay, repairable quarantine, pending
review, or `existing_identity_conflict` before insert; it cannot fall through to
the customer/provider unique index. Any remaining unique violation is an
invariant failure that raises and commits neither a partial review nor wallet
row. This permits legitimately
reused account numbers at different banks without treating account number as
cross-bank identity.

Preserving the customer/provider key requires an explicit quarantine-recovery
contract rather than attempting a second insert. Wallet-account resolution first
locks the existing `(merchant_id, customer_id, provider)` row regardless of
status after acquiring the owner advisory, which provides serialization when
that row was absent at transaction start. An `active` exact row is idempotent.
An `active` non-exact row returns `existing_identity_conflict`, files its durable
review and alerts, remains active and byte-for-byte unchanged, and never reaches
insert. A `pending_review` row may be reactivated in place only after a fresh
Paystack response proves the same
provider customer code, merchant subaccount, account number, and non-null
provider account id when one was previously stored; the database recomputes a
valid bank identity, updates only the bank name/slug/identity evidence, changes
status to `active`, and atomically resolves the exact repair review. It may not
change the account number, customer, merchant, subaccount, provider customer,
or existing provider account identity. A different or incomplete provider
identity remains quarantined, returns the stable
`WALLET_DVA_PENDING_REVIEW` application outcome, and never falls through to an
insert that will collide with the customer/provider unique index. Replacing a
wallet DVA with a genuinely different account requires a separate immutable-
alias design and is outside this change.
An existing `disabled` row takes precedence over replay/reactivation
classification, remains disabled for both exact and changed provider evidence,
and returns the same safe pending-review application outcome with its dedicated
review. Neither a fresh funding request nor a Paystack replay is authority to
discard the disable reason.

The quarantine review stores the wallet-account id and a database-computed
fingerprint over merchant/customer/provider customer/subaccount/account/provider-
account/bank evidence. Add an open partial expression unique index on
`(issue_type, metadata->>'wallet_payment_account_id',
metadata->>'evidence_fingerprint')` for this issue type when both metadata values
are non-empty. An identical migration or persistence retry reuses the same
review and alerts; changed evidence requires a newly proved fingerprint, and
only successful in-place reactivation may resolve the exact current review.

`confirmPaystackWalletDvaTopUp` must also remove its synthetic `new Date()`
fallback. A missing or invalid verified `paid_at` has no authority for the
assignment lower-bound check and therefore creates/reuses a durable
`wallet_dva_verified_timestamp_invalid` review and alert, then returns without
wallet, transaction, or order mutation. The signed payload may corroborate but
may not manufacture this timestamp.

Replace the current application-level wallet-account lookup, order-alias query,
review insert, and pending-transaction insert with one service-role-only
`reserve_paystack_wallet_dva_top_up` RPC. It accepts the raw verified receiver
bank/account, provider reference, amount/currency, normalized verified customer
email, exact provider customer code, and verified `paid_at`; it accepts no
wallet/customer/merchant id or canonical bank from the caller. After the common
external-reference resolver has acquired the reference namespace, the RPC
recomputes canonical bank identity and takes the same provider/account advisory
as order reservation, then sorted order-payment advisories and locked relevant
orders/epochs, followed by matching retained wallet rows. It invokes the same
private locked order classifier used by `reserve_paystack_dva_order_payment`.
Thus order reservation and wallet reservation use the exact order
`external-reference -> receiver account -> sorted orders -> wallet rows` and
cannot each observe the other purpose as absent.

The wallet reservation RPC returns exactly `reserved`, `completed_replay`,
`order_alias_conflict`, `wallet_identity_unresolved`, or `zero_wallet_candidates`.
`reserved` selects exactly one active wallet row whose canonical receiver and
immutable provider customer agree, creates or reuses one pending wallet top-up
transaction with `gateway_reference_role = external_provider`, and returns its
id for the common reference claim. `completed_replay` validates and returns the
same previously completed transaction. An otherwise eligible invoice returns
`order_alias_conflict`, atomically creates/reuses the existing fingerprinted
review and alert, and inserts no wallet transaction. Missing/contradictory or
multiple wallet ownership, or a unique matching `pending_review`/`disabled`
wallet row, returns `wallet_identity_unresolved` with its durable review; no row
is selected heuristically and no retained receiver is treated as absent. A terminal-only order alias is
diagnostic and does not block a unique valid wallet reservation. The RPC is the
only fresh wallet-DVA transaction creator; the TypeScript wrapper validates its
bounded result and never performs a select-then-insert fallback.

A payable order blocks wallet allocation only when the transfer could plausibly
be that order payment; a different amount or immutable provider customer can continue through the
existing wallet matching flow. A terminal-only order alias is diagnostic
evidence, not a wallet blocker. If no eligible order exists, the webhook must
continue through wallet matching before deciding that the payment has zero
candidates. A terminal-only alias is included in the final review only when no
wallet or other transaction path claims the transfer. Wallet-account creation
uses the same checked bank identity when testing order aliases, so it cannot
reserve a same-number/different-bank account or reject one by account number
alone. The storefront conflict copy must not promise that this state clears in
90 minutes: it tells the customer that the account is attached to a payable
order and to complete that order or ask the merchant to cancel it before trying
wallet funding again. `WalletFundingPanel` must map
`WALLET_DVA_ORDER_ALIAS_CONFLICT` to that lifecycle-based copy, and its source
comment and tests must contain no fixed expiry claim.

## Replay Resolution and Atomic Transaction Reservation

After Paystack verification and before any fresh agentic, order, or wallet DVA
matching, the webhook must call a service-role RPC,
`resolve_paystack_transaction_reference`. It must:

1. Normalize and advisory-lock
   `baci_paystack_external_reference:<Paystack reference>`.
2. Search Paystack transactions using the canonical external-reference
   expression defined below. A non-empty
   `transactions.metadata.paystack_reference` takes precedence; an explicitly
   internal BAC reference is never an external-reference owner; and
   `transactions.gateway_reference` is used only for ordinary or unclassified
   legacy rows.
3. Return `none` when no transaction owns the reference.
4. Return the existing transaction and its current status when exactly one row
   owns it and either ownership came from non-empty `paystack_reference`
   metadata or its explicit/audited legacy fallback role proves
   `gateway_reference` is external. The resolver does not mutate or hide
   `processing`, `failed`, or `cancelled` rows merely because they are not
   payable states.
5. Return `external_reference_role_unclassified` when the sole legacy fallback
   owner could instead be an internal BAC, and return a structured ownership
   conflict when multiple rows claim the same external reference.

An existing transaction bypasses fresh DVA candidate matching. The resolver's
transaction-scoped advisory lock ends when that RPC returns, so the application
must not follow it with a race-prone direct transaction update. After the
webhook validates the resolver snapshot's amount and currency, it calls a second
service-role RPC, `claim_paystack_transaction_reference`, with the external
reference, expected transaction id, verified amount, verified currency, and
gateway response. That RPC must:

1. reacquire the same
   `baci_paystack_external_reference:<Paystack reference>` advisory lock;
2. re-resolve the canonical reference owner and return a structured conflict if
   it is missing, duplicated, or no longer the expected transaction;
3. revalidate transaction amount and currency against the verified values under
   lock; and
4. apply this status state machine atomically:
   - `pending`: update only that exact row to `completed`, preserve its BAC
     `gateway_reference`, attach the gateway response and external-reference
     metadata without overwriting immutable evidence, and return `claimed`;
   - `completed`: do not rewrite the transaction and return
     `completed_replay`;
   - `processing`, `failed`, or `cancelled`: do not mutate and return
     `status_conflict` with the current status.

`claimed` continues through the existing transaction-type dispatch and order
transactions use the shared finalizer. `completed_replay` continues through the
existing idempotent dispatch so an order transaction can heal a missed order
flip, `amount_paid` update, atomic inventory confirmation, or side effect.
`status_conflict` creates a durable `payment_match_ambiguous` review with reason
`external_reference_transaction_status_conflict`, including the transaction id,
status, order id, merchant id, and verified evidence. Missing, changed, or
duplicated ownership creates `external_reference_conflict`. Neither conflict
path mutates a transaction or dispatches fulfillment, and the webhook
acknowledges only after the review and alert rows commit.

Every Paystack transaction selected by fresh agentic, order-DVA, wallet-DVA, or
remaining Paystack matching must pass through the same claim RPC after its
reservation has attached the external reference. Existing-reference and fresh
matching paths therefore converge before transaction-type dispatch.

The webhook must remove the current shared
`.update({ status: 'completed' }).neq('status', 'completed')` claim. Paystack
uses `claim_paystack_transaction_reference`; non-Paystack gateways retain their
existing dispatch behavior but any application-level claim must use an exact
`status = 'pending'` predicate and explicit completed-replay branch rather than
resurrecting `processing`, `failed`, or `cancelled` rows. A crash after the
Paystack claim RPC commits but before dispatch is safe: redelivery receives
`completed_replay` and runs the healing path.

Preliminary TypeScript matching remains read-only and diagnostic. It may explain
likely candidates, but it cannot authorize a payment mutation or decide the
final ambiguity set. Its fixture matrix must also run against the SQL
classification so diagnostic and authoritative behavior cannot silently drift.
For every fresh verified Paystack transfer not already claimed by the agentic
path and with a valid receiving identity, a new service-role RPC,
`reserve_paystack_dva_order_payment`, receives the account number, raw verified
receiving bank, external reference, amount, currency, normalized customer
email, exact provider customer code, `paid_at`, a caller-supplied BAC reference,
explicit fee amounts, and an optional `expected_legacy_transaction_id`. The
normal webhook always supplies
`NULL` for the legacy id. Only the audited reconciliation CLI may provide it
after independently verifying the intended order and transaction. The RPC owns
the final classification and reservation decision.

The RPC must:

1. Acquire locks in this global order:
   - the same namespaced external-reference advisory lock used by
     `resolve_paystack_transaction_reference`;
   - an account-scoped advisory lock for
     `baci_paystack_dva_account:<provider>:<account number>`;
   - the existing `baci_order_payment:<order id>` advisory lock for every
     account-linked order, sorted by order id;
   - row locks on the `orders` rows in that deterministic order; and
   - only then row locks on the relevant `order_payment_accounts` projections,
     sorted by id, followed by their `order_payment_account_epochs`, sorted by
     id, `order_payment_account_epoch_capture_links`, sorted by id, and the
     relevant `order_dva_terminal_snapshots` rows. The
     account advisory lock freezes registered assignment/lifecycle writers while
     order ids are derived, so no path needs an account-row lock before an
     order-row lock.
2. Recheck the external Paystack reference using the same canonical expression
   and precedence rule as the resolver and unique index.
3. Return the same transaction id when a concurrent request attached the
   reference after the preliminary resolver ran, and reject a reference already
   attached to another order or merchant.
4. Reload the complete provider/account-number
   `order_payment_account_epochs` set under lock,
   including superseded epochs, normalize every stored `bank_name` with the
   same shared contract, and classify only
   rows whose bank equals the verified receiver bank. Rows from another bank
   are identity diagnostics, never candidates or terminal aliases. Recheck
   cancellation, terminal state, assignment lower bound, immutable assigned
   email and provider customer code, currency, terminal residual conflicts,
   unresolved historical blockers, and the authoritative outstanding balance
   for every relevant same-bank order. The current order email is not matching
   evidence. A blank/unparseable stored bank
   on an otherwise plausible row is a conflict requiring review, not permission
   to fall back to account number alone.
5. For each otherwise eligible order, check the locked
   `provider_shipment_cancellation_attempts` evidence. An active
   `external_call_claimed`, `provider_cancelled`,
   `provider_outcome_unknown`, or unresolved `manual_review` attempt returns
   the dedicated `cancellation_pending` outcome and atomically creates/reuses the
   `payment_during_provider_cancellation` review and operations alert. It does
   not create/adopt a transaction or attach the external reference. A
   `provider_rejected` attempt is not a hold; a locally cancelled order remains
   terminal and ineligible. A manual review releases the hold only through a
   service-role decision RPC that locks shipment, order, and attempt in the
   canonical order, records evidence proving `provider_rejected`, and appends
   the immutable review resolution event.
6. Return structured `ambiguous`, `zero_candidates`, or `conflict` outcomes with
   complete diagnostics when a manual payment, cancellation, refund, another
   gateway completion, or another account-linked invoice changes the result.
   No transaction or order mutation occurs for those outcomes.
7. Continue only when the locked classification contains exactly one eligible
   order and no terminal alias or unresolved historical conflict.
8. Resolve transaction ownership from the selected
   `order_payment_account_epochs.payment_transaction_id`:
   - when it is non-null and matches the verified current outstanding balance,
     lock and adopt only that exact `assignment_intent` transaction;
   - when it is non-null, still pending, explicitly tagged for that epoch,
     has no external Paystack reference, and is stale only because the locked
     outstanding balance changed, preserve it as the epoch's immutable
     assignment-intent pointer, mark that transaction `cancelled` with the exact
     stale-balance reason and replacement transaction id, create a correctly
     priced BAC transaction for the verified capture, and append one reciprocal
     `order_payment_account_epoch_capture_links` row. The new transaction is
     tagged `matched_capture`; neither the epoch pointer nor projection mirror
     changes;
   - when it is null and `expected_legacy_transaction_id` is null, create a new
     `assignment_intent` DVA transaction for that epoch with the caller-supplied
     BAC reference and set the previously null epoch pointer once;
   - when it is null and the audited CLI supplies
     `expected_legacy_transaction_id`, lock that exact row and adopt it only
     after validating order id, merchant id, gateway, transaction type, pending
     status, amount, currency, epoch-assigned customer email, and provider
     customer code;
   - never scan the order for “the one pending Paystack transaction” and infer
     ownership from amount alone.
9. Reject a linked or explicitly selected legacy transaction when its order,
   merchant, gateway, type, status, currency, or DVA metadata conflicts with the
   locked assignment epoch and verified transfer. An amount mismatch may create
   a matched-capture link only under the exact linked-pending-DVA conditions
   above; it never supersedes the epoch's assignment pointer. Unlinked pending
   card, stale DVA, domain, wallet, agentic, and other Paystack transactions are
   diagnostic only and cannot be repurposed. A missing DVA tag is permitted only
   for the explicitly audited legacy transaction; metadata that positively
   identifies another payment purpose is always a conflict.
10. When adopting a transaction, preserve its id, BAC
   `gateway_reference`, `platform_fee`, and `merchant_amount`. Attach the
   external Paystack reference, immutable provider-customer identity, and DVA
   evidence in metadata, and atomically set
   the epoch's previously null `payment_transaction_id` when adopting an audited
   legacy row. A non-null pointer is never changed.
11. When creating a transaction, advisory-lock the caller-supplied BAC reference
    before insertion and store the explicit fee values validated below. A new
    primary epoch transaction is tagged with
    `metadata.gateway_reference_role = 'internal_bac'` and
    `metadata.dva_epoch_link_role = 'assignment_intent'` and is linked through
    the epoch pointer. A stale-balance replacement is tagged
    `metadata.gateway_reference_role = 'internal_bac'` and
    `metadata.dva_epoch_link_role = 'matched_capture'` and is linked through the
    append-only capture-link table. Both relationships and reciprocal metadata
    commit atomically with the external-reference reservation.

The webhook maps every RPC `ambiguous` or `conflict` outcome to a durable
`payment_match_ambiguous` review with the RPC reason and diagnostics. It delays
the `zero_candidates` review until wallet and remaining payment paths have also
returned no match. `cancellation_pending` already owns its dedicated review and
alert from the RPC; the webhook returns a retryable failure without creating a
second review or continuing to wallet matching.

Every DVA assignment route and the webhook caller compute fees in explicit
units:

```typescript
const grossAmountKobo = Math.round(grossAmountNgn * 100);
const fee = calculatePlatformFee(grossAmountKobo);
const platformFeeNgn = fee.platformFee / 100;
const merchantAmountNgn = fee.merchantAmount / 100;
```

Both `persist_paystack_order_dva_assignment` and
`reserve_paystack_dva_order_payment` receive naira values and reject any newly
created transaction unless:

- gross amount, `platform_fee`, and `merchant_amount` are finite, nonnegative,
  and rounded to at most two decimal places;
- `platform_fee + merchant_amount = gross amount` exactly at two-decimal
  precision; and
- the gross amount equals the locked outstanding balance within the existing
  one-kobo tolerance. The assignment path uses its expected payable amount; the
  reservation path uses Paystack's verified gross amount.

Neither RPC may silently substitute zero or the gross amount for missing fee
inputs. Adopted transactions retain their existing fee fields unchanged.
`reserve_paystack_wallet_dva_top_up` separately validates a finite positive NGN
gross amount rounded to at most two decimals and preserves the existing wallet-
top-up policy of zero merchant settlement/platform fee on its orderless pending
transaction; it does not apply the order-DVA fee split or outstanding-balance
rule.
This fee formula is explicitly the current NGN-only DVA policy; non-NGN orders
must have been rejected by the assignment routes rather than receiving a
naira-denominated cap.
The implementation also removes the stale `/api/payments/initialize` comment
that says DVA is 1% capped at ₦300. The authoritative shared
`calculatePlatformFee` policy is 2% capped at ₦2,050, and this design does not
change that business rule.

A separate append-only, non-transactional **post-contract** migration must build
the canonical Paystack-reference unique index. It runs only after the contract
application has made every new Paystack writer persist an immutable reference
role, the fixed legacy-writer drain has elapsed, and the signed reference-role
audit below proves zero unclassified referenced rows. The resolver, claimant,
reservation RPC, duplicate preflight, catalog-definition assertion, and index
must use this exact expression without separately reimplementing its
precedence:

```sql
CASE
  WHEN NULLIF(btrim(metadata ->> 'paystack_reference'), '') IS NOT NULL
    THEN NULLIF(btrim(metadata ->> 'paystack_reference'), '')
  WHEN NULLIF(btrim(metadata ->> 'gateway_reference_role'), '') = 'internal_bac'
    THEN NULL
  ELSE NULLIF(btrim(gateway_reference), '')
END
```

for rows where `gateway = 'paystack'` and the expression is non-null. This makes
a legacy external reference in `gateway_reference` conflict with the same
reference stored in metadata on a BAC-preserving transaction without indexing
that DVA transaction's internal BAC before provider binding. The migration must
run a duplicate preflight that fails with actionable diagnostics rather than
deleting or rewriting financial rows, then use the stable index name and
`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` with catalog-definition
verification.

The index must not be present during the contract migration-first window. Until
the post-contract index release commits, the resolver and claim RPC serialize
on the same namespaced provider-reference advisory lock and perform the exact
cross-storage duplicate query under that lock. That transactional check is the
authoritative uniqueness guard for the bounded window; the later concurrent
index is defense in depth. Deploying the index before role classification would
incorrectly index an unclassified internal BAC as an external provider
reference and could either fail the duplicate preflight or reject the exact
provider-reference/internal-BAC collision this design is required to handle.

### Transaction reference roles

For a BAC-preserving Paystack DVA transaction:

- `transactions.gateway_reference` remains the internal BAC reference used by
  settlement and existing financial idempotency keys; and
- `transactions.metadata.gateway_reference_role` is the immutable value
  `internal_bac`; and
- `transactions.metadata.paystack_reference` is the provider reference used to
  resolve webhook replays and re-verify the charge with Paystack.

Every newly persisted ordinary Paystack transaction whose
`gateway_reference` is the provider reference stores
`metadata.gateway_reference_role = 'external_provider'`. Claim and reservation
may attach `metadata.paystack_reference` to an internal-BAC row but must never
change its role or replace its BAC `gateway_reference`.

The Paystack reference/claim module installs a schema-first-compatible role guard:
legacy null roles remain permitted during the old-application window, but a
non-null role must be one of those two values and cannot later be changed or
removed. Every contract RPC requires the correct non-null role for a newly
created Paystack row. Metadata merge helpers and direct tests must preserve an
existing role byte-for-byte.

The same reference/claim module adds an independent immutable DVA epoch-link-role guard.
Every new internal-BAC order-DVA transaction must carry exactly
`metadata.dva_epoch_link_role = 'assignment_intent'` or `matched_capture`.
`assignment_intent` requires reciprocal ownership through the epoch's
`payment_transaction_id`; `matched_capture` requires reciprocal ownership
through `order_payment_account_epoch_capture_links` and may never be the epoch
pointer. A non-null link role cannot be changed or removed, and every metadata
merge, reference claim, recovery path, audit, and direct test preserves it
byte-for-byte. Legacy null link roles remain permitted only until their exact
assignment evidence is classified or repaired.

Add one shared TypeScript helper,
`getExternalGatewayReference(transaction)`, with a discriminated result rather
than a nullable string. For Paystack it returns `external` from non-empty
`metadata.paystack_reference`; `internal_unbound` when the role is
`internal_bac` and no provider reference has been attached; `external` from
`gateway_reference` when the role is `external_provider`; and `unclassified`
with the legacy fallback value when no role exists. For other gateways it
returns `external` from `gateway_reference`. No caller may pass
`internal_unbound` or `unclassified` to `verifyGatewayCharge`; it must first use
the locked legacy-role classifier or file the durable conflict.

The contract reference-role module creates the RLS-locked, append-only
`paystack_reference_role_audit_decisions` table keyed by transaction id and
evidence fingerprint, then audits existing Paystack rows and adds a role only
when immutable transaction purpose and reference evidence proves it. It does not
infer that a string is external merely because it happens not to start with a
known BAC prefix. An unclassified legacy `gateway_reference` remains in the
transaction table but is not yet protected by the later unique index; the
resolver may auto-claim it only when the locked row is positively
ordinary/external. A DVA marker, BAC-like purpose,
missing role proof, or contradictory evidence returns
`external_reference_role_unclassified`, atomically files the exact
transaction/reference review and alerts, and performs no payment mutation.
The audit output lists every unclassified live Paystack row; the recovery CLI
can assign a role only with provider verification or exact historical evidence.
This fail-closed branch prevents an incoming provider reference that equals a
pending invoice's internal BAC from acquiring that invoice by string collision.
When the locked classifier positively proves an ordinary legacy fallback, the
resolver returns that classification and the claim RPC recomputes it before
atomically stamping `external_provider`; the resolver alone remains read-only.

The service-role-only
`classify_paystack_transaction_reference_role(p_transaction_id uuid,
p_expected_evidence_fingerprint text, p_role text, p_review_id uuid,
p_reason text, p_actor text)` RPC acquires the namespaced reference advisory
lock, then the payment/order locks in canonical order, recomputes the evidence
fingerprint, and writes the result atomically. For a proved classification,
`p_role` must be `internal_bac` or `external_provider`, `p_review_id` must be
null, and the RPC writes both the immutable metadata role and audit decision.
`internal_bac` requires reciprocal DVA assignment or capture
linkage; `external_provider` requires an ordinary initialization record,
verified provider reference, or equivalent immutable ordinary-payment proof.
For a manual blocker, `p_role` must be null and `p_review_id` must name the
exact open `external_reference_role_unclassified` review; the RPC appends the
blocker decision without changing transaction metadata. A manual blocker is not
index-ready and cannot be closed by operator assertion alone.

The checked-in `audit-paystack-reference-roles.ts` CLI reads through a
service-role audit RPC, performs classifications only through the function
above, and emits a signed machine-readable report. The post-contract index
preflight passes only when every Paystack transaction with a non-empty
`gateway_reference` has a non-null valid immutable role, every internal-BAC row
has reciprocal DVA evidence, every external-provider row has ordinary/provider
evidence, no current-fingerprint manual blocker remains, and the canonical
expression has no duplicate. The contract application must be live for the
entire fixed 15-minute legacy-writer drain before that report can pass.

### Audit report evidence contract

Every “signed report” in this design uses one shared checked implementation;
the phrase never means an operator name pasted into JSON. The unsigned envelope
is RFC 8785 JSON Canonicalization Scheme output over an I-JSON value; the shared
helper rejects duplicate keys, non-finite numbers, unsafe integers, and unknown
fields before signing. It has exactly these fields:

- `schemaVersion = 1`;
- `reportType`, one of `notification_owner`, `inventory_allocation`,
  `paystack_reference_role`, `order_payment_account`, or
  `cancelled_internal_credit`;
- `environment`, exactly `test` or `production`;
- `projectRefHash`, the lowercase SHA-256 of the Supabase project ref rather
  than the ref itself;
- exact 40-character lowercase `releaseSha` for the checked-out code that
  produced the report, and its `releasePhase`;
- `databaseSnapshot` containing RFC 3339 `auditedAt` and `auditCutoff`, a
  `decisionHighWatermark` object with nullable RFC 3339 `decidedAt` and nullable
  1-to-256-character canonical ASCII `key` that are either both null or both
  non-null, and a bounded nonblank `contractStateVersion`, all read in the audit
  RPC's repeatable-read snapshot;
- RFC 3339 `startedAt`, `completedAt`, and `expiresAt`, where expiry is no more
  than two hours after completion;
- a random UUID `nonce`;
- `counts` with required nonnegative safe integers `examined`, `passed`,
  `repaired`, `reviewed`, and `blockers`, plus only the report-type-specific
  count keys allowlisted by the Zod discriminated union; and
- lowercase SHA-256 `evidenceDigest` and `extensionManifestDigest` over the
  database-returned canonical evidence and current post-base migration prefix.

The report adds a detached `signature` object containing algorithm
`hmac-sha256`, a non-secret configured `keyId`, and a 64-character lowercase
digest over the UTF-8 canonical unsigned envelope. The scripts read
`PAYMENT_AUDIT_REPORT_HMAC_KEY_ID_CURRENT` and
`PAYMENT_AUDIT_REPORT_HMAC_SECRET_CURRENT`. A previous key is accepted only
when all of `PAYMENT_AUDIT_REPORT_HMAC_KEY_ID_PREVIOUS`,
`PAYMENT_AUDIT_REPORT_HMAC_SECRET_PREVIOUS`, and
`PAYMENT_AUDIT_REPORT_HMAC_SECRET_PREVIOUS_EXPIRES_AT` are present and the
report's `completedAt` is inside that window and verifier time has not passed
the expiry. Current and previous key ids must be distinct. Secrets are at least
32 decoded bytes encoded as unpadded base64url, never enter the report,
database, command line, logs, or test
snapshots, and are independent of payment-orchestration RPC proof secrets.

`env.ts` exposes these as server-only variables. Ordinary application startup
does not require them, but every audit/sign/verify CLI fails closed unless the
current id/secret pair is complete; a partially configured previous key also
fails. Production rollout preflight confirms the current pair exists without
printing it. The values are operator-side evidence credentials only and are
never forwarded as workflow inputs or database settings.

Each audit CLI writes two new files with exclusive-create semantics: canonical
database evidence and the signed report, both at operator-selected mode-`0600`
paths. It refuses a symlink, existing path, or broader resulting mode.
`verify-payment-audit-report.ts` requires both paths and explicit expected
environment, project-ref hash, phase, and release SHA. It recomputes the
canonical evidence digest and current extension-manifest digest, then verifies
schema, exact canonical bytes, key id, constant-time HMAC equality, binding,
expiry, high-watermark consistency, count consistency, and zero required
blockers. It prints only both files' SHA-256 values plus aggregate counts. The
verified pair is archived as restricted operational evidence before the
corresponding merge.

The signed report is **not** database authorization and is not passed into the
automatic deploy workflow. Every migration and activation gate independently
recomputes current database blockers under its own locks; a stale or forged
report cannot make SQL pass. Conversely, a missing/invalid report stops the
operator runbook even when SQL would pass, so the evidence trail cannot be
silently skipped. This separation avoids pretending that migration SQL can
inspect a local file or GitHub secret while retaining a cryptographically
verifiable audit record.

Every gateway verification or reconciliation path must use that helper for the
provider-facing reference and explicitly handle every result kind. In particular,
`reconcile-wedged-gateway-orders.ts` and
`drain-failed-paid-order-side-effects.ts` must stop passing the BAC value to
`verifyGatewayCharge`. They must also pass the resolved external reference as
the finalizer's `reference` argument while preserving
`transaction.gateway_reference` as the BAC value supplied to settlement and
financial side-effect records. Logs and reconciliation reviews should record
both values when they differ.

The current `paid-order-settlement-executor.ts` passes
`externalGatewayReference` to `record_merchant_settlement`, which violates the
database's documented BAC-key idempotency contract for DVA transactions. Change
that executor in the contract application so `p_gateway_reference` is the
trimmed non-empty `transaction.gateway_reference`, falling back to the external
reference only for a legacy transaction that has no BAC reference. Keep the
resolved provider reference in `p_metadata.paystack_reference` or
`p_metadata.korapay_reference`. The direct webhook, wedged-order reconciliation,
and failed-side-effect drain must all produce the same pair. This is an
application correction, not a settlement-row rewrite: any pre-existing
settlement is left untouched and the recovery CLI must treat a conflicting
historical settlement key as manual reconciliation evidence rather than insert
a duplicate.

The current settlement unique key cannot by itself make that transition safe:
the same capture stored once under the provider reference and later under the
BAC reference would be two distinct keys. The paid-order settlement module therefore
adds service-role-only
`record_order_gateway_settlement_for_transaction(p_transaction_id uuid,
p_external_gateway_reference text, p_gateway_fee numeric, p_gateway_metadata
jsonb, p_actor text)`. It first reads only the immutable identity needed to
derive the order and gateway, acquires
`baci_merchant_settlement:<order id>:<gateway>`, then locks the transaction and
order and revalidates that identity before deriving merchant, BAC reference,
gross amount, and platform fee. It never holds a transaction or order row lock
while waiting for the settlement advisory lock. If transaction order/gateway
identity changed between the read and lock, it files/returns the checked
conflict without reacquiring another advisory under row locks; a retry starts
from fresh identity. It returns exactly `inserted`, `exact_replay`,
`legacy_reference_replay`, or `conflict_filed`.

An exact active BAC-key settlement is replay. An active settlement under the
exact provider reference is `legacy_reference_replay` only when merchant,
order, gateway, gross amount, gateway/platform fees, and provider metadata all
match this transaction; it is left immutable and no wallet balance is changed.
Any partial or contradictory match creates or reuses one
`merchant_settlement_reference_conflict` review and operations alert and returns
`conflict_filed` without inserting. With no match, the wrapper records one BAC-
keyed settlement whose metadata contains transaction id and provider reference.
The executor marks its side-effect row completed only for the first three
outcomes.

For migration-first compatibility, the settlement module replaces the existing
`record_merchant_settlement` body without changing its signature or return
shape so old-application calls acquire that same order/gateway advisory lock
before any wallet lookup, settlement insert, or balance mutation. The legacy
function derives the lock key from its checked order source id and gateway and
rejects unsupported source identity rather than inventing a lock namespace.
Thus an old external-reference caller and the new transaction-aware wrapper
cannot race across application deployment, and both use settlement advisory
then wallet/settlement-row locking order. The old function remains for other
checked callers; the paid-order executor switches to the new wrapper. Its lock
and evidence checks distinguish legitimate additional captures by their
different transaction/BAC/provider references instead of collapsing every
settlement for one order.

This distinction applies even when `gateway_response` is already stored: the
finalizer still needs the external reference for gateway evidence and the BAC
reference for settlement idempotency.

### RPC security contract

Every new or replaced financial `SECURITY DEFINER` function must:

- use `SET search_path = ''`;
- reference tables, sequences, and non-built-in functions through explicit
  schemas, and use `pg_catalog` explicitly for security-sensitive built-ins;
- validate all identifiers, amounts, currency, references, and JSON input
  before mutation; and
- have execute privileges revoked from `PUBLIC`, `anon`, and `authenticated`
  before narrowly scoped grants are applied.

`resolve_paystack_transaction_reference`,
`claim_paystack_transaction_reference`,
`reserve_paystack_dva_order_payment`,
`reserve_paystack_wallet_dva_top_up`,
`repair_paystack_order_dva_epoch_link`,
`record_order_gateway_settlement_for_transaction`,
`record_paystack_historical_evidence_outcome`,
`file_payment_match_review`, and every
alert claim, finish, or retry RPC, including
`seed_paid_order_side_effect_retries` and
`classify_legacy_order_notification_owner` and
`classify_legacy_order_inventory_allocation` and
`get_internal_credit_checkout_control`,
`pause_internal_credit_checkout`,
`finalize_internal_credit_checkout_pause`,
`reconcile_internal_credit_checkout_intent`,
the gateway-initialization reconciliation RPC,
`activate_internal_credit_checkout`, and
`record_internal_credit_cancelled_order_audit_decision`, are
service-role-only. Each must
perform a fail-closed `auth.role() = 'service_role'` check before reading or
mutating protected data, and only `service_role` receives `EXECUTE`.

The provider-cancellation recovery claim/finish and manual-review decision RPCs
are also service-role-only under that exact guard. The prepare, result-record,
and attempt-aware local-finalizer wrappers grant execute only to
`authenticated` and `service_role`; every non-service call re-derives active
merchant/staff access and locked shipment/attempt ownership rather than trusting
a merchant id or token alone. They validate the checked disposition, numeric
refund, timestamps, and a sanitized provider JSON object capped at 16 KiB; raw
headers, credentials, and unbounded bodies are never persisted. The attempt and
append-only attempt-event tables have RLS enabled with no direct anon or
authenticated policy. Every state transition and manual decision appends an
event in the same transaction; a trigger rejects event updates/deletes.

The preparation-control migration's
`internal_credit_checkout_ready()` RPC is the deliberately narrow exception:
it returns only whether the singleton state is `enabled` with a non-null
contract SHA and exposes no timestamp, SHA, generation, intent, event,
financial row, or customer data. It may be granted to `anon`, `authenticated`,
and `service_role` so the route can make the same fail-closed user-experience
decision. It is not mutation authority. After activation, every internal-credit
mutation is authorized by a locked checkout intent created through the
authenticated begin RPC described below.

`get_order_terminalization_contract_version()` is the other no-data read-only
exception. It returns only one checked literal—`legacy_direct_v0`,
`allocation_safe_v1`, or `compensation_v1`—and no timestamp, function
definition, order, inventory, or financial evidence. It may be granted to
`anon`, `authenticated`, and `service_role` so already-live server routes can
cross schema-first cutovers safely. It grants no mutation authority; every
terminal RPC retains its own scope checks. The singleton is migration-owned:
no runtime role receives table mutation rights, and its version may advance
only `legacy_direct_v0 -> allocation_safe_v1 -> compensation_v1`; it cannot be
downgraded to re-enable a legacy writer.

The RLS-locked `internal_credit_checkout_control` singleton contains:

- `state`, checked to exactly `paused`, `enabled`, or `draining`;
- nullable `contract_sha`, retaining the last activated application SHA even
  after an emergency pause;
- nullable `activated_deployment_id` and `activation_attestation_sha256`,
  retaining the exact armed artifact identity and immutable release-identity
  envelope digest alongside `contract_sha` after an emergency pause; live
  readiness is never part of this digest;
- nullable `activated_at`;
- non-null `state_changed_at`;
- non-null `pause_generation`, initialized to `1` and incremented once for
  every fresh `enabled -> draining|paused` emergency-pause request;
- non-null `checkout_generation`, initialized to `0` and incremented once for
  every activation or reactivation; and
- `current_event_id`, referencing the immutable event that established the
  current state.

The preparation control-tables module creates the append-only, RLS-locked
`internal_credit_checkout_control_events` table. Each event records
`initial_pause`, `activation`, `emergency_drain_started`,
`emergency_pause_completed`, `emergency_pause`, or `reactivation`, the prior
and next state, contract SHA, pause and checkout generations, bounded reason,
service actor, active-intent count, nullable activated deployment id and
immutable release-identity digest, and database timestamp. An
activation/reactivation event requires all three release identifiers; every pre-activation event requires the
new fields null, while later pause events copy the retained identifiers. A
trigger rejects updates and deletes. The initial singleton insert and
`initial_pause` event occur in one migration transaction. No client receives
direct table access.
The gateway-initialization module adds a non-null
`active_gateway_initialization_count` defaulting to zero before gateway handoff
can run; later pause events record both counts.

The behavior-neutral preparation migration also creates the RLS-locked
`internal_credit_checkout_intents` table. It changes no existing checkout
function, but provides the durable transaction boundary the contract
application will use after activation. Each intent stores:

- an opaque UUID and the authenticated user, merchant, and customer scope;
- the checkout idempotency key and request hash, with a unique key that makes an
  identical begin replay return the same intent and rejects a changed hash;
- the captured `checkout_generation`;
- nullable bound `order_id`;
- `status`, exactly `open`, `reconciling`, `completed`, `aborted`, or
  `reconciliation_conflict`;
- the last durable phase, exactly `started`, `order_bound`,
  `credit_redeemed`, `gateway_handoff`, `fully_paid`, or `aborted`;
- created, heartbeat, completed, and aborted timestamps; and
- nullable reconciliation review and control-event ids.

The preparation signatures for intent completion, safe pre-credit abort, and
reconciliation are fail-closed contract shells: because the future
compensation and allocation helpers do not exist yet, they return
`INTERNAL_CREDIT_CHECKOUT_CONTRACT_NOT_INSTALLED` and mutate no intent, order,
or ledger row. The internal-credit finalizer module replaces those shells
with the full gateway-handoff and evidence-reconciliation bodies before
activation and refreshes their registry digests. This keeps the preparation
migration behavior-neutral without reserving an undefined future function
shape.

The row is not caller-writable. The authenticated
`begin_internal_credit_checkout(...)` RPC locks the control row before any
intent lookup or insert and derives the authenticated customer scope. It first
looks up the exact customer/merchant/idempotency key. An identical existing
request hash returns that intent read-only in every control state, including a
completed, aborted, or conflict row needed after an HTTP crash; a changed hash
conflicts. Only when no row exists does begin require `state = enabled` and a
non-null contract SHA, capture the current checkout generation, and insert a
new intent. An existing open/reconciling intent may mutate only through the
separate generation assertion, so returning it while paused does not reopen
mutation authority. Because both a fresh begin and pause lock the same singleton
first, a fresh begin either commits before the pause starts and belongs to the
draining generation, or waits and fails without creating an intent. A partial
unique index permits only one open/reconciling
intent per authenticated user, merchant, and customer; a different request
while one is active returns `INTERNAL_CREDIT_CHECKOUT_IN_PROGRESS` instead of
creating unbounded pause-blocking rows. The route's boolean readiness check is
therefore only an early rejection for a new key. On a same-key retry it must
call begin/replay even when readiness is false so a durable terminal outcome
remains recoverable; this locked begin RPC closes the creation race without
hiding replay state.

`begin_internal_credit_checkout`,
`complete_internal_credit_checkout_intent`, and
`abort_internal_credit_checkout_intent`, plus the read-only
`get_internal_credit_checkout_replay` and proof-gated gateway-initialization
claim/finish RPCs, are authenticated-customer
entrypoints. They derive the merchant-scoped customer from `auth.uid()`, reject
cross-customer or cross-merchant intent access, and grant execute only to
`authenticated` and `service_role`. Completion accepts only the checked
`gateway_handoff` close reason. Abort accepts only the checked pre-credit
reasons described below and refuses to compensate committed credit; only the
service-role reconciler may decide compensation from ledger truth. Claim and
finish additionally validate their exact payment-orchestration proof action and
payload before reading or mutating the gateway-initialization record. A fresh
claim rejects an active provider-cancellation hold under the locked order before
any provider call. If the hold begins after claim, finish must still persist the
sanitized provider result and reference, but atomically changes the
initialization to `reconciliation_required`, links the exact attempt-scoped
review, returns `payment_held_for_provider_cancellation`, and exposes no
checkout URL or fresh-call authority. Provider rejection lets the service
reconciler promote the stored result to `ready`; committed local cancellation
proves provider state and safely aborts/compensates the initialization and
checkout intent. Once the gateway-initialization table exists, the
compensation-aware replacement of provider-cancellation prepare atomically
changes any linked `ready` initialization to `reconciliation_required` and
links that same attempt-scoped review before it grants external cancellation
authority. A pending row remains pending but unclaimable under the hold; a
claimed row is handled by finish. A ready replay that races the hold before
prepare performs that transition makes the identical locked
`ready -> reconciliation_required` change and is withheld rather than returned
to the customer.

Every contract-version storefront call carrying internal-credit intent,
redemption, pre-gateway handoff, and finalizer calls
`private.assert_internal_credit_checkout_intent(...)` before mutation. The
global lock order starts with the control singleton and intent row, followed by
the existing wallet and savings locks, any sorted order-DVA account advisory
locks, then payment, order, evidence, assignment-row, and inventory locks. The
assertion accepts:

- `enabled` with an `open` intent from the current checkout generation; or
- `draining` with an `open` or `reconciling` intent from the retained draining
  checkout generation.

It rejects `paused`, a foreign user/customer/merchant/order, a completed or
aborted intent, a changed request hash, or any generation mismatch. Each
successful mutation binds or revalidates the order and advances the heartbeat
and phase in the same transaction. No public credit mutation has a tokenless
compatibility overload after contract cutover.

`get_internal_credit_checkout_control()` returns the full control state only to
`service_role`. `pause_internal_credit_checkout(p_expected_contract_sha text,
p_reason text, p_actor text)` locks the singleton, requires a trimmed reason of
10 through 500 characters and a trimmed operator identity of 3 through 200
characters, and:

- when enabled, requires the exact retained contract SHA, increments
  `pause_generation`, blocks every new begin by changing state before releasing
  the control lock, and counts `open`, `reconciling`, and
  `reconciliation_conflict` intents plus
  pending/claimed/reconciliation-required gateway initializations for the
  retained checkout generation;
- when both counts are zero, changes directly to `paused`, writes one
  `emergency_pause` event, and returns `outcome = paused`;
- when either count is non-zero, changes to `draining`, writes one
  `emergency_drain_started` event, and returns `outcome = draining` with the
  separate active counts and at most 100 oldest checkout-intent ids and 100
  oldest gateway-initialization ids, each with its current database-computed
  evidence fingerprint; repeated service-only status reads expose the next
  oldest ids after earlier rows resolve;
- when already draining for the same retained SHA and pause generation, returns
  the current drain state idempotently without another event;
- when already paused after activation, requires the same retained SHA and
  returns the existing pause state without inserting another event; and
- when initially paused with no contract SHA, returns the initial pause state
  idempotently.

`finalize_internal_credit_checkout_pause(p_expected_contract_sha text,
p_expected_pause_generation bigint, p_actor text)` locks the control row and
refuses to change `draining -> paused` while any `open` or `reconciling` intent
or `reconciliation_conflict` intent, or any `pending`, `claimed`, or
`reconciliation_required` gateway
initialization from the draining checkout generation remains. When none
remains, it writes one
`emergency_pause_completed` event and returns `paused`. It is idempotent for the
same already-paused generation.

The checked-in pause script first calls the pause RPC, so readiness becomes
false and no new intent can start. If the result is `draining`, it polls the
service-only status, lets recently heartbeating requests finish, and after a
fixed five-minute stale threshold calls
`reconcile_internal_credit_checkout_intent(p_intent_id uuid,
p_expected_evidence_fingerprint text, p_actor text)` for each stale intent,
using the fingerprint returned by service-only status. That RPC
locks the control row, intent, and exact financial/order evidence in the global
order and derives truth from the ledgers rather than trusting the last phase:

- no order and no financial evidence aborts the intent;
- an order with no committed credit is terminalized through the shared
  inventory unwind before the intent is aborted;
- committed wallet or savings without a completed deterministic payment is
  compensated through the shared reversal contract, then inventory is unwound
  and the order is terminalized before abort;
- an already-completed deterministic payment heals the intent to `completed`;
  and
- partial, foreign, or contradictory evidence creates the durable
  `internal_credit_checkout_intent_reconciliation_conflict` review and alert,
  marks the intent `reconciliation_conflict`, and never guesses.

The reconciler accepts `open`, `reconciling`, or `reconciliation_conflict` and
validates a bounded operator identity. It also requires the locked control state
to be `draining` and the intent to belong to that retained checkout generation;
it cannot mutate an enabled or fully paused system. It recomputes the 64-character lowercase
SHA-256 evidence fingerprint after locking and rejects a stale caller
fingerprint without mutation. An unchanged conflict replay returns the same
review id. If ledger or operator repair changes the evidence, a new call with
the new service-status fingerprint re-evaluates from first principles. It may
move the intent to `completed` or `aborted` only when the locked evidence proves
that outcome, atomically records the prior/current fingerprints and resolution
on the linked review, and resolves that review as system reconciliation. If the
new evidence remains contradictory, it keeps the intent and review open while
updating the review's current fingerprint and appending the prior fingerprint
to bounded metadata history. This is the only path by which a conflict intent
can become activatable; no direct intent update or review closure is allowed.

The same script dispatches stale gateway-initialization ids to the dedicated
service reconciler. A `claimed` record is not reclaimed until its fixed
five-minute claim lease expires. That reconciler has the same locked
`draining`-state and retained-generation requirement. It performs provider status lookup
using the stored reference, then either persists the one ready result, proves no
provider object exists and invokes credit compensation plus order
terminalization, or files the durable conflict and leaves the drain unresolved.

The pause script calls the finalize-pause RPC only after every intent is
completed or safely aborted and every gateway initialization is ready or safely
aborted. A durably filed but unresolved intent or gateway conflict remains
drain-blocking. It must not report success while
the state is `draining`. A bounded script timeout leaves readiness false,
reports the remaining checkout-intent and gateway-initialization ids, and exits
non-zero; it never force-flips the state and strands partially committed credit.

`activate_internal_credit_checkout(p_contract_sha text,
p_deployment_id text, p_release_attestation_sha256 text,
p_expected_pause_generation bigint, p_actor text)` is also service-role-only.
It validates the same bounded operator identity and release identifiers, then
locks the singleton. When it is already `enabled`, it returns the existing state
without mutation only if SHA, deployment id, release-identity digest, and pause
generation are the exact active values; it returns the retained checkout
generation and any mismatch fails. Otherwise it requires the caller's pause
generation to match and `state = paused`, with no open, reconciling, or
reconciliation-conflict intent from the prior checkout generation and no
pending/claimed/reconciliation-required gateway initialization from that
generation, requires
`order_payment_account_contract_state.enforcement_state = 'enforced_v1'`,
reruns the assignment epoch/customer-identity/link/supersession/terminal-snapshot SQL preflight,
requires `order_terminalization_contract_state.version = 'compensation_v1'`,
reruns every contract and historical-audit gate, increments
`checkout_generation`, and:

- enables an initially paused singleton with an `activation` event that stores
  the exact contract SHA, deployment id, and immutable release-identity digest;
- re-enables an emergency-paused singleton with a `reactivation` event, allowing
  either the same verified application SHA or a newer verified repair SHA, but
  always requiring a newly verified armed deployment id and release-identity
  digest;
- leaves checkout generation and events unchanged for the exact enabled-state
  idempotent replay described above; and
- rejects an enabled-state identity mismatch, a stale pause generation, an
  invalid 1-32 character normalized deployment id, a non-lowercase 64-character
  release-identity digest, or any failed gate.

The database does not infer which application revision is serving traffic.
The checked-in activation script must query exactly
`https://ogabassey.com/api/internal/release-attestation` with redirects disabled
and no production base-URL override, then prove the exact armed deployment, not
merely its `headSha`. The build embeds the full 40-character GitHub SHA,
normalized `BACI_NEXT_DEPLOYMENT_ID_SOURCE`, workflow run id/attempt,
`environment = 'production'`, lowercase SHA-256 of `VERCEL_PROJECT_ID`, and
`canonicalOrigin = 'https://ogabassey.com'` as non-secret immutable release
constants. `next.config.ts` validates them during production config evaluation
and serializes them through Next's build-time environment substitution, so a
later runtime environment change cannot rewrite artifact or target identity.
The workflow verifier and activation script independently derive the one
trusted expected `projectIdHash` as lowercase SHA-256 over the exact
`VERCEL_PROJECT_ID` bytes in their production environment. They fail when that
value is absent or malformed and accept no CLI argument, response field,
receipt field, or alternate environment variable as an expected-hash override.
The attested response must equal that independently derived hash.
Internal-credit checkout mode and agentic Paystack DVA mode remain
deployment-scoped runtime configuration; changing either requires the fresh
deployment id already enforced by this rollout.

The protected route returns the strict shape
`{ releaseIdentity, dbReady }`. `releaseIdentity` has exactly
`{ schemaVersion: 1, environment: 'production', projectIdHash,
canonicalOrigin, releaseSha, deploymentId, workflowRunId,
workflowRunAttempt, checkoutMode, agenticPaystackDvaMode }`; the SHA and project hash are lowercase
hexadecimal, the deployment id matches the normalized 1-32 character Next
contract, the run id is a positive canonical decimal string, the attempt is a
positive integer, the origin is the exact HTTPS production origin,
`checkoutMode` is exactly `paused` or `enabled`, and
`agenticPaystackDvaMode` is the literal `paused` for every deployment in this
release. Missing, `enabled`, or any other agentic mode is malformed release
identity and returns `503`; it cannot be omitted from canonicalization.
`dbReady` is a live boolean outside that identity object. An authorized GET with
valid build identity and a successful readiness RPC returns HTTP `200` with
this strict body whether `dbReady` is `false` or `true`; false readiness is an
expected attestation result, not an HTTP failure.
The route returns a generic no-identity HTTP `401` for missing/invalid bearer
authorization, `421` for a noncanonical effective origin, and `503` for
missing/malformed server identity or a failed/malformed readiness RPC. Every
response path has `Cache-Control`, `CDN-Cache-Control`, and
`Vercel-CDN-Cache-Control` set to `no-store`; it rejects a request whose
effective HTTPS origin is not the canonical origin, a missing or incorrect
constant-time `Authorization: Bearer` comparison against a dedicated
minimum-32-byte `RELEASE_ATTESTATION_SECRET`, and any absent or malformed
identifier. It accepts no query parameter or alternate credential header, logs
no credential or response body, and creates the server-only readiness client
only after authorization. Route-level tests require all three headers. Because
Vercel consumes `Vercel-CDN-Cache-Control` before forwarding the public
response, the production-alias verifier requires the two externally observable
headers—`Cache-Control` and `CDN-Cache-Control`—to be exactly `no-store`; it does
not require the consumed Vercel-only header to be present at the client.

The route verifier and activation script share one serializer for
`releaseIdentity` only, using the strict schema's fixed field order and UTF-8
JSON with no whitespace or terminal newline. Headers, credentials, and mutable
`dbReady` are excluded. The activation script requires the audited
final-receipt SHA, production target fields, exact armed workflow run, a
deployment id different from the earlier paused deployment, and
`checkoutMode = 'enabled'` and `agenticPaystackDvaMode = 'paused'`, then hashes
the immutable identity. It reads the service-only control state before deciding
the readiness expectation. For `state = paused`, it requires `dbReady = false`
and calls the RPC with the identity digest and current `pause_generation`. For
`state = enabled`, it requires `dbReady = true` and the exact stored SHA,
deployment id, identity digest, and pause generation, then invokes the same RPC
idempotently and requires no new event or checkout-generation increment. Any
other state, identity mismatch, redirect, origin mismatch, agentic mode, or
readiness/state combination fails. The singleton and immutable event store all three stable activation
identifiers so the paused and armed deployments of the same commit cannot be
conflated while an identical post-activation replay remains possible. Database
readiness becomes false immediately when pause enters `draining` or `paused`;
already-registered intents can continue only under their captured generation
until they are durably resolved.

`persist_paystack_order_dva_assignment` and
`persist_initialized_gateway_payment` are the route-proof-gated exceptions
described above because a caller is the customer/guest payment route while DVA
also has merchant-facing callers. They may grant `EXECUTE` to `anon`,
`authenticated`, and `service_role`, but every non-service call must pass the
short-lived valid proof bound to the complete mutation payload. They derive
merchant, customer, amount, currency, gateway policy, and current status from
the locked order/context; caller-supplied identity or proof payload is never
ledger truth. Authenticated merchant/staff and customer identity are additional
scope checks, while a guest capability is valid only for the proof-bound locked
order. `service_role` is reserved for checked-in repair/configuration CLIs,
never the user-facing route.

`persist_customer_wallet_payment_account` is the authenticated route-proof-
gated wallet exception. `anon` has no execute grant. `authenticated` and
`service_role` may execute, but every authenticated call must provide a fresh
`wallet_dva_account_persist` payment-orchestration proof, valid for at most five
minutes and bound to proof id/issued-at, `auth.uid()`, merchant and customer ids,
consent timestamp, provider, currency, raw and canonical receiver bank/account,
account name, provider customer code, subaccount code, nullable provider account
id, and the provider-response fingerprint. The RPC validates the current or
unexpired previous proof secret in constant time, derives the authenticated
merchant-scoped customer and enabled wallet-DVA configuration under lock,
validates the provider subaccount against the locked merchant configuration,
and rejects caller/proof/live-scope disagreement before reading an order alias.
A service-role call additionally performs the explicit role check and is
reserved for a checked-in recovery CLI.

The funding-account POST route signs the proof only after its server-side
Paystack create/fetch response passes the bounded wallet-DVA parser, then calls
the RPC through the request-scoped authenticated Supabase client returned by
the route's auth flow. It must remove `createAdminClient()` and may not substitute
a service client. The proof contains no provider secret or raw response, and
logs contain only its id, action, generation, and sanitized fingerprint.

`get_payment_initialize_context` is a read-only guest-capability exception. It
has the same empty search path and explicit grants but returns only the bounded
payment-init context after exact order-id/email and optional authenticated-scope
validation. It cannot insert a transaction or authorize any provider result;
the proof-gated persistence RPC independently relocks and revalidates.

`get_renderable_order_dvas(uuid[])` is the read-only authenticated presentation
exception. Only `authenticated` and `service_role` receive execute; it checks
`auth.role()` and non-null `auth.uid()` before protected reads for a user call,
then derives customer authorization through the order's same-merchant customer
row or merchant authorization through
`public.check_staff_permission(auth.uid(), order.merchant_id, 'orders',
'view')` for every returned order. That helper includes owners and effective
permission overrides; an active staff row alone is not enough. It emits no
existence/collision diagnostics, never accepts a customer or merchant id, and
cannot mutate, link consent, or authorize provider access.

The replaced `finalize_wallet_order_payment` and
`finalize_store_credit_order_payment` functions are authenticated customer
exceptions. They retain execute grants for `authenticated` and `service_role`,
lock the order before authorization, and prove that `auth.uid()` owns the
order's merchant-scoped customer. They derive payment authority only from
locked order-linked wallet and savings redemption rows; no caller-supplied
amount or payment method may authorize completion. `anon` and unrelated
authenticated users remain denied.

## Match Outcomes

### Exactly one eligible invoice

Automatic confirmation is allowed only when there is exactly one eligible
invoice and no terminal alias, wallet-purpose conflict, or unresolved historical
conflict in the RPC's locked classification.
Reserve or adopt its transaction through
`reserve_paystack_dva_order_payment`, then continue through the shared atomic
gateway finalizer.

The Paystack transaction has already been atomically claimed as `completed`
before dispatch. The shared finalizer remains responsible for:

- changing or healing the order to paid without rewriting the already-claimed
  transaction;
- setting `amount_paid` to the authoritative fully-paid total;
- confirming tracked inventory in the same database transaction as the order
  flip and durable side-effect seed set;
- customer paid-order email;
- merchant payment-received notification, plus the new-order notification only
  when the order's immutable notification-owner contract assigns that event to
  payment;
- merchant settlement;
- ad conversion and other idempotent side effects.

Webhook retries must remain harmless through the replay-first external-reference
resolver, transaction reservation, finalizer, and side-effect idempotency
boundaries.

### Ambiguous invoice identity

Do not select automatically when either:

- multiple eligible invoices exist; or
- one eligible invoice and one or more indistinguishable terminal alias
  conflicts exist; or
- one or more otherwise eligible invoices share the verified receiving/
  provider-customer identity with a retained wallet DVA; or
- one otherwise plausible historical epoch lacks provable immutable
  provider-customer identity or terminal residual evidence.

Persist a `payment_match_ambiguous` reconciliation review containing:

- `merchant_id` only when all candidate and conflict rows identify one distinct
  merchant; otherwise `NULL`;
- Paystack reference;
- receiving account number and normalized bank identity, plus both verified and
  signed source values when they disagreed;
- verified normalized customer email and provider customer code;
- verified amount and paid timestamp;
- every eligible order ID and order number;
- every terminal conflict order ID, order number, terminal state, assignment
  amount, exact snapshotted terminal residual, terminal ledger fingerprint,
  assignment timestamp, and terminal timestamp when available; and
- every conflicting wallet-account id, merchant/customer owner ids, status,
  provider-customer evidence class, and purpose-conflict fingerprint; and
- every unresolved historical epoch, its missing proof class, and all exact
  evidence that caused it to block selection.

No transaction or order is mutated. Send one durable operational alert for the
unresolved review. No customer payment confirmation is sent until an operator
chooses the intended invoice.

### No eligible invoice

Persist a `payment_match_zero_candidates` review with the same verified payment
evidence and any near-match diagnostics, including candidates rejected because
of receiver-bank identity, order state, email, currency, amount, a stale
assignment snapshot, or a terminal-only alias.

The order-DVA RPC's `zero_candidates` outcome does not immediately file this
review. It first allows the existing wallet and other transaction paths to claim
the verified transfer. File the zero-candidate review only if every payment path
returns no match. A cancelled-only alias therefore cannot divert or block a
legitimate wallet top-up.

The review must no longer be silent:

- emit an error-level structured production log;
- enqueue an immediate platform-operations email;
- enqueue merchant email and push alerts when all matching account rows identify
  one merchant;
- deduplicate alerts by the open review's Paystack reference.

The webhook acknowledges the verified event with `2xx` only after the review
and alert rows are durable. If either persistence step fails, return `500` so
Paystack retries. This avoids both an uncontrolled permanent retry loop and a
successful acknowledgement with no operational trail.

## Durable Review Alerts

Add an RLS-locked `payment_reconciliation_alerts` outbox in the owner-expand
migration, before any `claimed_v1` gateway completion can need it. Each row
contains:

- `review_id`
- `merchant_id`
- `audience` (`operations` or `merchant`)
- `channel` (`email` or `push`)
- `status` (`pending`, `claimed`, `sent`, or `failed`)
- claim token and claim timestamp
- attempts, next-attempt timestamp, last error, and sent timestamp

A unique key on `(review_id, audience, channel)` provides deduplication.
`review_id` and `merchant_id` must have indexed foreign keys. RLS is enabled
with no anon or authenticated policies; only `service_role` receives table and
claim-function access.

The owner-expand alert-outbox module installs the alert claim, finish, and retry functions,
a private typed review-and-enqueue primitive, and a service-role public wrapper
that whitelists its issue types. The private primitive has an empty pinned
search path and no execute grant to `PUBLIC`, `anon`, `authenticated`, or
`service_role`; only registered trusted `SECURITY DEFINER` payment,
terminalization, and classification functions call it after completing their
own scope checks. It recomputes required order/merchant scope, creates or reuses
the exact review, and enqueues the allowed audiences atomically. The public
service-role wrapper performs its fail-closed role check before delegating, so
webhooks and CLIs do not duplicate the SQL. An authenticated customer
terminalizer never calls that public wrapper and no client can invoke the
private primitive directly. The initial issue-type surface must include:

- `serialized_inventory_confirmation_failed`;
- the existing transaction-scoped gateway-payment-wedge issue used when
  `claimed_v1` detects side-effect ownership conflict; and
- `legacy_inventory_allocation_ambiguous`, because the allocation audit runs
  after expand and must persist its blocking review before the contract bundle
  exists;
- `terminal_inventory_allocation_conflict`, because every provisional
  terminalizer and replacement RPC already uses immutable unwind; and
- `abandoned_order_terminalization_failed`, because the expand-phase bounded
  cleanup must make an unexpected per-order failure durable;
- `payment_during_provider_cancellation`, because the expand payment finalizer
  must hold a capture that races an active provider cancellation; and
- `provider_cancellation_outcome_unknown`, because the expand-activated
  recovery pass must durably escalate an ambiguous provider result without
  repeating the external cancellation; and
- `payment_received_after_cancellation` and
  `payment_received_after_refund`, because a captured payment blocked from
  reopening a terminal order already needs immediate operational action in the
  expand-compatible completion path.

For a strict gateway inventory failure, the RPC atomically creates or reuses the
review and enqueues one operations alert plus the known merchant alerts. For a
gateway-payment wedge it creates or reuses the review and enqueues the
operations alert required by that issue type. The `claimed_v1` application path
must await this RPC and fail closed if review or alert durability fails; the
current best-effort
`fileInventoryConfirmationFailureReview` behavior is permitted only in the
bounded old-schema branch.
The terminal-allocation and abandoned-cleanup branches create or reuse their
order/fingerprint-scoped reviews and operations alerts before the provisional
caller returns a conflict/error count. A provider-cancellation attempt that
already succeeded externally reuses the existing
`provider_cancelled_local_finalization_failed` marker and links the applicable
allocation or cleanup review; no later migration may be the first release able
to persist that local-finalization failure. Payment-hold and ambiguous-provider
branches use their two dedicated expand-phase types and enqueue one operations
alert before returning.

The existing `handlePaymentForCancelledOrder` best-effort direct review insert
is replaced by an awaited service-role call to the typed atomic
review-and-enqueue wrapper. `fileBlockedOrderPaymentReview` routes both the
cancelled and refunded/skipped captured-payment branches through it.
Deduplication remains transaction/reference scoped—not broad order scoped—so
two real captures on one cancelled order cannot collapse into one review. Each
branch enqueues one operations email and, when the locked transaction/order
evidence identifies one merchant, that merchant's email and push rows. Review
or alert persistence failure returns the existing `review_failed`/retryable
gateway outcome; the caller does not acknowledge success, reopen the order,
dispatch fulfillment, or run paid-order side effects with no durable trail.
The preparation application ships this as a dual-schema capability branch:
before expand it preserves the bounded existing direct-review behavior; as soon
as the expand contract is visible it must use the atomic wrapper and may not
fall back after an RPC durability error. Thus the migration can activate alerts
without an application gap.

The same alert-outbox module adds nullable, non-FK `order_item_id` evidence to
`reconciliation_review` and an open-review expression unique index on
`(issue_type, order_item_id, (metadata->>'evidence_fingerprint'))` for non-null
item ids and fingerprints. It also recreates the existing
`reconciliation_review_open_by_order_idx` predicate with
`legacy_inventory_allocation_ambiguous`,
`payment_during_provider_cancellation`, and
`provider_cancellation_outcome_unknown` excluded, alongside the already
excluded capture-scoped types, so that broad `(issue_type, order_id)`
deduplication cannot collide with distinct items, fingerprints, shipments, or
attempts on one order. The module adds the stable partial unique expression
index `reconciliation_review_open_by_provider_cancel_attempt_idx` on
`(issue_type, (metadata->>'attempt_token'))` for those two issue types when the
review is open and the token is non-empty. That attempt-token index is their
authoritative deduplication key. Their worker updates the same open row to the
latest database-computed evidence fingerprint whenever attempt/provider/order
evidence changes; the manual decision RPC accepts only that exact current
fingerprint. The item/fingerprint index is the authoritative open-review
deduplication key for the allocation issue type. The service-role allocation-review branch accepts
only a pre-cutoff item, recomputes the current 64-character lowercase SHA-256
fingerprint through the allocation-classification contract, creates or reuses
`legacy_inventory_allocation_ambiguous` for that exact item and fingerprint,
and atomically enqueues one operations alert. A changed fingerprint is a new
logical review; an identical CLI replay reuses the same review and alert. The
classification RPC accepts `manual_reconciliation_open` only with that exact
open review id. This issue type, column, index, review branch, and alert
whitelist all belong to the owner-expand bundle and are catalog-verified by
`20260719115890_owner_expand_contract_gate.sql`; the later contract bundle may
extend the contract but must not be the first release able to record the audit
blocker.

That owner-expand alert contract also installs
`order_dva_wallet_assignment_conflict`, excludes it from broad order-only
deduplication, adds its exact order-id/wallet-account-id/fingerprint open unique
key and private review-and-alert branch, and catalog-verifies them before the
consent backstop can suppress a conflicting row. The later assignment RPC reuses
this exact branch; it is not first introduced by the contract bundle.

The first late-payment-contract review foundation,
`20260719120014_payment_review_contract_extensions.sql`, extends this same
table, helper, and worker contract before any wallet-bank backfill or wallet
persistence function can consume a new review type. It covers ambiguous and
zero-candidate matching, invalid wallet timestamps,
`wallet_dva_bank_identity_repair_required` quarantine,
`wallet_dva_assignment_identity_unresolved` and
`wallet_dva_assignment_identity_conflict`,
`wallet_dva_receiver_owner_conflict`,
`wallet_dva_existing_identity_conflict`,
`wallet_dva_disabled_reactivation_required`,
external-reference-role conflicts,
epoch-scoped assignment-contract and historical-identity blockers,
`historical_provider_evidence_unavailable` and
`historical_provider_evidence_conflict` outcomes,
retry-seed conflicts, and
internal-credit conflicts. It must not create a second outbox or replace the
expand-phase rows with a new delivery system. Its catalog/dependency test rejects
any dependency on a `20260719120015`-or-later object. The wallet schema, wallet
repair/persistence, order-DVA assignment, and wallet-reservation migrations each assert that
`20260719120014` is already in the migration ledger and that all required
issue-type constraint values,
fingerprint indexes, broad-order-index exclusions, private review branches, and
alert whitelists exist before they inspect or mutate a wallet row.

The generic service-role `file_payment_match_review` wrapper also rejects all
four wallet-assignment issue types plus
`order_dva_wallet_assignment_conflict`. Only the proof-gated
`persist_customer_wallet_payment_account` RPC can derive an order-identity,
receiver-owner, or existing-identity type and invoke that private branch after
its authenticated scope and provider-evidence checks; only
`persist_paystack_order_dva_assignment` can derive the reciprocal order-purpose
type after its consent, scope, and provider-evidence checks.

The two historical-provider-evidence issue types use an open partial unique
index over `(issue_type, paystack_ref, metadata->>'order_id',
metadata->>'evidence_fingerprint')` when the reference, order id, and lowercase
64-character fingerprint are non-empty, under the stable name
`reconciliation_review_open_historical_provider_evidence_idx`. Their bounded
metadata records the
production-project identity, report hash, observed provider status, and exact
missing or contradictory fields, but never raw webhook secrets or an unredacted
provider payload. The generic service-role `file_payment_match_review` wrapper
must reject both historical-provider-evidence issue types; accepting a caller-
selected issue name is not this contract's authority.

The sole public writer is the service-role-only
`record_paystack_historical_evidence_outcome(p_report jsonb,
p_expected_report_sha256 text)` RPC installed in the payment-review contract
module. It uses the standard empty search path and explicit role check, rejects
reports over 32 KiB, validates schema version
`paystack_historical_evidence_v1`, canonical JSON hash, and order/reference
shape, rejects a provider observation older than 15 minutes, and
accepts only `historical_provider_evidence_unavailable` or
`historical_provider_evidence_conflict`. `recoverable`, caller-selected issue
type, raw payload, secret, or unbounded diagnostics fail before mutation.
The checked `providerObservation` object is exactly `authenticated = true`,
`httpStatus = 200`, `schemaValidated = true`, and RFC 3339 `observedAt`; all
four fields participate in canonical report hashing. A timeout, DNS/TLS/connect
failure, 401/403, 429, 5xx, or malformed/unbounded response cannot be encoded as
an unavailable/conflict report and is rejected before review lookup.
The CLI rejects a report whose production target differs from its configured
Supabase URL/project before calling; the RPC then acquires the external-reference
and order advisories, locks the order, assignment epochs, linked transaction,
and existing review rows, and recomputes the complete local-evidence
fingerprint. A stale or contradictory report is rejected.

The RPC derives the issue type from the checked report status and invokes the
private typed review-and-enqueue primitive. It can create/reuse only that review
and its alerts; its definition and dependency-closure tests reject calls to any
order, transaction, inventory, settlement, notification-completion, assignment-
repair, or financial mutation primitive. It returns exactly `inserted` or
`exact_replay` with review id, alert ids, report hash, and evidence fingerprint.
Only `reconcile-paystack-dva.ts --record-evidence-outcome` calls this RPC. The
private primitive remains available to registered trusted functions, while
`file_payment_match_review` continues serving its other whitelisted issue types.
Together they atomically create or reuse the open `reconciliation_review` row
and enqueue:

- one operations email row for every ambiguous, zero-candidate, invalid-wallet-
  timestamp, `wallet_dva_bank_identity_repair_required`,
  `wallet_dva_assignment_identity_unresolved`,
  `wallet_dva_assignment_identity_conflict`,
  `wallet_dva_receiver_owner_conflict`,
  `wallet_dva_existing_identity_conflict`,
  `wallet_dva_disabled_reactivation_required`, external-reference-role,
  assignment-contract, historical-identity-unresolved,
  `historical_provider_evidence_unavailable`, or
  `historical_provider_evidence_conflict` review;
- one merchant email and one merchant push row only when exactly one merchant
  can be identified.

The RPC sets `reconciliation_review.merchant_id` and every merchant alert's
`merchant_id` to that sole distinct merchant. It sets the review merchant to
`NULL` and creates operations-only alerts when the evidence spans multiple
merchants.

Operations email is delivered to the validated server-only environment variable
`PAYMENT_RECONCILIATION_ALERT_EMAIL`. Merchant email resolves
`support_email`, then `email`; push uses a dedicated
`notifyPaymentReconciliationRequired` message.

The preparation application must already contain the dual-schema alert worker,
route, delivery helpers, and cron before the owner-expand bundle is deployed.
Before the outbox contract exists, the worker performs a schema-capability check,
logs `payment_reconciliation_alert_contract_not_installed`, and exits
successfully without querying or mutating alert rows. Immediately after expand
commits, the same application begins draining the outbox. Production preparation
deployment is blocked unless `PAYMENT_RECONCILIATION_ALERT_EMAIL` is configured.

The webhook schedules an immediate drain attempt after responding. A protected
`/api/cron/process-payment-reconciliation-alerts` route retries pending, failed,
and claims older than 15 minutes. The route uses the existing `CRON_SECRET`
authorization pattern and runs every five minutes from `vercel.json`. Retry
delays are 1, 5, 15, and 60 minutes, then remain capped at 60 minutes; rows are
never automatically discarded. Delivery failure remains visible and retryable;
it does not delete or resolve the reconciliation review.

## Merchant Push Ownership and Paid-Order Durability

`new order` and `payment received` are different business events. The existing
order-creation route intentionally sends the new-order push immediately for
invoice, pay-on-delivery, and fully covered quiz-voucher orders, while
redirected gateway orders defer it until payment. Wallet-, store-credit-, and
savings-funded orders currently mix a creation-time direct new-order push with
a direct payment push. The existing
`runWalletFundedPaidOrderSideEffects` path cannot own those checkout events: it
is reached only after a separate DVA wallet-funding intent settles through
Paystack or Korapay and requires external gateway evidence and settlement
inputs. This change therefore adds a distinct internal-credit paid-order path
for checkout wallet, savings, and store-credit completion. The paid-order
pipeline must not infer ownership from the current `payment_method` or blindly
replay both pushes.

The durable completion guarantee in this section is deliberately bounded to
Paystack/Korapay callers of `complete_order_gateway_payment`, fresh Juicyway
completion by the wedge reconciler, post-cutover Juicyway retries by the
failed-side-effect drain, and the new internal-credit finalizers. Current
`main` already routes those Juicyway callers through the same finalizer. The
primary Juicyway webhook's direct-success branch, Klump, Credit Direct, and
manual paid transitions may still stamp the correct immutable owner for future
migration, but their direct order flips and best-effort notifications are not
silently upgraded by this design. For Juicyway, scope follows the actual
completion caller, not the provider name alone.

Add an order column that becomes immutable as soon as it is classified:

`orders.merchant_new_order_push_owner text`

with a check constraint allowing `NULL` only during the expand/backfill phase
and otherwise exactly:

- `creation`: the order-creation path owns the new-order push, so any later
  paid-order runner must send only payment received;
- `payment`: the first successful paid-order runner owns both new order and
  payment received; and
- `not_applicable`: no new-order push may be invented by this pipeline, while a
  real payment may still produce payment received.

The owner is a deduplication and responsibility contract, not proof that a
creation-time direct push was delivered. For `creation`, the existing order
route attempts the new-order push once for a fresh creation and logs provider
failure; this design prevents later payment code from attempting that event
again. For `payment`, the paid-order outbox owns durable delivery and retry.

The owner is a database creation contract, not a route-side guess. Changing a
PostgreSQL `RETURNS TABLE` row type requires dropping and recreating the
function, so the migration must explicitly drop and recreate the latest
signatures for:

- `private.create_storefront_order` and
  `public.create_storefront_order`;
- `private.create_storefront_order_with_savings` and
  `public.create_storefront_order_with_savings`;
- `private.create_storefront_order_with_quiz_voucher` and
  `public.create_storefront_order_with_quiz_voucher`; and
- `public.create_storefront_order_with_discount_code`.

Every public wrapper must select, return, and preserve
`merchant_new_order_push_owner` from its private or base RPC for both a fresh
insert and an idempotent replay, then receive the exact grants required by its
current callers. The checked-in Supabase types and storefront RPC contract
tests must cover every changed signature; updating only
`create_storefront_order` is not sufficient because
`apps/web/src/app/api/orders/route.ts` dynamically calls all four public entry
points.

For the final notification behavior, `invoice`, `pod`, `pay_on_delivery`, and
fully covered quiz-voucher orders stamp `creation`; every deferred-payment
checkout order stamps `payment`, including ordinary redirected gateway orders
and orders that may later become fully funded by checkout wallet, savings, or
mixed store credit. That mapping does not require the creation RPC to predict
whether a later redemption will be full, partial, unavailable, or skipped for
currency reasons: all of those deferred paths owe their new-order event to the
first successful paid-order runner. Direct imports and external-order inserts
that do not participate in either notification flow explicitly stamp
`not_applicable`. The route consumes the returned owner and never recalculates
it from a later payment-method mutation.

Serialized quiz prizes require a separate insert-time fix. The latest
`private.create_quiz_product_prize_award_with_inventory` replacement must stamp
the reserved order `creation` when it first inserts the zero-total
`quiz_award` order. The reserved-order branch of
`create_storefront_order_with_quiz_voucher` updates that existing row without
changing its owner and returns `creation`. It must never depend on a later
backfill changing a reserved order from `not_applicable`.

The active chat-order conversion is another distinct creator. The expand
migration replaces the exact private/public
`convert_chat_order_to_paid_order_with_inventory(uuid, text, text, numeric,
text)` signatures without changing their JSON result contract, stamps
`creation` because that webhook directly attempts both new-order and
payment-received events when the paid order is created, and writes immutable
allocation evidence for every converted item in the same transaction as its
inventory claim. Bumpa and Jumia direct application inserts explicitly stamp
`not_applicable` and their item paths create `external_untracked` allocations.

The final owner column has no default. A default of `not_applicable` would let a
new order creator silently suppress its new-order responsibility. A checked-in
owner insert-surface test inventories every live application `.insert` into
`orders` and every latest active SQL `INSERT INTO ... orders`; each must be a
known explicit owner writer, a migration backfill, or a test fixture. The final
owner-expand gate aborts on an unclassified writer and asserts
`column_default IS NULL` after `NOT NULL` is installed.

The expand trigger also closes the migration-to-application window. On every
post-cutoff insert it assigns `not_applicable` only when locked insert evidence
shows `external_source IN ('bumpa', 'jumia')` or a non-null Bumpa import-job id;
an explicit conflicting owner is rejected. Every other insert must already
carry its creation-function-selected owner or fails with
`ORDER_NOTIFICATION_OWNER_REQUIRED`, even while the column is temporarily
nullable for historical rows. On update, `NULL -> valid owner` is accepted only
for `service_role` classification of a pre-cutoff order; anon/authenticated
direct updates and post-cutoff repairs are rejected. The contract trigger keeps
the insert derivation for those exact import identities, changes update behavior
to reject every owner change, and retains no general default. Thus the old
Bumpa/Jumia revision remains compatible during schema-first deploy without
creating a null cohort, while an unknown creator fails visibly.

### Legacy owner classification and contract rollout

Do not blanket-backfill every existing order to `not_applicable`. Active unpaid
legacy gateway orders can still be waiting for their deferred new-order event,
so such a backfill would permanently suppress a notification that the current
route intentionally sends only after payment.

Use a route-quiesce/database-fence prepare/expand/classify/contract/arm/activate
rollout. The split preparation is required because the current base storefront
RPC receives `p_payment_method` but no wallet intent, while the route discovers
whether wallet or savings fully covers the order only after base order creation
and redemption. The currently deployed route also treats wallet-redemption
failure as optional. Installing the redemption fence before the prepared route
is live would therefore allow the old application to create an order, hit the
new fence later, and continue through the wrong payment path. Do not add a
caller-controlled owner flag, permit a later `payment -> creation` rewrite, or
rely permanently on one HTTP route to enforce the financial boundary.

1. First ship a route-quiesce preparation release containing the append-only,
   behavior-neutral manifest-listed preparation bundle ending in
   `20260719115690_preparation_contract_gate.sql` and the
   preparation application. Before merge, provision the dedicated matching
   release-attestation secret in GitHub and Vercel production. This release also
   introduces the production build-identity injection, protected attestation
   route, verifier, and post-deploy workflow check; the database job creates the
   readiness RPC before that route is deployed. The bundle creates only:
   - the RLS-locked control singleton and immutable event table described in the
     security contract;
   - the RLS-locked checkout-intent table, begin/status/drain-finalization
     primitives, and fail-closed completion/abort/reconciliation contract
     shells;
   - `internal_credit_checkout_ready()`;
   - `get_internal_credit_checkout_control()` and
     `pause_internal_credit_checkout(...)`;
   - the RLS-locked terminalization-contract singleton initialized to
     `legacy_direct_v0` and its no-data version RPC; and
   - the additive RLS-locked provider-cancellation attempt and immutable event
     tables,
     prepare/result and service-role recovery-claim/backoff functions, plus an
     attempt-token compatibility finalizer that delegates local mutation to the
     unchanged current cancellation function.
     The recovery signatures are exactly
     `claim_provider_shipment_cancellation_recoveries(integer)` and
     `finish_provider_shipment_cancellation_recovery(uuid, uuid, text, jsonb)`.
   It does **not** replace, fence, revoke, or change the behavior of any current
   creation, redemption, or finalizer RPC. It is therefore safe for the
   migration to run before the prepared application while the old production
   revision still serves traffic.

   The preparation application introduces the server-only
   `INTERNAL_CREDIT_CHECKOUT_MODE` setting. Production requires the explicit
   value `enabled` or `paused`; development and test may default to `enabled`.
   Set production to `paused` before this deployment. `/api/orders` rejects an
   internal-credit request immediately after Zod parsing when the environment
   value is `paused`, without calling the readiness RPC. When the value is
   `enabled`, it proceeds only if `internal_credit_checkout_ready()` returns
   true; a missing, malformed, or failed readiness response is false.
   Otherwise it rejects immediately after Zod parsing with HTTP `503`,
   `code = INTERNAL_CREDIT_CHECKOUT_PAUSED`, and `Retry-After: 300`. After the
   application is live, wait a fixed 15-minute route-quiescence interval and
   verify from request logs and recent order/redemption evidence that no
   internal-credit checkout remains in flight through the route. The storefront
   shows a temporary-payment-option message and does not discard the cart.
2. The same route-quiesce application must contain a dual-schema gateway
   notification bridge before any owner migration is deployed. It understands
   both versions of `complete_order_gateway_payment`:
   - when the current RPC result has no `merchant_push_contract` field, the
     bridge preserves the existing direct helper only for the fresh completion
     that changed the order; a replay never sends direct pushes;
   - when the result contains
     `merchant_push_contract = claimed_v1`, the bridge never calls the direct
     helper and runs only claim-gated executors backed by the exact
     `paid_order_side_effect_steps` returned by the RPC, using
     `merchant_push_steps` as the merchant-executor subset and the locked
     `payer_transaction_id` to distinguish a payer replay from a settlement-only
     capture. A payer completion or replay must also return
     `inventory_contract = atomic_confirmed_v1`; a settlement-only capture
     returns `not_applicable`, and a payerless historical replay returns
     `legacy_confirmation_required`.
   The preparation application therefore includes the two push executors, their
   TypeScript step union, failed-row drain dispatch, a backward-compatible
   completion result validator covering the payer and inventory contracts, the
   typed `payment_held_for_provider_cancellation` no-fulfillment outcome, and
   tests, but it does not invoke the new step names until the database advertises
   `claimed_v1`. It also contains a
   dual-schema validator for `claim_payment_side_effect`: the old result has only
   `we_won` and `current_status`, while the hardened result additionally returns
   `current_transaction_id` and `ownership_conflict`. Completion and failure
   updates already filter by transaction id as well as order, step, and claim
   token, which is safe against both schemas because the column already exists.
   It does not call the future `seed_paid_order_side_effect_retries` RPC before
   the contract bundle, and its `claimed_v1` failure path never falls back to
   the legacy direct table upsert; expand-period payer-owned rows are created
   only by the atomic completion function. Before the owner-expand bundle it behaves
   exactly like the current application; immediately after that schema-first
   migration it is already able to consume the claimed completion and hardened
   claim contracts. The old-schema preparation interval still has the current
   direct-delivery and transaction-unaware claim limitations, so it is a bounded
   compatibility window: after quiescence verification, proceed directly to the
   expand release and do not claim the new durability guarantee until that
   migration commits.
   The preparation revision also contains a dual-schema storefront-creation
   result parser for all four RPC entrypoints. When the old result has no
   `merchant_new_order_push_owner`, it preserves the current route decision.
   Once the expand result supplies the field, only the exact checked
   `creation` value permits the direct new-order attempt, `payment` defers it to
   the claimed paid-order pipeline, and `not_applicable` installs no attempt.
   A null, unknown, or malformed post-expand value fails closed before any
   direct notification. This makes database ownership authoritative in the
   migration-to-application window rather than waiting for the expand app
   deployment.
   It also contains the dual-schema payment-reconciliation alert worker and
   cron route described above. Before expand, that worker no-ops after its
   capability check; after expand, it drains strict-inventory, gateway-wedge,
   payment-during-cancellation, and provider-cancellation-unknown alerts without
   another application deployment. The same preparation revision contains the
   bounded provider-cancellation recovery pass added to the existing hourly
   reconciliation route; it also no-ops until `allocation_safe_v1`.
   Finally, it contains the terminalization compatibility dispatcher and
   dual-shape result parsers before immutable allocations are introduced. The
   behavior-neutral control-schema module creates an RLS-locked
   `order_terminalization_contract_state` singleton initialized to
   `legacy_direct_v0` plus a no-data
   `get_order_terminalization_contract_version()` RPC. While the version is
   `legacy_direct_v0`, the prepared application preserves the current terminal
   paths except provider cancellation: the preparation migration adds its
   dormant durable attempt saga without replacing the current local finalizer,
   and the prepared route returns HTTP `503`,
   `code = PROVIDER_CANCELLATION_MAINTENANCE`, plus `Retry-After: 300` before
   any provider or mutation call. The same 15-minute route-quiescence interval
   must prove no cancellation request started by the prior revision remains in
   flight, so no external provider call can straddle the later strict gate.
   Once expand atomically advertises
   `allocation_safe_v1`, every chat, agentic, merchant PATCH, customer
   cancellation, shipping webhook, payment-failure, import, and cleanup caller uses the
   structured allocation-safe RPC path. A missing or malformed capability
   response fails closed for a terminal mutation. A request that read
   `legacy_direct_v0` immediately before the expand commit may have its old
   direct write rejected by the new database gate; it rereads capability and
   retries the RPC once, never falls back again after seeing the gate error.
3. Only after the prepared application is live and the route-drain proof has
   passed, ship a separate fence-only release containing the manifest-listed fence
   bundle ending in `20260719115740_internal_credit_fence_contract_gate.sql`.
   The already-live application remains unchanged. This bundle installs
   `private.assert_internal_credit_checkout_enabled()` and replaces the exact
   current mutation-entrypoint allowlist:
   - `private.create_storefront_order_with_savings(uuid, text, text, jsonb,
     text, numeric, numeric, numeric, text, text, text, jsonb, text, text,
     jsonb, uuid, text, text, uuid, text, numeric, numeric, uuid, numeric, text,
     text, text)`;
   - the public wrapper with that identical argument signature;
   - `public.redeem_savings_for_order(uuid, uuid, uuid, uuid, numeric, text)`;
   - `public.redeem_wallet_for_order(uuid, uuid, uuid, numeric, text)`;
   - the current amount-taking
     `public.finalize_wallet_order_payment(uuid, numeric)`; and
   - the current amount-taking
     `public.finalize_store_credit_order_payment(uuid, numeric, text)`.
   Each replacement invokes the assertion before order, idempotency,
   redemption, wallet, savings-goal, inventory, email, or notification
   mutation. The registry module creates an RLS-locked
   `internal_credit_checkout_function_contracts` registry containing every
   exact fenced signature, purpose, expected grant set, active flag, contract
   version, and SHA-256 digest of its canonical `pg_get_functiondef` result,
   plus an RLS-locked singleton
   `internal_credit_checkout_function_contract_state` whose version is exactly
   `fence_v1`. Migration tests fail if any named signature is absent or its
   grants are not restored exactly. Registry writes receive no runtime grant;
   only migration SQL may refresh them. There is no
   “additional entrypoint found during implementation” escape hatch: a newly
   discovered direct mutation signature requires this specification and static
   allowlist to be updated before implementation.

   Because the prepared route is already live, the migration-first deployment
   window is safe. After the fence commits, prove every direct authenticated
   call returns `INTERNAL_CREDIT_CHECKOUT_PAUSED` without mutation and wait a
   fixed 15-minute direct-RPC quiescence interval before treating database
   quiescence as complete.
4. The expand release contains only the owner-expand bundle plus its
   expand-compatible application and generated types. The owner-schema module adds the
   nullable checked owner column and the insert/update trigger contract above:
   exact external imports derive `not_applicable`, every other new row requires
   an explicit owner, and only service classification may perform the one-time
   pre-cutoff `NULL -> owner` transition. It replaces every storefront RPC listed above so
   all post-cutoff orders receive an explicit owner: creation-time flows stamp
   `creation`, every deferred checkout stamps `payment`, and non-participating
   inserts stamp `not_applicable`. It preserves the preparation fence in every
   replaced storefront and redemption entrypoint. Internal-credit checkout
   remains closed in both the environment and database for the entire expand
   and classification interval, so the bundle never has to infer wallet
   intent that the old route did not provide. After all replacements and grants
   are final, the bundle's final gate atomically refreshes every changed active
   function-contract row from the new canonical definitions, retires no-longer
   active signatures, and changes the exact registry-state version from
   `fence_v1` to `owner_expand_v1`. It then asserts that the active signature
   set, digests, and grants equal the versioned manifest before commit.
5. The paid-order side-effect module also extends the `payment_side_effects` step constraint,
   drops and recreates `claim_payment_side_effect`, and replaces
   `complete_order_gateway_payment`. The hardened claim RPC preserves the old
   parameter list but returns `current_transaction_id` and
   `ownership_conflict` in addition to `we_won` and `current_status`. It validates
   that the requested transaction belongs to the order and permits a failed or
   stale-claimed takeover only when the stored row has that same transaction id.
   A row owned by another transaction is left byte-for-byte unchanged and
   returns an explicit ownership conflict; it can never lend its claim token to
   the requesting transaction. The preparation application treats that result
   as `PAID_ORDER_SIDE_EFFECT_STATE_CONFLICT`, files or reuses the existing
   transaction-scoped gateway-payment-wedge review with the step and both
   transaction ids, and returns `500`. If review persistence fails it also
   returns `500`, so a gateway retry or drain invocation cannot retire the work
   silently.

   The completion function returns
   `merchant_push_contract = claimed_v1`, the locked nullable owner, the exact
   `merchant_push_steps`, and the exact complete
   `paid_order_side_effect_steps` durably owned by the payer transaction, plus
   the locked `payer_transaction_id`, `inventory_contract`, and committed
   inventory counts. In the
   same transaction that first changes an order to paid, it always seeds
   `paid_email`, `ad_tracking_conversion`, `merchant_settlement`, and
   `merchant_payment_received_push`; it also seeds
   `merchant_new_order_push` when the owner is `payment`. For a still-null legacy
   owner it seeds payment received but not new order and returns
   `new_order_push_deferred_for_owner = true`. It never calls, requests, or
   stamps a direct-delivery mode. Before returning, it proves that every required
   row exists and is owned by the payer transaction. A row already owned by a
   different transaction returns a conflict before the order flip or any new
   step inserts commit; the preparation application files the existing
   gateway-payment-wedge review and returns `500`, so replay can retry after
   reconciliation. It never silently treats `ON CONFLICT DO NOTHING` as durable
   ownership. Before commit it confirms inventory under the same locks. A strict
   serialized shortage rolls back the order flip, all seeds, and inventory
   mutations; unlimited and fallback policies remain successful. Earlier
   owner-expand alert-schema and alert-RPC modules install and catalog-verify
   the minimal durable outbox, worker functions, and typed review-and-alert RPC
   before the paid-completion adapter is activated, so `claimed_v1` never
   depends on later infrastructure.
   Because the preparation application is already live, the
   migration-to-application window immediately uses those claims and cannot
   duplicate an invoice's creation-time new-order event. No payment first
   completed after this migration may enter a permanent direct-only or
   fetch-before-marker cohort.
6. Add an RLS-locked singleton
   `order_notification_owner_migration_state` table. The owner-schema module
   inserts only its immutable
   `legacy_cutoff_at = transaction_timestamp()` value in the same transaction
   that adds the column. Internal-credit activation state belongs exclusively
   to `internal_credit_checkout_control`; do not mix deployment readiness with
   owner-classification evidence. Add a separate RLS-locked
   `order_notification_owner_backfill_decisions` table containing one row per
   pre-expand order: `order_id`, selected owner, structured evidence,
   `decided_by`, and `decided_at`. Only `service_role` may read either table or
   write decisions. The migration-state table grants no direct `UPDATE`.
7. A service-role RPC,
   `classify_legacy_order_notification_owner`, acquires the existing
   `baci_order_payment:<order id>` advisory lock, locks the order, inserts or
   idempotently reuses the decision, and performs only the permitted
   `NULL -> owner` update atomically. If an order became paid under
   `claimed_v1` while its owner was null and the decision is `payment`, the same
   transaction finds the payer transaction from the existing
   `merchant_payment_received_push` row and seeds the missing
   `merchant_new_order_push` row. A valid paid order with no such row predates
   the claimed completion contract or was completed by a non-participating
   historical path, so classification records the owner but does not invent
   retrospective work. A present payment-received row whose transaction does
   not belong to the order is a reconciliation conflict. A `creation` or
   `not_applicable` decision never seeds the new-order step. The RPC rejects
   orders created at or after the persisted cutoff; a post-cutover null owner
   indicates a broken insert path and must not be hidden by the legacy
   classifier.
8. The audit CLI reads the persisted expand cutoff and classifies every
   pre-cutover order. Active unpaid or partially paid orders require an
   individual evidence-backed decision using the original creation path,
   checkout idempotency data, payment-initialization/reference history, order
   audit records, and available notification logs. Mutable current
   `payment_method`, `updated_at`, or DVA metadata is never sufficient by
   itself. Ambiguous historical rows receive an explicit operator-approved
   `not_applicable` decision rather than an inferred value. Terminal and
   inactive historical rows may be bulk-decided `not_applicable`, but still
   receive one recorded decision per order. Tony's known invoice is recorded as
   `creation`, matching the invoice creation path; its later recovery therefore
   owns payment received only and cannot create another new-order push.
9. The final late-payment contract gate aborts unless every pre-cutover order has a decision,
   every order has a non-null owner, and every active unpaid or partially paid
   order appears in the signed audit output. It changes the column to
   `NOT NULL` with no default, verifies the complete explicit insert surface,
   replaces the trigger with a strict every-update immutability trigger, and
   revokes and drops the classification RPC. The audit table remains immutable
   operational evidence. The late-payment contract bundle replaces
   every preparation-fenced internal-credit function with intent-aware
   signatures, drops both unsafe amount-taking finalizer signatures and every
   tokenless redemption compatibility signature, creates only the
   checkout-intent plus redemption-id finalizer signatures, and adds the
   service-role-only
   `activate_internal_credit_checkout(p_contract_sha text,
   p_deployment_id text, p_release_attestation_sha256 text,
   p_expected_pause_generation bigint, p_actor text)` RPC. The
   activation RPC locks the control singleton and refuses to open it unless:
   - the owner contract gate still passes;
   - both unsafe amount-taking finalizer signatures are absent;
   - both intent-aware replacement finalizer signatures exist with the expected
     grants;
   - every exact begin, intent assertion, intent completion, intent abort,
     wallet (including `reserve_paystack_wallet_dva_top_up`), savings,
     storefront, finalizer, drain, and reconciliation signature
     exists in `internal_credit_checkout_function_contracts`, has its expected
     grant set, and its live canonical function-definition digest matches the
     registered digest;
   - every exact terminalization signature and the cancellation backstop
     contract described below passes the same registry check;
   - the separate terminalization-contract state is exactly
     `compensation_v1` and the strict one-shot authorization trigger is live;
   - the post-contract Paystack external-reference index has its exact
     role-aware catalog definition and a fresh database recomputation has zero
     unclassified, evidence-mismatched, or duplicate referenced rows; the
     operator runbook has already verified and archived the signed
     reference-role report, but this RPC trusts only its fresh locked database
     recomputation and receives no report or report-derived authorization;
   - the separate DVA assignment contract state is exactly `enforced_v1` with
     a current zero-blocker epoch/identity/link/terminal-snapshot audit, zero
     post-contract wallet-purpose collision, and every pre-contract collision
     either absent or bound to its exact current open quarantine review;
   - the historical cancelled-order evidence gate described below passes; and
   - `p_contract_sha` is exactly 40 lowercase hexadecimal characters,
     `p_deployment_id` is the exact normalized 1-32 character armed deployment
     id, and `p_release_attestation_sha256` is exactly 64 lowercase hexadecimal
     characters representing the canonical immutable `releaseIdentity` object,
     never the surrounding live-readiness response.
   Contract-bundle modules stage every replacement and expected digest/grant
   without changing the active registry version. After the owner-contract
   module is staged, the final gate atomically deletes retired active rows,
   refreshes every remaining digest and grant contract, inserts every new
   intent-aware, terminalization, and storefront signature, changes the
   registry-state version directly from `owner_expand_v1` to
   `late_payment_v1`, and asserts the final active set. Activation requires
   `late_payment_v1`, rejects any missing or extra active signature, and
   therefore cannot compare any post-replacement function against a fence-,
   expand-, or core-phase hash.
   No migration or deployment calls activation, so the singleton remains in its initial
   `paused` state with null `contract_sha`, `activated_deployment_id`,
   `activation_attestation_sha256`, and `activated_at`.
   The contract application removes the direct internal-credit paid email and
   push calls, begins one generation-bound checkout intent before order
   mutation, passes it through every internal-credit-capable storefront,
   redemption, gateway-handoff, and finalizer call, uses the replay-first
   ledger-authoritative finalizers, and schedules the best-effort targeted
   worker nudge after a completed durable result. The protected worker and
   periodic drain alone invoke the claimed internal-credit runner. The app is
   deployed while
   `INTERNAL_CREDIT_CHECKOUT_MODE` is still `paused`.
10. After the contract application's migrations, finalizer replay tests,
    side-effect tests, cancellation tests, owner gates, and health checks pass on
    the exact production revision, keep the environment and database paused,
    wait the fixed legacy Paystack-writer drain, pass the signed
    reference-role audit with zero unclassified or duplicate referenced rows,
    and deploy only
    `20260719120200_paystack_external_reference_unique_index.sql` plus its
    phase marker, hashes, `reference-index-candidate.json`, and tests. Verify
    its role-aware catalog expression and recorded migration, then merge the
    separate zero-migration receipt PR with
    `reference-index-deployment.json`; require enforce convergence and its exact
    healthy receipt deployment SHA before continuing.
11. Keep the application unchanged and paused, pass the signed
    epoch/customer-identity/link/terminal-snapshot audit, and deploy the
    manifest-listed enforcement bundle ending in
    `20260719120220_order_payment_account_enforcement_cutover.sql` plus its
    phase marker, hashes, `enforcement-candidate.json`, generated types, and
    tests. Verify `enforced_v1`, direct-write rejection, and that candidate
    commit's exact healthy `headSha`.
12. Capture the enforced production ledger/effects and exact deployment-job
    evidence, then merge the no-migration final receipt PR with
    `enforcement-deployment.json` and `final-production.json`. Update all
    current P0 post-deploy receipt/provenance/fixture bindings, require both
    replay modes to pass in `enforce`, then deploy and
    health-check that exact commit while environment and database remain
    paused. Archive the protected release-attestation response, including its
    production target, paused deployment id, immutable release-identity digest,
    `agenticPaystackDvaMode = 'paused'`, and live `dbReady = false`. This
    final-receipt `headSha` becomes the audited
    application SHA; freeze merges until activation and invalidate/reissue the
    receipt if `main` moves.
13. Only then change the production setting to `enabled` and perform a fresh
    prebuilt deployment of that same final-receipt commit. This arms the route
    but does not open checkout: the route continues returning
    `INTERNAL_CREDIT_CHECKOUT_PAUSED` because the database readiness RPC is
    still false, and direct authenticated RPC calls still fail at the database
    fence. Verify through the production alias the armed deployment's exact
    production target, `headSha`, workflow run id/attempt, normalized deployment
    id distinct from the paused deployment, `checkoutMode = 'enabled'`, zero
    pending migrations, `agenticPaystackDvaMode = 'paused'`, readiness-false
    response, and direct-RPC rejection.
    Only then call
    `activate_internal_credit_checkout` with that exact 40-character production
    final-receipt commit SHA, exact deployment id, canonical immutable
    release-identity digest, current `pause_generation` returned by the service-only
    status RPC, and recorded operator identity. It atomically stores the SHA,
    deployment id, and release-identity digest, increments `checkout_generation`,
    changes state to `enabled`, writes the immutable activation event, and
    returns the state.
    This database activation is the final action and the first point at which
    the route may begin an internal-credit intent. Direct redemption or
    finalizer RPCs still fail without a valid intent bound to the same
    authenticated checkout; no post-activation application deploy is required.

14. If any financial smoke, reconciliation signal, or contract check fails
    after activation, call `pause_internal_credit_checkout` immediately with
    the active SHA, incident reason, and operator identity. This closes
    readiness to new checkout intents without waiting for a deployment and
    returns either `paused` or `draining`. Set the environment mode to `paused`,
    then use the checked-in script to wait for recent intents, reconcile stale
    intents, and call `finalize_internal_credit_checkout_pause`; do not claim
    rollback completion while the database remains `draining`. Deploy the same
    or a repaired revision while readiness remains false, repeat every gate,
    arm the exact verified SHA, and reactivate with the new current
    `pause_generation`. Never reopen by direct table update, force-close an
    unresolved intent, or clear an event.

Order idempotency replay, `prepare_storefront_order_for_checkout`, imports,
repairs, and every payment-method update preserve the stored owner. A future
product flow that genuinely transfers ownership requires a separate audited
design and cannot achieve it by changing `payment_method`.

Add the two claim-gated steps to `payment_side_effects`:

- `merchant_new_order_push`
- `merchant_payment_received_push`

Extend the side-effect constraint, TypeScript step union, executors, and
`REPLAYABLE_PAID_ORDER_SIDE_EFFECT_STEPS`. The shared failed-side-effect drain
then retries whichever merchant pushes that flow owns together with paid email,
settlement, and ad tracking.

The owner-expand paid-order module must also harden the existing claim boundary. Because a
`payment_side_effects` row is durably owned by its `transaction_id`, the current
claim RPC's failed/stale takeover cannot remain keyed only by `(order_id, step)`.
Drop and recreate `claim_payment_side_effect(uuid, uuid, text, uuid, text)` with
the same parameters and explicit service-role guard before financial reads. The
replacement uses an empty pinned `search_path`, fully qualified relations,
revokes default/PUBLIC execution, and restores execution only to `service_role`.
The new table result contains:

- `we_won`;
- `current_status`;
- `current_transaction_id`; and
- `ownership_conflict`.

Its insert or takeover validates that the requested transaction belongs to the
requested order. `ON CONFLICT` may update the claim token, actor, timestamp,
status, and attempt count only when
`payment_side_effects.transaction_id = p_transaction_id` and the row is failed
or stale claimed. When the stored transaction differs, the function changes no
row and returns `ownership_conflict = true` with the stored owner. It must never
rewrite `transaction_id`.

The preparation application validates both result shapes before the expand
migration. The old two-field result is accepted only while the completion RPC
has no `merchant_push_contract`; a `claimed_v1` flow requires the hardened claim
shape. `claimStep` throws a typed ownership-conflict result rather than treating
it as an ordinary skipped claim. The gateway caller durably files or reuses the
existing `gateway_payment_wedge_requires_review` row with metadata subtype
`paid_order_side_effect_claim_owner_conflict`, then returns
`completion_failed` during the preparation/expand release. After the contract
migration, the caller routes the same conflict through
`seed_paid_order_side_effect_retries`, which files the dedicated
`paid_order_side_effect_retry_conflict` review and alert instead of creating a
second generic wedge review.
Both `markCompleted` and `markFailed` filter by `order_id`, `transaction_id`,
`step`, and `claim_token`. A zero-row completion/failure update is a concurrent
takeover result, never permission to mutate or report completion for a different
transaction's row.

`runPaidOrderSideEffects` must require an explicit
`merchantPushPolicy` with exactly these values:

- `new_order_and_payment`: install both claimed executors;
- `payment_only`: install only `merchant_payment_received_push`; and
- `none`: install neither executor.

During the nullable-owner expand interval, a transient `NULL` owner resolves to
`payment_only` for immediate execution and emits
`new_order_push_deferred_for_owner`. The classifier later decides whether to
seed `merchant_new_order_push`; application code must not guess while the owner
is null.

Gateway orchestration must separately require the completion RPC's database
contract marker. `merchant_push_contract = claimed_v1` means the RPC has already
made the complete payer-owned gateway set durable—paid email, ad tracking,
settlement, and the selected merchant pushes—and direct push calls are
forbidden. For a payer completion, it also means
`inventory_contract = atomic_confirmed_v1`; the seed set and inventory result
became visible in the same commit. An absent marker is recognized only by the
preparation application's backward-compatible bridge while the old database
function is still installed; it permits the existing direct helper and
application inventory compensation for that fresh completion and never for
replay. Internal credit is always claim-gated and cannot select the compatibility
branch.

The ownership matrix is:

| Flow | Stored owner | New-order executor | Payment-received executor | Paid-order policy |
| --- | --- | --- | --- | --- |
| Invoice, including a later DVA payment | `creation` | Existing creation route, best-effort once on fresh creation | Shared gateway finalizer after confirmed payment | `payment_only` |
| Deferred-payment checkout order fully funded by wallet, store credit, or savings after unpause | `payment` | Internal-credit paid-order runner | Internal-credit paid-order runner | `new_order_and_payment` |
| Legacy internal-credit order classified from evidence as creation-owned | `creation` | Existing historical creation path; no retrospective retry is invented | Internal-credit paid-order runner | `payment_only` |
| Ordinary redirected card/Paystack/Korapay order | `payment` | Shared gateway finalizer after confirmed payment | Shared gateway finalizer | `new_order_and_payment` |
| Juicyway payer freshly completed by the existing wedge reconciler, or retried from post-cutover durable rows by the failed-side-effect drain | Locked immutable owner | Shared gateway finalizer only when the locked owner selects it | Shared gateway finalizer | Locked-owner policy; the drain never seeds a genuinely pre-outbox already-paid replay |
| Pay on delivery | `creation` | Existing creation route, best-effort once on fresh creation | None until a separately supported payment-completion flow runs | No paid-order runner invocation |
| Fully covered quiz voucher | `creation` | Existing creation route, best-effort once on fresh creation | Preserve the current behavior; this change does not invent a gateway payment event | No new paid-order push |
| Legacy/imported order without trustworthy ownership evidence | `not_applicable` | None | First genuine paid-order runner | `payment_only` |
| Additional capture on an order already paid elsewhere | Any | None | None; settlement-only capture behavior remains unchanged | `none` |

Add `merchant_new_order_push_owner` to `PAID_ORDER_RICH_SELECT` and its
normalized paid-order type. The gateway finalizer, external DVA wallet-funded
runner, and internal-credit runner resolve policy only from that stored owner:

- `payment` resolves to `new_order_and_payment`;
- `creation` and `not_applicable` resolve to `payment_only`; and
- settlement-only captures override the order owner and use `none`.

`payment_method`, transaction DVA tags, and whether the DVA was added after
creation are never notification-ownership inputs.

The expand-migration replacement of `complete_order_gateway_payment` loads and
locks the transaction's persisted `gateway`; it accepts no caller-selected
provider mode. Fresh payer completion through this RPC is supported only for
`paystack`, `korapay`, and `juicyway`, matching the live
`FinalizeOrderGatewayPaymentTransaction`/`HEALABLE_GATEWAYS` surface. The
Juicyway branch is reachable only from the already-existing reconciliation and
failed-side-effect-drain callers; this replacement does not route the primary
Juicyway webhook's direct-success branch into the RPC. Any other gateway on a
fresh completion returns a typed unsupported-gateway conflict before order,
inventory, or side-effect mutation. A genuinely pre-outbox already-paid
Juicyway replay with no persisted payer evidence returns `NULL` payer and empty
step arrays, preserving the no-retrospective-notification rule.

The replacement must return
the locked nullable `merchant_new_order_push_owner`, the literal
`merchant_push_contract = claimed_v1`, the exact persisted
`merchant_push_steps`, the exact persisted
`paid_order_side_effect_steps`, and
`payer_transaction_id`, `inventory_contract`,
`inventory_reclaimed_unit_count`, `inventory_missing_unit_count`, and
`new_order_push_deferred_for_owner`. It also returns an exact
`completion_outcome` that includes
`payment_held_for_provider_cancellation` plus the durable review id when that
branch applies. In the same locked operation, all
order-scoped side-effect rows that identify the payer must agree on one
transaction id; mixed owners return a conflict. A fresh completion returns the
current transaction as payer, a replay returns the persisted payer, an
additional capture returns the other payer, and a genuinely pre-outbox paid
order may return `NULL`.

For a fresh order flip, the RPC performs the following work in one PostgreSQL
transaction and in this order:

1. validate the complete required side-effect set and its transaction ownership;
2. after locking the order, read active provider-cancellation evidence under
   that order-lock stability rule. A hold commits the verified transaction
   state, creates/reuses `payment_during_provider_cancellation` through the
   private review/enqueue primitive, returns
   `payment_held_for_provider_cancellation`, and performs no paid-order,
   inventory, or side-effect mutation. The application returns a retryable
   failure; the hourly reconciler can heal after a known provider rejection or
   route the captured payment for refund after terminal cancellation;
3. update the order to paid and synchronize `amount_paid`;
4. insert `paid_email`, `ad_tracking_conversion`, `merchant_settlement`, and the
   selected push rows with the payer transaction id;
5. call `private.confirm_order_inventory_reservations` while the order and
   payment advisory lock are still held; and
6. inspect its result before returning or committing.

If the inventory result contains any strict exception code, the RPC raises
`serialized_inventory_unavailable` with the existing stable SQLSTATE `55000`.
That
single database failure rolls back the order flip, amount update, side-effect
seeds, inventory-unit mutations, and fulfillment snapshots together. No seeded
row becomes visible to the failed-side-effect drain, so application-level seed
deletion and a race-prone paid-status rollback are forbidden in the
`claimed_v1` branch.

The external transaction claim is a preceding committed transaction and is not
rolled back by this finalizer failure. The durable state is therefore a
completed gateway transaction plus an unpaid order and a required
`serialized_inventory_confirmation_failed` review. Webhook replay or
reconciliation may heal the order only if strict inventory later becomes
available; it never reclaims or rewrites the completed gateway transaction.

Successful payer completions and payer replays return
`inventory_contract = atomic_confirmed_v1` plus the committed reclaimed and
missing-unit counts. The application may revalidate product caches after commit
when `inventory_reclaimed_unit_count > 0`, but cache revalidation cannot change
payment success. A settlement-only additional capture returns
`inventory_contract = not_applicable` and performs no order inventory work. A
genuinely pre-outbox already-paid order with no payer returns
`inventory_contract = legacy_confirmation_required`; the compatibility
application may run the existing idempotent inventory confirmer, but it creates
no notification or settlement work.

When a verified external gateway payment encounters a strict inventory
exception, `completeOrderGatewayPayment` maps the stable SQLSTATE to the existing
`inventory_failed` outcome and files or reuses a
`serialized_inventory_confirmation_failed` review with the order, transaction,
gateway reference, effective strict policies, missing item diagnostics, and the
proof that the order flip and side-effect set rolled back. The review RPC also
enqueues the deduplicated operations alert and merchant alerts for the known
merchant. Paystack webhook delivery acknowledges only after the review and alert
rows are durable; an application verify request receives the existing
inventory-unavailable response. Review persistence failure remains `500` so the
payment cannot become operationally silent.

Every row atomically seeded by gateway completion starts as `failed` with the
existing `error = rpc_seed_pending_drain` marker and a result reason identifying
the completion seed. Those rows commit only after atomic inventory confirmation
succeeds. Replays read and return the existing rows; they do not infer new work
from mutable application state. An order already paid before the expand
migration with no owned push rows returns an empty `merchant_push_steps` list
under `claimed_v1`, so the preparation bridge knows that it must neither create
claimed push work nor resend direct pushes; it also does not manufacture
historical fixed steps that were never persisted. A completed transaction that
first heals a still-unpaid order after the migration receives the normal full
atomic payer-owned set because that RPC invocation owns the order flip.

### Per-item inventory accounting contract

The owner-expand paid-order module must replace
`private.confirm_order_inventory_reservations`, not merely call the current
implementation. The current helper carries a reclaimed-unit counter across
order items, which allows serialized units reclaimed for an earlier item to
mask a strict shortage on a later item. The replacement keeps aggregate totals
only for its successful return value and resets decision counters for every
item:

- `v_item_reserved_count`
- `v_item_reclaimed_count`
- `v_item_confirmed_count`
- `v_item_missing_count`

Every reservation confirmation or reclaim increments the current item's
counter and the corresponding aggregate counter. The effective-policy decision
for an item uses only that item's required, reserved, reclaimed, confirmed, and
missing counts. No count earned by item A can satisfy item B.

Each strict exception entry must include:

- `allocationId`
- `itemId`
- `productId`
- nullable `variantId`
- `allocationMode`
- `effectivePolicy`
- `requiredUnitCount`
- `reservedUnitCount`
- `reclaimedUnitCount`
- `missingUnitCount`
- the stable exception code

If one or more strict exceptions exist, the helper raises
`serialized_inventory_unavailable` with SQLSTATE `55000` and puts the complete
JSON diagnostic array in `DETAIL`. The surrounding payment transaction rolls
back, while the application can persist an exact review from the exception
detail after rollback. Successful calls continue returning aggregate reclaimed
and missing-unit counts for cache invalidation and observability.

The SQL regression matrix must include a multi-item order where item A reclaims
units and item B has no strict units; item B must still fail. It must also cover
all-`off`, all-`serialized_then_unlimited`, mixed unlimited/strict, and variant
override fixtures.

### Unlimited and mixed inventory policy

Inventory confirmation must preserve Baci's existing unlimited-stock behavior.
The product/variant effective policy is resolved once when inventory is
allocated and persisted in the immutable allocation row described below.
Payment confirmation uses that allocation evidence, not a later catalog toggle:

- an allocation resolved from `off` is `aggregate_decremented` when managed
  numeric stock was actually decremented, otherwise `unlimited_noop`. Neither
  needs a new decrement during payment, and unlimited never blocks payment;
- an allocation resolved from `serialized_then_unlimited` confirms or reclaims
  its snapshotted serialized quantity, records the snapshotted
  `untracked_quantity` as unlimited fallback, and never treats that fallback as
  a payment failure;
- an allocation resolved from `serialized_strict` is the only mode whose
  missing allocated units add a strict exception and roll back payment; and
- `inherit` is resolved to the product policy before the allocation row is
  written.

This applies per order item, not as a merchant-wide all-or-nothing guess. An
all-unlimited order therefore succeeds with no stock mutation. A mixed order
confirms only its tracked items, while unlimited items cannot cause rollback.
New storefront `manage_stock = false` or nullable-unmanaged products persist
`unlimited_noop`; payment code must not reinterpret a zero/null stock quantity
or later tracking toggle as a tracked allocation. Pre-cutover rows use only
their audited allocation decision. The new finalizers do not introduce a new
merchant inventory switch or convert unlimited products to strict tracking.

The expand-compatible gateway helper has one bounded legacy branch because
gateway payments remain live while the pre-cutover allocation audit runs. A
pre-cutover item with no decision may continue through the existing effective
policy logic and emits structured `legacy_inventory_confirmation_without_allocation`
evidence; a post-cutover missing allocation is an error. The audit still
classifies every pre-cutover item whose inventory has not already been durably
unwound, including an order that becomes paid during this interval. The final
late-payment gate removes this fallback and aborts unless every such item has
immutable allocation evidence or an exact open manual review. Internal-credit
activation occurs only after that branch is unreachable.

### Immutable inventory allocation evidence

Terminal inventory reversal must use what checkout actually allocated, not the
product's current `manage_stock` or `inventory_tracking_policy`. Both fields are
mutable, `order_items.product_id` and `variant_id` become null when catalog rows
are deleted, and the current order-item replacement RPCs delete and reinsert
lines. Reading current catalog state during cancellation can therefore
double-restock serialized items, convert a historical unlimited item into a
tracked item, or lose the evidence entirely.

The owner-expand allocation-evidence module creates the RLS-locked, append-only
`order_item_inventory_allocations` table. Each immutable row represents one
allocation epoch and stores:

- a caller-generated `allocation_id`, `order_id`, `merchant_id`, and the original
  `order_item_id_snapshot` without a cascading foreign key;
- non-FK `product_id_snapshot` and nullable `variant_id_snapshot`, plus a
  stable order-line fingerprint and item quantity;
- `allocation_mode`, exactly `aggregate_decremented`,
  `serialized_reserved`, `unlimited_noop`, or `external_untracked`;
- immutable `manage_stock_snapshot`, product policy, variant policy, and
  resolved effective-policy snapshots;
- `allocated_quantity` and `untracked_quantity`, whose sum equals the item
  quantity;
- source and allocation-version fields; and
- the database timestamp and creation-function identity.

The same allocation-evidence module adds nullable `inventory_allocation_id` columns to
`public.variant_inventory` and `private.variant_inventory_events`. Both columns
have exactly named `DEFERRABLE INITIALLY DEFERRED` foreign keys to
`order_item_inventory_allocations(allocation_id)`, allowing a creation function
to generate the allocation id, stamp each reserved unit and its event, then
insert the immutable allocation row after the actual reserved count is known
but before commit. Every serialized reservation, confirmation, release,
return, edit, and quiz-reservation path preserves that allocation id in its
append-only event even when the live unit becomes available and clears its
current reservation fields. No terminalizer may infer allocation membership
from a reusable `order_item_id` alone.

The modes mean:

- `aggregate_decremented`: checkout decremented the numeric product or variant
  stock by `allocated_quantity`; `allocated_quantity = quantity` and
  `untracked_quantity = 0`. Terminalization must restore that exact quantity
  even if the merchant later disables stock management;
- `serialized_reserved`: checkout bypassed aggregate decrement and linked
  `allocated_quantity` serialized units. For
  `serialized_then_unlimited`, `untracked_quantity` is the unlimited fallback
  and is never restocked;
- `unlimited_noop`: the item was unlimited at allocation time, including
  `manage_stock = false`; `allocated_quantity = 0` and
  `untracked_quantity = quantity`, and future stock mutation remains zero
  regardless of later catalog changes; and
- `external_untracked`: an imported, custom, or externally fulfilled line did
  not consume Baci inventory, so `allocated_quantity = 0` and
  `untracked_quantity = quantity`.

Every storefront-order and quiz-reservation function replaced by the expand
migration writes the allocation row in the same transaction as its stock
decrement or serialized reservation. It records the actual linked serialized
count after reservation, not the requested count. A strict serialized item
must have `allocated_quantity = quantity`; a then-unlimited item may split
between allocated and untracked quantities. A failed allocation rolls back the
order, item, inventory mutation, and allocation evidence together.

The same allocation-evidence module replaces `replace_order_items` and
`replace_imported_order_items` so allocation evidence cannot be deleted:

- imported/custom rows create `external_untracked` allocations;
- replacing an item with no active Baci allocation may replace its item row and
  create a new external/unlimited allocation epoch;
- replacing an item with an active aggregate or serialized allocation must
  atomically release the old allocation through the shared unwind primitive,
  insert the new item, allocate the new inventory, and append a new allocation
  row; any strict shortage rolls back the entire edit; and
- a pre-cutover inventory-live item with no classified allocation is rejected with
  `LEGACY_INVENTORY_ALLOCATION_UNCLASSIFIED` rather than being deleted.

When the same call also carries a terminal order patch, it completes the scoped
old-allocation releases and new item snapshots first, then invokes the
order-level terminalization wrapper over every newly active or unchanged
allocation before changing status. Thus no allocation created by the replacement
remains active on a terminal order. A failure in either scoped rebalance,
order-level unwind, or terminal guard rolls back items, allocations, inventory,
and status together.

The allocation-evidence module also persists
`order_inventory_allocation_migration_state.legacy_cutoff_at` and creates the
append-only `order_inventory_allocation_audit_decisions` table. Before contract
cutover, a service-role CLI classifies every pre-cutoff item whose inventory has
not already been durably unwound, including paid but unfulfilled orders, using
an evidence fingerprint over the order item, linked serialized units, order
source, import metadata, available creation audit, and catalog history. Current
`manage_stock`, current policy, current stock quantity, or a now-null product
link is never sufficient by itself. A decision either:

- appends one exact allocation row with a proven mode and quantities; or
- records `manual_reconciliation_open` backed by an open
  `legacy_inventory_allocation_ambiguous` review containing the exact current
  fingerprint.

The CLI writes only through
`classify_legacy_order_inventory_allocation(p_order_item_id uuid,
p_expected_evidence_fingerprint text, p_disposition text,
p_allocation_mode text, p_allocated_quantity integer,
p_untracked_quantity integer, p_review_id uuid, p_reason text, p_actor text)`.
The service-role RPC may read the item id without a lock only to derive its
order. It then acquires the payment advisory lock, locks and revalidates the
order before the order item, and locks serialized evidence and surviving
catalog rows in the same sorted order as terminalization. It recomputes the
fingerprint, validates quantities and mode, and atomically appends the audit
decision plus allocation row for
`proven_allocation`. A proven serialized classification also stamps every
currently linked unit and a classification event with the new allocation id in
that same transaction; a unit-count or linkage mismatch fails the
classification. `manual_reconciliation_open` requires null mode/quantities and
the exact matching open review. Replays are idempotent; a contradictory
decision for the same fingerprint fails.

The contract and activation gates reject an unclassified inventory-live legacy
item, a stale fingerprint, or a manual disposition without its matching open
review.
A manual disposition remains payment-confirmation- and
terminalization-blocking for that item until an operator records a proven
replacement decision; activation does not turn ambiguity into stock mutation
permission.

### Policy-aware terminal inventory unwind

Cancellation and other terminal transitions must not combine the current
`private.restock_order_items` aggregate increment with
`private.release_order_inventory_units`. The former increments every current
`manage_stock = true` item, including an item whose serialized policy bypassed
the original aggregate decrement, while the latter handles only serialized
unit reservations. Calling both can double-restock serialized products; calling
only the serialized helper can strand aggregate managed stock.

The allocation-evidence module adds one private selected-allocation primitive,
`unwind_order_inventory_allocations(p_merchant_id uuid, p_order_id uuid,
p_allocation_ids uuid[], p_reason text, p_actor text)`, and one private
order-level wrapper,
`unwind_order_inventory_for_terminalization(p_merchant_id uuid,
p_order_id uuid, p_reason text, p_actor text)`. The wrapper locks and enumerates
every still-active allocation for the order, then calls the primitive with that
exact set. The same allocation-evidence module creates the RLS-locked, append-only
`order_inventory_unwind_events` table. Each event references one
`allocation_id`, and a unique key on that allocation id makes release
idempotent even when the original order-item or catalog row was later replaced
or deleted. It stores the immutable allocation snapshot, action, released or
restored count, actor, reason, and database timestamp. Replaying any
terminalization returns the stored events and does not mutate stock again. No
client receives direct table or helper access.

Both helpers require the caller to follow the global order: control and
financial advisory locks when applicable, then the order row, then allocation
rows sorted by `allocation_id`, serialized-unit rows sorted by id, and surviving
catalog rows sorted by stable identity. The order-level wrapper locks the order
before it enumerates or locks allocations; the selected primitive verifies the
same order/merchant relationship and never acquires an order lock after an
allocation lock. Replacement RPCs already hold the order lock before passing
their sorted selected ids. Under those locks, the helper applies exactly one
action per allocation:

- `serialized_reserved`: release only active units whose
  `inventory_allocation_id` equals that allocation and synchronize derived
  stock; the unlimited fallback quantity remains a no-op and no aggregate
  increment is permitted;
- `aggregate_decremented`: restore exactly `allocated_quantity` to the
  snapshotted variant or product stock row, regardless of current
  `manage_stock` or policy;
- `unlimited_noop`: record `unlimited_noop` and change no stock row;
- `external_untracked`: record `external_untracked_noop` and change no stock
  row; and
- if the snapshotted aggregate catalog target was deleted, record
  `catalog_deleted_noop` because there is no saleable stock row to restore. A
  contradictory surviving target, serialized linkage mismatch, quantity
  mismatch, or unclassified/manual legacy allocation is a durable
  `terminal_inventory_allocation_conflict`, not permission to consult current
  policy and guess.

The helper returns `inventory_unwind_event_count`,
`released_serialized_unit_count`, `restocked_aggregate_unit_count`,
`unlimited_noop_item_count`, `external_untracked_item_count`,
`catalog_deleted_noop_item_count`, and the immutable event ids.
Strict-inventory compensation and every cancellation or terminalization
function added by the later terminal-compensation module calls the already-installed
order-level wrapper. The expand versions of `replace_order_items` and
`replace_imported_order_items` pass only the replaced line's old allocation ids
to the selected-allocation primitive before creating the new epoch; they must
not unwind an unchanged sibling line. No live Bumpa or Jumia import caller can
observe a replacement function that references a primitive, wrapper, or event
table which has not been deployed.
The old
`private.restock_order_items` helper is dropped after all call sites have been
replaced, so unlimited merchants and mixed orders cannot accidentally re-enter
the legacy blanket-restock path.

### Internal-credit finalization and side effects

Changing the two existing boolean RPC return types and their financial evidence
inputs requires explicit `DROP FUNCTION` plus recreation. Drop:

- `finalize_wallet_order_payment(uuid, numeric)`; and
- `finalize_store_credit_order_payment(uuid, numeric, text)`.

Replace them with:

- `finalize_wallet_order_payment(p_checkout_intent_id uuid,
  p_order_id uuid, p_wallet_redemption_transaction_id uuid)`; and
- `finalize_store_credit_order_payment(p_checkout_intent_id uuid,
  p_order_id uuid, p_savings_redemption_id uuid,
  p_wallet_redemption_transaction_id uuid DEFAULT NULL)`.

The new table-returning versions preserve their current authenticated
customer/service-role authorization and return:

- `outcome` (`completed`, `completed_replay`,
  `payment_held_for_provider_cancellation`,
  `inventory_unavailable_reversed`, or
  `inventory_reversal_conflict_filed`);
- `order_id`, `merchant_id`, and `transaction_id`;
- transaction amount, currency, gateway, gateway reference, and payment
  method;
- `merchant_push_contract = claimed_v1` and the exact atomically seeded
  `merchant_push_steps` plus complete `paid_order_side_effect_steps`;
- the locked `merchant_new_order_push_owner`; and
- `inventory_contract = atomic_confirmed_v1` with reclaimed and missing-unit
  counts, plus `order_terminalized` and `cancellation_reason` for a reversed
  strict-inventory outcome.

`transaction_id`, payment fields, and side-effect arrays are non-null only for
the two completed outcomes. `payment_held_for_provider_cancellation` returns
the current attempt and review ids, leaves the bound intent and redemption
evidence open for provider resolution, and creates no transaction, order-paid
mutation, inventory confirmation, or side-effect row. A provider rejection
allows exact same-key finalizer replay; committed local cancellation owns
compensation/intent abort. `inventory_unavailable_reversed` is an explicit
non-payment outcome: it returns no payment transaction, no side-effect steps,
`inventory_contract = strict_unavailable_reversed`,
`order_terminalized = true`, `cancellation_reason =
serialized_inventory_unavailable_after_internal_credit_redemption`, and the
strict item diagnostics needed by the route.
`inventory_reversal_conflict_filed` is also a non-payment outcome; it returns
the durable review id, `order_terminalized = false`,
`inventory_contract = strict_unavailable_reversal_conflict`, and no claimable
steps.

Neither RPC accepts a caller-supplied amount or payment method. Under the
control-singleton and checkout-intent locks described above, then the wallet
redemption lock used by `redeem_wallet_for_order` and
`reverse_wallet_redemption` when wallet evidence is present
(`('x' || substr(md5(p_order_id::text), 1, 16))::bit(64)::bigint`), the savings
order lock used by `redeem_savings_for_order` when savings evidence is present
(`hashtextextended('customer_savings_redemption:' || p_order_id::text, 0)`), the
sorted order-DVA account advisory locks derived read-only and revalidated under
the eventual order lock, the
payment lock
(`hashtextextended('baci_order_payment:' || p_order_id::text, 0)`), and an order
row lock, each must:

1. validate all identifiers, acquire those advisory locks in that exact order,
   lock the order, authorize the authenticated merchant-scoped customer or
   `service_role`, and prove the locked checkout intent is bound to that exact
   order, customer, merchant, request hash, and checkout generation;
2. lock and validate every supplied evidence row:
   - wallet evidence must be the exact
     `customer_wallet_transactions.id`, have `source_type = order_redemption`,
     `source_id = order.id`, `type = redemption`, `status = completed`, and
     matching customer and merchant;
   - savings evidence must be the exact
     `customer_savings_redemptions.id` with matching order, customer, merchant,
     and goal ownership; and
   - before fresh validation, detect a prior exact strict-inventory
     compensation. A wallet `order_reversal` and/or savings row marked reversed
     for these same evidence ids returns
     `inventory_unavailable_reversed` idempotently only when the complete
     expected evidence set agrees. A partial, foreign, differently reasoned, or
     mismatched reversal is `INTERNAL_CREDIT_LEDGER_CONFLICT`;
3. derive the deterministic gateway, reference, and component fingerprint from
   the locked evidence, preserving the existing references
   `WALLET-<ORDER_PREFIX>`, `SAVINGS-<ORDER_PREFIX>`, and
   `STORE_CREDIT-<ORDER_PREFIX>`, where `ORDER_PREFIX` is
   `upper(substr(p_order_id::text, 1, 8))`, then lock and look up that exact
   order/merchant/gateway/reference transaction before any fresh
   outstanding-balance calculation;
4. when the deterministic transaction already exists, validate its exact order,
   merchant, completed status, amount, currency, gateway, reference, evidence
   ids, and component amounts. If they match, the order has
   `payment_status = paid` and `amount_paid >= total`, and every
   finalizer-seeded side-effect row is owned by that transaction, return
   `completed_replay` immediately. A mismatched transaction, a transaction owned
   by different evidence, or a transaction whose order or side-effect ownership
   is no longer in the expected fully-paid state returns
   `INTERNAL_CREDIT_LEDGER_CONFLICT`; replay must never fall through to fresh
   outstanding validation;
5. only when no deterministic transaction exists, reject an order that is
   cancelled, refunded, BNPL-owned, already paid, already paid by another
   transaction, or otherwise not eligible for a fresh internal-credit
   completion;
6. check active provider-cancellation evidence under the locked order. Any
   unresolved hold returns `payment_held_for_provider_cancellation` only after
   the private primitive commits the exact attempt-scoped review/alert; it
   leaves the intent and redemption evidence unchanged and does not enter the
   payment exception block. `provider_rejected` permits continuation, while a
   locally terminal order was already rejected by step 5;
7. calculate the fresh baseline paid-to-date as the greater of
   `orders.amount_paid` and completed payment transactions that exist before the
   candidate internal-credit transaction. Do not add `orders.wallet_amount_used`
   and do not add either supplied redemption amount to that baseline: those
   exact rows are the candidate evidence being validated. Resolve
   `outstanding_before_candidate = orders.total - baseline_paid_to_date`,
   clamped at zero;
8. require the sum of the locked redemption amounts to equal that exact
   `outstanding_before_candidate`; partial, excess, foreign, missing, reversed,
   or duplicate evidence not already recognized as the exact compensation
   replay fails closed without changing the order or creating a payment
   transaction;
9. derive gateway and payment method from the evidence: wallet-only is
   `wallet`, savings-only is `savings`, and savings plus wallet is
   `store_credit`;
10. enter a PL/pgSQL exception block, insert the deterministic completed
   transaction with the derived amount, currency, gateway, reference, and
   metadata containing the exact wallet and savings evidence ids and component
   amounts, set `orders.amount_paid = orders.total` and
   `payment_status = paid`, and seed the owner-selected push rows plus paid email
   and ad-tracking retry rows. If any selected `(order_id, step)` row is owned by
   another transaction, raise `INTERNAL_CREDIT_LEDGER_CONFLICT` so the candidate
   transaction, order update, and new side-effect rows roll back;
11. inside that same exception block, call
    `private.confirm_order_inventory_reservations` under the order lock, apply
    the effective per-item policy above, and inspect the result.
    `off` and `serialized_then_unlimited` shortages remain successful. Any
    `serialized_strict` exception raises `serialized_inventory_unavailable`,
    rolling the exception block back to its savepoint so the candidate payment
    transaction, order update, inventory changes, fulfillment snapshots, and
    side-effect rows disappear together;
12. catch only that stable strict-inventory error in the outer finalizer
    transaction and compensate the already-committed redemption evidence while
    all wallet, savings, payment, and order locks remain held:
    - wallet evidence uses a private refactoring of the existing deterministic
      `reverse_wallet_redemption` logic and creates or reuses exactly one
      `order_reversal` adjustment for the order;
    - savings evidence uses a new private
      `reverse_savings_redemption_for_inventory_failure` helper that restores
      the exact pre-redemption goal snapshot, marks the redemption reversed, and
      writes one compensating savings event; and
    - mixed store credit performs both compensations atomically; and
    - after every required compensation succeeds, call
      `unwind_order_inventory_for_terminalization` so serialized reservations,
      aggregate managed stock, and unlimited no-op items follow the exact shared
      policy, then transition the order to the terminal cancelled state in the
      same transaction with `cancelled_by = 'system'` and
      `cancellation_reason =
      serialized_inventory_unavailable_after_internal_credit_redemption`.
      This state is not payable, cannot render or rematch an invoice, and proves
      that a fresh checkout order is required.
      If either compensation, reservation release, or terminal transition
      fails, none commits. The finalizer then atomically files or reuses one
      `internal_credit_inventory_reversal_conflict`
      reconciliation review and its operations alert and returns
      `inventory_reversal_conflict_filed`. If review or alert persistence fails,
      the RPC raises `INTERNAL_CREDIT_INVENTORY_REVERSAL_CONFLICT`;
13. return `inventory_unavailable_reversed` after successful compensation. An
    identical replay detects the same wallet reversal and/or reversed savings
    row plus the exact system terminal reason and returns the same outcome
    without consuming or restoring funds, releasing reservations, or
    cancelling again, and the same transaction marks the checkout intent
    `aborted` with the terminal order id; and
14. otherwise return `completed` with the concrete transaction, exact seeded
    steps, and committed inventory result, and mark the checkout intent
    `completed` with phase `fully_paid` in that same transaction.

The internal-credit finalizer module adds nullable `reversed_at`, `reversal_reason`, and
`reversal_event_id` fields to `customer_savings_redemptions`;
`reversal_event_id` is an indexed foreign key to `customer_savings_events`.
It also replaces `orders_cancelled_by_check` so the allowed values are
`merchant`, `customer`, or `system`; only the strict-inventory compensation path
uses `system` in this design.
New savings redemptions also persist the locked pre-redemption goal amount,
status, `spent_at`, and `applied_order_id` in their request snapshot. The
reversal helper restores that exact snapshot only when the current goal still
matches the expected post-redemption state; later goal activity is a durable
conflict, never an inferred balance rewrite. RLS and grants remain unchanged for
the table, and only the service-role finalizer may execute the private reversal
helper.

Add `internal_credit_inventory_reversal_conflict` to the checked
`reconciliation_review.issue_type` set. It is order-scoped and deduplicates
through the existing open `(issue_type, order_id)` index. Its metadata contains
the wallet and savings evidence ids, expected and observed goal snapshots,
wallet reversal evidence, strict inventory diagnostics, actor, and original
compensation error. The finalizer creates the review and operations-email alert
in the same outer transaction that returns
`inventory_reversal_conflict_filed`; no partial compensation is committed.

Add `internal_credit_cancellation_reversal_conflict` to the same checked issue
type set and order-scoped deduplication contract.
The owner-expand alert/terminal modules already add
`terminal_inventory_allocation_conflict`,
`legacy_inventory_allocation_ambiguous`, and
`abandoned_order_terminalization_failed` to the same checked issue-type
contract with exact order/item/fingerprint deduplication as applicable. The
late-payment review-contract module adds
`internal_credit_checkout_intent_reconciliation_conflict` and
`gateway_initialization_persistence_conflict`, plus
`merchant_settlement_reference_conflict`, before installing the reconciler,
proof-gated ordinary initialization path, and transaction-aware settlement
wrapper that can emit them. The gateway-initialization issue is
excluded from broad order-only deduplication and uses an open unique key over
issue type, normalized gateway/provider reference, and current evidence
fingerprint, so two different provider sessions for one order cannot overwrite
each other's evidence. The settlement issue uses transaction id plus its exact
BAC/provider-reference fingerprint and cannot absorb a legitimate additional
capture.
Add `historical_cancelled_internal_credit_evidence` as a separate order-scoped
issue type used only by the pre-activation evidence audit. It never represents
a successful automatic repair and cannot be resolved while it is the active
disposition for the current evidence fingerprint.
Add `order_payment_account_contract_unlinked` as an epoch-scoped issue type for
the post-contract assignment audit. It stores projection and epoch ids, cutoff,
touch timestamp, reciprocal-link/projection diagnostics, and current evidence
fingerprint. Exclude it from the broad open order index and add an open unique
expression key over issue type, non-empty
`metadata.order_payment_account_epoch_id`, and the exact evidence fingerprint,
so two unlinked epochs on one order cannot collapse. It atomically enqueues one
operations alert. Changed evidence creates the new exact-fingerprint review;
the enforcement preflight passes only after each epoch is repaired and its
current review is resolved by the applicable repair RPC.

The owner-expand `order_dva_wallet_assignment_conflict` is the receiver-purpose
issue type available before the backstop or assignment RPC can emit it. It is
excluded from broad order-only
deduplication and has an open unique expression key over issue type, non-empty
order id, non-empty wallet-account id, and the lowercase database-computed
purpose-conflict fingerprint. The assignment RPC and contract audit derive the
same fingerprint from provider, canonical receiver identity, order/wallet owner
ids, provider-customer evidence classes, and current statuses. A changed
identity/status is a new review; an exact retry reuses the existing review and
alert. Closing a review cannot make the same unresolved receiver exposable: the
render, assignment, and matcher checks recompute current database truth.

Add `order_dva_historical_identity_unresolved` as a fingerprint-scoped issue
type for pre-cutoff epochs whose immutable provider-customer identity or first
terminal residual cannot be proved. Its metadata records epoch/order ids,
receiving identity, assignment/time/currency evidence, which proof classes are
missing, terminal state, and the exact candidate transfer when matcher-created.
Exclude it from the broad order index and deduplicate open rows by issue type,
epoch id, and lowercase 64-character evidence fingerprint. Only an audited
identity or terminal-snapshot repair with that same locked fingerprint may
resolve it; an operator cannot mark the row safe by closing the review alone.

### Cancellation after internal-credit redemption

A cancelled invoice is terminal for a reason and can never be a payment
candidate. Cancellation must therefore reconcile committed internal-credit
evidence before it changes the order state; it cannot strand wallet or savings
value on an order that payment code will correctly refuse to finalize.

The owner-expand bundle first installs allocation-safe provisional versions
of this exact terminalization allowlist. They use immutable allocation unwind,
return the final structured result shapes, and reject active unreversed wallet
or savings evidence with `INTERNAL_CREDIT_CANCELLATION_REQUIRES_CONTRACT` while
internal-credit checkout remains fenced. The terminal-compensation module then adds
the private cancellation-compensation helper and replaces the same signatures
with compensation-aware bodies; it does not introduce a migration-first result
shape change that the already-live preparation application cannot parse:

- `public.cancel_order_as_customer(uuid, text)`;
- `private.cancel_order_and_release_inventory(uuid, uuid, text, text, jsonb)`
  and its public wrapper;
- the already-prepared private/public
  `prepare_provider_shipment_cancellation(uuid, uuid)` and
  `record_provider_shipment_cancellation_result(uuid, uuid, text, numeric,
  jsonb)` saga functions;
- the cancellation-attempt-token replacement
  `private.cancel_provider_shipment_order_and_release_inventory(uuid, uuid,
  uuid, numeric, timestamp with time zone)` and its public wrapper;
- `private.apply_provider_shipment_webhook_status(uuid, text, text, text,
  jsonb, timestamp with time zone)` and its public wrapper;
- `private.mark_order_payment_failed_and_release_inventory(uuid, uuid, text,
  text, jsonb)` and its public wrapper; and
- the new private/public
  `terminalize_order_and_release_inventory(uuid, uuid, text, text, text,
  jsonb)` merchant-status wrapper; and
- `public.replace_order_items(uuid, jsonb, uuid, boolean, jsonb)` and
  `public.replace_imported_order_items(uuid, jsonb, uuid, jsonb, timestamp with
  time zone)`; and
- their service-only notification-suppressing wrappers,
  `public.replace_order_items_suppressing_order_notifications(uuid, jsonb,
  uuid, jsonb)` and
  `public.replace_imported_order_items_suppressing_order_notifications(uuid,
  jsonb, uuid, jsonb, timestamp with time zone)`; and
- `public.terminalize_claimed_abandoned_order(uuid, uuid, integer)`.

The old
`public.claim_paystack_paid_atomic(uuid, text, jsonb, uuid, uuid, uuid[], text)`
is not added to the terminalization registry. The reconciliation CLI is the
only current caller, and this design already moves that CLI to reservation,
external-reference claim, and the shared finalizer. The final contract gate
therefore revokes and drops `claim_paystack_paid_atomic` after the replacement
CLI is deployed and tested. Leaving its duplicate-order cancellation array
callable would be an unregistered terminalization bypass.

The final owner-expand gate registers every provisional private and public signature plus
`public.prevent_cancelled_order_reopen()` in
`internal_credit_checkout_function_contracts` with purpose
`terminalization`, then records `allocation_safe_v1` in the separate
terminalization-contract singleton only after every body, grant, trigger, and
authorization gate is installed. The late-payment modules replace those
bodies and stage their digests; the final contract gate records
`compensation_v1`. Activation
requires `compensation_v1` and fails if a listed signature is missing, its live
definition digest differs, or its grants differ from the expected contract.
There is no implementation-time wildcard. If repository inspection discovers
another current function that can enter the terminal transition set, this
allowlist and the specification must be amended before implementation.

### Application terminalization caller migration

The database-function allowlist is not sufficient while application code can
write terminal statuses directly. The preparation application already ships
the version-aware dispatcher described above; after the owner-expand gate
advertises `allocation_safe_v1`, it replaces every current direct writer:

- `apps/web/src/ai/chat-order-cancellation.ts` keeps its Ogabassey-scoped order
  and email checks, but calls the structured merchant cancellation RPC through
  its scoped client instead of updating `orders`;
- `apps/web/src/lib/agentic/checkout-order-dispatch.ts` uses the same structured
  merchant cancellation RPC for compensation and returns its exact
  cancelled/replay/conflict outcome;
- `apps/web/src/app/api/orders/[id]/route.ts` keeps direct updates only for
  non-terminal fields and statuses. Any request entering the terminal
  transition set dispatches to the authorized cancellation, payment-failure, or
  new generic terminalization RPC and validates its structured result;
- `apps/web/src/app/api/shipping/webhooks/[provider]/route.ts` calls
  `apply_provider_shipment_webhook_status` for every normalized status instead
  of separately updating the shipment and order; and
- `apps/web/src/app/api/shipping/track/[trackingNumber]/route.ts` may persist the
  authenticated customer's carrier snapshot and non-terminal progress, but it
  must not write an order into `cancelled`, `canceled`, `failed`, or `returned`.
  A terminal carrier result is logged/returned for display and converges only
  through the service-owned webhook or provider-status reconciliation path; no
  customer-callable fallback RPC may manufacture terminal proof; and
- `apps/web/src/app/api/shipping/cancel/[shipmentId]/route.ts` uses the
  provider-cancellation saga below instead of two independent local updates.

The expand release cannot leave either application writers or already-replaced
import/edit RPCs as terminal-write bypasses while the full compensation helper
remains in the later contract release. The owner-expand bundle therefore installs the
provisional functions above, including allocation-safe replacement bodies for
the already-prepared provider-cancellation saga, the generic merchant
terminalizer, structured customer result, and bounded abandonment
result. Every provisional function acquires the control and financial locks
before the order lock, rejects active unreversed internal-credit evidence,
invokes the already-installed allocation unwind, and applies the terminal state
atomically. Replacement/import RPCs do the same for a terminal patch. The
expand-compatible callers surface the stable retryable credit-contract failure
and retain external work for retry instead of silently terminalizing without
compensation. The terminal-compensation contract module replaces these provisional branches with the
common compensation helper rather than deleting or changing their public
result contract.

The allocation-safe terminalizer module creates an RLS-locked private
`order_terminalization_authorizations` table and a private one-shot apply
helper. An authorization binds the current database transaction, order,
merchant, exact old/new terminal-transition fingerprint, registered function
identity, and a nonce. Only the registered terminalizers can create one through
the ungranted private helper after compensation or provisional no-credit proof
and inventory unwind have succeeded. The `orders` trigger atomically consumes
that exact authorization before allowing a terminal transition; a missing,
stale, cross-order, or mismatched token raises
`ORDER_TERMINALIZATION_RPC_REQUIRED`. The row is consumed in the same
transaction, and any failed update rolls back both token and financial work.
No custom GUC or caller-set session variable is accepted as authorization.

This trigger never acquires the control row or locks wallet, savings, payment,
allocation, unit, or catalog evidence after PostgreSQL has locked the order
row. It checks only the transaction-local private authorization and the existing
cancelled-order reopen rule. Consequently a direct terminal update is rejected
regardless of whether internal credit exists, and the backstop cannot invert
the global control/financial-before-order lock order. The final owner-expand gate changes the
terminalization-contract version to `allocation_safe_v1` only after the
provisional functions and trigger are active. A legacy request crossing that
commit can fail with the stable gate error but cannot commit an un-unwound
terminal order; the preparation dispatcher retries through the advertised RPC.

The contract bundle and tests run a repository-wide static inventory of
application writes and latest database function definitions. Any live
`.from('orders').update(...)`, dynamic update object, or SQL `UPDATE
public.orders` that can newly set `shipping_status` to `cancelled`, `canceled`,
`failed`, or `returned`; `payment_status` to `cancelled`, `failed`, `refunded`,
`abandoned`, or `expired`; or `cancelled_at` non-null must be one of:

- a registered terminalization function;
- a test fixture; or
- an explicitly dropped, unreachable legacy definition.

The gate fails on an unclassified writer. This scan is checked in as a contract
test so a later route cannot silently reintroduce direct terminalization.

Provider cancellation is a prepare/provider/finalize saga because the external
provider call cannot share a database transaction:

1. The protected route authenticates first, validates the path with the
   colocated Zod schema, checks merchant scope and CSRF, then calls
   `prepare_provider_shipment_cancellation`. The RPC locks shipment, then the
   control/bound-intent, wallet, savings, sorted DVA-account, payment, and order
   sequence used by shipment terminalization. It rejects an already paid or
   terminal order, validates merchant access and
   provider cancellability, and creates or reuses one RLS-locked attempt for
   the shipment. The row contains an opaque token, shipment/order/merchant,
   provider shipment id and tracking number, an immutable request fingerprint,
   provider-response evidence, timestamps, attempts/backoff, and an exact state
   from `external_call_claimed`, `provider_cancelled`, `provider_rejected`,
   `provider_outcome_unknown`, `locally_finalized`, or `manual_review`.
   Result recording and local finalization use the same
   shipment-then-financial/order lock order before changing the attempt. Payment functions already hold the
   order lock and read attempt state without taking a later attempt-row lock;
   because every attempt-state transition first locks that order, the snapshot
   is stable and cannot invert the lock order. In the compensation-aware
   replacement, prepare also inspects the bound gateway initialization while
   those locks are held: it changes a linked `ready` row to
   `reconciliation_required` with the attempt token/current review before
   returning `call_provider`, leaves `pending` blocked by the claim-time hold,
   and leaves `claimed` for the finish-time hold. This branch is absent from the
   expand provisional body because the gateway-initialization table does not
   exist then and internal credit is still paused.
2. Creation atomically claims the one permitted external cancellation call and
   returns a typed disposition: `call_provider`, `in_progress`,
   `recover_provider_status`, `finalize_local`, `rejected`, or
   `completed_replay`. Concurrent or HTTP retries reuse the attempt; only the
   transaction that inserted/claimed it can receive `call_provider`. Current
   Topship cancellation has no idempotency key, so a stale claim or ambiguous
   network result is recovered only by tracking/status lookup and can never
   issue a second cancellation. A future provider may opt into a same-key
   replay only after a checked capability test proves provider-side
   idempotency; provider name alone is not evidence.
3. The route records `provider_cancelled`, `provider_rejected`, or
   `provider_outcome_unknown` against the token through
   `record_provider_shipment_cancellation_result`; a boolean cannot collapse a
   timeout into a known rejection. Only `provider_cancelled` calls the
   cancellation-attempt-aware replacement of
   `cancel_provider_shipment_order_and_release_inventory`. That finalizer locks
   shipment first. Under `allocation_safe_v1` it proves there is no active
   unreversed internal credit; under `compensation_v1` it reconciles that
   credit. It then unwinds immutable inventory allocations and changes
   shipment/order state atomically.
   A locked known rejection resolves the attempt-scoped
   `payment_during_provider_cancellation` and
   `provider_cancellation_outcome_unknown` reviews as provider-rejected before
   releasing the hold. Successful local cancellation resolves them as
   terminalized. Resolution requires the same current fingerprint and appends
   the attempt event; it never closes an unrelated or stale review.
4. An active attempt in `external_call_claimed`, `provider_cancelled`,
   `provider_outcome_unknown`, or unresolved `manual_review` is a payment
   hold. `complete_order_gateway_payment`,
   `reserve_paystack_dva_order_payment`, and both fresh internal-credit
   finalizers check it after locking the order and
   before transaction reservation, paid-state mutation, inventory confirmation,
   or side-effect seeding. They return a typed cancellation-pending conflict and
   create/reuse one durable review/operations alert; they do not auto-confirm
   the invoice. A locked `provider_rejected` attempt releases the hold and
   permits normal payment replay. A committed local cancellation is terminal
   and remains ineligible under the ordinary matcher rules. Because prepare
   also locks the order, either payment commits before the attempt and prepare
   rejects cancellation, or the attempt commits first and payment is held. A
   linked internal-credit initialization already in `ready` cannot remain
   replayable across the latter outcome: prepare or a racing replay atomically
   moves it to `reconciliation_required` before any URL can be returned again.
5. If the provider is known cancelled but local finalization fails, the route
   preserves the existing
   `provider_cancelled_local_finalization_failed` reconciliation marker with the
   attempt token, provider response, review id, and error. The existing pending
   finalization lookup returns that token, and a recovery worker retries only
   local finalization. It does not call the provider again.
6. The already-hourly `reconcile-gateway-paid-orders` cron receives a third,
   independently bounded pass that claims stale cancellation attempts through a
   service-role `SKIP LOCKED` RPC and commits the short claim before any
   provider or order work. It locally finalizes `provider_cancelled`, queries tracking
   status for stale `external_call_claimed`/`provider_outcome_unknown`, and
   records a confirmed cancelled result when proven. Any non-definitive status
   creates/reuses `provider_cancellation_outcome_unknown`, enters bounded
   backoff, and ultimately moves to `manual_review`; it never calls the
   cancellation endpoint. The preparation worker no-ops while the
   terminalization version is `legacy_direct_v0`, then activates automatically
   at `allocation_safe_v1`.
   The provider-cancellation allocation module also adds the service-role-only
   `resolve_provider_shipment_cancellation_review(uuid, uuid, text, text,
   text)` decision RPC. It accepts only `provider_rejected` or
   `provider_cancelled`, locks shipment, financial/account/order evidence, then
   the attempt in the canonical order,
   recomputes and validates the open review fingerprint, records the bounded
   operator reason/identity and immutable resolution evidence, and updates the
   attempt atomically. The checked-in CLI is the only operational caller. A
   cancelled decision leaves local finalization to the same idempotent worker;
   a rejected decision releases the payment hold for ordinary replay.
7. A crash after prepare is therefore recoverable from the attempt row by
   provider-status query. A crash after provider success is recoverable from the
   persisted result or later status. No success response is returned until
   local finalization commits, and no unresolved attempt is silently abandoned.

The terminal transition set is exact:

- `shipping_status` newly enters `cancelled`, `canceled`, `failed`, or
  `returned`;
- `payment_status` newly enters `cancelled`, `failed`, `refunded`, `abandoned`,
  or `expired`; or
- `cancelled_at` changes from null to non-null.

`returned` and `refunded` are terminal/non-payable for matching, but they do
not automatically mean that pre-payment credit should be compensated. When a
valid completed deterministic payment exists, the backstop does not request
pre-finalization compensation; the verified return/refund workflow owns its
refund ledger and inventory semantics. Generic merchant PATCH rejects a request
to manufacture `refunded` without that workflow. Imported-order wrappers may
record an external `returned`/`refunded` state only through the registered
terminalizer after revalidating source ownership and payment evidence. Without
a completed deterministic payment, every state in this set follows the same
compensate-before-terminal rule.

Order-only paths use the same lock order as finalization: control singleton,
any checkout intent bound to the order, wallet-redemption advisory lock,
savings-redemption advisory lock, every currently linked order-DVA account
epoch advisory lock deduplicated and sorted by provider/account identity,
payment advisory lock, order
row, exact wallet, savings, goal, and transaction evidence rows, sorted
`order_payment_accounts` projection rows, sorted
`order_payment_account_epochs` rows, sorted capture-link rows, any existing
`order_dva_terminal_snapshots` row, then immutable inventory allocations and
stock rows. The account identities may be discovered read-only before locking, but
must be reloaded after the order lock; every assignment, expiry, reservation,
and enforcement writer uses the same account advisory key, so the later account
row locks cannot race a registered epoch append/supersession. A bound open intent is
changed to `reconciling` before compensation and to `aborted` only when the
terminal transition commits.
Shipment paths use one explicit extension of that order: lock the shipment row
first to derive the order id, then acquire the same control, intent, advisory,
order/evidence, and inventory sequence. They never acquire a shipment lock
after an order lock. Both provider functions listed above are replaced to use
shipment-first ordering and to revalidate the locked shipment-to-order and
merchant linkage before any mutation. This preserves the existing provider
ordering and removes the proposed order-then-shipment inversion that could
deadlock with the webhook path.

While locked, the helper detects active wallet and savings redemptions for the
order that have no valid completed deterministic payment transaction. It
atomically:

1. reverses the exact wallet redemption through the shared private wallet
   reversal helper when present;
2. restores the exact savings pre-redemption snapshot and marks that redemption
   reversed when present;
3. performs both reversals all-or-nothing for mixed credit;
4. records `reversal_reason =
   order_cancelled_before_internal_credit_finalization`; and
5. while all ledger and DVA evidence remains locked, computes paid-to-date and
   outstanding with the authoritative matching formula and, when any DVA epoch
   exists, inserts the order's first immutable terminal snapshot. A replay
   validates the existing row's statuses, amounts, currency, reason, source,
   actor, and database-computed ledger fingerprint exactly; a mismatch aborts
   instead of rewriting it;
6. while the canonical account advisories are still held, expires every live
   `order_payment_accounts` current projection without rewriting its historical
   epochs, and cancels each open
   `order_wallet_funding_intents` row for the order. It also changes every
   bound nonterminal `gateway_initialization_intents` row to `aborted` with the
   terminal reason while preserving provider reference/response evidence and
   withholding any checkout URL; and
7. only after successful reversal, terminal-snapshot capture, and
   payment-instrument closure, calls
   `unwind_order_inventory_for_terminalization` and permits the caller's
   terminal order or shipment update.

If the evidence is partial, foreign, already compensated for a different
reason, or no longer matches the expected goal or wallet state, the cancellation
does not commit. Instead the same transaction creates or reuses an
`internal_credit_cancellation_reversal_conflict` review and operations alert,
then returns or raises a stable conflict for the caller. Review or alert
persistence failure fails the entire cancellation.

The owner-expand gate's replacement cancellation/reopen trigger remains the
permanent database backstop. It preserves the existing cancelled-order reopen
clamp and requires the one-shot private authorization for every new terminal
transition, not only orders that currently expose internal-credit evidence.
The terminal-compensation module upgrades official terminalizers to complete
compensation before they mint that authorization. Direct updates fail with
`ORDER_TERMINALIZATION_RPC_REQUIRED`; a registered provisional terminalizer
that finds active credit fails earlier with
`INTERNAL_CREDIT_CANCELLATION_REQUIRES_CONTRACT`, and a compensation-aware
terminalizer with contradictory evidence returns the durable reversal-conflict
outcome. The trigger itself performs no financial evidence reads or locks.

The replacement of `public.cancel_order_as_customer(uuid, text)` is an
extension of the production repair installed by
`20260714225503_reconcile_customer_order_cancellation_reason.sql` at frozen
SHA-256
`6c5f9ca9ed75b63e241f25e1dddfab9b2d7da1bab7cb91694b92a1d9548d7a71`,
not a new
interpretation of customer cancellation. Before either the owner-expand or
contract replacement, its migration gate must compare the live canonical
definition and runtime grants with the expected predecessor: the July 14
repair before owner-expand, then the registered owner-expand definition before
contract. Both replacements must preserve all of these observable rules while
adding structured outcomes, compensation, snapshots, and policy-aware
inventory unwind:

- `p_reason` defaults to null; a blank value trims to null, a nonblank value is
  stored trimmed, and more than 500 characters raises `reason_too_long` with
  SQLSTATE `22001`;
- the function scopes and locks the order through `auth.uid()`; a missing or
  foreign order raises `order_not_found` with SQLSTATE `P0002`, so ownership is
  not leaked;
- `private.order_customer_cancellable` remains the policy source and a
  disallowed transition raises its existing SQLSTATE `P0001` contract;
- an already-cancelled order is an idempotent `cancelled_replay`: it sends no
  second email and performs no second compensation, inventory unwind, payment
  instrument closure, or terminal-state rewrite;
- a fresh cancellation still writes the trimmed `cancellation_reason`,
  `cancelled_by = 'customer'`, database `cancelled_at`, and `updated_at` in the
  same transaction;
- every live order payment account is expired and every open wallet-funding
  intent is cancelled exactly once; the new shared compensation and allocation
  unwind replace the old `restock_order_items` call without weakening its
  successful all-or-nothing inventory effect; and
- only `authenticated` receives runtime execute on the public signature;
  `anon`, `public`, and `service_role` receive no direct execute grant, every
  delegated helper is private/ungranted, and the security-definer body keeps an
  empty `search_path` with schema-qualified references.

The phase candidate receipt must classify this function definition and ACL change
explicitly. The final production-effect capture must prove the same definition
and grants that the contract registry activates; a replacement that silently
drops the July 14 repair semantics cannot pass replay or activation.
The current replay manifest's July 14 forward-repair entry, SHA-256, deployment
receipt, and semantic evidence remain frozen. Owner-expand and contract
replacements are later ordinary post-base extension sources; implementation
must never rewrite or retarget the historical repair to make the new final
definition appear converged.

The owner-expand terminalizer module changes the customer cancellation RPC from boolean so the
prepared application's dual-shape parser is live first. It requires an explicit
`DROP FUNCTION public.cancel_order_as_customer(uuid, text)` and recreation as a
table-returning function with:

- `outcome`: exactly `cancelled`, `cancelled_replay`, or
  `cancellation_reversal_conflict_filed`;
- `order_id`, `shipping_status`, and `payment_status`;
- nullable `review_id`;
- nullable `reversed_wallet_transaction_id` and
  `reversed_savings_redemption_id`;
- `inventory_unwind_event_count`;
- `released_serialized_unit_count`;
- `restocked_aggregate_unit_count`; and
- `unlimited_noop_item_count`;
- `external_untracked_item_count`; and
- `catalog_deleted_noop_item_count`;
- `terminal_payment_snapshot_count`;
- `expired_payment_account_count`; and
- `cancelled_wallet_funding_intent_count`; and
- `aborted_gateway_initialization_count`.

The expand provisional result includes that final field as zero because the
gateway-initialization table does not exist yet; the late-payment replacement
keeps the shape and supplies the committed count after creating the table.

`cancelled` proves reversal, terminal-payment snapshot capture when a DVA epoch
exists, policy-aware inventory unwind, payment-instrument expiry, and terminal
order mutation all committed. `cancelled_replay` proves the order was already
terminal with no active unreversed evidence, validates any required existing
terminal snapshot, and performs no email, reversal, or inventory mutation.
`cancellation_reversal_conflict_filed` proves the order and inventory were not
changed and returns the durable review id. The customer route validates this
shape: it sends the cancellation email only for `cancelled`, returns an
idempotent success without email for `cancelled_replay`, and maps the conflict
to HTTP `409`,
`code = INTERNAL_CREDIT_CANCELLATION_REVERSAL_CONFLICT`, with `orderId` and
`reviewId`. A malformed or empty result is a retryable `500`, never boolean
success.

The merchant, provider-cancellation, provider-webhook, payment-failure, and
abandonment functions return the same `outcome`, review, reversal, and inventory
summary fields in their existing JSON result where they already return JSON.
Provider webhook conflict is acknowledged only after the review and alert are
durable, returns `cancellation_reversal_conflict_filed`, and leaves both
shipment and order state unchanged; it must not report the provider status as
locally applied.

The owner-expand terminalizer bundle must **not** replace
`mark_abandoned_orders` with another multi-order SQL function. A PL/pgSQL
exception block is a subtransaction, not an independent commit: every
successful order, inventory, advisory, and control-row lock would remain held
until the outer RPC completed. Because every registered terminalizer begins
with the control singleton, looping over 500 orders in one function would turn
cleanup into a global checkout/pause lock convoy.

The preparation application therefore ships a capability-aware cleanup worker
before owner-expand. While the terminalization contract is
`legacy_direct_v0`, it may call the old
`public.mark_abandoned_orders(integer)` once. When the owner-expand final gate
atomically advertises `allocation_safe_v1`, it also revokes and drops that old
direct-update signature. A request that read the old capability immediately
before the gate may receive `42883` or
`ORDER_ABANDONMENT_WORKER_UPGRADE_REQUIRED`; the prepared dispatcher rereads
the capability and enters the claim pipeline once. It never falls back to the
legacy function after observing `allocation_safe_v1`.

The abandonment-cleanup module installs exactly three service-role-only RPCs:

- `claim_abandoned_order_cleanup_candidates(hours_threshold integer DEFAULT
  72, batch_limit integer DEFAULT 50, lease_seconds integer DEFAULT 120)
  RETURNS jsonb`;
- `terminalize_claimed_abandoned_order(p_order_id uuid, p_claim_token uuid,
  p_hours_threshold integer DEFAULT 72) RETURNS TABLE (...)`; and
- `get_abandoned_order_cleanup_work_state(hours_threshold integer DEFAULT 72)
  RETURNS jsonb`.

The claim RPC validates `hours_threshold` in `1..720`, `batch_limit` in
`1..50`, and `lease_seconds` in `30..600`. Candidate discovery is read-only,
orders eligible ids by `created_at, id`, and never locks an order, the control
singleton, wallet/savings evidence, or inventory. It creates or updates only
rows in the RLS-locked `abandoned_order_cleanup_attempts` table and claims them
with `FOR UPDATE SKIP LOCKED` in that private queue. It returns at most 50
objects containing `orderId`, opaque `claimToken`, claim expiry, and the
read-only evidence fingerprint. Claiming a queue row is not permission to
terminalize from that snapshot.

`abandoned_order_cleanup_attempts` is keyed by `order_id` and stores
`claim_token`, `claimed_at`, `claim_expires_at`, last database-computed evidence
fingerprint, last outcome (`conflict` or `error`), consecutive
same-fingerprint failure count, `next_attempt_at`, last review id and bounded
error code, and first/last attempt timestamps. The fingerprint covers the
candidate order status/timestamps, active wallet and savings evidence,
deterministic payment evidence, allocation decision/unwind state, and terminal
state. A stale lease may be reclaimed with a new token; the old token becomes
invalid before any terminal mutation.

Each call to `terminalize_claimed_abandoned_order` handles exactly one order in
exactly one database transaction. It first reads the candidate token without a
lock only to reject malformed identifiers, then acquires the control,
financial, account, payment, order, evidence, and inventory locks in the global
order. Only after locking and revalidating the order does it lock the cleanup
attempt row, prove the token is still current and unexpired, recompute the
fingerprint and abandonment eligibility, and invoke the registered per-order
terminalizer. The claim RPC never locks an order, so taking the attempt row
after the order cannot create a reverse cycle. A changed or no-longer-eligible
row returns `skipped_state_changed`; a stolen or expired lease returns
`claim_lost`; neither mutates the order or inventory.

The one-order RPC uses one PL/pgSQL exception block around compensation,
allocation unwind, and terminalization. A known conflict atomically persists
its existing review/alert and backoff. An unexpected exception rolls back that
order's attempted financial, inventory, and terminal work, then creates or
reuses one `abandoned_order_terminalization_failed` review and operations alert
before recording error backoff. Failure to make the review or alert durable
raises and leaves the claim retryable. Conflict outcomes back off for 24 hours;
unexpected errors use 5 minutes, 15 minutes, 1 hour, 6 hours, then a 24-hour
cap. Successful terminalization, terminal replay, or a proved state change
clears or completes the claim without retaining a defer row.

The preceding non-transactional index migration adds a partial
`orders_abandonment_candidates_created_at_id_idx` on `created_at, id` whose
static predicate covers exactly the payment and BNPL states that can enter this
cleanup. Both candidate selection and the continuation probe use that index and
apply the runtime age threshold as a range condition.

`get_abandoned_order_cleanup_work_state` performs bounded read-only existence
probes using the same eligibility and defer predicates. Its exact result is
`hasMoreActionable`, `hasDeferredWork`, `nextDeferredAttemptAt`, and
`oldestActionableOrderId`; it never locks orders or queue rows.

The cleanup route's exact aggregate JSON result remains:

- `scannedCount`
- `terminalizedCount`
- `replayedCount`
- `conflictFiledCount`
- `errorFiledCount`
- `deferredConflictCount`, counting this batch's conflict outcomes placed into
  same-fingerprint backoff
- `deferredErrorCount`, counting this batch's unexpected errors placed into
  same-fingerprint backoff
- `hasMoreActionable`
- `hasDeferredWork`, true when any still-eligible row is currently deferred
- `reviewIds`, containing at most the first 100 durable review ids created by
  this batch
- `reviewIdsTruncated`, true when the batch created more than 100 reviews

A known reversal or allocation conflict increments `conflictFiledCount`.
An unexpected per-order exception rolls back only that order's subtransaction,
creates or reuses an `abandoned_order_terminalization_failed` review and
operations alert, and increments `errorFiledCount`; failure to make that error
durable aborts the whole RPC. Both conflict and error paths record the current
fingerprint and backoff only after the corresponding review and alert are
durable. `hasMoreActionable` is calculated after the batch with a deterministic
`SELECT 1 ... ORDER BY created_at, id LIMIT 1` existence probe using the same
eligibility and defer predicate; it never locks candidate orders.
`hasDeferredWork` is a separate bounded `EXISTS` probe over eligible rows whose
same-fingerprint attempt is still deferred. Deferred reviewed conflicts do not
make immediately actionable work appear undrained, and repeated calls cannot
select the same oldest conflict while starving later rows.

`apps/web/src/app/api/cron/cleanup-orders/route.ts` remains the
`CRON_SECRET`-protected manual/VPS worker endpoint. It claims at most 50 rows at
a time, invokes `terminalize_claimed_abandoned_order` once per order with
bounded concurrency of five, and processes at most 500 orders across at most
ten claim rounds. Every Supabase RPC invocation is a separate HTTP request and
therefore a separate database transaction. It stops when the work-state RPC
returns `hasMoreActionable = false`, and validates claim, per-order, and
work-state responses with colocated Zod schemas in
`apps/web/src/schemas/abandoned-order-cleanup-result.ts`. Missing, malformed, or
negative counts return `500`. A valid route response aggregates the batches and
adds `batchCount` and `drained`, where `drained` is true only when the final
work-state result returned `hasMoreActionable = false`; deferred reviewed conflicts are
reported through `hasDeferredWork` and do not make `drained` false. It keeps at
most the first 100 unique
review ids and sets `reviewIdsTruncated` when any batch was truncated or when
cross-batch aggregation omits another unique id. It logs warnings for
conflict/error reviews, deferred work, or `drained = false`. The next VPS
invocation continues actionable work and retries deferred rows only after their
backoff or evidence change. No database transaction terminalizes more than one
order, and no successful cleanup transaction retains the control singleton
while processing a sibling order. The route and its current migration-contract
tests must be updated together; generated Supabase types drop
`mark_abandoned_orders(integer)` and expose the exact three new RPC results.

Before contract activation, audit every order already in the terminal
transition set for active wallet or savings redemption evidence that lacks a
completed deterministic payment or matching reversal. The migration creates an
RLS-locked, append-only
`internal_credit_cancelled_order_audit_decisions` table keyed uniquely by
`(order_id, evidence_fingerprint)`. Each row stores:

- the order and merchant;
- a 64-character lowercase SHA-256 fingerprint over the sorted wallet and
  savings evidence ids, amounts, statuses, reversal ids, deterministic payment
  ids, and terminal order state;
- disposition `repaired` or `manual_reconciliation_open`;
- nullable order-scoped reconciliation `review_id`;
- bounded reason, service actor, and database timestamp; and
- the structured evidence snapshot used to compute the fingerprint.

Updates and deletes are rejected. The service-role-only
`record_internal_credit_cancelled_order_audit_decision(p_order_id uuid,
p_expected_evidence_fingerprint text, p_disposition text, p_review_id uuid,
p_reason text, p_actor text)` RPC validates a reason of 10 through 500
characters and an operator identity of 3 through 200 characters, locks the
order and evidence, recomputes the fingerprint in the database, and rejects a
caller fingerprint mismatch. `repaired` is accepted only when no active
unreversed evidence remains. `manual_reconciliation_open` requires an open
`historical_cancelled_internal_credit_evidence` reconciliation review for the
same order whose metadata contains the exact fingerprint. The new issue type is
order-scoped, uses the existing open-review deduplication rule, and is created
through the existing service-role review-and-alert contract so one durable
operations email is queued before the disposition is accepted.

The audit CLI prints the current fingerprint, records decisions only through
that RPC, and emits a signed machine-readable gate report. Activation queries
the evidence again under lock. It passes only when the candidate count is zero
or every remaining candidate has an exact-current-fingerprint
`manual_reconciliation_open` decision backed by the still-open matching review.
A stale decision, closed/mismatched review, missing fingerprint, or unrecorded
candidate blocks activation. A prose note or operator spreadsheet is never an
activation disposition.

The replay branch deliberately runs before the fresh baseline calculation. Once
the first completion has inserted its transaction and set
`orders.amount_paid = orders.total`, recomputing outstanding would produce zero
and incorrectly reject the original non-zero redemption evidence. Tests must
prove that the same evidence returns the same transaction id, while changed
evidence fails as a conflict.

The contract order route begins one checkout intent after Zod/auth/customer
validation and before any order RPC whenever wallet or savings is requested.
It passes that intent to every storefront call, including the optional
`p_internal_credit_checkout_intent_id` added to all four storefront creation
contracts. A fresh order creation binds the intent to the returned order and
idempotency hash in the same transaction; an idempotent order replay must return
the same binding.

The final active intent API is exact:

- `begin_internal_credit_checkout(uuid, uuid, text, text)` for merchant,
  customer, checkout idempotency key, and request hash;
- `complete_internal_credit_checkout_intent(uuid, uuid, text, text)` for intent,
  order, selected gateway, and the checked `gateway_handoff` outcome;
- `get_internal_credit_checkout_replay(uuid)` for the authenticated owner to
  retrieve the sanitized durable replay state described below;
- `abort_internal_credit_checkout_intent(uuid, uuid, text)` for intent,
  nullable order, and one of `order_creation_failed`,
  `pre_credit_checkout_failed`, or `checkout_restarted_before_credit`;
- `private.assert_internal_credit_checkout_intent(uuid, uuid)`;
- `redeem_wallet_for_order(uuid, uuid, uuid, uuid, numeric, text)`, with the
  checkout intent first;
- `redeem_savings_for_order(uuid, uuid, uuid, uuid, uuid, numeric, text)`, with
  the checkout intent first;
- every private/public storefront creation signature gains one trailing
  `p_internal_credit_checkout_intent_id uuid DEFAULT NULL`; and
- the two intent-first finalizer signatures listed above.

The contract storefront-adapter module explicitly retires each old storefront
adapter before recreating its supported signature because the return shapes are
also changing. The dedicated finalizer modules drop each old tokenless
redemption/finalizer adapter without a compatibility overload; the renamed
ungranted inners remain callable only by the versioned adapters that still need
them during the staged bundle.
Ordinary card/invoice/POD calls omit the optional storefront intent; any later
credit redemption still requires a separately begun intent bound to the same
order and idempotency hash.

The authenticated abort RPC locks the control row, intent, optional bound order,
and exact financial evidence in the global order. It is permitted only before
any wallet or savings redemption, deterministic completed payment, or paid
side-effect seed exists. With no bound order it marks the intent `aborted`. With
a bound order and no credit/payment evidence it terminalizes that order through
the shared immutable-allocation unwind using
`internal_credit_checkout_aborted_before_redemption`, then marks the intent
`aborted` in the same transaction. Any committed or contradictory financial
evidence returns `INTERNAL_CREDIT_CHECKOUT_RECONCILIATION_REQUIRED` without
changing the intent, order, inventory, or ledger. An identical aborted replay
is idempotent.

The contract redemption-adapter module drops the tokenless wallet and savings
redemption signatures and recreates them with the checkout-intent id. A pause/fence,
foreign-intent, stale-generation, malformed-result, or unknown database error
is never treated as optional and can never fall through to a gateway payment.
The existing wallet fallback behavior is preserved only for a recognized
business outcome such as insufficient available wallet balance and only when
the database proves that no wallet or savings mutation committed. In that case,
or after a valid partial redemption, the route calls
`complete_internal_credit_checkout_intent` to atomically:

- lock and validate the intent, order, and any redemption evidence;
- persist the exact pre-gateway wallet and savings amounts on the order;
- derive and validate the authoritative residual gateway amount and currency;
- create or replay one durable gateway-initialization record for the selected
  gateway, stable provider reference, checkout generation, request hash, and
  residual amount;
- mark the intent `completed` with phase `gateway_handoff`; and
- return the gateway-initialization id plus authoritative residual amount.

The gateway-initialization module creates the RLS-locked
`gateway_initialization_intents` table before installing that completion body.
It stores an opaque id, unique checkout-intent id, order/merchant/customer and
checkout-generation scope, checked gateway, amount, currency, checkout request
hash, stable provider reference, status (`pending`, `claimed`, `ready`,
`reconciliation_required`, or `aborted`), claim token/timestamp, attempt count,
nullable provider transaction id, sanitized response, review id, bounded error,
and created/updated/completed timestamps. Unique keys on checkout intent and on
`(gateway, provider_reference)` prevent a second provider initialization. RLS
has no client policies; authenticated callers use only scoped RPCs. The
initialize route uses its request-scoped authenticated Supabase client and must
not use `service_role` for this user-facing orchestration.

For an internal-credit residual, `/api/payments/initialize` requires both the
checkout-intent id and gateway-initialization id. It rejects a caller amount,
currency, order, customer, merchant, gateway, or request hash that differs from
the durable record. Before claim, the server signs a
`payment-orchestration-rpc-proof:v1` action
`claim_internal_credit_gateway_initialization` binding the authenticated user,
record, order, gateway, residual amount/currency, request hash, and issued-at.
The authenticated claim RPC validates that proof and either returns an existing
`ready` result read-only after locking the order and proving there is no
active provider-cancellation hold, returns an existing non-stale claim as in
progress, or claims the exact `pending` record. A fresh claim checks that same
hold under the order lock before granting provider-call authority. The provider
call uses the stored stable reference and provider-specific idempotency or
status lookup. The server then signs action
`finish_internal_credit_gateway_initialization`, binding the claim token and
canonical provider-result hash. The authenticated finish RPC validates the
proof and token, follows the canonical control/intent/account/payment/order lock
order, and atomically persists the BAC transaction/provider identity and
sanitized response before the HTTP response is returned. A direct customer
cannot claim, finish, alter, or indefinitely lease a record without a current
server proof. If an active provider-cancellation attempt appeared after claim,
finish preserves that provider evidence but sets the initialization to
`reconciliation_required`, links the exact attempt-scoped review, returns
`payment_held_for_provider_cancellation`, and exposes neither checkout URL nor
fresh-call authority. A subsequent ready replay performs the same locked hold
check, atomically changes `ready -> reconciliation_required`, links the current
attempt review, and is withheld rather than leaking a launch URL. The
compensation-aware provider-cancellation prepare path makes this same
transition when it encounters a previously ready row, so withholding does not
depend on a customer replay. Provider rejection lets the service reconciler
promote the stored response to `ready`; committed local cancellation aborts or
compensates the initialization and checkout intent while preserving the
provider evidence. If the process dies
after the provider call, retry retrieves the same provider object by stable
reference; an uncertain provider result becomes `reconciliation_required` and
must not trigger a blind second initialization. Client-only launch gateways
must persist a complete deterministic launch payload as `ready` before it is
returned. A gateway without an idempotent initialization or authoritative
status-lookup strategy is rejected before any wallet or savings redemption; it
cannot participate in partial internal-credit checkout until that strategy is
implemented and tested.

The route does not initialize a gateway until that handoff and its durable
gateway-initialization record commit. A full wallet/savings payment is completed
by the finalizer, which closes the intent atomically as described above. If the
HTTP request dies after order creation or redemption but before either close
path, the durable open intent is visible to the emergency drain and
reconciliation contract. If it dies after handoff, the completed checkout
intent points to a resumable gateway-initialization record rather than becoming
an invisible completed row.

Emergency drain counts `pending`, `claimed`, and `reconciliation_required`
gateway-initialization records from the retained checkout generation in
addition to `open`, `reconciling`, and `reconciliation_conflict` checkout
intents. During `draining`, a record that
was durably created by a retained-generation intent may finish or be reconciled;
no new checkout may begin. `paused` permits read-only replay of `ready` and
`aborted` outcomes but no fresh provider call. Conflict outcomes remain readable
while state stays `draining`. Pause finalization
therefore cannot report `paused` while a provider initialization can still run.
Reconciliation looks up provider truth: a ready/paid provider object is
persisted and returned, a proven not-started object compensates any committed
credit and terminalizes the order before marking the initialization `aborted`,
and contradictory or unknowable evidence creates one durable intent review and
keeps the pause drain unresolved. Partial credit is never left silently held
behind a completed handoff.

Authenticated same-key replay is an exact state machine:

- `started` resumes the idempotent order-creation call;
- `order_bound` reuses that order and resumes only the missing redemption or
  finalization step;
- `credit_redeemed` reuses the stored redemption ids and advances to full-credit
  finalization or durable gateway handoff without redeeming again;
- completed `gateway_handoff` resumes or returns the one linked gateway
  initialization and never reruns order creation or redemption;
- completed `fully_paid` returns the deterministic payment transaction and
  reruns only its claim-gated side-effect drain;
- `aborted` returns the stable terminal reason and whether compensation/order
  terminalization was proven, so only that proven retryable outcome may clear
  the browser fingerprint key; and
- `reconciliation_conflict` returns the durable review id, retains the same
  browser key/order, and performs no mutation.

`get_internal_credit_checkout_replay` returns only the authenticated caller's
intent phase/status, bound order id, nullable gateway-initialization id and
status, nullable deterministic transaction id, terminal reason, compensation
proof flag, and review id. The route must branch on this result before any fresh
mutation. It is available while control is `draining` or `paused` because it is
read-only; mutation remains governed by the captured-generation rules above.

If a recognized order-creation or other pre-credit failure occurs after begin,
the route calls `abort_internal_credit_checkout_intent` before returning. A
successful abort frees the customer to retry with a new checkout fingerprint.
If abort returns reconciliation-required, times out, or is malformed, the route
returns a stable retryable error and leaves the intent durable for same-key
replay or service reconciliation; it never guesses that no mutation occurred.

The RPC must never return a completed outcome without a concrete transaction
id. The route passes the checkout intent and redemption ids it already receives
from `redeem_wallet_for_order`/`create_storefront_order_with_savings`, validates
the table result, and never treats `{ data: true }` as enough. For
`inventory_unavailable_reversed`, the route returns HTTP `409` with
`code = SERIALIZED_INVENTORY_UNAVAILABLE`, preserves the cart, includes the
existing `orderId`, `orderTerminalized = true`, the terminal cancellation
reason, and explicitly reports that wallet or savings credit was restored. For
`inventory_reversal_conflict_filed`, it returns `500` with
`code = INTERNAL_CREDIT_INVENTORY_REVERSAL_CONFLICT`, the order and review ids,
`orderTerminalized = false`, and no claim that credit was restored. A finalizer
error or malformed result must not be logged-and-ignored: the route returns a
stable retryable error with the existing `orderId`, never reports the order as
paid, and relies on the same checkout idempotency key plus redemption ids for a
safe retry. A strict-inventory outcome means the payment transaction,
order-paid state, and side-effect seeds did not commit; unlimited or fallback
inventory can never produce that outcome.

The active storefront implementation is
`apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`. On the
proven `inventory_unavailable_reversed` outcome it must preserve the cart and
checkout session, clear the pending checkout order, clear the stored
idempotency key for that cart fingerprint, refresh wallet and savings balances,
show a stock-unavailable/credit-restored message, and permit the next submission
to create a fresh order with a fresh key. It must not clear the idempotency key
for `inventory_reversal_conflict_filed`, a malformed finalizer response, or any
generic `500`; those outcomes retain the old order and key for safe replay.
Updating only the standalone
`pages/checkout/handlers/place-order.ts` helper is insufficient because the
active page owns the current idempotency lifecycle. Keep that helper in parity
only if it remains a supported path; otherwise remove it with its tests.

Generalize `runPaidOrderSideEffects` with an explicit settlement policy:

- `{ kind: 'gateway', gateway: 'paystack' | 'korapay' }` installs
  `merchant_settlement`; and
- `{ kind: 'none', reason: 'internal_credit' }` does not install or seed
  `merchant_settlement`.

Rename the shared runner and `StepContext` input from the gateway-specific
`gatewayResponse` to `paymentEvidence`. Gateway callers provide their actual
verified provider response. Internal-credit callers provide honest internal
evidence containing the payment method and transaction id. Only the gateway
settlement-policy branch may pass that evidence to
`extractVerifiedGatewayFeeNgn`; the internal-credit branch never constructs the
settlement executor.

The existing DVA wallet-funding runner retains the gateway policy because it
represents external money received through Paystack or Korapay. Add a separate
`runInternalCreditPaidOrderSideEffects` wrapper for checkout wallet, savings,
and store credit. It fetches the paid order and invokes the shared runner with
the returned transaction, the owner-derived merchant push policy, paid email,
ad tracking, and the no-settlement policy with reason `internal_credit`. It
does not fabricate gateway responses, allocate a gateway fee, create merchant
settlement, or require an `OrderWalletFundingIntent`.

Gateway callers must honor the completion RPC contract:

- an absent `merchant_push_contract` is the old-database compatibility result.
  Only the already-deployed preparation bridge may use
  `schedulePaidOrderNotifications`, and only for the fresh completion that
  changed the order; a replay never sends direct pushes;
- `merchant_push_contract = claimed_v1` forbids direct notification calls and
  installs executors only for the exact `paid_order_side_effect_steps` returned
  or found in the payer transaction's rows. `merchant_push_steps` is the push
  subset used to select the two merchant executors;
- a payer completion or replay under `claimed_v1` also requires
  `inventory_contract = atomic_confirmed_v1` before any executor may claim a
  row. A missing or malformed inventory contract is
  `PAID_ORDER_SIDE_EFFECT_STATE_CONFLICT`, not permission to fall back to
  application-side confirmation or direct delivery;
- under `claimed_v1`, the locked `payer_transaction_id` is authoritative. The
  current transaction runs order-scoped claims only when it is that payer;
  another payer means settlement-only capture. A null payer on an already-paid
  pre-outbox replay creates no notification work. The application does not call
  `getOrderOutboxState` or pick the first side-effect row to infer ownership in
  this branch; and
- every replay under `claimed_v1` reuses persisted claims. An empty
  `merchant_push_steps` list for a pre-expand already-paid order means no push
  work is inferred, not a reason to resend direct notifications.

The preparation application's old-schema branch retains
`confirmPaidOrderInventoryOrRollback` and `clearPaymentSideEffectSeed` only for
the bounded database version that cannot advertise `claimed_v1`. The
`claimed_v1` branch never invokes either helper: successful RPC return is proof
that inventory and seeds committed atomically, while an RPC inventory error
means neither committed. The contract application may delete the compensation
path after every supported recovery environment has the owner-expand bundle.

Keep `notify-paid-order.ts` only in the preparation and expand-compatible
application as the bounded old-schema bridge. The contract application may
delete it after production and every supported recovery environment have the
owner-expand bundle, because the new database function never creates a direct-only
transaction cohort. Rollback remains safe by rolling back to the preparation
application, which understands both the old and `claimed_v1` result shapes.

The failed-side-effect drain must explicitly dispatch by transaction class
rather than treating every replayable row as a gateway payment:

- completed `paystack` and `korapay` transactions keep the existing external
  reference resolution, provider re-verification when evidence is missing, and
  `finalizeOrderGatewayPayment` path, and replay the transaction's persisted
  claimed rows under `merchant_push_contract = claimed_v1`;
- completed `wallet`, `savings`, and `store_credit` transactions call
  `runInternalCreditPaidOrderSideEffects` directly with stored internal evidence
  and the no-settlement policy; they never call `verifyGatewayCharge`, require a
  provider reference, or install `merchant_settlement`; and
- unsupported gateways preserve the existing terminal/manual-reconciliation
  behavior.

Keep `drain-failed-paid-order-side-effects.ts` focused on candidate lookup,
deduplication, and summary construction. Extract the gateway/internal-credit
dispatch into `paid-order-side-effect-drain-dispatch.ts` with a colocated test so
the existing drain file does not cross the repository's 300-line limit.

Immediately after either internal-credit finalizer returns a completed outcome,
the order route validates that the response names the committed payment
transaction and the exact side-effect steps atomically seeded by that
transaction. It returns the paid response from this durable state; delivery is
not part of the customer request's success condition. It never invokes or
claims the runner for `inventory_unavailable_reversed` or
`inventory_reversal_conflict_filed`, because those outcomes contain no payment
transaction or side-effect rows. A per-step delivery failure remains represented
by its claimed `failed` row and does not roll back the completed internal
transfer. A failure before a worker can claim the steps, such as rich-order
fetch or normalization failure, must find the exact paid email, ad tracking, and
owner-selected merchant push rows already seeded by the finalizer. If the
returned transaction or step set is malformed, the route returns `500` with
`PAID_ORDER_SIDE_EFFECT_STATE_CONFLICT`; an idempotent client retry receives the
same committed finalizer result through the replay-first branch and cannot
create a second order or transfer.

For low-latency delivery, the completed branch calls
`scheduleInternalCreditPaidOrderSideEffectNudge` after validating the committed
result. That server-only helper schedules a best-effort self-request to a
dedicated `CRON_SECRET`-protected worker route, carrying only the transaction
id. The worker route, not the customer order route, constructs the service-role
client, verifies that the transaction belongs to an internal-credit gateway,
and dispatches only that transaction through
`runInternalCreditPaidOrderSideEffects`. A missing cron secret, rejected nudge,
timeout, worker failure, or process loss is logged but does not turn a committed
payment into an HTTP failure: the existing hourly
`reconcile-gateway-paid-orders` drain discovers the same durable rows as the
fallback. The targeted route is non-cacheable, rejects browser/unauthenticated
requests in constant time, validates the transaction id with the shared Zod
boundary schema before any database operation, and never accepts an order id or
caller-selected side-effect list. Same-key replay may schedule the same harmless transaction
nudge again; transaction/step claims preserve exactly-once ownership.

Use a `GET` worker endpoint to match the repository's existing bearer-authenticated
cron convention: it accepts no body or cookie authority, sets `Cache-Control:
no-store`, authenticates `CRON_SECRET` before Zod/query work, and receives the
UUID only as `transactionId`. The server-only nudge builds its absolute URL from
the configured application origin and never forwards customer headers. This is
not a browser mutation endpoint and therefore introduces no cookie-CSRF path.

The checkout route must require a valid `Idempotency-Key` before creating any
order that requests wallet or savings credit. The storefront client already
sends this key; making it mandatory for internal-credit flows ensures a `500`
after payment completion cannot create a second order when the client retries.
Every non-success response includes `orderId` and the stable error code. Only
`inventory_unavailable_reversed` may state that internal credit was restored;
ordinary execution failures must not claim a rollback that the returned outcome
does not prove.

The authenticated route client invokes the customer-authorized begin,
redemption, handoff, and finalizer RPCs. Both finalizers, both redemption RPCs,
and every internal-credit-capable storefront entrypoint require a valid locked
checkout intent; the begin RPC requires enabled persisted control only when it
must insert a new intent. The contract route requires both environment
`enabled` and database readiness before beginning a new key, but an
authenticated same-key request first retrieves and returns its existing durable
replay state even while readiness is false or the environment is paused. It
never uses that replay exception to create an intent or authorize mutation. An authenticated caller
therefore cannot bypass the paused route with a tokenless direct RPC, and a
pause race after begin is resolved through the captured draining generation
rather than a half-created order or gateway fallback.
After it receives the transaction result, the customer-facing route never
constructs `createServiceClient()`, calls `createAdminClient()`, performs a
privileged rich-order fetch, or claims a side-effect row. Those operations live
only behind the protected targeted worker and the existing protected periodic
drain. The customer route's authenticated Supabase client is limited to the
customer-authorized checkout-intent, redemption, handoff, and finalizer RPCs;
neither service-role credentials nor worker authorization are returned to the
browser.

Remove wallet/store-credit/savings from the creation route's immediate paid
email block at the same contract cutover, because the internal-credit runner
owns the claim-gated `paid_email`. Remove both direct `notifyNewOrder` and
`notifyPaymentReceived` calls for those flows. Retain the immediate invoice,
pay-on-delivery, and fully covered quiz-voucher creation behavior only when the
stored owner is `creation`; those existing creation-time emails and new-order
push attempts remain outside the paid-order durability guarantee. Retire and
delete `schedulePaidOrderNotifications` in the contract application only after the
owner-expand bundle is verified in production and every supported recovery
environment. No internal-credit finalizer may call either push function
directly; gateway finalization may use the bounded compatibility helper only
when the old completion result has no `merchant_push_contract` field.

The `(order_id, step)` key remains the logical event deduplication boundary
across webhook delivery, both wallet-funded paths, checkout replay, recovery
CLI, and the failed-side-effect drain, while `transaction_id` is the immutable
owner of that event row. Deduplication never authorizes cross-transaction
takeover.

### Monotonic retry seeding and durable conflicts

Replace the direct retry-marker upsert with a service-role RPC,
`seed_paid_order_side_effect_retries`. `persistPrePushRetryMarkers` and
`persistPaidOrderSideEffectRetry` become validated wrappers over that RPC and
must accept the resolved policy, completion contract, and exact persisted
`paid_order_side_effect_steps`. Under `claimed_v1`, they may add a missing
selected row only when the completion result proves that the payer transaction
owns that work: a fresh gateway payer owns paid email, ad tracking, settlement,
and `merchant_payment_received_push`; only `new_order_and_payment` additionally
owns `merchant_new_order_push`; and a settlement-only capture owns none of the
order-scoped rows.
The old-schema compatibility branch never manufactures claimed push rows; its
other paid-order steps remain independently retryable until the expand
migration removes that branch from new completions.

The seed RPC receives one order id, one transaction id, the selected step array,
the actor, external reference, reason, and normalized error. Under one
transaction it must:

1. reject unknown or duplicate steps and validate that the transaction belongs
   to the order;
2. insert a missing selected row as `failed`;
3. refresh error and retry context only on an existing `failed` row owned by the
   same transaction;
4. leave every `completed` or `claimed` row unchanged, including stale claims;
   stale-claim takeover remains exclusively owned by
   `claim_payment_side_effect` and the failed-side-effect drain;
5. reject a selected row owned by another transaction instead of overwriting
   `transaction_id`; and
6. return the final status and ownership of every requested step so the caller
   can prove that all required markers are durable.

Add `paid_order_side_effect_retry_conflict` to the checked
`reconciliation_review.issue_type` set. Treat it as transaction-scoped by
excluding it from the open `(issue_type, order_id)` unique index and
deduplicating it through the existing open `(issue_type, txn_id)` index. Its
metadata contains the requested steps, current row statuses and transaction
owners, actor, external reference, seed reason, and normalized original error.

The seed RPC must own conflict filing so no application crash can occur between
detecting the conflict and recording it:

- successful validation applies all selected marker changes and returns
  `outcome = 'seeded'`;
- an existing selected step owned by another transaction applies no
  `payment_side_effects` changes, atomically creates or reuses one
  `paid_order_side_effect_retry_conflict` review plus one operations-email
  alert in `payment_reconciliation_alerts`, and returns
  `outcome = 'conflict_filed'` with the review id and conflicting rows; and
- if review or alert persistence fails, the entire RPC raises and commits
  neither marker changes nor a partial review.

Unknown or duplicate steps, an invalid transaction/order relationship, or
malformed identifiers fail closed before marker mutation. When enough valid
order and transaction identity exists, the same RPC files the conflict review;
otherwise it raises a validation error for the caller's structured production
log. Application code contains no direct `payment_side_effects` retry-marker
upsert after this RPC is introduced.

Every wrapper must await the RPC and treat `conflict_filed` as an unsuccessful
completion even though the review is durable. Webhooks, cron, and recovery CLI
return or propagate `completion_failed`; the checkout route returns `500` with
`PAID_ORDER_SIDE_EFFECT_STATE_CONFLICT`. The payment may already be committed,
but no caller reports side-effect completion or returns its normal success path
after `conflict_filed`; an idempotent retry re-enters the same claims while the
durable review remains visible.

This makes side-effect state monotonic: a catch handler can add missing work or
refresh failed diagnostics, but it cannot reopen completed work, steal a live
claim, change transaction ownership, or silently abandon a paid order.

As with email, a worker that sends successfully and crashes before marking
completion can cause a rare provider-level duplicate, but it cannot strand the
notification permanently.

The append-only replacement of `complete_order_gateway_payment` must also set
`amount_paid = GREATEST(amount_paid, total)` whenever it successfully completes
or heals a fully paid order. Cancelled and refunded branches must leave
`amount_paid` unchanged.

## Current Incident Recovery

After the prevention change is deployed, recovery of
`ORD-150726-F2D98D` remains conditional on a read-only historical-provider-
evidence gate. The existing zero-candidate review did not persist receiver-bank
identity or the complete provider-customer tuple, and a DVA assignment row proves
only what Baci expected to receive; neither may manufacture missing transfer-
side evidence.

`reconcile-paystack-dva.ts` therefore has a mandatory `--evidence-only` mode
that performs no order, transaction, inventory, settlement, notification, or
review mutation. Only after an authenticated Paystack Verify call returns HTTP
`200` and passes the bounded response schema does the
mode emit, for the exact order and reference, a canonical bounded JSON report,
report fingerprint, production-project identity, a checked provider-observation
object with exactly `authenticated = true`, `httpStatus = 200`,
`schemaValidated = true`, and RFC 3339 `observedAt`, observed provider status,
and exactly one status: `recoverable`,
`historical_provider_evidence_unavailable`, or
`historical_provider_evidence_conflict`. Transfer-side authority is either:

- a fresh authenticated Paystack response that itself binds the exact reference
  to successful status, amount, currency, `paid_at`, provider customer code,
  receiver account, and receiver bank; or
- the retained original `charge.success` payload whose HMAC still verifies with
  an approved retained webhook secret, whose event/reference and complete
  receiver/customer tuple agree internally, and whose status, amount, currency,
  and `paid_at` agree with fresh Paystack verification.

An assignment epoch, linked BAC transaction, current order email, current DVA
fetch, local log line, screenshot, or existing reconciliation metadata may
corroborate but cannot replace that transfer-side authority. The evidence-only
invocation always stops after atomically writing its local report when a valid
provider observation exists. DNS/TLS/connect/read timeout, 401/403, 429, 5xx,
unexpected HTTP status, malformed JSON, schema-invalid/unbounded provider data,
or production-target mismatch writes no canonical report or report hash and
exits non-zero. Retryable transport/rate-limit/provider failures emit only the
sanitized stderr code `PAYSTACK_EVIDENCE_PROBE_RETRYABLE`; authentication,
target, or response-contract failures emit only
`PAYSTACK_EVIDENCE_PROBE_REJECTED`. Neither code is a report status and neither
can be passed to the record mode. A separate
`--record-evidence-outcome <report>` mode accepts only a canonical unavailable
or conflict report whose project/order/reference/fingerprint still match live
read-only evidence and invokes only
`record_paystack_historical_evidence_outcome`. For an incomplete tuple that RPC
may create/reuse only the exact-
fingerprint `historical_provider_evidence_unavailable` review and operations
alert; for contradictory assignment evidence it may create/reuse only
`historical_provider_evidence_conflict`. It cannot call any financial,
inventory, settlement, notification, or assignment-repair primitive. Both
outcomes stop with no financial mutation. Their manual path is provider-
evidence escalation, not discretionary manual credit. Recovery execution mode
requires a `recoverable` report for the exact production project, order,
reference, and current evidence fingerprint, then re-verifies that fingerprint
under lock; there is no force or skip-evidence flag.

Only a `recoverable` report may continue through the audited Paystack DVA path:

1. Run `reconcile-paystack-dva.ts --evidence-only` for order
   `ORD-150726-F2D98D` and Paystack reference
   `000013260715125423000067116596`; archive its canonical report and hash.
2. Re-verify the reference in execution mode and require the evidence status,
   production project, order, reference, and fingerprint to remain exact.
3. Confirm the exact amount, NGN currency, verified normalized assignment email
   `tonycldm@gmail.com`, exact Paystack provider customer code, receiving DVA
   account number and bank identity, and payable order. Prove those customer
   fields against the assignment/linked transaction and, if the legacy epoch is
   missing them, fill them once through the audited repair RPC with its evidence
   fingerprint. Never use the order's current email as a substitute. Stop if
   live provider or database evidence differs from this incident identity.
4. Pass the audited existing BAC pending transaction id as
   `expected_legacy_transaction_id` to
   `reserve_paystack_dva_order_payment`. The RPC validates it, links it to the
   exact matching assignment epoch, and preserves its BAC reference and fee
   fields.
5. Call `claim_paystack_transaction_reference` with the verified external
   reference, reserved transaction id, amount, and currency. Continue only for
   `claimed` or `completed_replay`; `status_conflict` or
   `external_reference_conflict` stops recovery without invoking fulfillment
   and updates the reconciliation review with the conflict evidence.
6. For `claimed`, run `finalizeOrderGatewayPayment` with the successful
   transaction-claim outcome; for `completed_replay`, run its healing branch.
   The recovery CLI must not call the finalizer directly from reservation and
   must not use the legacy `claim_paystack_paid_atomic` orchestration. Its
   settlement executor must receive `inserted`, `exact_replay`, or a fully
   evidence-matched `legacy_reference_replay`; `conflict_filed` stops automatic
   recovery and leaves the durable review for manual settlement reconciliation.
7. In the CLI, collect and await every `scheduleAfter` task before exit so
   claimed push and email work cannot be abandoned when the process ends.
8. Verify transaction completion, `payment_status = paid`,
   `amount_paid = total`, zero invoice balance, inventory, customer email,
   one completed `merchant_payment_received_push` claim, no newly created
   `merchant_new_order_push` claim for this already-created invoice, and
   settlement records.
9. Resolve the existing reconciliation review with the evidence report and
   fingerprint, reservation result,
   reference-claim result, transaction id, finalizer result, notification
   claims, and settlement evidence.

Other historical zero-candidate reviews must be evaluated individually rather
than automatically included in this repair.

## Implementation Surface

Required pre-release trust-anchor bootstrap, merged and deployed as a separate
no-feature PR before replay scope:

- `.github/CODEOWNERS`
- `.github/workflows/ci.yml` (guardian test routing only in this bootstrap)
- `.github/workflows/guardian-containment-probe.yml`
- `apps/release-guardian/package.json`
- `apps/release-guardian/src/server.ts` and its tests
- `apps/release-guardian/src/github-app-auth.ts` and its tests
- `apps/release-guardian/src/github-app-configuration.ts` and its tests
- `apps/release-guardian/src/webhook-verifier.ts` and its tests
- `apps/release-guardian/src/delivery-store.ts` and its tests
- `apps/release-guardian/src/delivery-worker.ts` and its tests
- `apps/release-guardian/src/delivery-redelivery.ts` and its tests
- `apps/release-guardian/src/candidate-tree-reader.ts` and its tests
- `apps/release-guardian/src/release-policy.ts` and its tests
- `apps/release-guardian/src/protection-snapshot.ts` and its tests
- `apps/release-guardian/src/github-review-evidence.ts` and its tests
- `apps/release-guardian/src/check-run-reconciler.ts` and its tests
- `apps/release-guardian/src/actions-run-containment.ts` and its tests
- `apps/release-guardian/src/bootstrap-receipt.ts` and its tests
- `apps/release-guardian/src/bootstrap-signature.ts` and its tests
- `apps/release-guardian/tools/capture-bootstrap-receipt.ts` and its tests
- `apps/release-guardian/tools/sign-bootstrap-receipt.ts` and its tests
- `apps/release-guardian/tools/verify-bootstrap-receipt.ts` and its tests
- `apps/release-guardian/policy/late-payment-v1.json` and its schema/tests
- `ops/release-guardian/baci-release-guardian.service`
- `ops/release-guardian/baci-release-guardian-redelivery.service`
- `ops/release-guardian/baci-release-guardian-redelivery.timer`
- `ops/release-guardian/deploy-release-guardian.sh` and its tests

After that source PR is deployed and the bootstrap ceremony succeeds, one
separate guardian-receipt PR materializes only:

- `apps/release-guardian/receipts/bootstrap-v1.json`
- `apps/release-guardian/receipts/bootstrap-v1.owner-signature.json`
- `apps/release-guardian/receipts/bootstrap-v1.reviewer-signature.json`

The guardian source may live in this repository for review, but its running
artifact, policy digest, GitHub App private key, and webhook secret live on the
existing shared VPS outside candidate-controlled GitHub Actions. No Baci
workflow may deploy or reconfigure it during this rollout.

Expected application changes:

- `.github/workflows/ci.yml`
- `.github/scripts/assert-production-secret-boundaries.mjs`
- `.github/scripts/assert-production-secret-boundaries.test.mjs`
- `.github/scripts/assert-actions-log-retention.mjs`
- `.github/scripts/assert-actions-log-retention.test.mjs`
- `apps/web/package.json`
- `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
- `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test-utils.ts`
- `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
- `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.resolution.test.ts`
- `apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/route.ts`
- `apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/route.test.ts`
- `apps/web/src/app/api/customers/[id]/route.ts`
- `apps/web/src/app/api/customers/[id]/route.test.ts`
- `apps/web/src/schemas/wallet-payment-account-persistence.ts`
- `apps/web/src/schemas/wallet-payment-account-persistence.test.ts`
- `apps/web/src/lib/paystack.ts`
- `apps/web/src/lib/paystack.test.ts`
- `apps/web/src/lib/agentic/paystack.ts`
- `apps/web/src/lib/agentic/paystack.test.ts`
- `apps/web/src/lib/payments/parse-paystack-dva-assignment-identity.ts`
- `apps/web/src/lib/payments/parse-paystack-dva-assignment-identity.test.ts`
- `apps/web/src/lib/payments/paystack-dva-receiver-identity.ts`
- `apps/web/src/lib/payments/paystack-dva-receiver-identity.test.ts`
- `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`
- `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts`
- `apps/web/src/lib/payments/reserve-paystack-wallet-dva-top-up.ts`
- `apps/web/src/lib/payments/reserve-paystack-wallet-dva-top-up.test.ts`
- `apps/web/src/schemas/paystack-wallet-dva-reservation.ts`
- `apps/web/src/schemas/paystack-wallet-dva-reservation.test.ts`
- `apps/web/src/lib/customer-wallet-payment-account-db.ts`
- `apps/web/src/lib/customer-wallet-payment-account-db.test.ts`
- `apps/web/src/lib/customer-wallet-payment-account-types.ts`
- `apps/web/src/lib/customer-wallet-payment-accounts.ts`
- `apps/web/src/lib/customer-wallet-payment-accounts.creation.test.ts`
- `apps/web/src/lib/customer-wallet-payment-accounts.concurrency.test.ts`
- `apps/web/src/lib/customer-wallet-payment-accounts.proof.test.ts`
- `apps/web/src/scripts/verify-wallet-dva-persistence-contract.ts`
- `apps/web/src/scripts/verify-wallet-dva-persistence-contract.test.ts`
- `apps/web/src/lib/order-wallet-funding-intent-repository.ts`
- `apps/web/src/lib/order-wallet-funding-intent-repository.test.ts`
- `apps/web/src/lib/order-wallet-funding-intent-types.ts`
- `apps/web/src/lib/order-wallet-funding-intents.ts`
- `apps/web/src/lib/order-wallet-funding-intents.test.ts`
- `apps/web/src/lib/order-wallet-funding-intents.fallbacks.test.ts`
- `apps/web/src/lib/posthog/wallet-funding-events.ts`
- `apps/web/src/lib/posthog/wallet-funding-events.test.ts`
- `apps/web/src/lib/posthog/wallet-funding-failure-reason.ts`
- `apps/web/src/lib/posthog/wallet-funding-failure-reason.test.ts`
- `apps/web/src/components/storefront/ogabassey/components/wallet-funding-copy.ts`
- `apps/web/src/components/storefront/ogabassey/components/wallet-funding-copy.test.ts`
- `apps/web/src/components/storefront/ogabassey/components/WalletFundingPanel.tsx`
- `apps/web/src/components/storefront/ogabassey/components/WalletFundingPanel.test.tsx`
- `apps/web/src/components/storefront/ogabassey/components/WalletFundingPanel.telemetry.test.tsx`
- `apps/web/src/lib/agentic/paystack-dva-webhook.ts`
- `apps/web/src/lib/agentic/paystack-dva-webhook.test.ts`
- `apps/web/src/lib/payments/paystack-dva-multi-key-match.ts`
- `apps/web/src/lib/payments/paystack-dva-multi-key-match.test.ts`
- `apps/web/src/lib/payments/confirm-paystack-dva-by-order-account.ts`
- `apps/web/src/lib/payments/confirm-paystack-dva-by-order-account.test.ts`
- `apps/web/src/lib/payments/paystack-dva-order-alias.ts`
- `apps/web/src/lib/payments/paystack-dva-order-alias.test.ts`
- `apps/web/src/lib/payments/paystack-dva-order-assignment-wallet-collision.ts`
- `apps/web/src/lib/payments/paystack-dva-order-assignment-wallet-collision.test.ts`
- `apps/web/src/lib/payments/paystack-dva-wallet-assignment-collision.ts`
- `apps/web/src/lib/payments/paystack-dva-wallet-assignment-collision.test.ts`
- `apps/web/src/lib/payments/paystack-dva-wallet-transfer-alias.ts`
- `apps/web/src/lib/payments/paystack-dva-wallet-transfer-alias.test.ts`
- `apps/web/src/lib/payments/resolve-paystack-transaction-reference.ts`
- `apps/web/src/lib/payments/resolve-paystack-transaction-reference.test.ts`
- `apps/web/src/lib/payments/claim-paystack-transaction-reference.ts`
- `apps/web/src/lib/payments/claim-paystack-transaction-reference.test.ts`
- `apps/web/src/lib/payments/persist-paystack-order-dva-assignment.ts`
- `apps/web/src/lib/payments/persist-paystack-order-dva-assignment.test.ts`
- `apps/web/src/lib/payments/payment-orchestration-rpc-proof.ts`
- `apps/web/src/lib/payments/payment-orchestration-rpc-proof.test.ts`
- `apps/web/src/lib/payments/get-external-gateway-reference.ts`
- `apps/web/src/lib/payments/get-external-gateway-reference.test.ts`
- `apps/web/src/lib/payments/reconcile-wedged-gateway-orders.ts`
- `apps/web/src/lib/payments/reconcile-wedged-gateway-orders.test.ts`
- `apps/web/src/lib/payments/reconcile-wedged-gateway-orders.gateway-verification.test.ts`
- `apps/web/src/lib/payments/reconcile-wedged-gateway-orders.juicyway.test.ts`
- `apps/web/src/lib/payments/drain-failed-paid-order-side-effects.ts`
- `apps/web/src/lib/payments/drain-failed-paid-order-side-effects.test.ts`
- `apps/web/src/lib/payments/drain-failed-paid-order-side-effects.test-helpers.ts`
- `apps/web/src/lib/payments/drain-failed-paid-order-side-effects.test-helpers.test.ts`
- `apps/web/src/lib/payments/drain-failed-paid-order-side-effects.verification.test.ts`
- `apps/web/src/lib/payments/verify-gateway-charge.ts`
- `apps/web/src/lib/payments/verify-gateway-charge.test.ts`
- `apps/web/src/lib/payments/verify-gateway-charge.juicyway.test.ts`
- `apps/web/src/lib/payments/juicyway-platform-fee.ts`
- `apps/web/src/lib/payments/juicyway-platform-fee.test.ts`
- `apps/web/src/lib/payments/juicyway-settlement-metadata-compatibility.ts`
- `apps/web/src/lib/payments/juicyway-settlement-metadata-compatibility.test.ts`
- `apps/web/src/lib/payments/juicyway-settlement-policy.ts`
- `apps/web/src/lib/payments/juicyway-settlement-policy.test.ts`
- `apps/web/src/app/api/payments/juicyway/webhook/route.settlement-recovery.test.ts`
- `apps/web/src/lib/payments/paid-order-side-effect-drain-dispatch.ts`
- `apps/web/src/lib/payments/paid-order-side-effect-drain-dispatch.test.ts`
- `apps/web/src/lib/payments/schedule-internal-credit-paid-order-side-effect-nudge.ts`
- `apps/web/src/lib/payments/schedule-internal-credit-paid-order-side-effect-nudge.test.ts`
- `apps/web/src/app/api/cron/internal-credit-paid-order-side-effects/route.ts`
- `apps/web/src/app/api/cron/internal-credit-paid-order-side-effects/route.test.ts`
- `apps/web/src/schemas/internal-credit-paid-order-worker.ts`
- `apps/web/src/schemas/internal-credit-paid-order-worker.test.ts`
- `apps/web/src/lib/payments/complete-order-gateway-payment.ts`
- `apps/web/src/lib/payments/complete-order-gateway-payment.test.ts`
- `apps/web/src/schemas/order-gateway-payment-completion.ts`
- `apps/web/src/schemas/order-gateway-payment-completion.test.ts`
- `apps/web/src/lib/payments/finalize-order-gateway-payment.ts`
- `apps/web/src/lib/payments/finalize-order-gateway-payment.test.ts`
- `apps/web/src/lib/payments/handle-payment-for-cancelled-order.ts`
- `apps/web/src/lib/payments/handle-payment-for-cancelled-order.test.ts`
- `apps/web/src/lib/payments/file-blocked-order-payment-review.ts`
- `apps/web/src/lib/payments/file-blocked-order-payment-review.test.ts`
- `apps/web/src/lib/payments/clear-payment-side-effect-seed.ts`
- `apps/web/src/lib/payments/clear-payment-side-effect-seed.test.ts`
- `apps/web/src/lib/payments/confirm-paid-order-inventory.ts`
- `apps/web/src/lib/payments/confirm-paid-order-inventory.test.ts`
- `apps/web/src/app/api/payments/webhook/route.ts`
- `apps/web/src/app/api/payments/webhook/route.test.ts`
- `apps/web/src/app/api/payments/initialize/route.ts`
- `apps/web/src/app/api/payments/initialize/route.test.ts`
- `apps/web/src/schemas/payment-initialize.ts`
- `apps/web/src/schemas/payment-initialize.test.ts`
- `apps/web/src/schemas/order-dva-customer-consent.ts`
- `apps/web/src/schemas/order-dva-customer-consent.test.ts`
- `apps/web/src/lib/supabase/request-scoped-payment-client.ts`
- `apps/web/src/lib/supabase/request-scoped-payment-client.test.ts`
- `apps/web/src/lib/payments/get-payment-initialize-context.ts`
- `apps/web/src/lib/payments/get-payment-initialize-context.test.ts`
- `apps/web/src/lib/payments/persist-initialized-gateway-payment.ts`
- `apps/web/src/lib/payments/persist-initialized-gateway-payment.test.ts`
- `apps/web/src/lib/payments/order-dva-customer-consent.ts`
- `apps/web/src/lib/payments/order-dva-customer-consent.test.ts`
- `apps/web/src/lib/payments/get-renderable-order-dvas.ts`
- `apps/web/src/lib/payments/get-renderable-order-dvas.test.ts`
- `apps/web/src/schemas/order-dva-render-projection.ts`
- `apps/web/src/schemas/order-dva-render-projection.test.ts`
- `apps/web/src/lib/payments/order-dva-presentation-contract.test.ts`
- `apps/web/src/lib/payments/order-dva-consent-link.ts`
- `apps/web/src/lib/payments/order-dva-consent-link.test.ts`
- `apps/web/src/components/storefront/ogabassey/pages/checkout/hooks/use-dva-payment.ts`
- `apps/web/src/components/storefront/ogabassey/pages/checkout/hooks/use-dva-payment.test.ts`
- `apps/web/src/lib/agentic/agentic-paystack-dva-mode.ts`
- `apps/web/src/lib/agentic/agentic-paystack-dva-mode.test.ts`
- `apps/web/src/lib/agentic/agentic-dva-caller-contract.test.ts`
- `apps/web/src/lib/agentic/agent-commerce-manifest.ts`
- `apps/web/src/lib/agentic/agent-commerce-manifest.test.ts`
- `apps/web/src/lib/agentic/ucp-discovery-profile.ts`
- `apps/web/src/lib/agentic/ucp-discovery-profile-payment.test.ts`
- `apps/web/src/app/agent-commerce.json/route-checkout-capabilities.test.ts`
- `apps/web/src/app/.well-known/acp.json/route.test.ts`
- `apps/web/src/app/.well-known/agent-native-commerce/route.test.ts`
- `apps/web/src/app/.well-known/ucp/route.test.ts`
- `apps/web/src/app/openapi.json/route.ts`
- `apps/web/src/app/openapi.json/route.test.ts`
- `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/checkout-session-complete-handler.ts`
- `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.test.ts`
- `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route-payment-state.test.ts`
- `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route-payment-account-resume.test.ts`
- `apps/web/src/lib/agentic/checkout-payment-setup.ts`
- `apps/web/src/lib/agentic/checkout-payment-setup.test.ts`
- `apps/web/src/lib/agentic/checkout-payment-setup-authorization.test.ts`
- `apps/web/src/lib/agentic/checkout-payment-account.ts`
- `apps/web/src/lib/agentic/checkout-payment-account.test.ts`
- `apps/web/src/lib/agentic/checkout-completion-response.ts`
- `apps/web/src/lib/agentic/checkout-completion-response.test.ts`
- `apps/web/src/scripts/audit-agentic-dva-consent-cutover.ts`
- `apps/web/src/scripts/audit-agentic-dva-consent-cutover.test.ts`
- `apps/web/src/scripts/drain-agentic-dva-consent-cutover.ts`
- `apps/web/src/scripts/drain-agentic-dva-consent-cutover.test.ts`
- `apps/web/src/app/auth/bank-transfer-consent/[orderId]/page.tsx`
- `apps/web/src/app/auth/bank-transfer-consent/[orderId]/page.test.tsx`
- `apps/web/src/app/auth/bank-transfer-consent/[orderId]/bank-transfer-consent-client.tsx`
- `apps/web/src/app/auth/bank-transfer-consent/[orderId]/bank-transfer-consent-client.test.tsx`
- `apps/web/src/app/auth/bank-transfer-consent/[orderId]/action/route.ts`
- `apps/web/src/app/auth/bank-transfer-consent/[orderId]/action/route.test.ts`
- `apps/web/src/app/root-dynamic-body.tsx`
- `apps/web/src/app/root-dynamic-body.test.tsx`
- `apps/web/src/proxy.test.ts` (regression coverage only; no `proxy.ts` change)
- `apps/web/src/app/api/cron/cleanup-order-dva-consent-challenges/route.ts`
- `apps/web/src/app/api/cron/cleanup-order-dva-consent-challenges/route.test.ts`
- `apps/web/src/lib/email-templates/order-confirmation.ts`
- `apps/web/src/lib/email-templates/order-confirmation.test.ts`
- `apps/web/src/lib/email-templates/order-dva-consent-challenge.ts`
- `apps/web/src/lib/email-templates/order-dva-consent-challenge.test.ts`
- `apps/web/src/lib/zeptomail-consent.ts`
- `apps/web/src/lib/zeptomail-consent.test.ts`
- `apps/web/src/lib/zeptomail.ts`
- `apps/web/src/lib/zeptomail.test.ts`
- `apps/web/src/app/api/orders/[id]/generate-dva/route.ts`
- `apps/web/src/app/api/orders/[id]/generate-dva/route.test.ts`
- `apps/web/src/app/api/orders/[id]/ship-on-credit/route.ts`
- `apps/web/src/app/api/orders/[id]/ship-on-credit/route.test.ts`
- `apps/web/src/app/api/orders/route.ts`
- `apps/web/src/app/api/orders/route.test.ts`
- `apps/web/src/app/api/orders/[id]/route.ts`
- `apps/web/src/app/api/orders/[id]/route.test.ts`
- `apps/web/src/lib/orders/order-terminalization-contract.ts`
- `apps/web/src/lib/orders/order-terminalization-contract.test.ts`
- `apps/web/src/app/api/storefront/account/orders/[id]/cancel/route.ts`
- `apps/web/src/app/api/storefront/account/orders/[id]/cancel/route.test.ts`
- `apps/web/src/ai/chat-order-cancellation.ts`
- `apps/web/src/ai/chat-order-cancellation.test.ts`
- `apps/web/src/lib/agentic/checkout-order-dispatch.ts`
- `apps/web/src/lib/agentic/checkout-order-dispatch-cancel.test.ts`
- `apps/web/src/app/api/shipping/cancel/[shipmentId]/route.ts`
- `apps/web/src/app/api/shipping/cancel/[shipmentId]/route.test.ts`
- `apps/web/src/schemas/provider-shipment-cancellation.ts`
- `apps/web/src/schemas/provider-shipment-cancellation.test.ts`
- `apps/web/src/lib/shipping/provider-shipment-cancellation.ts`
- `apps/web/src/lib/shipping/provider-shipment-cancellation.test.ts`
- `apps/web/src/lib/shipping/reconcile-provider-shipment-cancellations.ts`
- `apps/web/src/lib/shipping/reconcile-provider-shipment-cancellations.test.ts`
- `apps/web/src/scripts/resolve-provider-shipment-cancellation.ts` and its
  tests
- `apps/web/src/app/api/cron/reconcile-gateway-paid-orders/route.ts`
- `apps/web/src/app/api/cron/reconcile-gateway-paid-orders/route.test.ts`
- `apps/web/src/app/api/shipping/webhooks/[provider]/route.ts`
- `apps/web/src/app/api/shipping/webhooks/[provider]/route.test.ts`
- `apps/web/src/app/api/shipping/track/[trackingNumber]/route.ts`
- `apps/web/src/app/api/shipping/track/[trackingNumber]/route.test.ts`
- `apps/web/src/app/api/cron/cleanup-orders/route.ts`
- `apps/web/src/app/api/cron/cleanup-orders/route.test.ts`
- `apps/web/src/schemas/abandoned-order-cleanup-result.ts`
- `apps/web/src/schemas/abandoned-order-cleanup-result.test.ts`
- `apps/web/src/schemas/abandoned-order-cleanup-claim.ts`
- `apps/web/src/schemas/abandoned-order-cleanup-claim.test.ts`
- `apps/web/src/schemas/abandoned-order-terminalization.ts`
- `apps/web/src/schemas/abandoned-order-terminalization.test.ts`
- `apps/web/src/schemas/abandoned-order-cleanup-work-state.ts`
- `apps/web/src/schemas/abandoned-order-cleanup-work-state.test.ts`
- `apps/web/src/schemas/customer-order-cancellation-result.ts`
- `apps/web/src/schemas/customer-order-cancellation-result.test.ts`
- `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`
- `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx`
- `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.ts`
- `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts`
- `apps/web/src/components/storefront/ogabassey/pages/checkout/handlers/place-order.ts`
- `apps/web/src/components/storefront/ogabassey/pages/checkout/handlers/place-order.test.ts`
- `apps/web/src/app/api/orders/reuse/route.ts`
- `apps/web/src/app/api/orders/reuse/route.test.ts`
- `apps/web/src/app/api/orders/[id]/invoice/route.ts` and its test
- `apps/web/src/app/api/orders/[id]/reminder/route.ts` and its test
- `apps/web/src/app/api/storefront/orders/route.ts` and its test
- `apps/web/src/app/api/storefront/orders/[id]/route.ts` and its test
- `apps/web/src/lib/storefront-account-document-data.ts` and its test
- `apps/web/src/app/api/storefront/account/orders/[id]/route.ts` and its test
- `apps/web/src/app/api/storefront/account/orders/[id]/invoice/route.ts` and its
  test
- `apps/web/src/app/api/storefront/account/orders/[id]/receipt/route.ts` and its
  test
- `apps/web/src/lib/payments/apply-paid-order-side-effects.ts`
- `apps/web/src/lib/payments/apply-paid-order-side-effects.test.ts`
- `apps/web/src/lib/payments/apply-paid-order-side-effects-internals.ts`
- `apps/web/src/lib/payments/apply-paid-order-side-effects-internals.test.ts`
- `apps/web/src/schemas/payment-side-effect-claim.ts`
- `apps/web/src/schemas/payment-side-effect-claim.test.ts`
- `apps/web/src/lib/payments/file-paid-order-side-effect-claim-conflict.ts`
- `apps/web/src/lib/payments/file-paid-order-side-effect-claim-conflict.test.ts`
- `apps/web/src/lib/payments/run-paid-order-side-effects.ts`
- `apps/web/src/lib/payments/run-paid-order-side-effects.test.ts`
- `apps/web/src/lib/payments/paid-order-settlement-executor.ts`
- `apps/web/src/lib/payments/paid-order-settlement-executor.test.ts`
- `apps/web/src/lib/payments/paid-order-settlement-executor.juicyway.test.ts`
- `apps/web/src/lib/payments/settle-captured-order-payment.ts`
- `apps/web/src/lib/payments/settle-captured-order-payment.test.ts`
- `apps/web/src/lib/payments/record-order-gateway-settlement.ts`
- `apps/web/src/lib/payments/record-order-gateway-settlement.test.ts`
- `apps/web/src/schemas/order-gateway-settlement.ts`
- `apps/web/src/schemas/order-gateway-settlement.test.ts`
- `apps/web/src/lib/payments/paid-order-merchant-push-policy.ts`
- `apps/web/src/lib/payments/paid-order-merchant-push-policy.test.ts`
- `apps/web/src/lib/payments/merchant-new-order-push-owner.ts`
- `apps/web/src/lib/payments/merchant-new-order-push-owner.test.ts`
- `apps/web/src/lib/payments/paid-order-rich-select.ts`
- `apps/web/src/lib/payments/paid-order-rich-select.test.ts`
- `apps/web/src/lib/payments/paid-order-side-effect-types.ts`
- `apps/web/src/lib/payments/paid-order-retry-persistence.ts`
- `apps/web/src/lib/payments/paid-order-retry-persistence.test.ts`
- `apps/web/src/lib/payments/persist-pre-push-retry-markers.ts`
- `apps/web/src/lib/payments/persist-pre-push-retry-markers.test.ts`
- `apps/web/src/lib/payments/wallet-funded-order-side-effects.ts`
- `apps/web/src/lib/payments/wallet-funded-order-side-effects.test.ts`
- `apps/web/src/lib/payments/internal-credit-paid-order-side-effects.ts`
- `apps/web/src/lib/payments/internal-credit-paid-order-side-effects.test.ts`
- `apps/web/src/lib/payments/internal-credit-checkout-intent.ts`
- `apps/web/src/lib/payments/internal-credit-checkout-intent.test.ts`
- `apps/web/src/lib/payments/internal-credit-gateway-initialization.ts`
- `apps/web/src/lib/payments/internal-credit-gateway-initialization.test.ts`
- `apps/web/src/schemas/internal-credit-checkout-replay.ts`
- `apps/web/src/schemas/internal-credit-checkout-replay.test.ts`
- `apps/web/src/schemas/internal-credit-payment-finalization.ts`
- `apps/web/src/schemas/internal-credit-payment-finalization.test.ts`
- `apps/web/src/lib/payments/paid-order-new-order-push-executor.ts`
- `apps/web/src/lib/payments/paid-order-new-order-push-executor.test.ts`
- `apps/web/src/lib/payments/paid-order-payment-received-push-executor.ts`
- `apps/web/src/lib/payments/paid-order-payment-received-push-executor.test.ts`
- `apps/web/src/lib/payments/replayable-paid-order-side-effect-steps.ts`
- `apps/web/src/lib/payments/notify-paid-order.ts`
- `apps/web/src/lib/payments/notify-paid-order.test.ts`
- `apps/web/src/lib/payments/payment-reconciliation-alerts.ts`
- `apps/web/src/lib/payments/payment-reconciliation-alerts.test.ts`
- `apps/web/src/lib/payments/drain-payment-reconciliation-alerts.ts`
- `apps/web/src/lib/payments/drain-payment-reconciliation-alerts.test.ts`
- `apps/web/src/lib/expo-push.ts`
- `apps/web/src/lib/expo-push.test.ts`
- `apps/web/src/app/api/cron/process-payment-reconciliation-alerts/route.ts`
- `apps/web/src/app/api/cron/process-payment-reconciliation-alerts/route.test.ts`
- `apps/web/src/scripts/classify-legacy-order-notification-owners.ts` and its
  tests
- `apps/web/src/scripts/classify-legacy-order-inventory-allocations.ts` and its
  tests
- `apps/web/src/scripts/audit-internal-credit-cancelled-orders.ts` and its
  tests
- `apps/web/src/scripts/activate-internal-credit-checkout.ts` and its
  tests
- `apps/web/src/scripts/verify-production-release-attestation.ts` and its tests
- `.github/workflows/deploy.yml`
- `apps/web/next.config.ts`
- `apps/web/src/config/release-build-attestation.ts`
- `apps/web/src/config/release-build-attestation.test.ts`
- `apps/web/src/lib/release/canonical-release-identity.ts`
- `apps/web/src/lib/release/canonical-release-identity.test.ts`
- `apps/web/src/schemas/internal-release-attestation.ts`
- `apps/web/src/schemas/internal-release-attestation.test.ts`
- `apps/web/src/app/api/internal/release-attestation/route.ts`
- `apps/web/src/app/api/internal/release-attestation/route.test.ts`
- `apps/web/src/scripts/pause-internal-credit-checkout.ts` and its tests
- `apps/web/src/scripts/configure-payment-orchestration-rpc-secret.ts` and its
  tests
- `apps/web/src/scripts/audit-order-payment-account-contract.ts` and its tests
- `apps/web/src/scripts/audit-paystack-reference-roles.ts` and its tests
- `apps/web/src/lib/payments/paystack-historical-incident-evidence.ts`
- `apps/web/src/lib/payments/paystack-historical-incident-evidence.test.ts`
- `apps/web/src/schemas/paystack-historical-incident-evidence.ts`
- `apps/web/src/schemas/paystack-historical-incident-evidence.test.ts`
- `apps/web/src/lib/payments/payment-audit-report.ts`
- `apps/web/src/lib/payments/payment-audit-report.test.ts`
- `apps/web/src/schemas/payment-audit-report.ts`
- `apps/web/src/schemas/payment-audit-report.test.ts`
- `apps/web/src/scripts/verify-payment-audit-report.ts`
- `apps/web/src/scripts/verify-payment-audit-report.test.ts`
- `apps/web/src/scripts/reconcile-paystack-dva.ts` and its evidence-only,
  record-evidence-outcome, stale-report, and recovery tests
- `apps/web/src/lib/import-commit/commit-bumpa-orders.ts` and its tests
- `apps/web/src/lib/jumia/order-sync-operations.ts` and its tests
- `apps/web/src/lib/jumia/order-sync-mappers.ts` and its tests
- `apps/web/src/env.ts`, `apps/web/src/env.test.ts`, and `vercel.json`
- `apps/web/src/types/supabase.ts`
- `apps/web/src/lib/agentic/storefront-order-rpc-contract.test.ts`
- `apps/web/src/lib/internal-credit-checkout-control-migration.test.ts`
- `apps/web/src/lib/provider-cancellation-saga-preparation-migration.test.ts`
- `apps/web/src/lib/internal-credit-checkout-fence-migration.test.ts`
- `apps/web/src/lib/order-abandonment-candidate-index-migration.test.ts`
- `apps/web/src/lib/internal-credit-terminalization-contract.test.ts`
- `apps/web/src/lib/internal-credit-terminal-write-surface.test.ts`
- `apps/web/src/lib/order-inventory-allocation-contract.test.ts`
- `apps/web/src/lib/order-notification-owner-expand-migration.test.ts`
- `apps/web/src/lib/order-notification-owner-contract-migration.test.ts`
- `apps/web/src/lib/order-notification-owner-insert-surface.test.ts`
- `apps/web/src/lib/invoice-dva-late-payment-matching-migration.test.ts`
- `apps/web/src/lib/paystack-external-reference-index-migration.test.ts`
- `apps/web/src/lib/order-payment-account-contract-enforcement-migration.test.ts`
- `apps/web/src/lib/payments/late-payment-migration-manifest.ts`
- `apps/web/src/lib/payments/late-payment-migration-manifest.test.ts`
- `apps/web/src/lib/payments/late-payment-migration-release.ts`
- `apps/web/src/lib/payments/late-payment-migration-release.test.ts`
- `apps/web/src/lib/payments/late-payment-deploy-release-shape.test.ts`
- `apps/web/tools/db/invoice-dva-late-payment-replay-extensions.ts`
- `apps/web/tools/db/invoice-dva-late-payment-replay-extensions.test.ts`
- `apps/web/tools/db/invoice-dva-late-payment-effect-scope.ts`
- `apps/web/tools/db/invoice-dva-late-payment-effect-scope.test.ts`
- `apps/web/tools/db/verify-supabase-post-base-extensions.ts`
- `apps/web/tools/db/verify-supabase-post-base-extensions.test.ts`
- `apps/web/tools/db/late-payment-phase-tree-receipt.ts`
- `apps/web/tools/db/late-payment-phase-tree-receipt.test.ts`
- `apps/web/tools/db/read-late-payment-phase-git-diff.ts`
- `apps/web/tools/db/read-late-payment-phase-git-diff.test.ts`
- `apps/web/tools/db/late-payment-phase-path-policy.ts`
- `apps/web/tools/db/late-payment-phase-path-policy.test.ts`
- `apps/web/tools/db/late-payment-production-target.ts`
- `apps/web/tools/db/late-payment-production-target.test.ts`
- `apps/web/tools/db/github-actions-log-retention.ts`
- `apps/web/tools/db/github-actions-log-retention.test.ts`
- `apps/web/tools/db/rerun-late-payment-phase-deployment.ts`
- `apps/web/tools/db/rerun-late-payment-phase-deployment.test.ts`
- `apps/web/tools/db/verify-late-payment-pr.ts`
- `apps/web/tools/db/verify-late-payment-pr.test.ts`
- `apps/web/tools/db/verify-late-payment-phase-receipts.ts`
- `apps/web/tools/db/verify-late-payment-phase-receipts.test.ts`
- `apps/web/tools/db/capture-supabase-history-ledger.ts`
- `apps/web/tools/db/capture-supabase-history-ledger.test.ts`
- `apps/web/tools/db/capture-supabase-history-ledger-boundaries.test.ts`
- `apps/web/tools/db/capture-late-payment-phase-deployment.ts`
- `apps/web/tools/db/capture-late-payment-phase-deployment.test.ts`
- `apps/web/tools/db/capture-late-payment-replay-scope.ts`
- `apps/web/tools/db/capture-late-payment-replay-scope.test.ts`
- `apps/web/tools/db/verify-late-payment-replay-scope-receipt.ts`
- `apps/web/tools/db/verify-late-payment-replay-scope-receipt.test.ts`
- `apps/web/tools/db/verify-late-payment-replay-scope.ts`
- `apps/web/tools/db/verify-late-payment-replay-scope.test.ts`
- `apps/web/tools/db/schemas/late-payment-phase-candidate-receipt-schema.ts`
- `apps/web/tools/db/schemas/late-payment-phase-candidate-receipt-schema.test.ts`
- `apps/web/tools/db/schemas/late-payment-phase-deployment-receipt-schema.ts`
- `apps/web/tools/db/schemas/late-payment-phase-deployment-receipt-schema.test.ts`
- `apps/web/tools/db/schemas/late-payment-replay-scope-receipt-schema.ts`
- `apps/web/tools/db/schemas/late-payment-replay-scope-receipt-schema.test.ts`
- `apps/web/tools/db/supabase-history-replay-manifest.ts`
- `apps/web/tools/db/supabase-history-replay-manifest.test.ts`
- `apps/web/tools/db/supabase-history-replay-types.ts`
- `apps/web/tools/db/verify-supabase-history-replay-manifest.ts`
- `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`
- `apps/web/tools/db/materialize-supabase-history-replay.ts`
- `apps/web/tools/db/materialize-supabase-history-replay.test.ts`
- `apps/web/tools/db/supabase-history-effects.sql`
- `apps/web/tools/db/build-supabase-history-effect-query.ts`
- `apps/web/tools/db/build-supabase-history-effect-query.test.ts`
- `apps/web/tools/db/supabase-history-effect-query-contract.ts`
- `apps/web/tools/db/supabase-history-effect-query-contract.test.ts`
- `apps/web/tools/db/supabase-history-effect-scope.ts`
- `apps/web/tools/db/supabase-history-effect-scope.test.ts`
- `apps/web/tools/db/read-supabase-history-effects.ts`
- `apps/web/tools/db/read-supabase-history-effects.test.ts`
- `apps/web/tools/db/read-supabase-history-effects-comparison.test.ts`
- `apps/web/tools/db/run-replay-command.ts`
- `apps/web/tools/db/run-replay-command.test.ts`
- `apps/web/tools/db/run-replay-command-effects.test.ts`
- `apps/web/tools/db/run-production-old-cancellation-proof.ts`
- `apps/web/tools/db/run-production-old-cancellation-proof.test.ts`
- `apps/web/tools/db/replay-module-boundaries.test.ts`
- `apps/web/tools/db/supabase-history-effects.test.ts`
- `apps/web/tools/db/validate-supabase-history-effect-components.ts`
- `apps/web/tools/db/validate-supabase-history-effect-components.test.ts`
- `apps/web/tools/db/summarize-supabase-history-effects.ts`
- `apps/web/tools/db/summarize-supabase-history-effects.test.ts`
- `apps/web/tools/db/summarize-supabase-history-effects-fail-closed.test.ts`
- `apps/web/tools/db/supabase-history-effect-test-fixture.ts`
- `apps/web/tools/db/supabase-history-effect-test-fixture.test.ts`
- `apps/web/tools/db/schemas/supabase-history-effect-component-schema.ts`
- `apps/web/tools/db/schemas/supabase-history-effect-component-schema.test.ts`
- `apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.ts`
- `apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.test.ts`
- `apps/web/tools/db/schemas/production-history-effects-schema.ts`
- `apps/web/tools/db/schemas/production-history-effects-schema.test.ts`
- `apps/web/tools/db/schemas/linked-migration-ledger-schema.ts`
- `apps/web/tools/db/schemas/linked-migration-ledger-schema.test.ts`
- `apps/web/tools/db/schemas/build-linked-migration-ledger-schema.ts`
- `apps/web/tools/db/schemas/build-linked-migration-ledger-schema.test.ts`
- `apps/web/tools/db/schemas/production-effect-provenance-schema.ts`
- `apps/web/tools/db/schemas/production-effect-provenance-schema.test.ts`
- `apps/web/tools/db/schemas/build-production-effect-provenance-schema.ts`
- `apps/web/tools/db/schemas/build-production-effect-provenance-schema.test.ts`
- `apps/web/tools/db/task8-post-deploy-schema-contracts.test.ts`
- `apps/web/tools/db/supabase-history-post-deploy-receipt.ts`
- `apps/web/tools/db/supabase-history-post-deploy-receipt.test.ts`
- `apps/web/tools/db/fixtures/linked-migration-ledger.json`
- `apps/web/tools/db/fixtures/production-history-effects.json`
- `apps/web/tools/db/fixtures/production-effect-provenance.json`
- `docs/architecture/invoice-dva-late-payment-replay/replay-scope.json`
- `docs/architecture/invoice-dva-late-payment-replay/preparation-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/preparation-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/fence-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/fence-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/abandonment-index-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/abandonment-index-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/owner-expand-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/owner-expand-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/contract-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/contract-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/reference-index-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/reference-index-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/enforcement-candidate.json`
- `docs/architecture/invoice-dva-late-payment-replay/enforcement-deployment.json`
- `docs/architecture/invoice-dva-late-payment-replay/final-production.json`

### Migration modularity and oversized-function adapters

The manifest below is the implementation contract, not a placeholder list.
Every file has one primary concern and remains at or below 300 physical lines
without minification. Existing oversized SQL functions are not copied into a
single replacement migration. The applicable preparation or fence module uses
`ALTER FUNCTION ... RENAME TO ..._inner_v1`, revokes every runtime execute grant
from the renamed inner, and installs a short security-definer adapter under the
publicly supported signature. Only the adapter receives caller grants. Its
effective database owner may invoke the ungranted inner after authorization and
fence checks.

The owner-expand adapters use the same pattern rather than rewriting the current
825-line storefront function or 319-line item-replacement function in one file:

- a private one-shot order-creation authorization binds the current transaction,
  merchant/customer/idempotency identity, creation function, and selected
  notification owner; the order insert trigger consumes it and stamps the owner;
- after a legacy inner returns, the adapter invokes the allocation-capture helper
  before commit. That helper locks and validates the returned order/items and
  exact serialized reservations or aggregate action, stamps unit/event linkage,
  and appends immutable allocation evidence. Failure rolls back the inner's order
  and stock work;
- idempotent replay consumes no new creation authorization and instead validates
  the stored owner/allocation contract before returning it;
- item-replacement adapters unwind selected old allocations before invoking the
  renamed inner, capture the new allocations afterward, and mint terminal
  authorization only after any terminal patch has passed compensation and
  order-level unwind; and
- final contract adapters add the trailing checkout-intent argument and final
  return fields around versioned private helpers. They never duplicate the
  legacy body merely to change a row type.

No adapter may use a caller-set GUC or a generally executable helper as proof.
Migration tests exercise each renamed inner plus adapter on its actual current
signature, assert that runtime roles cannot invoke the inner, and prove the
wrapper and all work it delegates commit or roll back atomically. If any listed
file still exceeds 300 lines during implementation, the specification and the
single manifest source must be revised with another named responsibility before
the migration is written; an unlisted implementation-time file is not allowed.

### Phase-aware migration and replay manifests

The complete 74-file catalog and the set of files materialized in the current
release are different contracts. `late-payment-migration-manifest.ts` owns the
complete ordered catalog, with each entry's filename, release phase,
transactional/concurrent kind, and optional final gate. It never claims that a
future file already exists. `late-payment-migration-release.ts` exports
`materializedThrough`, initially null and then exactly one phase from this
closed sequence:

1. `preparation`
2. `fence`
3. `abandonment_index`
4. `owner_expand`
5. `contract`
6. `paystack_reference_index`
7. `enforcement`

The reviewed reserved lane is the complete ordered interval
`20260719115600..20260719120220`. It was originally allocated against
`origin/main = fb6c7570ac1a0897efb9890db6b9992410c5eb7a` and has now been
rechecked against source `origin/main =
ac2564ff1ba76ecc179fda9ebedeb91d5b571936`. The intervening `ac2564ff1b`
delta adds the tools/worker TypeScript project to the web quality gate and
rotates the governed event-pipeline authority baseline; it changes no payment
runtime or migration. The preparation implementation must retain that expanded
`pnpm turbo typecheck` surface rather than restoring the prior web-only script.
The repository migration tail and
production ledger tail remain
`20260718070011_require_credit_direct_guest_tracking_token`. Successful source
deployment run `29683395832` is the current canonical healthy-application
receipt for `a332a978`: migration job `88183438860` reverified the complete
ledger with `0 applied, 439 skipped` through that same tail, and production job
`88183457147` deployed successfully, promoted the release, verified five
storefront HTML canaries, and passed the blog smoke checks. Prior successful
run `29676236659`, migration job `88164086530`, remains historical evidence for
the earlier `fb6c7570` baseline. At the 2026-07-19 rereview, source run
`29699896434` for `3aba670` completed its no-op migration job successfully and
built, deployed, and promoted the Vercel release, but production job
`88227082330` then failed the required `Purge and verify storefront release
HTML` step because Cloudflare purge returned HTTP `401`, code `10000`,
`Authentication error`. It is therefore not a healthy-application receipt and
cannot supersede `29683395832`, even though the production alias may already
point at its promoted artifact. Source run `29702227893` for current
`ac2564ff1b` was still in progress at implementation bootstrap and therefore
was not accepted as a healthy receipt. Bootstrap
capture may use whichever newer receipt exists only after a fresh read proves
its exact `main` SHA, completed production deployment, migration tail,
production alias, and health; otherwise refresh the evidence or stop. These ids
are review evidence, not future caller inputs.
No feature migration may retain the former `20260716*` version. This ordering is
semantic, not cosmetic: the already-deployed July 18 Credit Direct migrations
recreate `reconciliation_review_issue_type_check`; applying this feature after
them in production but before them in a clean lexical replay would erase new
review types and make replay diverge from production.

Immediately before the guardian source policy is frozen, trusted capture reads
both the fresh `origin/main` migration tree and production
`supabase_migrations.schema_migrations` and requires every version to be less
than `20260719115600`, with exact repository/production name reconciliation. If
either tail reaches or passes the reserved start, stop before any bootstrap PR:
move **all 74** still-unmaterialized entries as one mechanical unit to one new
contiguous lane strictly after both tails while preserving their relative
version gaps and phase order, then regenerate every path-bearing design entry,
manifest, test fixture, expected hash, replay-scope receipt input, and guardian
policy byte. Renumbering one phase/file independently, retaining a mixed old/new
lane, or reallocating after the signed bootstrap receipt is forbidden and
requires restarting the bootstrap review.

Before the preparation migration PR, a no-migration replay-scope PR introduces
the complete catalog with `materializedThrough = null`, the extension verifier,
and an additive baseline-aware effect scope for every table, column, constraint,
index, trigger, policy, grant, and exact function signature this design creates
or replaces, plus deterministic contract-state singleton rows and migration
cutoffs represented only by bounded canonical state/counts. Generated
timestamps, UUIDs, actors, and environment-specific values are reduced to
typed null/presence markers; only deterministic state labels, versions, and
contract booleans owned immutably by migrations enter the effect digest.
Mutable checkout readiness/generation, operational audit decisions, and
payment/customer rows are excluded and remain rollout/RPC audit gates. Each identity
records either an explicit absence marker or its exact pre-feature
definition/ACL/state digest. It preserves every existing scoped component,
bumps the fixture schema to `3` and scope version to
`baci-p0-invoice-dva-effects-v4`, and treats removal or digest drift of any
pre-existing component as failure. It refreshes the reviewed query hash, scope
manifest/count, production-effects fixture, and `replay-scope.json` from the
management API's
read-only endpoint while every feature migration is still absent. Both normal
replays must converge in `enforce`. This creates the comparison baseline before
any feature SQL can change production; adding the scope in the same PR as the
first migration is forbidden.

The effect-scope PR must make that scope executable without growing or
minifying the current 299-line `supabase-history-effects.sql`. Those exact bytes
remain the historical base query and retain a separate `baseQuerySha256`.
`build-supabase-history-effect-query.ts` validates and canonically serializes
the typed feature identity manifest, wraps the base query as a CTE, and appends
one generic catalog/state query that left-joins every declared identity. The
outer query preserves the existing 76 base component objects byte-for-byte,
adds exactly one sorted feature component per manifest identity, and emits a
typed `present: false` component when the table, column, constraint, index,
trigger, policy, grant, function signature, or singleton row is absent. An
identity collision, duplicate output, missing output, unsafe serialized value,
or output outside the manifest fails closed. The builder accepts only the
checked-in base SQL and checked manifest; callers cannot append arbitrary SQL.

`supabase-history-effect-query-contract.ts` binds the base-query hash, generic
feature-template hash, feature-scope-manifest hash/count, and final composed
query hash. Capture and both replay modes execute and hash only that composed
query. `capture-supabase-history-ledger.ts` no longer passes the raw file
directly to `readSupabaseHistoryEffects`; it reads the base bytes, invokes the
builder, and passes the effective bytes and composed hash. Scope/component
schemas and summaries accept the frozen 76-component base plus the exact
feature extension while continuing to reject unknown, duplicate, reordered,
or omitted components. Tests prove the current 76 component bytes and digests
are unchanged, every pre-feature identity produces one absence/baseline row,
every planned migration changes only its allowed rows, and no TypeScript or SQL
source exceeds the repository's 300-line limit.

The production-old cancellation proof is the sole deliberate raw-query
consumer. It remains bound to `baseQuerySha256`, the frozen v3 scope, and the
same 76-component validator branch because it proves a historical overlay, not
the current feature baseline. The snapshot/component schemas become an exact
scope-version discriminated union: v3 accepts only the frozen base identities;
v4 requires the same base identities plus every feature identity. Normal
capture and `run-replay-command.ts` must use v4/composed bytes, while
`run-production-old-cancellation-proof.ts` must use v3/base bytes; either path
crossing those contracts fails. Its evidence fixture and cancellation digest
remain unchanged. `replay-module-boundaries.test.ts` adds every new builder,
scope, factory, and schema module to its checked manifest, refreshes that
manifest digest deliberately, and continues enforcing the 300-line boundary.

The same replay-scope PR removes the live-ledger literals from the reusable P0
schemas without weakening their evidence. `buildLinkedMigrationLedgerSchema`
and `buildProductionEffectProvenanceSchema` accept a strictly validated expected
post-deploy receipt; the normal exported schemas are factory instances built
from the checked-in `supabaseHistoryPostDeployReceipt`. The linked-ledger
factory binds the current row count, tail, local file count, and local unique
version count. The provenance factory parameterizes only
`linkedLedger.receipt`; `linkedLedger.historicalReplay`, base SHA, historical
row count `439`, historical tail `20260714225500`, exceptional records, and
their provenance remain literal and immutable. During capture, the tool derives
the next receipt from read-only live evidence, constructs both schemas with
those derived values, validates the complete candidate bytes in memory, and
only then atomically replaces the receipt and fixtures. Consequently each
post-deploy receipt PR changes receipt/fixture/manifest data but not schema
source. Tests model at least two successive phase receipts and prove that stale
counts/tails, attempts to parameterize historical replay, or mixed old/new
receipt bytes fail.

The preparation migration PR then advances `materializedThrough` to
`preparation`. Every later migration PR advances it exactly once. The
phase-aware test requires every catalog entry through that phase to exist,
requires every later catalog entry to be absent, rejects an unlisted file in
the reserved timestamp lane, checks the present prefix's order and 300-line
cap, and verifies that only the last file in a transactional bundle advances
its state. The final enforcement phase is the first point at which all 74 files
must be present. A future filename appearing early is a failure, not a missing
file to be tolerated.

The replay system's last fully evidenced base snapshot at `origin/main`
`fb6c7570ac1a0897efb9890db6b9992410c5eb7a` freezes a base SHA, historical
production mappings, exceptional provenance, semantic GitHub-log evidence,
forward-repair deployment receipt, linked-ledger fixture, production-effects
fixture, and post-deploy inventory receipt. Its real-workspace Vitest rejects
any unregistered top-level migration. Current source `main` is `ac2564f`; the
payment-specific Juicyway finalizer drift and last completed healthy deployment
receipt from `a332a978` are incorporated into this design. The intervening
`3aba670` durable-event-pipeline modularization and `ac2564f` tools/worker
typecheck follow-up leave
`paid-order-ad-tracking-executor.ts`, its `enqueue_only` plus legacy-scheduling
contract, and the shared paid-order finalizer byte-identical to `a332a978`; this
feature must preserve that boundary rather than inventing another conversion
delivery path. Implementation must still re-read production, rebase onto the
then-current `origin/main`, and repeat this inventory; it must not weaken,
replace, retarget, or silently regenerate any frozen historical byte, mapping,
relation, repair receipt, or evidence source.
The refreshed root scope must include all July 18 Credit Direct migrations and
their deployed constraint/function effects as historical predecessor state. In
particular it must prove that the feature alert-schema migration extends the
live `reconciliation_review_issue_type_check` rather than replaying an older
allowlist, and that clean chronological replay and production-tail application
end with the same exact constraint digest.

`invoice-dva-late-payment-replay-extensions.ts` imports the complete catalog
and current materialization phase and stores an exact lowercase SHA-256 only for
the materialized prefix. `verify-supabase-post-base-extensions.ts` verifies
those current-tree bytes and returns ordinary replay sources with receipt ids
prefixed `post-base:`. The global verifier's current-tree registry becomes
exactly frozen base plus existing repair/forward-repair files plus that checked
prefix. `VerifiedReplayManifest` carries these as a separate
`postBaseSources` collection; they never enter the historical
`expectedSourceHashes`, exceptional provenance, or forward-repair arrays.
Chronological and production-effect materializers append the extension
prefix after the existing forward repairs, because all versions are later and
canonical; the historical production-version count and topological graph stay
unchanged. No feature migration may be inserted into historical exceptional
provenance. Tests reject a missing/extra extension, hash mismatch, future-phase
hash, changed frozen byte, changed historical count/order, or attempt to label a
feature migration as a repair or exceptional mapping.

`replay-scope.json` is the strict root receipt for this release chain, not an
untyped note. Its dedicated Zod schema fixes `schemaVersion = 1`,
`kind = 'replay_scope'`, `environment = 'production'`, the trusted production
project-ref hash, exact pre-PR base SHA,
`materializedThrough = null`, and the same canonical complete Git-diff tree
receipt used below with only `replay-scope.json` itself omitted. It also binds
the current P0 post-deploy receipt, linked-ledger, production-effects,
provenance, replay-manifest, post-base extension, base-query, composed-query,
feature-template, feature-scope manifest/count, v3 base effect, and v4
absence-baseline hashes. It asserts that all 74 feature migrations are absent,
no reserved-lane migration or unregistered top-level migration exists, both
normal replay modes converge in `enforce`, and the production v4 baseline was
captured through the read-only management path before any feature migration.

`late-payment-production-target.ts` is the one checked target-authority helper.
It requires `SUPABASE_PROJECT_REF` from the production process environment,
validates the repository's exact 20-character lowercase project-ref contract,
fixes the environment to literal `production`, and computes lowercase SHA-256
over the exact validated ref bytes. It never reads `supabase/.temp/project-ref`,
accepts no CLI/receipt/config target value or alternate environment variable,
and returns the raw ref only to the in-process Management API URL builder. Logs,
receipts, diagnostics, and thrown errors expose only the hash or a generic
configuration failure, never the raw ref.

### Candidate-independent release guardian

The in-repository dispatcher is necessary but cannot be its own trust anchor:
GitHub executes a `pull_request` workflow from the candidate merge commit, and
the repository's required `Build`, `Quality Gate`, and `Jules review` checks are
all currently emitted by the GitHub Actions App. A candidate that rewrites those
workflows can otherwise preserve their names while removing the verifier. Baci
is user-owned, so the organization/enterprise-only ruleset workflow feature is
not available. Before replay scope, install a dedicated **Baci Release
Guardian** GitHub App and require its literal `Baci Release Guardian` check with
that App's exact source id. A GitHub Actions job or commit status with the same
name does not satisfy the rule.

The App's exact sorted permission map is `actions = write`, `administration =
read`, `checks = write`, `contents = read`, `metadata = read`, and
`pull_requests = read`; no other permission key may be present. GitHub's
`write` value includes the read access needed for run/job discovery. Actions
write exists solely so the candidate-independent hold worker can inspect and
force-cancel every exact affected-SHA deployment run after a delivery collision;
the service has no code path for dispatch, rerun, workflow mutation, artifact
deletion, or unrelated-run cancellation. It has no Contents write,
Administration write, Merge queues, Secrets, Deployments, or Environments
permission. Its private key
and webhook secret are `0600` VPS-only files, never GitHub Actions/Vercel
secrets. The webhook URL is HTTPS-only behind the existing VPS reverse proxy
with certificate verification, a fixed body-size limit, no secret in the URL,
and no route to the guardian's local state/admin interface.

Those statements are live signed inputs, not operator notes.
`github-app-configuration.ts` starts with a freshly minted App JWT and derives
one strict canonical `guardianAppConfiguration` object from `GET /app`,
`GET /app/hook/config`, `GET /app/installations`, and the complete paginated
repository list for the one installation. The three App-level reads use the App
JWT. For the repository list, the helper uses that JWT to mint one fresh,
unrestricted installation access token for the selected installation through
`POST /app/installations/{installation_id}/access_tokens`, sends no
`repositories`, `repository_ids`, or `permissions` narrowing fields, and uses
the in-memory token only for `GET /installation/repositories`. The token is
never persisted, serialized, or logged and is discarded immediately after the
paginated read. The object contains the exact App
id/slug/owner id; the sorted permission map above; configured events exactly
`check_run`, `pull_request`, and `push`; a SHA-256 of the normalized HTTPS webhook
URL plus literal `content_type = 'json'` and `insecure_ssl = '0'`; one active,
unsuspended installation for the expected owner; `repository_selection =
'selected'`; the installation's exact permission map; and exactly one selected
repository with Baci's pinned repository id/full name. Mandatory GitHub App
system events that cannot be unsubscribed are listed separately as
authenticated-ignore inputs and never widen the configured event set.

Every call uses `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2026-03-10`, bounded timeouts, expected JSON content type,
and redirect rejection. Pagination must reach the declared installation and
repository totals without a duplicate id/page. The helper accepts no App,
installation, repository, permission, event, URL, suspension, or selection
override. Its canonical JCS SHA-256 enters policy, the signed bootstrap receipt,
every later `ciTrustAnchor`, and check output. Bootstrap capture, startup, every
redelivery cycle, and every PR/main evaluation independently re-read it; any
permission/event/webhook/installation/repository drift alerts and leaves all
guardian checks non-successful. The service never edits GitHub App settings or
silently accepts a broader installation token.

The reverse proxy and public handler share literal
`maxBodyBytes = 26_214_400` and reject a larger declared or streamed body with
`413`. The handler verifies the exact raw bytes with
`X-Hub-Signature-256` before JSON parsing. A missing or malformed signature/GUID
returns bounded `400`, and a failed HMAC returns bounded `401`; each path alerts
without reflecting request bytes. These are transport-validation failures, not
durable acknowledgements.

After HMAC succeeds, the handler starts `BEGIN IMMEDIATE` with literal
`busy_timeout = 2000`, then commits the `X-GitHub-Delivery` GUID as primary
idempotency key, body digest, bounded raw body, receive time, headers needed for
classification, and initial `received` state to
`/var/lib/baci-release-guardian/deliveries.sqlite3`. It returns `202` only after
that durable commit and has a literal five-second application deadline inside
GitHub's ten-second response deadline. `SQLITE_BUSY` at the two-second boundary,
`SQLITE_FULL`, `SQLITE_IOERR`, `SQLITE_READONLY`, failed fsync/commit, or any
other inability to prove the transaction durable returns generic `503` with
`Retry-After: 5`, writes a bounded secret-free systemd-journal alert, and never
returns `202`. GitHub therefore records a failed delivery that the timer can
redeliver after storage recovers; local alert persistence is not falsely claimed
when the local store itself is unavailable.

An already committed GUID with the identical digest returns the same bounded
`202` outcome without another evaluation. A validly signed reuse of that GUID
with different bytes executes one immediate collision transaction that records
both digests, original state/lease/check identity, collision time, and the exact
affected release identity already derived from the committed original
delivery/evaluation: PR number/base/head/tree, main SHA, or `none` only for a
proven terminal ignored/rejected original that could not create a check. If the
original has not reached semantic classification, the collision record leaves
that field unresolved for the hold worker to derive solely from the committed
original bytes and headers. The transaction then enters the global durable
`security_hold` state and returns `202` only after that record commits. The
second body is never evaluated and supplies no identity input. If the original
is still `received`, `queued`, or leased, the same transaction changes it to
`collision_quarantined` and revokes the lease; every worker rechecks that state
immediately before each GitHub read and check-run write. If the original
already completed, history is not rewritten: the transaction enqueues one
high-priority hold action for its exact affected release identity. The request
transaction does not pretend to know whether the PR has since merged or whether
a remote workflow step has started.

The dedicated hold worker, not the request path, performs independently
verified containment phases. First, it calls
`PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}` with
`status = completed` and `conclusion = failure`, then verifies the returned App
id, check id, head SHA, external id, status, and conclusion whenever the
original had emitted a check. A proven terminal ignored/rejected original with
release identity `none` has no check mutation or Actions target but still keeps
the global hold active. For a PR/head collision the worker then reads the exact
persisted PR number through the Pull Requests
API, verifies repository/base/head identity against the committed original
record, and reconciles its merge state through a bounded late-merge window after
the failed check is visible. A PR proven closed-unmerged, or still unmerged
under unchanged no-bypass protection throughout that window, has no
materialized release target. If that exact head merged, the worker accepts only
the API-returned `merge_commit_sha` that passes the guardian's already-pinned
squash topology: approved base is its sole parent and its full tree equals the
approved PR tree. That commit becomes the affected main SHA. Missing, changed,
non-main, non-squash, bypassed, conflicting, or unavailable PR/merge evidence
never authorizes a guessed SHA and is classified as potentially materialized.

For every directly recorded or safely derived affected main SHA, the worker
lists check runs. If no exact guardian check exists, it creates one completed
with `conclusion = failure` for that exact SHA, check name, App, and
policy-derived `external_id`; if one exists, it updates it to failure; if
multiple exist, it fails every guardian-owned exact-name instance. Every create
or update response is rebound to the App id, repository, SHA, name,
`external_id`, status, and conclusion. A duplicate or mismatched completed
success remains containment uncertainty, never permission to proceed. It then
paginates the all-event Actions run API and
derives every `deploy.yml` run and attempt for the authenticated repository,
`main` branch, and exact head SHA; callers may supply none of the PR, merge,
check, or run ids. Exactly one `push` run is canonical, but a same-SHA
`workflow_dispatch` or any other additional event is an unauthorized release
attempt that must also be contained and makes the evidence fail closed. It
issues
`POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel` for each matching
queued or in-progress run, polls each run to a bounded terminal state, then
paginates jobs for every attempt and records the exact event plus job/step
status and `started_at`/`completed_at` evidence. It never cancels another
workflow, ref, repository, SHA, completed historical run, or caller-selected
run id.

The containment probe is a separately pinned workflow/path and state-machine
exception. It is unavailable during ordinary `armed` operation and may run only
in `bootstrap_only` or a separately reviewed recovery state that first restores
the same exact-run isolation, refusal, cancellation, and evidence gates.
`guardian-containment-probe.yml` has exactly `workflow_dispatch`, top-level
`permissions: {}`, one bounded Ubuntu job with `timeout-minutes: 5`, and one
literal shell wait step. It has no checkout or other action, repository-derived
command, matrix, container/service, environment, secret/context expansion,
artifact, cache, network command, production credential, or deployment step.
The policy and workflow-shape tests reject every extra trigger, permission,
job, step, expression, executable, or mutable indirection. The trusted
bootstrap/recovery operator dispatches it; the guardian App never gains a
dispatch code path and derives the resulting run id through the authenticated
workflow-run API.

Containment is conservative. The result is
`no_release_side_effect_stage_started` only when either the affected PR is
proven not to have materialized a main release target under the stable failed
check and no-bypass policy, the committed original is proven to have release
identity `none`, or the complete authenticated history for every derived main
run proves every policy-pinned migration-apply and
production-deploy step kept null `started_at`, remained pending/skipped, and
the run became terminal after the hold. If the exact PR-to-main relation cannot
be proven, either step ever became in-progress or completed, the run was
already terminal after executing one, or PR, protection, check, run,
pagination, attempt, job/step, timestamp, force-cancel, or terminal-polling
evidence is missing, ambiguous, unavailable, or times out, the immutable
outcome is `release_side_effect_may_have_started`. A force-cancel acceptance or
failed check rewrite is never treated as rollback proof: GitHub cancellation
is asynchronous, so an in-progress external write may commit before the runner
stops. The hold record binds the PR/merge/main lineage, check-update results,
run/job/attempt/step evidence digest, GitHub response dates, and cancellation
results. The worker keeps polling for both the bounded PR late-merge window and
the bounded run late-enqueue window after a derived or direct main push so a
racing merge or Actions run cannot escape classification.

All future checks remain non-successful. A race, API mismatch, failed check
update, failed cancellation, or uncertain workflow history leaves
`security_hold` active and pages operations. Recovery from
`no_release_side_effect_stage_started` still requires webhook-secret rotation,
delivery/check/run audit, a fresh containment probe, and the separately reviewed
guardian bootstrap/recovery ceremony. Recovery from
`release_side_effect_may_have_started` additionally freezes merges and deploys,
assumes the candidate may be live, restores the last audited healthy application
deployment when the production-deploy step may have started, and independently
reads the production migration ledger/effects. Any applied or indeterminate
feature prefix requires the post-materialization recovery design before a new
guardian policy/receipt can be signed; ordinary re-arm is forbidden. Restart
cannot return the service to `armed`. The request path otherwise performs no
GitHub tree read, Actions call, check evaluation, or semantic action rejection
inline.

The SQLite store is a local, non-network filesystem database with
`journal_mode = WAL`, `synchronous = FULL`, `foreign_keys = ON`, literal
`busy_timeout = 2000`, and a checked schema/user version. Startup fails unless
each
effective PRAGMA has the exact value, the database passes `integrity_check`, and
an fsync-capable transaction/online-backup probe succeeds. A file copy of the
database or WAL is not a backup; the service uses SQLite's online backup API and
verifies the restored copy. The directory, database, WAL/SHM files, and backups
are guardian-user-only. No `202` may be emitted from a deferred, `NORMAL`, or
memory-only transaction.

A separate restart-safe worker claims `received` rows and performs bounded
semantic classification. Expected `pull_request`
synchronize/open/reopen/ready events, relevant downstream `check_run`
completions/rerequests, and `push` to `refs/heads/main` enter evaluation. A
validly signed but irrelevant pull-request action, non-main push, self-generated
check event, mandatory App system event, wrong repository/installation, stale
event, unknown action, or non-fast sequence is durably recorded as terminal
`ignored` or fail-closed `rejected` and never creates a successful check; it is
still an acknowledged `202` delivery and is not a GitHub-failed redelivery.
Malformed JSON after a valid HMAC is likewise durably `rejected` and alerts.
Evaluation records terminal `completed`/`rejected` outcomes idempotently by the
GUID, and expired worker leases are reclaimable after restart. Startup and every
claim/check boundary also fail closed while `security_hold` is active.

The systemd redelivery timer runs on boot and every five minutes. Using only the
App JWT/private key, it lists the App's webhook deliveries for the recoverable
three-day GitHub window with `per_page = 100`, follows the response `Link`
header's cursor-based `rel="next"` chain to exhaustion, requests redelivery for
each GitHub-failed delivery not already terminal locally, and reconciles every
GitHub-OK delivery in scope to a durable local `received`, `queued`, `ignored`,
`completed`, `rejected`, or `collision_quarantined` row by matching the list
record's `guid` to the webhook idempotency key. A GitHub-OK delivery missing
locally is an integrity
failure: while it remains inside the three-day window, the timer alerts and
requests one bounded redelivery so the signed body can be durably recovered.
It records the request and will not issue another while that attempt is pending;
continued absence/backlog follows bounded backoff and remains non-successful.
The list record's numeric `id`, never its GUID or a caller value, is used only
for the redelivery endpoint. List/get/redeliver requests use
`Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2026-03-10`, bounded timeouts, and redirect rejection;
only a delivery id returned by the authenticated list may enter the redelivery
endpoint. A terminal local `ignored`/`rejected` row is reconciled evidence, not
a reason to redeliver the same valid but irrelevant event; a
`collision_quarantined` row is security-hold evidence and is likewise never
redelivered through the normal timer. It never stores a JWT
or signed redelivery URL. Backlog age
over two minutes, worker/timer failure, an API/page failure, malformed or
repeated next cursor, database integrity failure, or less than 24 hours
remaining for any unresolved failed delivery in the GitHub recovery window
pages the existing operations alert recipient and leaves all guardian checks
non-successful. Startup performs
integrity check, expired-lease reclamation, and redelivery reconciliation before
accepting new evaluations. An outage that exceeds GitHub's redelivery window
requires the separately reviewed guardian recovery ceremony; it cannot be waved
through manually.

For a PR the guardian obtains the exact base/head identities from the signed
webhook and reads Git trees and blobs only through GitHub's REST API.
It never checks out a candidate, invokes Git against candidate objects, extracts
an archive, installs candidate dependencies, imports a candidate module, or
executes candidate bytes. Release lanes from a fork are rejected. All candidate
workflow, script, receipt, JSON, and package bytes are data passed to the
guardian's deployed policy implementation under explicit size, path, mode, and
schema limits. Only regular `100644` or specifically allowed `100755` blobs are
accepted; symlinks, submodules, duplicate paths, truncated pagination, mutable
ref substitution, and API redirects fail.

The VPS artifact embeds a domain-separated digest of
`late-payment-v1.json`. That policy contains:

- the exact reviewed hashes and allowed absence-to-presence transition for the
  replay-scope CI workflow, dispatcher, path policy, package command, and
  production-secret/retention assertion files;
- the exact legacy and prepared `deploy.yml` canonical shapes described below;
- the hashes of every other `.github/workflows/*.yml`/`.yaml` file, including
  the Jules workflow and the secretless manual-only guardian-containment probe,
  so a candidate cannot add a second workflow or duplicate a required job name;
- the exact guardian source and CODEOWNERS hashes and the permitted root,
  preparation, later-candidate, and receipt path classes;
- the post-root global top-level-migration freeze, exact manifest-derived next
  candidate transition for each materialized phase, and terminal behavior for
  any out-of-lane migration or protected-control drift; and
- the literal repository, default branch, check name, GitHub Actions App id,
  guardian App id, required downstream check names, and exact canonical
  `guardianAppConfiguration` object/digest; and
- the named independent reviewer's immutable user id/login, the exact sole-owner
  CODEOWNERS patterns for `.github/**`, `apps/release-guardian/**`, and
  `ops/release-guardian/**`, and the latest-head review-evidence contract.

The policy does not contain its own hash. The deployed artifact embeds the
policy blob's digest, and the external service compares any repository copy of
that blob with the embedded digest while its bootstrap receipt binds both the
artifact and policy digests. This avoids a recursive self-hash while still
making candidate policy replacement impossible.

`bootstrap-v1.json` is a strict RFC 8785 JCS canonical JSON object captured on
the VPS by the deployed artifact. It contains schema/policy versions, repository
and default branch, bootstrap source commit/tree SHA, guardian App and
installation ids, literal check name, artifact/policy/unit/CODEOWNERS digests,
the exact canonical `guardianAppConfiguration` object/digest, the canonical live
branch-protection/ruleset digest, durable-store schema and effective-PRAGMA
versions, the bootstrap source PR/base/head/merge SHAs and named collaborator's
effective review id, user id/login, `APPROVED` state, reviewed commit SHA, and
GitHub-submitted timestamp, and the exact probe and rejected-spoof
PR/head/check-run/App/external-id evidence. It also binds the one bootstrap
containment-probe workflow run id/attempt/path/head/event, its exact harmless
job/step shape, force-cancel request/response, terminal cancelled state, and
run/job evidence digest. Capture
derives every GitHub value through pinned APIs and every local digest from the
installed read-only paths; callers may supply neither an id, SHA, digest,
setting, timestamp, nor probe result. GitHub's response `Date` is the receipt
`observedAt`.

Before the source PR, the owner and named independent collaborator each create
a distinct offline Ed25519 signing key. Their public keys, key ids, and
fingerprints are frozen in policy; private keys never enter the repository,
VPS, GitHub, or Vercel. Each signs the domain-separated bytes
`UTF8("baci-release-guardian-bootstrap-v1\0") || JCS(receipt)` with Ed25519. The
two strict signature JSON objects contain only schema version, signer role/key
id, receipt digest, algorithm, context, and base64 signature. Verification
requires distinct keys,
the literal owner/reviewer roles, both pinned public keys, exact receipt digest,
and valid Ed25519 signatures. Unknown fields, reordered/noncanonical receipt
bytes, a caller-selected key, one signer in both roles, or a signature over a
different artifact/policy/settings snapshot fails.

The package exposes exactly `bootstrap:capture`, `bootstrap:sign-owner`,
`bootstrap:sign-reviewer`, and `bootstrap:verify`. Capture runs only on the VPS
and writes the fixed staging receipt path atomically. Each sign command runs on
the corresponding reviewer's trusted machine, reads only
`BACI_GUARDIAN_SIGNING_KEY_FILE`, refuses a symlink/non-regular or group/world-
readable private key, infers the fixed role/key id from the command, and writes
only its fixed signature filename. Verify accepts the fixed receipt directory
but no key, role, digest, or policy override and must pass independently on both
reviewer machines and the VPS before installation. The private-key environment
value and path are never serialized or logged.

The service initially runs in `bootstrap_only`: it may evaluate only the named
same-repository probe and spoof PRs and cannot approve a payment/root lane. After
the receipt is captured and both signatures verify, the exact three files are
installed in its root-owned read-only receipt directory and it enters
`receipt_materialization`, where it may approve one PR that adds only those
three identical repository bytes. That PR receives the now-enforced independent
CODEOWNERS approval and the guardian independently proves the exact named
reviewer's latest-head approval. Once its main-push check succeeds and the
repository copy matches the installed receipt/signatures, the service enters
`armed`. Every
later PR/main evaluation and every `ciTrustAnchor` bind the bootstrap receipt
digest, both signature digests, and both signer-key fingerprints.
The policy may name the three fixed receipt paths and pinned signer keys, but it
must not obtain an expected receipt or signature digest from the candidate. The
already installed, independently signed bytes are the sole comparison authority
during `receipt_materialization`.

`receipt_materialization` has one explicit bootstrap PR/main-push path and does
not pretend the later dispatcher or `ciTrustAnchor` already exists. For that PR,
the guardian reads the complete base-to-head tree through GitHub, requires the
only changes to be the three fixed receipt paths with bytes exactly equal to the
installed signed files, requires guardian source/policy/units/CODEOWNERS and all
existing workflows to remain at their bootstrap hashes, revalidates the live
`guardianAppConfiguration` and signed protection/ruleset snapshot, and waits for
the three exact downstream Actions checks on the PR-head SHA. It also derives
the effective named-reviewer evidence described below and rejects owner-only,
other-collaborator, prior-head, dismissed, or superseded approval. Its PR check
uses
`bootstrap-v1:<policyDigest>:<bootstrapReceiptDigest>:<prHeadSha>` as the
domain-separated `external_id`; no candidate `ciTrustAnchor` or dispatcher is
required or accepted in this state.

For the corresponding main push, the guardian requires that exact previously
approved receipt PR, the approved base as the squash commit's sole parent, and
the pushed tree to equal the approved receipt PR tree. It re-reads the App
configuration and live protection/rulesets, compares repository receipt bytes
to the already installed signed bytes, and emits
`bootstrap-v1:<policyDigest>:<bootstrapReceiptDigest>:<mainSha>`. Only after that
check completes successfully and its durable state transition commits may the
service enter `armed`. A missing receipt path, any fourth changed path, stale
setting, candidate-proposed digest, rebase/merge topology, or process restart
during an uncommitted transition leaves it in `receipt_materialization`.

The policy permits one attestation-only transition followed by exactly two
control-surface transitions during this design: the signed receipt-only PR may
materialize the three prevalidated bootstrap receipt bytes; the no-migration
replay-scope PR may introduce the pre-reviewed root CI hashes; and the
preparation PR may replace only the legacy deploy shape with the pre-reviewed
prepared shape. After each transition, the new bytes are frozen.
Any review change to an expected protected byte after the guardian policy is
deployed requires a new manually reviewed policy artifact and bootstrap receipt
before the affected PR can be reconsidered; the service never learns a new hash
from the candidate it is judging.

After `armed`, the guardian does not replace the full secretless dispatcher.
For the replay-scope transition it proves the candidate introduces exactly the
pre-reviewed dispatcher bytes; for every later PR evaluation it first proves
the candidate cannot change or route around that frozen dispatcher,
then waits for one successful, non-duplicate `Build`, `Quality Gate`, and
`Jules review` check from the exact GitHub Actions App on the same PR-head SHA.
Only then may its own check conclude `success`. A missing,
skipped, neutral, stale, duplicate-name, wrong-App, wrong-SHA, or subsequently
rerun downstream check keeps the guardian queued or fails it. `check_run` events
from the guardian itself are ignored to prevent recursion.

For every `armed` main push the guardian does not wait for the new push CI. It
requires an associated, previously guardian-approved PR; proves the pushed
commit has the approved PR base as its sole parent and its full tree equals the
approved up-to-date PR tree under the rollout's squash-only topology; rechecks
live App configuration/protection and the committed `ciTrustAnchor`; and emits
the exact main-SHA check promptly. Its bounded output binds the GitHub delivery
id, durable store sequence, PR/base/head/main SHAs, tree digest,
artifact/policy/App-configuration/bootstrap receipt/signature digests, and
live-trust and effective independent-review evidence digests; its `external_id`
remains the stable machine-readable identity
used by preflight. A direct/unassociated push, different tree, stale prior
check, missing `ciTrustAnchor` after arming, or main movement after approval
fails. This is the check the migration preflight polls before touching Supabase.

Every evaluation also reads current branch protection and active rulesets with
the App's Administration-read permission. The accepted live shape is strict:
main is up to date; admins are enforced; force pushes/deletions and every bypass
actor are absent; the three Actions checks remain required from the GitHub
Actions App; `Baci Release Guardian` remains required from the guardian App;
pull requests, conversation resolution, one approving review, stale-approval
dismissal, latest-push approval, and CODEOWNERS review are required; and no
active rule may require or enable a merge queue. Merge queues are explicitly
forbidden for every payment PR in this rollout because the live `Jules review`
workflow has no `merge_group` trigger. The guardian has no Merge queues
permission, rejects any `merge_group` delivery, and fails live-policy comparison
if a queue rule appears.

GitHub permits any one owner on a multi-owner CODEOWNERS line to satisfy required
code-owner review, so the protected lines list only the named independent
collaborator: `/.github/**`, `/apps/release-guardian/**`, and
`/ops/release-guardian/**`. The owner is not an alternate on those lines.
`github-review-evidence.ts` reads the exact PR and paginates
`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews` with `per_page = 100`,
the pinned REST headers, bounded timeouts, redirect rejection, and complete
`Link` traversal. It canonicalizes the policy-pinned reviewer user id/login,
review id, literal `APPROVED` state, `commit_id`, and GitHub `submitted_at`. For
any PR that touches one of those protected patterns, the guardian succeeds only
if that reviewer is not the author, the effective review is not from a bot, its
`commit_id` equals the current PR head, and no later dismissal or
`CHANGES_REQUESTED` review supersedes it. A matching display name, another code
owner, owner approval, a stale review, or branch protection's aggregate approval
count is not independent-review evidence. The separately revalidated
latest-push rule guarantees that approval by the most recent pusher cannot
satisfy merge protection. The guardian binds the canonical
review-evidence digest into its PR check and persists it for the corresponding
main-push check.

Before the source bootstrap PR opens, invite that collaborator and temporarily
strengthen the current main rule—without adding the not-yet-live guardian
check—to require one approval, stale-approval dismissal, latest-push approval,
admin enforcement, and no bypass. The source PR introduces the sole-owner
CODEOWNERS patterns above, so those new lines cannot protect their own first
merge; the exact named collaborator must therefore approve its final head, and
the later bootstrap capture independently derives and signs that source-PR
review evidence. A placeholder, owner-only or self-approval, bot without write
access, prior-head approval, or unenforced temporary review rule blocks capture.

The unavoidable source bootstrap is a separate named-collaborator-reviewed,
no-migration,
no-payment, no-production-deploy-workflow PR containing only the guardian/CODEOWNERS/VPS
surface above. After it merges, build on the VPS from that exact SHA, record the
content-addressed artifact and policy digests, install the App, verify a probe
PR and a synthetic rejected workflow-spoof PR, then dispatch the pinned
secretless guardian-containment probe at that exact source SHA. In
`bootstrap_only`, the service may force-cancel only that probe's exact run and
must prove its terminal cancelled job/step evidence while refusing every
non-probe run identity. Only after those checks pass may branch protection
change to the full strict shape above with CODEOWNERS review and the guardian
check bound to its App id. Capture and
sign `bootstrap-v1.json`, install the exact receipt/signatures, merge the
three-file guardian-receipt PR under the newly enforced independent review, and
require its successful main-SHA guardian check. No late-payment root PR may open
until a fresh API read proves those settings and the armed service plus repository
copies independently verify the same receipt and signatures.
Guardian upgrades or decommissioning are outside this payment rollout and must
keep the old required App check active until an independently reviewed
replacement App check is live and required.

`verify-late-payment-pr.ts` is the one secretless CI dispatcher. The root PR
adds the exact `apps/web/package.json` command
`verify:late-payment-pr = tsx tools/db/verify-late-payment-pr.ts` and a
`quality-misc` step in `.github/workflows/ci.yml`; the existing top-level
`quality` gate already requires `quality-misc`. The step runs for both
`pull_request` and `merge_group`, after an unfiltered full-object checkout. The
checkout action has the exact inputs `fetch-depth: 0` and
`persist-credentials: false`, omits the `filter` input entirely, and does not
configure a sparse checkout. Full commit history alone is insufficient:
`filter: blob:none` would leave historical blob content eligible for a lazy
network fetch even though receipt verification must hash that content. The step
then runs this exact command:

```bash
env -u SUPABASE_PROJECT_REF -u SUPABASE_ACCESS_TOKEN pnpm --filter @baci/web verify:late-payment-pr
```

Workflow-shape verification requires every
controlled path to select `web` or `quiz_db` and a non-`config-smoke` test plan,
so `quality-misc` cannot be skipped for a release lane. The command is
independent of Vitest selection, so the current targeted `vitest --changed`
path cannot skip receipt verification when a later PR changes only a generated
receipt or fixture.

The dispatcher accepts no CLI-selected base, head, path set, phase, or mode. It
requires empty production-target variables, reads `GITHUB_EVENT_NAME`,
`GITHUB_EVENT_PATH`, and `GITHUB_SHA`, validates full lowercase Git SHAs, and
derives the event boundary from the checked GitHub payload. A `merge_group`
event whose tree changes any frozen/controlled late-payment path fails
immediately with `LATE_PAYMENT_MERGE_QUEUE_FORBIDDEN`; an unrelated merge-group
diff may no-op after proving it contains no controlled path. For
`pull_request`, the dispatcher uses the payload's immutable base and head SHAs,
verifies the receipt against the PR head, and requires the checked synthetic
merge commit to have those exact parents and the same canonical controlled-path
tree. Every late-payment PR must be up to date, receive the external guardian
check on its PR-head SHA, and merge through GitHub's protected squash method.
Rebase and merge-commit methods are forbidden for these lanes even if the
repository permits them generally. There is no payment merge-group receipt or
queue retry path in this rollout.

Before hashing any receipt or invoking a verifier, the dispatcher performs a
staged, fail-closed local-object preflight. It rejects repository configuration
containing a partial-clone extension, promisor remote, or partial-clone filter,
then sets `GIT_NO_LAZY_FETCH=1` in the dispatcher process before any Git child
process so every later Git command and invoked verifier inherits it. First it
proves the event commits and root trees exist, then uses a tree-only raw diff
with rename/copy detection disabled to enumerate every old/new object ID in the
event boundary without reading blob content. It rejects unsupported modes and
proves every regular-file blob is local with `git cat-file -e`. This includes
unrelated changed paths because the later canonical rename-aware diff may
compare their bytes. Only after proving the selected receipt blob is local may
it read that blob, enumerate the receipt's referenced commits and predecessor
receipt paths, resolve their required tree/path objects under the same no-lazy-
fetch environment, and prove that transitive set is local. The dispatcher runs
the canonical diff and receipt verifier only after both stages pass.

Deleted, renamed, and modified paths therefore require their historical blobs,
not only the checked head tree. A missing object or unresolvable tree path fails
before verifier dispatch, never falls back to the network, and reports only a
known missing object ID or generic local-object failure plus remediation to use
the required unfiltered checkout. CI must not re-enable persisted checkout
credentials to make lazy fetching work.

The dispatcher derives changed paths from Git and exits successfully without a
receipt only when none belongs to the frozen late-payment controlled-path
universe. If any controlled path changed, it requires exactly one of
`replay_scope`, one `<phase>_candidate`, or one `<phase>_receipt`, invokes the
matching secretless verifier, and fails on an absent, duplicate, stale, or
wrong-lane receipt. Root, candidate, and receipt verification therefore run as
an actual required command, not merely as tests whose selection depends on
Vitest's static dependency graph.

The replay-scope PR also adds
`.github/scripts/assert-production-secret-boundaries.mjs` and runs it in the
always-executed `changes` job immediately after checkout and before any
third-party path-filter action. The same dependency-free block then runs
`node --test` for both boundary/assertion `.test.mjs` files before that action.
With no package installation or secret access,
it inventories every checked `.github/workflows/*.yml` and `.yaml` file. For
the controlled `deploy.yml` nodes it uses a small fail-closed, indentation-aware
canonical-shape reader rather than pretending to be a general YAML parser. It
rejects tabs, duplicate controlled keys, YAML anchors/aliases/merge keys or
explicit tags that define or target a controlled node, alternate flow or
multiline scalar forms in those nodes, and any unrecognized controlled job or
step field. This makes the dependency-free check semantic only for the one
frozen spelling it accepts and prevents YAML indirection from preserving a
searched token while changing the executed structure. The
only permitted references to `SUPABASE_PROJECT_REF` and
`SUPABASE_ACCESS_TOKEN` are the exact environment entries in `deploy.yml`'s
main-only, production-environment `db-migrations` job. Before preparation, zero
`BACI_ACTIONS_RETENTION_READ_TOKEN` references are allowed. Once the exact
retention assertion invocation exists, it must have exactly one such reference:
the step-local environment entry on that job's first executable assertion after
checkout. The reader accepts exactly two versioned controlled-job shapes: the
replay-scope baseline is the then-current pinned checkout followed directly by
the legacy single-command apply step with no assertion or retention token; the
preparation-and-later shape is the frozen assertion/apply execution envelope
below. It rejects a mixture or a third shape. In the prepared shape there is no
workflow `env` or `defaults`, no `db-migrations.defaults`, and the job/step field
and environment allowlists are exact. The token is forbidden at
workflow/job scope, in any later step or job, and in Vercel configuration.
`deploy.yml` must retain only `push` to `main` and `workflow_dispatch` triggers.
Any other reference, alias,
`secrets: inherit`, dynamic whole-secret serialization, PR-capable trigger, or reusable-workflow
forwarding fails the required `changes` job. This root guard is separate from
the preparation-only Vercel release-attestation shape test and is live before
the first receipt PR merges.

`capture-late-payment-replay-scope.ts` derives every scalar and digest from Git,
checked files, normal replay output, the checked production-target helper, and
the read-only production and live GitHub protection/check responses; callers may
supply only the expected base SHA. The exact ref used to build the Management
API URL is the ref whose hash is stored in the receipt. It refuses a dirty target, symlink, unexpected mode, path
outside the explicit `replay_scope` policy, migration presence, target override,
local linked-project fallback, or mutable caller evidence, validates the
complete receipt in memory, and writes only `replay-scope.json` atomically.
Creation follows the same two-commit pattern as phase candidates: commit all
scope/tool/fixture changes, generate the receipt from that committed tree, then
commit only the receipt. The required dispatcher selects and invokes
`verify-late-payment-replay-scope-receipt.ts`, the dedicated secretless root
verifier, for that final PR tree. It reads neither `SUPABASE_PROJECT_REF` nor
`SUPABASE_ACCESS_TOKEN`, imports neither the production-target helper nor a
Management API client, and recomputes the final PR tree with exactly that one
self-omission. Because the initial root has no trusted predecessor, this check
proves the receipt schema and Git/tree bindings but does not claim to
independently authenticate its production target. The trusted deployed-root
verification below must establish that binding before preparation can begin.

After the no-migration replay-scope PR deploys through the pre-existing workflow
and health checks, `verify-late-payment-replay-scope.ts` receives the immutable
deployed head plus checked GitHub workflow run/job identifiers. It runs only as
an approved trusted post-deploy operation with production credentials. It reads
the receipt bytes with `git show`, requires the deployed parent topology,
recomputes the complete tree receipt, confirms a successful web deployment and
existing production health check plus the distinct-App guardian main-push check
for that exact head, rechecks the live `ciTrustAnchor` and zero pending
migrations, independently derives the production target from its own required
`SUPABASE_PROJECT_REF`, rejects a receipt target mismatch, and requires the live
linked/effect hashes queried through that exact ref to remain equal to the
receipt. The preparation candidate stores this root-receipt digest, deployed
head, workflow run/job ids, and health-evidence digest in its strict predecessor
object. No separate replay-scope deployment-receipt PR is needed because the
root changes no database state; preparation cannot begin until this trusted
deployed-root verification passes.

Every migration PR runs both replay modes in `classify` against the deployed
predecessor fixture and writes `<phase>-candidate.json`. The strict schema binds
literal production and the trusted project-ref hash, phase, exact base SHA, and a
domain-separated SHA-256 tree receipt over sorted
`status NUL path NUL old-mode NUL old-blob-sha256 NUL new-mode NUL
new-blob-sha256 LF` records for the complete committed base-to-head diff except
the one phase-candidate receipt itself, plus the healthy predecessor
receipt deployment `headSha` and predecessor deployment-receipt digest,
predecessor linked inventory/effect hashes, extension-manifest digest, ordered
source hashes, SQL-check hashes, both local effect hashes, and the exact sorted
changed-component set, plus the server-timestamped `actionsLogRetention` object
described below and the server-timestamped `ciTrustAnchor` object described
here. Both modes must produce the same effect hash and only the components
allowed for that phase. The receipt contains no secrets or row-level payment
data. For `preparation`, the predecessor fields bind the
verified replay-scope root-receipt digest, deployment SHA, workflow run/job ids,
and health-evidence digest described above; its capture tool must read
`replay-scope.json` with `git show` from that SHA and rerun the root verifier.
Every later phase binds the immediately preceding phase-deployment receipt and
receipt-deployment SHA.

`replay-scope.json` and every phase candidate contain an immutable
`ciTrustAnchor` object with literal repository/default branch, guardian policy
version, check name, integer App and installation ids, VPS artifact digest,
policy digest, exact canonical `guardianAppConfiguration` object/digest,
bootstrap receipt/signature digests, both signer-key fingerprints, CODEOWNERS
blob SHA, exact sole-owner protected-pattern map, and named independent reviewer
user id/login, exact sorted required check/App-id
pairs, canonical branch-protection and active-ruleset digests, GitHub response
`Date` as `observedAt`, and
`canonicalRunMustStartBy = observedAt + 24 hours`. Trusted capture obtains every
live value through Administration/Checks-read APIs and canonicalizes strict
allowlisted response fields; it accepts no caller-supplied setting, local clock,
raw policy replacement, bypass actor, or unknown rule. The guardian evaluates
the committed object as candidate data and succeeds only when it equals its own
artifact/policy identity and a fresh live settings read. A stale object requires
normal receipt regeneration; neither the App nor CI may rewrite it after
commit.

The App-configuration object/digest is the deliberate exception to operator
recapture because the App private key remains VPS-only. Candidate/root capture
copies those exact bytes only from the already verified signed bootstrap receipt
and accepts no override or separately fetched public-App metadata. The guardian
re-derives the live object with its App JWT during evaluation, requires equality
with the bootstrap-bound bytes, and binds the resulting digest into its
App-sourced check/external id. Operator and GitHub Actions capture therefore
receive neither the private key nor authority to assert a new App configuration;
post-deploy verification proves freshness through the exact guardian check plus
the signed bootstrap inheritance.

Candidate and deployment-receipt capture tools, plus any post-deploy verifier
that re-queries live production state, run only in an approved trusted
operator/deployment context. Each independently invokes the production-target
helper from the process environment, requires its derived hash to equal the
verified root and immediate predecessor, uses the raw ref only to build the live
Management API URL in process, and accepts no target argument. A staging ref,
missing production ref, local linked-project fallback, or cross-project
predecessor fails before replay or receipt mutation.

Every pull-request verifier is deliberately secretless. It reads neither
`SUPABASE_PROJECT_REF` nor `SUPABASE_ACCESS_TOKEN`, makes no live Management API
request, recomputes all Git/tree/schema/effect/replay facts available from the
checked candidate or receipt, and requires the stored target hash to equal the
trusted replay-scope root and the immediate predecessor or phase candidate as
applicable. It cannot bless a new target hash or treat the hash's presence as
proof of production identity; that proof comes only from the trusted capture
and post-deploy boundaries. GitHub `pull_request` jobs must never receive either
production credential. Only protected trusted capture, deployment, or
post-deploy jobs may receive them.

GitHub Actions artifact-and-log retention is a versioned release input, not an
ambient repository assumption. Before a migration candidate receipt is
finalized, its trusted capture path calls
`GET /repos/ogabasseyy/Baci/actions/permissions/artifact-and-log-retention`
with the same pinned GitHub REST headers used by deployment capture. It records
an immutable `actionsLogRetention` object containing the literal repository,
API version, integer `days`, integer `maximumAllowedDays`, the GitHub response
`Date` header as `observedAt`, derived `canonicalRunMustStartBy` equal to
`observedAt + 24 hours`, and `requiredDays = 32`. Capture fails on a missing,
unauthorized, or malformed response, local-clock substitution,
`maximumAllowedDays < days`, or `days < 32`. The canonical push run's GitHub
`created_at` must be no earlier than `observedAt` and no more than 24 hours
later; a stale candidate snapshot requires receipt regeneration and all normal
candidate gates before merge.

The trusted process uses an operator/GitHub App credential scoped to this
repository with repository Administration read, Actions read, and Checks read;
the token is never passed to a pull-request job, Vercel, a receipt, a subprocess
argument, or logs. A public-repository anonymous response is not accepted as a
substitute for the protected settings read. The helper returns typed policy
data and the server timestamp only; it never exposes the credential or raw
response headers to receipt serialization.

Beginning with the preparation candidate, `deploy.yml` places this exact
dependency-free step mapping in `db-migrations` immediately after the pinned
checkout:

```yaml
- name: Assert GitHub Actions log retention
  shell: bash
  run: node .github/scripts/assert-actions-log-retention.mjs
  env:
    BACI_ACTIONS_RETENTION_READ_TOKEN: ${{ secrets.BACI_ACTIONS_RETENTION_READ_TOKEN }}
```

The `name`, explicit built-in `shell: bash`, single-line plain `run` scalar, and
one-entry `env` mapping are literal. No `id`, `if`, `continue-on-error`,
`timeout-minutes`, `working-directory`, `uses`, expression interpolation,
multiline/folded command, wrapper, command chaining, pipe, redirect, or
background execution is allowed. A custom shell template is not the built-in
`bash` selector and fails even if it contains `bash` or `{0}`. Explicit built-in
`bash` is required because GitHub documents it as
`bash --noprofile --norc -eo pipefail {0}`; an omitted shell has different
semantics, while a custom template can replace them.

The assertion is the first executable repository script in the job on the
initial push and every full rerun. Its immediate successor is the exact
`Apply pending migrations via Management API` step with literal `shell: bash`,
the single-line plain scalar
`run: .github/scripts/apply-pending-migrations.sh`, and no other step fields.
There is no workflow-level `env` or `defaults`, no `db-migrations.defaults`,
`container`, `services`, `strategy`, or job-level `continue-on-error`, and the
job retains literal `runs-on: ubuntu-24.04`. Its job-level `env` mapping contains
exactly the existing `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` secret
entries; the assertion step's `env` contains exactly the retention token entry.
No YAML override of `NODE_OPTIONS`, `NODE_PATH`, `PATH`, `HTTP_PROXY`,
`HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`, or any other
variable is accepted at workflow scope, in `db-migrations`, or on either
controlled step. No install, generated code, caller input, or untrusted action
runs between checkout and the assertion.

The assertion owns a frozen ordered table of the seven exact candidate/
deployment receipt path pairs and parity-tests it against the migration-release
sequence and phase path policy. Exactly one candidate without its corresponding
deployment receipt means a migration candidate window is active. No unmatched
candidate is allowed only when no phase is materialized yet or every
materialized candidate has its matching deployment receipt; a gap, two open
pairs, a deployment without its candidate, or a later phase after an open pair
fails. For an active window the script reads the committed candidate receipt,
calls `Get a workflow run` for the environment-provided `GITHUB_RUN_ID`, and
first requires `GITHUB_REPOSITORY = ogabasseyy/Baci` and
`GITHUB_REF = refs/heads/main`. It requires the returned head SHA to equal
`GITHUB_SHA`, head branch to be `main`, event to be `push`, path to be the
frozen `deploy.yml`, and `run_attempt` to equal `GITHUB_RUN_ATTEMPT`. It then
performs the protected retention query against the literal repository and
requires exact candidate-policy equality, `days >= 32`, run creation inside the
candidate's 24-hour start window, and GitHub-server time before the 30-day retry
boundary. It independently re-reads branch protection, active rulesets, and
CODEOWNERS at the current main SHA and requires canonical equality with the
candidate's fresh `ciTrustAnchor`. It then paginates check runs for
`GITHUB_SHA`, allowing at most sixty five-second polls for the post-merge
guardian evaluation, and requires exactly one completed successful
`Baci Release Guardian` check from the stored guardian App id. Its `external_id`
must equal
`late-payment-v1:<policyDigest>:<ciTrustAnchorDigest>:<GITHUB_SHA>`, and its
completion must postdate the main push. Missing, duplicate-name, wrong-App,
neutral/skipped/stale, stale-policy, or wrong-SHA checks fail. A queued/in-progress
guardian check or complete absence after the five-minute poll is classified only
as retryable `GUARDIAN_PENDING`; an HTTP 429/502/503/504, a 403 carrying an
unambiguous numeric `Retry-After` or `X-RateLimit-Remaining: 0` plus future
`X-RateLimit-Reset`, or a bounded network failure is retryable
`GITHUB_API_TEMPORARILY_UNAVAILABLE`. A completed non-success guardian check,
duplicate/wrong-App check, any other 4xx, protection/policy/CODEOWNERS mismatch,
malformed response, or stale identity is never retryable. All requests use
`Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2026-03-10`,
fail on redirects, paginate to the declared total, and require the expected JSON
content type. A closed/no-phase window emits a bounded `not_applicable` result
and makes no settings or check-run request.

On success the assertion emits one bounded canonical
`late_payment_retention_preflight` semantic line containing only phase, status,
run id/attempt, run creation time, policy scalars, candidate-receipt digest, and
derived deadlines, guardian App/check identity, and the canonical trust-anchor
digest. For either allowed transient above it instead emits exactly one bounded
line of the same semantic kind with
`status = retryable_pre_side_effect_failure`, the stable error code, phase,
run id/attempt, candidate/trust digests, and observation time, then exits
nonzero. It emits that status only before invoking or importing any migration or
deploy path and never emits a token, raw headers, or response body. Any missing
secret during an active window, parsed API/status/schema mismatch, stale
candidate, retention or trust-anchor drift, completed non-success/malformed
guardian result, malformed phase topology, non-push active window, or deadline
failure is terminal and exits nonzero without a retryable marker. The migration
application and every later job must remain skipped:
`continue-on-error`, `if: always()`, shell error suppression, duplicate apply
step, or an alternate migration/deploy path is forbidden. Because the check is
inside `db-migrations`, a full rerun repeats it before any additional database
or Vercel side effect. The external checked-rerun command remains the first
guard before requesting that rerun; the in-job assertion closes the remaining
trigger-to-migration race. A terminal failure or a failure without exactly one
allowed retryable marker remains terminal for that canonical run and requires
the separately reviewed recovery path. An attempt with exactly one allowed
retryable marker and zero migration/deploy semantic lines may be retried only by
the checked full-rerun command below after the guardian main-SHA check becomes
successful. The failed attempt remains immutable evidence in the gap-free
ledger; it is not rewritten or hidden.

The repository retention setting is frozen with `deploy.yml` from candidate
capture through deployment-receipt capture. The checked
`rerun-late-payment-phase-deployment.ts` command is the only authorized retry
path. It accepts the phase and candidate identity but no run id, discovers the
same canonical run as receipt capture, re-queries retention, branch protection,
rulesets, CODEOWNERS, and the exact guardian-App check on the canonical main SHA,
requires equality with both candidate policy objects, downloads the latest
attempt's migration-job log and accepts either one successful preflight line or
one `retryable_pre_side_effect_failure` line with exactly
`GUARDIAN_PENDING`/`GITHUB_API_TEMPORARILY_UNAVAILABLE` and zero later migration,
Vercel, or release-attestation semantic lines. In the retryable case it also
requires the exact guardian check to have completed successfully after that
failed attempt and repeats every live trust/API check before requesting a rerun.
Any other failed/missing/duplicate preflight line is terminal. The command
verifies the GitHub response time is before the provider's 30-day rerun
boundary, and only then calls the full-workflow rerun endpoint. It
has no failed-job or job-specific mode. Manual UI reruns and direct `gh run rerun`
calls are outside the contract. Final capture independently re-queries the
retention and trust-anchor settings plus guardian check, requires the same exact
policies, and must complete no later than 31 days after the canonical run's
`created_at`. The 32-day minimum therefore
leaves one full day of log-retention headroom after the final capture deadline.
A retention drift, stale snapshot, late retry, or late capture is fatal even if
the required logs happen to remain downloadable; changing retention after a
run starts cannot be used as retroactive proof for logs created under an
earlier policy.

`verify-late-payment-phase-receipts.ts` is the sole candidate/receipt
secretless verifier invoked by the dispatcher. It has no live mode and imports
neither the production-target helper nor a Management API client. For a
candidate it requires exact target-hash equality with the verified root and immediate
predecessor; for a deployment receipt it additionally requires equality with
the immutable candidate receipt. The trusted
`capture-late-payment-phase-deployment.ts` path owns live post-deploy queries
and target derivation. These responsibilities cannot be switched by a CLI flag
or caller-supplied configuration.

`late-payment-phase-tree-receipt.ts` receives a base SHA and candidate head,
never a caller-selected path list. `read-late-payment-phase-git-diff.ts` first
requires the base to be the merge base and an ancestor of the head, rejects
merge commits inside the candidate range, and derives the exact NUL-delimited
name-status and before/after trees from Git with rename/copy detection enabled.
Only add, modify, and delete records for regular `100644` or explicitly
expected executable `100755` files are allowed; a rename, copy, type change,
symlink, submodule, unmerged entry, malformed path, or unexpected executable
mode fails. `late-payment-phase-path-policy.ts` owns the exact per-phase allowed
repository paths/prefixes from this implementation surface. It is a total
discriminated map for `replay_scope`, each of the seven `<phase>_candidate`
changes, and each of the seven `<phase>_receipt` changes. The replay-scope key
owns the production-target helper, GitHub retention helper and checked rerun
command, and effect-query/schema/root-receipt infrastructure and no migration.
It alone also owns `.github/workflows/ci.yml`,
the dependency-free production-secret-boundary and Actions-retention assertion
scripts/tests, the exact
`apps/web/package.json` verifier command, and the secretless PR dispatcher/test.
Those root CI files, the target and retention helpers, and the checked rerun
command are frozen after that PR. The required guardian, executing from its
separately deployed artifact and pinned policy rather than the candidate tree,
rejects any later mutation, workflow duplicate, or removal before the
candidate-controlled dispatcher runs; the in-job trust preflight repeats the
live check before production side effects. Later lanes may execute these files
but cannot establish their own permission to alter or bypass them. The frozen
workflow shape requires `fetch-depth: 0`, no checkout `filter` or
`sparse-checkout` input, and
`persist-credentials: false`; a later lane cannot restore a blobless/partial
clone, rely on a lazy fetch, or retain credentials. The replay-scope exception
for `ci.yml` does not permit the production deployment or release-attestation
surface. The preparation-candidate key alone additionally owns
`.github/workflows/deploy.yml`,
`apps/web/next.config.ts`, the release-build/identity/schema/route/verifier
files, `env.ts`, `vercel.json`, and
`late-payment-deploy-release-shape.test.ts`; those files are forbidden in the
earlier replay-scope PR because the readiness RPC does not yet exist, and in
every later candidate/receipt because deployment attestation is then frozen.
The guardian bootstrap source, policy, receipt/signatures, CODEOWNERS, durable
store/redelivery worker, and VPS unit/deploy surface sit outside every payment
phase lane. Their approved hashes are a predecessor
prerequisite rather than candidate-owned paths; any change during this rollout
is rejected by the required external App check and requires the separate
guardian replacement ceremony above.
Shared candidate outputs are limited to the materialization marker, checked
extension hashes, candidate receipt, generated types, and files explicitly
owned by that phase. Shared receipt outputs are limited to the post-deploy
receipt, linked/effect/provenance fixtures, exact manifest scalars, phase
deployment receipt, and their verification tests; a receipt PR cannot change
runtime or verifier logic. The policy test enumerates every mutable path in this
implementation surface, requires it to belong to at least one explicit key,
rejects an unknown/broad catch-all prefix, and proves that any multi-key path is
one of those named shared outputs. A changed path outside the selected key, a
future migration, or a frozen replay/deploy contract change fails even though
it could be hashed.
Missing sides use fixed all-zero mode/hash sentinels. The canonical
record set must equal the Git diff path set with exactly one permitted omission:
the phase's own candidate-receipt path. The omitted receipt must exist as a
regular file at candidate head, and no other changed path may be unrecorded.
Generation is therefore a two-commit operation: commit candidate source/tests,
generate the receipt from that committed head, then commit only the receipt;
CI recomputes against the final PR head and observes the same records plus that
single allowed receipt omission.

The trusted deployment-receipt capture repeats this Git derivation from the
declared base to the immutable deployed SHA. The squash commit's sole parent
must be the exact base and its tree must equal the verified candidate PR tree.
A rebase merge, merge commit, extra parent, different tree, or intervening
commit is fatal. The
recomputed canonical records and tree digest must equal the candidate receipt;
deployment evidence cannot bless a different path set merely because selected
migration files still match.

After each migration phase deploys, no next-phase migration may be merged yet.
An application-only post-deploy receipt PR must:

1. bind the one canonical push-created `deploy.yml` workflow run for the
   candidate `headSha` and capture its complete contiguous `run_attempt`
   sequence from `1` through `N`, where `1 <= N <= 51`: the initial attempt plus
   GitHub's provider maximum of 50 reruns. Every retry is a full rerun of that
   same workflow run, never a failed-job-only rerun, job-only rerun, new
   `workflow_dispatch` run, or caller-selected replacement run. Each attempt
   records the same workflow run id, its exact run-attempt number, migration job
   id, workflow/job conclusion, exact retention-preflight semantic object and
   line digest, ordered applied/already-applied/skipped migration summary, and
   bounded sanitized semantic migration-log lines plus their digest. A
   retryable pre-side-effect attempt records empty migration/deploy summaries
   and the allowed error code; every other attempt records a successful
   preflight before any side effect. Attempt numbers must be unique and gap-free, the API's latest
   attempt must equal `N`, attempts `1..N-1` must have non-successful workflow
   conclusions, the last attempt must succeed, and every earlier failure remains
   in evidence. A missing/omitted attempt, mixed run id, extra
   same-SHA deployment run during this candidate window, missing attempt/log
   response, or truncated workflow-run/job page is fatal. If attempt 51 does
   not succeed, the phase is exhausted: keep the
   merge freeze and current safety mode, create no receipt, merge no next phase,
   and require a separately reviewed recovery design rather than starting an
   unaudited replacement run;
2. query the linked migration ledger and effect scope through the existing
   read-only management path, require the new tail/prefix and candidate effect
   hash, and update `supabase-history-post-deploy-receipt.ts`,
   `linked-migration-ledger.json`, `production-history-effects.json`, only the
   linked-ledger receipt inside `production-effect-provenance.json`, and their
   exact manifest hashes/scalars;
3. write `<phase>-deployment.json`, binding the deployed merge `headSha` and
   its recomputed tree receipt to the immutable candidate-receipt bytes read
   with `git show` from that SHA, requiring each phase version to be
   registered exactly once in the final linked ledger, and allowing an earlier
   nontransactional attempt to have created an exact resumable index only when
   its captured failure plus final successful retry prove that sequence; and
4. run `db:replay:chronological` and `db:replay:production-effect` in
   `enforce`, plus semantic-log verification, before merge.

`capture-late-payment-phase-deployment.ts` owns this refresh. It derives counts,
tail, inventory/effect hashes, retention evidence, trust-anchor/guardian-check
evidence, and deployment-attempt evidence from the checked candidate plus
read-only APIs; callers cannot supply a run id, attempt number, attempt subset,
retention/trust value, App/check id, timestamp, deadline, or those derived
values. Before workflow discovery it verifies both candidate server-timestamped
snapshots are fresh for the eventual canonical run; before downloading logs it
re-queries retention, protection, rulesets, CODEOWNERS, and the exact guardian
checks and requires exact policy equality plus a GitHub-server response time no
later than the canonical `created_at + 31 days` capture deadline. It paginates `List
workflow runs for a workflow` twice for the frozen `deploy.yml` workflow and
candidate `head_sha`:
the `event = push`, `branch = main` view must contain exactly one canonical run,
and the all-event view must contain no second same-SHA run during the candidate
window. It then calls `Get a workflow run` for that id and takes its completed
latest `run_attempt = N` as the closed upper bound; there is no assumed
list-attempts endpoint. For every integer `k` from `1` through `N`, it calls
`Get a workflow run attempt(run_id, k)`, requires the returned id, head SHA,
event, workflow path, status, conclusion, and `run_attempt` to match, paginates
`List jobs for a workflow run attempt(run_id, k)` through its declared total,
requires the complete full-rerun job topology and exactly one migration job,
then calls `Download job logs for a workflow run(migration_job_id)` for that
job before extracting and hashing the bounded semantic lines. Every candidate
attempt must contain exactly one `late_payment_retention_preflight` line. A
side-effecting attempt requires `status = success` before its first migration
semantic line. A non-side-effecting failed attempt may instead contain exactly
`status = retryable_pre_side_effect_failure` with one of the two allowed codes
and must contain zero migration, Vercel, or release-attestation semantic lines.
Its phase, run id/attempt, policy, candidate digest, trust digest, and deadlines
must equal independently derived receipt/API facts. A missing, duplicate,
unknown failed, `not_applicable`, reordered, or post-migration line is fatal. Every
request to the GitHub REST API uses `Accept: application/vnd.github+json` and
the checked `X-GitHub-Api-Version: 2026-03-10`. The log call must return one HTTPS `302`
location; the tool fetches that short-lived signed URL without forwarding the
GitHub authorization header and never logs the URL. Any retention/trust
mismatch, stale candidate snapshot, late capture, attempt 404, missing/expired log
redirect, job-total/page mismatch, metadata mismatch, same-SHA replacement run,
or noncontiguous evidence fails capture. The deployment receipt binds the
candidate and final retention/trust observations; exact guardian PR-head and
main-SHA check-run ids/App/external ids;
canonical run `created_at`; retry deadline; and capture deadline alongside the
attempt ledger, including every immutable retryable pre-side-effect failure. It stages all
generated bytes, validates the complete cross-bound receipt/fixture/
provenance/manifest set in memory, then replaces files only as one rollback-safe
operation. A partial write restores every prior byte and fails. `--verify-only`
recomputes without mutation; the normal capture command refuses a dirty target
file, symlink, broader mode, candidate-SHA mismatch, exhausted canonical run, or
an unrelated pending migration.

Hold a merge freeze from each candidate merge through its receipt-PR merge and
healthy zero-migration deployment. Between phases, rebase onto current `main`.
An unrelated application-only merge is allowed only after the candidate tree
receipt and full gates are regenerated. Once the no-migration replay-scope root
is approved, the guardian activates a **global migration freeze** through the
healthy final-production receipt: every PR outside the exact next reviewed
candidate lane that adds, removes, renames, or modifies a top-level
`supabase/migrations/*.sql` file fails the required guardian check. The current
phase state, materialized prefix, expected next candidate path set, and complete
reserved suffix are derived from the frozen manifest and deployed receipts, not
from a caller flag. Receipt PRs remain migration-free.

The root replay-scope receipt is never recaptured after
`materializedThrough` becomes non-null: its contract deliberately requires the
absence baseline and all 74 feature files absent. If an emergency bypass or
external incident nevertheless changes top-level migration history after the
preparation phase materializes, stop with the current safety mode and merge
freeze; do not renumber an applied prefix, apply the remaining suffix out of
historical order, or claim a fresh replay-scope receipt. Continuing requires a
separately reviewed **post-materialization recovery design** that binds the
already applied prefix, independently proves the new production/repository
ledger, allocates any residual lane safely, refreshes replay/effect baselines,
and replaces the guardian policy/receipt before another candidate opens.
An intervening replay tool/fixture, effect-scope, deploy-workflow, guardian, or
other protected-control change likewise cannot be normalized by a compatibility
receipt; it requires the guardian replacement ceremony and a new reviewed
recovery design. The original replay-scope receipt may be regenerated only for
drift discovered before that root PR receives its successful guardian main-push
check. Once that check activates the freeze, `materializedThrough = null` alone
does not authorize a second root or replacement baseline.

The receipt PR contains no migration and does not advance
`materializedThrough`. Its `apps/web/**` fixture/test changes deliberately
deploy the same runtime at a receipt commit SHA with zero pending migrations.
Only that healthy receipt commit is the predecessor for the next candidate PR.
The enforcement deployment receipt PR additionally writes
`final-production.json` and becomes the audited armed application SHA. The
checked receipts bind the enforcement candidate and live database evidence but
do not attempt to embed the receipt PR's own unknowable commit SHA. The receipt
deployment's workflow metadata and protected release-attestation response prove
that final SHA, production target, paused deployment id, stable release-identity
digest, `agenticPaystackDvaMode = 'paused'`, and live readiness. The later armed
deployment of the same SHA must
return the same target, a different normalized deployment id, its exact workflow
run id/attempt, `checkoutMode = 'enabled'`,
`agenticPaystackDvaMode = 'paused'`, and `dbReady = false`. The activation
script stores the SHA, armed deployment id, and canonical release-identity
digest in the immutable activation event; mutable readiness remains outside the
digest, so an exact enabled-state replay can require `dbReady = true` without
changing activation identity. No recursive receipt-of-receipt PR is created.
The
exact pre-deploy commands remain the existing replay CLI invoked directly with
`--comparison-mode classify`, both modes, and repeatable phase `--sql-check`
files; post-deploy receipt PRs use the normal enforce scripts and the checked
capture tools. Raw `supabase db reset`, hand-edited fixture JSON, a log excerpt
without API-bound job metadata, or combining a receipt with the next migration
phase is not a substitute.

Database changes must be append-only in:

- preparation bundle:
  - `supabase/migrations/20260719115600_internal_credit_control_schema.sql`
  - `supabase/migrations/20260719115605_internal_credit_checkout_intent_schema.sql`
  - `supabase/migrations/20260719115610_internal_credit_control_read_rpcs.sql`
  - `supabase/migrations/20260719115615_internal_credit_control_mutation_rpcs.sql`
  - `supabase/migrations/20260719115620_provider_cancellation_attempt_schema.sql`
  - `supabase/migrations/20260719115625_provider_cancellation_prepare_record_rpcs.sql`
  - `supabase/migrations/20260719115630_provider_cancellation_recovery_rpcs.sql`
  - `supabase/migrations/20260719115635_terminalization_contract_shells.sql`
  - `supabase/migrations/20260719115640_internal_credit_reconciliation_shells.sql`
  - `supabase/migrations/20260719115690_preparation_contract_gate.sql`
- fence bundle:
  - `supabase/migrations/20260719115700_internal_credit_checkout_fence_helpers.sql`
  - `supabase/migrations/20260719115705_internal_credit_fence_legacy_inner_renames.sql`
  - `supabase/migrations/20260719115710_internal_credit_fence_storefront_adapters.sql`
  - `supabase/migrations/20260719115715_internal_credit_fence_redemption_adapters.sql`
  - `supabase/migrations/20260719115720_internal_credit_fence_finalizer_adapters.sql`
  - `supabase/migrations/20260719115730_internal_credit_function_registry.sql`
  - `supabase/migrations/20260719115740_internal_credit_fence_contract_gate.sql`
- `supabase/migrations/20260719115750_order_abandonment_candidate_index.sql`
- owner-expand bundle:
  - `supabase/migrations/20260719115800_order_notification_owner_schema.sql`
  - `supabase/migrations/20260719115805_order_creation_authorization_contract.sql`
  - `supabase/migrations/20260719115810_order_inventory_allocation_schema.sql`
  - `supabase/migrations/20260719115815_order_inventory_allocation_capture_helpers.sql`
  - `supabase/migrations/20260719115820_order_inventory_allocation_unwind_helpers.sql`
  - `supabase/migrations/20260719115825_payment_reconciliation_alert_schema.sql`
  - `supabase/migrations/20260719115830_payment_reconciliation_alert_rpcs.sql`
  - `supabase/migrations/20260719115835_storefront_owner_allocation_adapters.sql`
  - `supabase/migrations/20260719115840_order_item_replacement_adapters.sql`
  - `supabase/migrations/20260719115845_terminalization_authorization_contract.sql`
  - `supabase/migrations/20260719115850_allocation_safe_terminalizer_core.sql`
  - `supabase/migrations/20260719115855_customer_merchant_terminalizer_adapters.sql`
  - `supabase/migrations/20260719115860_shipping_payment_terminalizer_adapters.sql`
  - `supabase/migrations/20260719115865_abandonment_cleanup_claim_contract.sql`
  - `supabase/migrations/20260719115870_provider_cancellation_allocation_contract.sql`
  - `supabase/migrations/20260719115875_paid_order_side_effect_schema.sql`
  - `supabase/migrations/20260719115880_paid_order_claim_completion_contract.sql`
  - `supabase/migrations/20260719115885_payment_orchestration_proof_config.sql`
  - `supabase/migrations/20260719115886_order_dva_customer_consent_schema.sql`
  - `supabase/migrations/20260719115887_order_dva_customer_consent_challenge_rpc.sql`
  - `supabase/migrations/20260719115888_order_dva_customer_consent_recording_rpc.sql`
  - `supabase/migrations/20260719115889_order_dva_customer_consent_backstop.sql`
  - `supabase/migrations/20260719115890_owner_expand_contract_gate.sql`
- late-payment contract bundle:
  - `supabase/migrations/20260719120000_order_dva_epoch_schema.sql`
  - `supabase/migrations/20260719120005_order_dva_projection_contract.sql`
  - `supabase/migrations/20260719120010_order_dva_compatibility_triggers.sql`
  - `supabase/migrations/20260719120014_payment_review_contract_extensions.sql`
  - `supabase/migrations/20260719120015_wallet_dva_bank_identity_schema.sql`
  - `supabase/migrations/20260719120020_wallet_dva_bank_identity_repair_rpcs.sql`
  - `supabase/migrations/20260719120025_payment_initialize_context_rpc.sql`
  - `supabase/migrations/20260719120030_payment_initialize_persistence_rpc.sql`
  - `supabase/migrations/20260719120035_order_dva_assignment_rpc.sql`
  - `supabase/migrations/20260719120040_order_dva_reservation_classifier.sql`
  - `supabase/migrations/20260719120045_order_dva_transaction_link_rpcs.sql`
  - `supabase/migrations/20260719120050_paystack_reference_role_audit_contract.sql`
  - `supabase/migrations/20260719120055_paystack_reference_resolver_claim.sql`
  - `supabase/migrations/20260719120060_paystack_wallet_dva_reservation.sql`
  - `supabase/migrations/20260719120065_paid_order_settlement_identity_helpers.sql`
  - `supabase/migrations/20260719120070_paid_order_settlement_wrapper.sql`
  - `supabase/migrations/20260719120075_paid_order_retry_seed_contract.sql`
  - `supabase/migrations/20260719120080_gateway_initialization_intents.sql`
  - `supabase/migrations/20260719120085_gateway_initialization_orchestration_rpcs.sql`
  - `supabase/migrations/20260719120090_internal_credit_evidence_helpers.sql`
  - `supabase/migrations/20260719120095_internal_credit_common_finalizer.sql`
  - `supabase/migrations/20260719120100_wallet_payment_finalizer.sql`
  - `supabase/migrations/20260719120105_store_credit_payment_finalizer.sql`
  - `supabase/migrations/20260719120110_terminal_payment_snapshot_contract.sql`
  - `supabase/migrations/20260719120115_cancellation_compensation_core.sql`
  - `supabase/migrations/20260719120120_compensation_terminalizer_adapters.sql`
  - `supabase/migrations/20260719120125_abandonment_customer_cancellation_adapters.sql`
  - `supabase/migrations/20260719120130_order_notification_owner_final_adapters.sql`
  - `supabase/migrations/20260719120135_internal_credit_activation_rpc.sql`
  - `supabase/migrations/20260719120190_late_payment_contract_gate.sql`
- post-contract concurrent reference index:
  - `supabase/migrations/20260719120200_paystack_external_reference_unique_index.sql`
- enforcement bundle:
  - `supabase/migrations/20260719120210_order_payment_account_enforcement_helpers.sql`
  - `supabase/migrations/20260719120220_order_payment_account_enforcement_cutover.sql`

Every migration is at most 300 physical lines, has one primary concern, and
must not be minified to evade the limit. Intermediate files are additive and backward-compatible;
they may install versioned private implementations, but no readiness,
registry, owner, terminalization, or enforcement state advances until that
bundle's final gate has catalog-verified every expected function definition,
trigger, constraint, index, grant, and prior migration. Public wrapper/grant
swaps stay dual-schema compatible until the final gate performs the atomic
version transition. Concurrent indexes remain isolated. The complete catalog,
current materialization phase, and hash-bound post-base replay extensions are
the three machine-readable views described above. Their tests require the exact
present prefix, exact absent suffix, ordering, hashes, and 300-line cap and
reject an extra, renamed, or prematurely gated file. Prose refers to gate
filenames rather than duplicating bundle counts.

The `12014` review-contract extension is a strict lexical dependency of `12015`,
`12020`, `12035`, and `12060`, not a later convenience migration. A clean replay
fixture seeds active and disabled legacy wallet rows whose banks cannot be
canonicalized, applies migrations only through `12014`, proves the new wallet
review types/indexes/helper branches and alert whitelist exist, then applies
`12015` and proves active quarantine plus disabled-status/reason preservation
and durable review/alerts commit. A second fixture reaches the receiver-owner and
order-identity branches through `12020`, the reciprocal order-assignment branch
through `12035`, and the atomic webhook reservation branch through `12060`.
Reordering, omitting, or making `12014` depend on any later migration is a test
failure.

These timestamps are reserved only after a final implementation-time recheck
against the latest `main` migration tail and linked production migration
ledger. If any is occupied, applied, or out of order, allocate a fresh
consecutive lane and regenerate the complete manifest; never reuse or edit an
applied migration.

The behavior-neutral preparation bundle, from
`20260719115600_internal_credit_control_schema.sql` through
`20260719115690_preparation_contract_gate.sql`, creates the
RLS-locked control singleton, immutable control-event table, checkout-intent
table, read-only readiness RPC, authenticated begin primitive, service-only
status/emergency-drain/drain-finalization primitives, and fail-closed
completion/abort/reconciliation contract shells. It also creates the RLS-locked
terminalization-contract singleton at `legacy_direct_v0` and its no-data
version RPC. Finally, it creates the additive RLS-locked provider-cancellation
attempt and immutable event tables, typed prepare/result functions, service-role bounded
recovery-claim/backoff functions, and attempt-aware compatibility finalizer
whose local body delegates to the unchanged current cancellation function. The
attempt constraint includes the exact call-claimed/cancelled/rejected/unknown/
locally-finalized/manual-review states and prevents more than one active attempt
per shipment. It replaces no current signature, trigger, or order path, so the old
application is unaffected; the prepared application keeps the saga dormant and
rejects new provider cancellation before any external call until expand
advertises `allocation_safe_v1`. It creates the checkout singleton in
state `paused` and changes no current financial function, grant, trigger, order
path, or checkout result. It is
intentionally safe to run before the prepared application.

The separate fence bundle, ending in
`20260719115740_internal_credit_fence_contract_gate.sql`, runs only after that
application is live and route traffic has drained. It creates the shared fail-closed
assertion, replaces the exact legacy creation/redemption/finalizer allowlist
only far enough to invoke the assertion before mutation, and creates the
versioned function-contract registry and registry-state singleton with canonical
definition digests and expected grants under `fence_v1`. It preserves
old-schema result shapes, adds no notification-owner column, and does not
activate checkout.

The separate `20260719115750` index migration runs after the fence release and
before expand. It starts with `-- disable-transaction`, verifies that any
existing index with its stable name has the exact expected keys and predicate,
and creates
`orders_abandonment_candidates_created_at_id_idx` on `(created_at, id)` with
`CREATE INDEX CONCURRENTLY IF NOT EXISTS`. Its static predicate covers exactly
the payment and BNPL states that can enter bounded cleanup. It verifies the
catalog definition after creation and is safely resumable if migration-history
registration fails. It changes no function, type, or application behavior and
therefore ships in an index-only PR while the prepared application remains
unchanged.

The owner-expand bundle ending in
`20260719115890_owner_expand_contract_gate.sql` is deployed by itself while
`INTERNAL_CREDIT_CHECKOUT_MODE=paused`. It adds the nullable checked owner
column, the one-time classification trigger, the RLS-locked migration-state
singleton, decision table and classification RPC, and the complete
private/public storefront RPC return-shape replacements. The trigger also
derives only exact Bumpa/Jumia/import inserts as `not_applicable` and rejects
every other post-cutoff null owner. The singleton persists
the exact legacy cutoff used by both the CLI and the final contract gate; it
contains no internal-credit activation fields. It also updates
`private.create_quiz_product_prize_award_with_inventory` so newly reserved quiz
orders are creation-owned, replaces the private/public chat conversion to stamp
creation ownership plus allocation evidence, and requires the Bumpa/Jumia
application insert paths to stamp `not_applicable`. Every new deferred-payment storefront order receives
`payment`; invoice, pay-on-delivery, and covered quiz creation flows receive
`creation`. Every replaced internal-credit-capable function retains the
preparation fence. The paid-order side-effect module extends the paid-order push-step constraint and
replaces `claim_payment_side_effect` with the transaction-aware result and
same-owner takeover rules described above. It also replaces
`complete_order_gateway_payment` with the atomic
`merchant_push_contract = claimed_v1` result and full payer-owned step seeding
described above: paid email, ad tracking, gateway settlement, payment received,
and owner-selected new order. Before those mutations it honors an active
provider-cancellation hold and returns the typed durable-review outcome. Its
result also returns the locked
`payer_transaction_id`, `inventory_contract`, and committed inventory counts,
and rejects mixed payer ownership. The paid-order claim/completion module replaces
`private.confirm_order_inventory_reservations` with the per-item-counter
implementation and stable SQLSTATE `55000` diagnostics. The earlier alert
schema/RPC modules install the minimal `payment_reconciliation_alerts` outbox, claim/finish/retry functions,
ungranted private typed review/enqueue primitive, and service-role
review-and-alert wrapper required by
strict-inventory, gateway-wedge, payment-during-cancellation,
provider-cancellation-unknown, terminal-allocation, legacy-allocation, and
abandoned-cleanup failures, plus transaction/reference-scoped
payment-received-after-cancellation/refund captures, including the attempt-token
review deduplication index and broad-order-index exclusions. The preparation
application's claim and completion validators are already able to consume both
old and new result shapes before the bundle begins.
The allocation-evidence module creates immutable order-item allocation evidence and its
legacy audit state/decision tables, adds the serialized-unit and inventory-event
allocation linkage with exactly named `DEFERRABLE INITIALLY DEFERRED` foreign
keys, stamps every new storefront and quiz item, and creates the selected-allocation
unwind primitive, order-level terminalization wrapper, and immutable unwind-event table before replacing both
order-item replacement RPCs with allocation-preserving or atomic-rebalance
behavior. It adds the `legacy_inventory_allocation_ambiguous` checked issue
type, exact item/fingerprint review deduplication, and expand-phase
review-and-alert support required by the audit CLI. The allocation-safe
terminalizer and provider-cancellation modules stage the
private one-shot terminalization authorization table, strict trigger definition,
allocation-safe provisional versions of the complete terminalization allowlist,
allocation-safe replacements of the prepared provider-cancellation saga,
the service-role exact-fingerprint provider-cancellation review-decision RPC,
durable abandonment claim/attempt state and one-order terminalization RPC, and the
final structured terminal result shapes. Those functions unwind from immutable
allocation evidence, reject active uncompensated credit before mutation, and
remain dual-schema compatible while staged. The final owner-expand gate binds
the strict trigger and changes the terminalization-contract version to
`allocation_safe_v1` only after catalog-verifying every prepared RPC path. A
direct writer crossing that gate commit is rejected instead of committing a
terminal order without unwind.
The proof-config module creates the private current/previous
payment-orchestration route-proof secret
configuration, proof validator, and no-data configuration preflight without
changing a current DVA path; the expand application supplies the matching proof
helper and configuration CLI before contract cutover.
The immediately following four consent modules record the immutable consent
cutoff, create the append-only customer receipt and bounded guest challenges,
install their proof-gated RPCs, and install the post-cutoff account-persistence
backstop. Because the preparation app has
already stopped all provider calls while this capability is absent, the
schema-first window cannot generate a new DVA without customer action. Once the
module commits, that same app records consent before provider access, allows
merchant routes to reuse but never manufacture the receipt, and emits only the
ordinary payment link plus consent CTA when no receipt exists.
The final owner-expand gate catalog-verifies every staged function replacement,
refreshes the active registry manifest, and commits the registry transition to
`owner_expand_v1` together with the terminalization transition; no earlier
module advances either state.
The expand application additionally consumes and preserves the new order and
allocation contracts and generated types. Wallet and savings checkout remains
unavailable until the contract application is deployed and verified.

Before the post-contract index PR is merged, the operator runbook must verify
and archive the signed zero-unclassified reference-role report. The automatic
deploy receives no report and derives no authorization from one. The
`20260719120200_paystack_external_reference_unique_index.sql` migration itself
must start with `-- disable-transaction`, rerun the database-native
zero-unclassified/evidence and role-aware canonical-reference duplicate
preflights, and create the unique
expression index
`transactions_paystack_external_reference_uidx` with
`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS`. Before creation, it must fail
if an index with that name exists but its catalog definition does not match the
expected keys, uniqueness, expression, or predicate; after creation, it verifies
the definition and repeats the current-row role/evidence/duplicate preflight so
a race prevents migration-history registration. This is required
because Baci's non-transactional migration runner executes statements before
recording migration history: if history registration fails after index
creation, the next deployment must safely resume instead of failing on an
already-created index. The migration must never delete, merge, or rewrite
transactions to make the unique index succeed.

The late-payment contract bundle, from
`20260719120000_order_dva_epoch_schema.sql` through
`20260719120190_late_payment_contract_gate.sql`, must preserve and
catalog-verify
the baseline `unique_order_account` constraint for old-application upsert
compatibility; create the RLS-locked immutable
`order_payment_account_epochs` table with supersession, transaction-link, touch,
immutable assigned-customer identity, and partial one-current-epoch indexes
plus the RLS-locked append-only
`order_payment_account_epoch_capture_links` table and reciprocal link-role
checks and the one-per-order immutable `order_dva_terminal_snapshots` table;
add the current projection's
`current_epoch_id`, `payment_transaction_id`, touch marker, behavior-neutral
PostgreSQL-owned `SECURITY DEFINER` insert-normalizer/after-insert/before-update
compatibility trigger topology, deferred
projection/epoch/capture-link/terminal-snapshot checks, and contract-state cutoff;
install the dependency-closed `12014` extension to the existing expand-phase
alert and review contract for ambiguous, zero-candidate, invalid-wallet-
timestamp, `wallet_dva_bank_identity_repair_required`,
`wallet_dva_assignment_identity_unresolved`,
`wallet_dva_assignment_identity_conflict`,
`wallet_dva_receiver_owner_conflict`,
`wallet_dva_existing_identity_conflict`,
`wallet_dva_disabled_reactivation_required`, external-reference-role,
epoch-scoped assignment-contract and historical-identity-unresolved,
`historical_provider_evidence_unavailable`,
`historical_provider_evidence_conflict`, retry-seed, and internal-credit issue
types, their stable open-fingerprint indexes, the wallet-type exclusions from
the broad order index, alert whitelists, and the dedicated
`record_paystack_historical_evidence_outcome(jsonb, text)` RPC before any wallet
backfill;
add and
backfill the wallet `bank_identity`, quarantine invalid legacy wallet-bank
evidence with durable repair reviews, preserve the customer/provider unique
index, replace both wallet owner cascades with exact validated delete
restrictions, add the same-provider-identity in-place reactivation contract, replace
the global wallet account-number unique index with the bank-aware identity
index, install the `legacy_direct_v0` capability plus nonblocking compatibility
trigger and immediately narrow runtime table grants to the exact legacy
select/insert matrix, then
atomically flip that capability to `rpc_v1` and revoke the remaining direct
service-role insert only after the authenticated route-proof-gated atomic
`persist_customer_wallet_payment_account` RPC whose assignment-time order-alias
classification and wallet insert/reactivation share the owner-before-account
advisories and one transaction and whose public result separates insertion,
replay, reactivation, and conflict outcomes; the narrow
payment-initialize context RPC, proof-gated ordinary gateway persistence RPC,
proof-gated atomic DVA assignment RPC, and audited service-role historical
epoch-link repair RPC; external-reference resolver RPC;
the private receiver-bank normalizer, immutable provider-customer parser and
repair contract, bank-aware wallet lookup/persistence contract, and all-epoch
bank-aware order reservation RPC;
the append-only reference-role audit decisions, audited legacy Paystack
reference-role classifier and fail-closed
unclassified-role outcome; atomic external-reference claim RPC; the
transaction-aware order-settlement wrapper and
lock-compatible replacement of the existing settlement RPC; paid order
review-type constraint changes;
monotonic, conflict-filing
`seed_paid_order_side_effect_retries` RPC; table-returning replacements for
`finalize_wallet_order_payment` and
`finalize_store_credit_order_payment`; full replacements for the preparation
intent completion/abort/reconciliation shells; the durable
`gateway_initialization_intents` table, authenticated replay result, and
service-only claim/finish/reconciliation functions; the savings-redemption reversal
fields, pre-redemption snapshot, private strict-inventory reversal helper, and
internal-credit reversal-conflict review contract; the shared cancellation
compensation helper composed around the already-installed policy-aware
allocation unwind; compensation-aware replacements for the already-installed
provider cancellation saga and exact terminalization allowlist including
`canceled`, `returned`, and `refunded`, with first-terminal DVA residual
snapshot capture; the provider-prepare/ready-replay
transition that places a linked ready gateway initialization into
attempt-scoped `reconciliation_required` before external cancellation or URL
replay;
retirement of `claim_paystack_paid_atomic`; the structured customer
cancellation and one-order claimed-abandonment compensation adapter while preserving
their expand-phase result shapes and cleanup-attempt state; the checked-in
direct-writer caller-surface gate and staged compensation contract;
the cancelled-order audit-decision table, fingerprint RPC, and dedicated
historical review type; and the
`internal_credit_cancellation_reversal_conflict` review contract; the
`complete_order_gateway_payment` amount synchronization update while preserving
the complete `claimed_v1` seed and return contract installed by the owner-expand
bundle; and the pause-generation-aware
`activate_internal_credit_checkout` RPC. The internal-credit replacements use
the exact checkout-intent plus redemption-id signatures and replay-first,
candidate-excluding ledger validation contract above, bind or validate the same
intent on every creation, redemption, handoff, and completion entrypoint,
reject tokenless mutation, terminalize successfully compensated
strict-inventory orders through the shared inventory unwind, and leave no
amount-taking or tokenless compatibility overload. The compensation module
stages the terminalizer definitions without changing the advertised
terminalization version; the final gate advances it to `compensation_v1` only
after the direct-writer scan and every historical/contract preflight pass. Each
module stages its exact
expected definition/grant manifest without advancing the active registry; the
final gate performs the one transition to `late_payment_v1`. The
activation RPC verifies the exact mutation and terminalization definition
registry, grants, owner contract gate, and current-fingerprint historical audit
before it can update the separate control singleton. It must apply the RPC
security contract and explicit grants above.

The owner-contract adapter module
`20260719120130_order_notification_owner_final_adapters.sql` and final
`20260719120190_late_payment_contract_gate.sql` run only after the
notification-owner and inventory-allocation classification gates have passed.
The owner-contract module installs versioned final function implementations and
catalog-verification helpers without changing the public owner constraint,
dropping the classifier, or advancing registry state. The final gate reads both
persisted cutoffs and aborts when any order owner is null, any pre-cutoff order
lacks an owner decision, any inventory-live pre-cutoff order item lacks a
proven allocation or exact open manual review, or any decision references a
post-cutoff row. It also aborts if
`internal_credit_checkout_control.state` is not `paused`, or its
`contract_sha`, `activated_deployment_id`, `activation_attestation_sha256`, or
`activated_at` is already non-null, because first activation
is an application-readiness operation that must occur only after this bundle
and its application are live. In that same final-gate transaction it changes
the column to `NOT NULL` without a default, verifies the explicit insert
surface, installs
the strict immutability trigger, drops the classification RPC, and replaces the
storefront RPCs with the final cutover mapping in which every deferred-payment
order remains payment-owned. After those final function replacements and grants,
it verifies that every private/public storefront function still exposes the
trailing optional checkout-intent argument and preserves binding on insert and
replay, refreshes their registry rows, retires the owner-classification
signature, sets the registry-state version to `late_payment_v1`, and asserts the
final active manifest. The
associated application revision removes the direct internal-credit email and
push calls, begins and passes the checkout intent plus exact redemption ids to
the ledger-authoritative finalizers, requires the already-prepared
terminalization dispatcher to observe `compensation_v1` and validates its
compensation-aware outcomes, removes the now-unreachable `legacy_direct_v0`
write branches from the contract revision, routes every DVA assignment through the shared signed-proof
wrapper without a user-facing service-role client, schedules the targeted
internal-credit worker nudge without privileged route claims, and dispatches
internal-credit failed-side-effect retries without gateway verification. It also
ships the no-provider, no-mutation authenticated wallet-persistence contract
verifier used by the production receipt gate. It is
deployed and health-checked while internal-credit checkout is still paused.

The enforcement bundle ending in
`20260719120220_order_payment_account_enforcement_cutover.sql` is a later
migration-focused release; the normal workflow still redeploys the unchanged
contract application at the enforcement commit SHA.
It runs only after the contract application's assignment routes are live, the
15-minute legacy-call drain has elapsed, the post-contract Paystack reference
index is recorded with its exact catalog definition, and the signed post-cutoff
assignment audit passes. It repeats the cutoff/touch/identity/link/terminal-snapshot
preflight in SQL and classifies every current order-DVA/retained-wallet receiver
collision with the same fingerprint contract. A still-payable collision must
have its exact open purpose-conflict review and remains non-renderable and
non-automatchable; a post-contract assignment collision is a blocker because
the new RPC should have rejected it. It then revokes direct
client write grants and policies, installs immutable epoch/current-supersession
and linked-assignment triggers, and records the enforcement state. It changes no application result shape and
is safe for the already-live contract application, which writes only through
the proof-gated RPC.

That redeploy is a checked release invariant, not an assumption about GitHub
Actions. The replay-scope PR, every migration candidate PR, and every
post-deploy receipt PR change a marker, hash, fixture, test, or receipt under
`apps/web/**`. The current `.github/workflows/deploy.yml` classifies that path
as `web = true`, and `deploy-production` runs when `web = true`; therefore even
the reference-index/enforcement candidates and all zero-migration receipt
commits receive a health-checkable application `headSha` while runtime output
is unchanged. The replay-scope deployment deliberately uses that existing
health contract; it does not install or invoke the new attestation route.
Beginning with the preparation candidate—whose database job creates the
readiness RPC before its application deploy—the production build also receives
`BACI_RELEASE_SHA = github.sha`, `BACI_RELEASE_WORKFLOW_RUN_ID = github.run_id`,
`BACI_RELEASE_WORKFLOW_RUN_ATTEMPT = github.run_attempt`,
`BACI_RELEASE_ENVIRONMENT = production`, and
`BACI_RELEASE_CANONICAL_ORIGIN = https://ogabassey.com` alongside the existing
`BACI_NEXT_DEPLOYMENT_ID_SOURCE` and `VERCEL_PROJECT_ID`.
`release-build-attestation.ts` validates and hashes the project id, rejects
missing/malformed production-build values, and exposes only validated
non-secret constants to the server route; local development cannot fabricate a
production attestation.

Before the preparation PR merges, the operator provisions the same independent
minimum-32-byte `RELEASE_ATTESTATION_SECRET` in the GitHub production
environment and Vercel production environment without printing or passing it as
a workflow input. Missing configuration blocks merge; the first protected
production-alias request after preparation deploy proves the two stores agree.
After alias promotion, the workflow verifier requests only the fixed canonical
URL with redirect mode `error`, requires HTTP `200` and the final response URL
to be identical, derives the expected project-id hash only from its own trusted
production `VERCEL_PROJECT_ID`, and validates exact hash equality, production
environment, canonical origin, full SHA, normalized deployment id,
run id/attempt, externally observable
`Cache-Control: no-store` and `CDN-Cache-Control: no-store`, and strict body
shape. It deliberately does not require the edge-consumed
`Vercel-CDN-Cache-Control` header in this public response. A cached response,
preview/staging target, redirect, malformed body, or alias still serving an
earlier deployment fails the job.

`late-payment-deploy-release-shape.test.ts` remains preparation-only and parses
`deploy.yml` for the Vercel release contract. It fails if `apps/web/**` stops
selecting the web lane, the production-deploy condition stops accepting that
lane, the retention assertion stops being the first executable
`db-migrations` script, drifts from its frozen shell/run/env mapping or execution
envelope, or stops gating migration/deploy side effects, any
Vercel release-identity injection is removed, the dedicated
attestation secret is not passed to its verifier, or the post-deploy
production-alias attestation step disappears. The replay-scope-owned standalone
script already enforces the complete production workflow-secret boundary
independently.
Route/config tests prove credentials compare in constant time, missing
configuration fails closed, the
route emits all three no-store headers, target/build identity is immutable,
agentic Paystack DVA mode is the literal paused identity field, readiness is
excluded from the identity digest, redirects/origin mismatches fail, and two
runs of one SHA produce distinct deployment ids. They require
HTTP `200` for both readiness booleans and the exact generic
`401`/`421`/`503` failures above. Verifier and activation-script tests prove the
expected project hash is independently derived from `VERCEL_PROJECT_ID`, cannot
be overridden, and rejects an otherwise valid response from a different
project. Verifier tests also model Vercel consuming its private header and
require exactly the two public no-store headers without weakening the origin
route contract. A workflow refactor after preparation must update this rollout
contract and restart predecessor compatibility review before any later phase PR
can merge.

These files are not one atomic production release. The repository's
`.github/scripts/apply-pending-migrations.sh` applies every not-yet-recorded
migration file in filename order before the application deploy, so release
separation must exist in Git rather than only in prose:

Before item 1, complete the release-guardian bootstrap ceremony. Select and
invite the named independent guardian-control reviewer; temporarily require one
latest-head approval with stale dismissal/admin enforcement/no bypass before the
source PR; finish the root CI and prepared-deploy expected hashes before freezing
`late-payment-v1.json`; merge the exact final-head collaborator-approved
guardian-only PR; build and install its exact artifact
on the shared VPS; and prove exact live App permission/event/webhook/installation
configuration, webhook signature/replay handling, FULL-synchronous durable
enqueue, exact storage-failure `503` behavior, collision quarantine/security
hold, exact Actions-run discovery/attempt/job reads and force-cancel-only write
surface, terminal acknowledgement of irrelevant signed actions, restart
recovery, timed failed/OK-missing delivery redelivery, backlog alerting, and health.
Open one harmless same-repository probe PR and one synthetic workflow-spoof PR.
The guardian must pass the probe, fail the spoof even when candidate Actions
jobs reuse every required name, and report from its distinct App id. Dispatch
the pinned secretless containment-probe workflow, prove the guardian cancels
that exact run to a terminal state, records its run/job/step evidence, and
refuses every adjacent run identity. Then enable
the exact no-bypass branch/ruleset/review shape, bind the guardian check to that
App, close the spoof PR, and re-read the settings through the API. Capture the
strict receipt including the API-derived source-review evidence, obtain both
pinned-key Ed25519 signatures, install those bytes, merge the three-file
receipt-only PR under the sole-owner protected patterns and exact named-reviewer
latest-head check, and prove its bootstrap-domain PR/main checks and durable `armed`
transition without requiring the not-yet-created dispatcher or `ciTrustAnchor`.
Any missing independent reviewer, unsupported permission/event/repository,
webhook/App configuration drift, policy/hash drift, unbound check,
or inability to durably receive/reconcile PR, check-run, and main-push events blocks
the entire payment release. This bootstrap changes no payment code, migration,
deploy workflow, production database, or Vercel application.

Throughout this sequence, root/candidate/receipt capture and any live
post-deploy verification are approved trusted operator or protected deployment
operations: they receive the production project ref, derive its hash internally,
and may query that exact project. Pull-request CI is always secretless: it
receives neither production Supabase credential, makes no Management API call,
and checks only reproducible repository facts plus exact target-hash inheritance
from the already trusted root, predecessor, and candidate receipts. The
candidate-independent guardian first proves the candidate did not replace the
checks that establish those facts. The replay-scope root then installs the
always-executed workflow-secret guard and required PR dispatcher plus the
controlled-path merge-queue rejection before any later payment lane exists;
later candidate and receipt PRs consume
that guardian-protected frozen gate even when targeted Vitest would not select
its tests.

1. a replay-scope PR contains no migration, introduces the complete 74-file
   catalog with `materializedThrough = null`, composes the checked post-base
   extension into the current P0 verifier, adds the complete absence-aware
   feature effect scope through the checked effective-query builder,
   parameterizes only the current-receipt portions of the linked-ledger and
   provenance schemas, refreshes its read-only fixture and query/manifest
   bindings. It also installs the frozen secretless dispatcher, exact package
   command, unfiltered full-object/no-credentials `quality-misc` checkout and
   invocation, staged local-object/no-lazy-fetch preflight, and always-executed
   production workflow-secret guard and dependency-free retention assertion
   described above. Its receipt binds the fresh live `ciTrustAnchor`, and the
   external guardian must approve the exact root transition from its preloaded
   hash policy before any GitHub Actions result is trusted. An approved trusted
   operator then captures the strict Git-bound `replay-scope.json` using only
   the required production `SUPABASE_PROJECT_REF`, with no target argument or
   local linked-project fallback. The required secretless PR gate recomputes
   its schema, replay, and final-tree binding against the immutable event SHAs but does not
   independently authenticate the first target hash. The PR must merge through
   the queue-forbidden protected squash-only path. It passes both normal replay
   modes in `enforce` before deployment.
   After the existing workflow deploys it, an approved trusted post-deploy
   verifier independently derives the same production target and verifies the
   exact root receipt, workflow run/job, current health result, zero pending
   migrations, and unchanged live effect/ledger hashes queried through that
   ref. Only then does that deployed root become preparation's predecessor;
2. the route-quiesce preparation candidate PR contains only the manifest-listed
   preparation bundle ending in
   `20260719115690_preparation_contract_gate.sql` plus the preparation
   application and the exact release-attestation workflow/config/route/verifier
   files assigned above. Before merge, provision the matching attestation
   secret in GitHub and Vercel production and the read-only
   `BACI_ACTIONS_RETENTION_READ_TOKEN` only in GitHub's protected production
   environment. The workflow revision puts the dependency-free live retention
   assertion in the exact frozen shell/run/env mapping immediately after
   checkout in `db-migrations`, before the exact built-in-bash Management API
   application step, and makes no other job a credential consumer. The PR
   advances
   `materializedThrough = 'preparation'`, binds exact prefix hashes and the
   verified replay-scope root deployment object, and writes
   `preparation-candidate.json`. The bundle is
   behavior-neutral; the application introduces
   the route's environment-plus-database readiness gate, dual-schema
   `claimed_v1` completion bridge, dual-schema storefront-owner and side-effect
   claim parsers,
   transaction-filtered mark helpers, executors, alert worker, and drain
   support, plus the dual-schema blocked-terminal-payment review bridge,
   fail-closed legacy DVA persistence-error response, the dual-schema wallet-
   persistence capability adapter with exact legacy `23505` identity comparison,
   request-scoped existing-account read, pre-provider capability selection,
   lazy-admin legacy mutation, fixed `WALLET_DVA_TEMPORARILY_UNAVAILABLE`
   response, proof/RPC branch, and one-reread crossing-request behavior,
   terminalization capability parsing,
   structured-result parsing,
   the one-retry legacy-to-RPC dispatcher, the pre-expand
   provider-cancellation maintenance response, and the capability-gated
   cancellation recovery pass required before the strict expand gate can
   appear, plus the consent disclosure/link UI and a pre-provider order-DVA
   capability gate that permits no provider access while the customer-consent
   contract is absent. Merchant routes can request consent but cannot attest for
   the customer. After deployment, a separate zero-migration receipt PR captures the
   exact attempt/ledger/effects evidence, updates the current P0 post-deploy
   bindings, writes `preparation-deployment.json`, and converges in `enforce`.
   The preparation deployment itself must be the first protected attestation
   HTTP `200` response, with exact production target/build identity,
   `checkoutMode = 'paused'`, `agenticPaystackDvaMode = 'paused'`, and
   `dbReady = false`;
3. after that receipt is live and route traffic has drained, the fence candidate
   PR contains only the manifest-listed fence bundle ending in
   `20260719115740_internal_credit_fence_contract_gate.sql`, generated types,
   the `fence` phase marker, exact prefix hashes,
   `fence-candidate.json`, and migration/replay tests. The application revision
   remains unchanged. Its separate receipt PR writes
   `fence-deployment.json`. After that receipt and direct-RPC drain verify, an
   index candidate PR adds only
   `20260719115750_order_abandonment_candidate_index.sql`, the
   `abandonment_index` marker and hashes,
   `abandonment-index-candidate.json`, and its migration/replay tests. Its
   separate receipt PR writes `abandonment-index-deployment.json`; the exact
   concurrent index and receipt must be recorded before expand begins;
4. the expand candidate PR contains only the manifest-listed owner-expand bundle ending in
   `20260719115890_owner_expand_contract_gate.sql`, the `owner_expand` marker
   and hashes, `owner-expand-candidate.json`, generated
   types, application, and tests, and must not contain any
   contract or enforcement bundle file in its deploy artifact; that bundle installs
   the owner-aware claim RPC, full atomic gateway payer seed set, corrected
   per-item inventory helper, immutable allocation evidence and edit/import
   preservation, minimum durable alert contract, allocation-safe provisional
   terminalizers, the activated single-call provider-cancellation saga and
   payment holds, private one-shot terminal authorization, and the strict
   direct-write trigger, plus the customer-consent cutoff/receipt RPC and
   post-cutoff DVA-account persistence backstop with its receiver-locked wallet-
   purpose veto and zero-row fail-closed application contract. The preparation app permits no
   provider call before that capability exists and no implicit or merchant-
   attested consent after it exists. Its separate receipt PR writes
   `owner-expand-deployment.json` before either legacy audit begins;
5. after both signed notification-owner and inventory-allocation
   classification audits pass, a contract candidate PR adds only the manifest-listed
   late-payment contract bundle ending in
   `20260719120190_late_payment_contract_gate.sql` together with the
   internal-credit finalizers and application, the `contract` marker and
   hashes, `contract-candidate.json`, generated types, and
   tests. It must not contain the later concurrent reference index or
   enforcement files. Its separate receipt PR writes
   `contract-deployment.json` and proves the exact healthy contract SHA;
6. the production setting remains `paused` and the internal-credit database
   activation fence remains closed through that schema-first deploy;
7. after the exact contract receipt SHA is healthy, wait the fixed 15-minute legacy
   Paystack-writer drain and pass the signed zero-unclassified/zero-duplicate
   reference-role audit. Then deploy the index candidate PR containing
   `20260719120200_paystack_external_reference_unique_index.sql`, the
   `paystack_reference_index` marker and hashes,
   `reference-index-candidate.json`, and its tests, with runtime application
   output unchanged. Verify the exact role-aware catalog
   expression through the separate receipt PR and
   `reference-index-deployment.json` before continuing;
8. keep the application and environment unchanged, pass the signed
   epoch/identity/link/terminal-snapshot/wallet-purpose audit, and deploy the enforcement
   candidate PR containing the manifest-listed
   enforcement bundle ending in
   `20260719120220_order_payment_account_enforcement_cutover.sql`, the
   `enforcement` marker and hashes, `enforcement-candidate.json`,
   generated types, and tests. Verify direct writes fail, the
   reference index is still exact, and the state is exactly `enforced_v1`.
   Its separate application-only receipt PR updates every current P0
   post-deploy binding, writes `enforcement-deployment.json` and
   `final-production.json`, advances no phase, passes both normal replay modes
   in `enforce`, and is deployed and health-checked while the environment and
   database remain paused. Its exact `headSha`, not the candidate SHA, becomes
   the audited armed application SHA; archive its paused release-attestation
   response, production target, deployment id, immutable identity digest,
   `agenticPaystackDvaMode = 'paused'`, and `dbReady = false`. Enter a merge
   freeze after it lands; any
   movement of `main` invalidates the armed SHA and requires a new final receipt
   and health check;
9. only after that final-receipt release is healthy, update the production
   setting to `enabled` and run `gh workflow run deploy.yml --ref main` to
   create the application-only armed deployment. Confirm the workflow run uses
   the audited final-receipt `headSha`, applies zero migrations, and the
   production-alias attestation returns that SHA, this run id/attempt, a
   deployment id different from the archived paused id, the exact production
   target, `checkoutMode = 'enabled'`,
   `agenticPaystackDvaMode = 'paused'`, and `dbReady = false`; direct RPC calls
   remain rejected; and
10. run the checked-in activation script with that exact SHA, armed deployment
   id, canonical release-identity digest, current `pause_generation`, and
   recorded operator identity as the final action. Verify the immutable activation event
   stores the same identity triple before testing internal credit. Rerun the
   script once: the same route must now return `dbReady = true`, the immutable
   identity digest must remain unchanged, and the RPC must return idempotently
   without another event or generation increment. No deployment follows
   activation; and
11. retain the checked-in emergency-pause script as the immediate rollback path.
   It closes readiness to new intents before any environment change or
   deployment, drains or reconciles every captured-generation intent, and
   reports success only after the database reaches `paused`.

The post-contract reference-index phase (`paystack_reference_index`) and DVA
enforcement bundle are intentionally outside the contract bundle. Both are
mandatory gates before arming, activation, production DVA recovery, or declaring
the rollout complete.

Do not pre-create or merge any contract-, paystack-reference-index-, or
enforcement-bundle filename in the expand PR: its mere presence on `main`
authorizes the deploy workflow to apply it.

Regenerate the checked-in `apps/web/src/types/supabase.ts` after each
schema-shape release; the index-only release verifies that generation is
unchanged.
The route-quiesce preparation types include
`internal_credit_checkout_control`,
`internal_credit_checkout_control_events`,
`internal_credit_checkout_intents`,
`internal_credit_checkout_ready()`,
`order_terminalization_contract_state`,
`get_order_terminalization_contract_version()`,
`get_internal_credit_checkout_control()`, and
`pause_internal_credit_checkout(text, text, text)`,
`finalize_internal_credit_checkout_pause(text, bigint, text)`, and the begin,
complete, abort, and reconciliation RPCs. They also include
`provider_shipment_cancellation_attempts`,
`provider_shipment_cancellation_attempt_events`,
`prepare_provider_shipment_cancellation`,
`record_provider_shipment_cancellation_result`, and the attempt-token
compatibility finalizer, plus the recovery claim/finish functions. The
fence-release types additionally
include
`internal_credit_checkout_function_contracts` and
`internal_credit_checkout_function_contract_state`. The
expand-release types additionally
include the nullable owner, owner migration-state and decision tables,
notification-owner classification RPC, allocation migration-state, immutable
allocation and allocation-decision tables, allocation classification RPC,
allocation-linked unit/event foreign keys, inventory-unwind event table,
expand-phase legacy-allocation review support, alert outbox contract,
allocation-safe provider-cancellation result shapes, abandonment claim/attempt
state, `claim_abandoned_order_cleanup_candidates`,
`terminalize_claimed_abandoned_order`,
`get_abandoned_order_cleanup_work_state`, the structured
terminalization RPC results and `allocation_safe_v1` state, and every changed
storefront return shape, plus the payment-orchestration proof preflight and
validator signatures. The private one-shot authorization table remains absent
from the generated public API types. Regenerate
again after the contract release so the dropped
classification RPC disappears and the owner is non-null. The final generated
output must include the `order_payment_accounts.payment_transaction_id`
relationship, deferred `current_epoch_id`, current assigned-customer identity
mirrors,
`assignment_contract_touched_at`, the complete
`order_payment_account_epochs` table with deferred projection/self and
assignment-transaction relationships and immutable provider-customer identity,
the append-only
`order_payment_account_epoch_capture_links` table with its transaction and epoch
relationships, the immutable `order_dva_terminal_snapshots` table,
wallet-account `bank_identity`, the public
contract-state row, the savings-redemption reversal columns and event relationship,
`orders.merchant_new_order_push_owner`,
`variant_inventory.inventory_allocation_id`, and the exact signatures and
result shapes for
`create_storefront_order`,
`create_storefront_order_with_savings`,
`create_storefront_order_with_quiz_voucher`,
`create_storefront_order_with_discount_code`,
`complete_order_gateway_payment` with `completion_outcome`, nullable hold
`review_id`, `payer_transaction_id`,
`merchant_push_steps`, `paid_order_side_effect_steps`, `inventory_contract`,
`inventory_reclaimed_unit_count`, and `inventory_missing_unit_count`,
`claim_payment_side_effect` with
`current_transaction_id` and `ownership_conflict`,
`get_payment_initialize_context`,
`get_order_dva_render_contract_version`,
`get_renderable_order_dvas`,
`persist_initialized_gateway_payment`,
`persist_customer_wallet_payment_account` with its typed success/account and
conflict/review result union including `receiver_owner_conflict` and
`existing_identity_conflict`,
`record_paystack_historical_evidence_outcome(jsonb, text)` with its
inserted/exact-replay review result,
`finalize_wallet_order_payment(uuid, uuid, uuid)`,
`finalize_store_credit_order_payment(uuid, uuid, uuid, uuid)`,
`persist_paystack_order_dva_assignment`,
`resolve_paystack_transaction_reference`,
`claim_paystack_transaction_reference`,
`reserve_paystack_dva_order_payment`,
`reserve_paystack_wallet_dva_top_up`,
`repair_paystack_order_dva_epoch_link`,
`classify_paystack_transaction_reference_role`,
`record_order_gateway_settlement_for_transaction`,
`prepare_provider_shipment_cancellation(uuid, uuid)`,
`record_provider_shipment_cancellation_result(uuid, uuid, text, numeric,
jsonb)`,
`claim_provider_shipment_cancellation_recoveries(integer)`,
`finish_provider_shipment_cancellation_recovery(uuid, uuid, text, jsonb)`,
`resolve_provider_shipment_cancellation_review(uuid, uuid, text, text, text)`,
`seed_paid_order_side_effect_retries`,
`internal_credit_checkout_ready()`,
`get_order_terminalization_contract_version()`,
`get_internal_credit_checkout_control()`,
`pause_internal_credit_checkout(text, text, text)`,
`finalize_internal_credit_checkout_pause(text, bigint, text)`,
`begin_internal_credit_checkout`,
`complete_internal_credit_checkout_intent`,
`get_internal_credit_checkout_replay`,
`abort_internal_credit_checkout_intent`,
`reconcile_internal_credit_checkout_intent(uuid, text, text)`,
`activate_internal_credit_checkout(text, text, text, bigint, text)`,
`classify_legacy_order_inventory_allocation`,
`record_internal_credit_cancelled_order_audit_decision`,
the structured `cancel_order_as_customer(uuid, text)` result, the three
abandonment cleanup RPCs, and the new review and alert RPCs. It must also expose
`internal_credit_cancelled_order_audit_decisions`,
`paystack_reference_role_audit_decisions`,
`gateway_initialization_intents`,
`abandoned_order_cleanup_attempts`,
`order_item_inventory_allocations`,
`order_inventory_allocation_audit_decisions`,
`provider_shipment_cancellation_attempts`,
`provider_shipment_cancellation_attempt_events`, and
`order_inventory_unwind_events`. The old
`claim_paystack_paid_atomic`, `mark_abandoned_orders(integer)`, and tokenless
redemption/finalizer signatures must be absent.
Do not hand-maintain partial local function declarations that can drift from
the database.

## Testing

### Matcher unit tests

- The receiver-identity parser accepts matching verified/signed account and
  bank values, normalizes harmless bank punctuation/case differences, and
  rejects a missing bank or any account/bank disagreement before fresh DVA
  matching.
- The TypeScript receiver parser and private SQL bank normalizer pass the same
  fixture matrix and reject blank, oversized, or non-canonicalizable bank
  evidence; the reservation RPC recomputes from the raw verified value.
- Two rows with the same provider/account number but different normalized bank
  identities do not describe the same DVA; only the verified receiver bank can
  contribute candidates or terminal aliases. A blank legacy bank on an
  otherwise plausible row fails closed to review rather than matching by
  number.
- The customer-identity parser requires the verified normalized assignment
  email and exact Paystack customer code, rejects signed/verified disagreement,
  and never substitutes `orders.customer_email`. Editing or clearing the order
  email after assignment does not change the matching result; a synthetic
  assignment email remains authoritative.
- A unique exact payment still matches after 90 minutes.
- A unique exact payment matches several days later while the invoice is
  pending.
- After Baci exposes account A and later appends display-current account B, a
  valid transfer to A still matches A's immutable epoch; invoice retrieval
  displays only B. Superseding A never rewrites its bank, `assigned_at`,
  `payable_amount`, or transaction link.
- A transfer to an old epoch of a now-terminal order remains terminal conflict
  evidence and can never reopen or credit that order.
- A payment before account assignment is rejected.
- Cancelled, fully paid, and zero-balance invoices are rejected.
- The exact outstanding balance is used instead of the original total.
- A stale `payable_amount` cannot override a newer locked partial-payment
  balance.
- Two identical eligible invoices return an ambiguous result.
- Account reuse across an old cancelled invoice and a current payable invoice
  yields exactly one eligible candidate, proves the cancelled row is never
  counted or matched, and then exercises the separate terminal-alias veto that
  sends the transfer to review rather than crediting either order.
- One otherwise eligible invoice plus a retained wallet DVA of each supported
  status (`active`, `pending_review`, and `disabled`) at the same provider,
  canonical bank/account, and provider customer produces a wallet-purpose
  conflict and credits neither destination. Missing or contradictory wallet
  provider-customer evidence or uncanonicalizable same-number bank evidence is
  unresolved; a same-number/different-proved-bank wallet row is irrelevant.
  With no eligible invoice, only the exact active-wallet
  fixture may be credited; pending-review or disabled receiver evidence files
  review and is not reclassified as zero candidates.
- A cancelled-only exact alias remains diagnostic and does not block wallet
  matching; when no wallet or other transaction path matches, the final
  zero-candidate review includes its terminal diagnostics.
- A partially paid invoice assigned for ₦100,000 and terminalized after ₦40,000
  paid captures a ₦60,000 residual; that exact transfer conflicts with an
  otherwise unique active ₦60,000 invoice and is never credited automatically.
- A proved terminal snapshot whose assignment and residual amounts both differ
  does not block a unique active invoice. A plausible historical terminal DVA
  with no provable residual or immutable provider-customer identity remains an
  unresolved blocker and routes to review.

### Reservation, reference, and fee tests

- A completed transaction with a BAC `gateway_reference` and the external
  Paystack reference in metadata is found before DVA matching. If its order is
  still pending, replay runs the finalizer and heals the order instead of filing
  a zero-candidate review.
- A pending transaction stored in either supported reference location is
  returned idempotently.
- A legacy external reference in `gateway_reference` conflicts with the same
  external reference in another row's metadata.
- A verified Paystack provider reference equal to another pending DVA's
  internal BAC does not resolve or claim that DVA transaction. The resolver
  returns no owner for an explicitly `internal_bac` row and fresh matching
  proceeds using checked receiver identity.
- A BAC-preserving DVA with no attached provider reference resolves to
  `internal_unbound`, while an `external_provider` transaction resolves its
  `gateway_reference` as `external`. An unclassified legacy row cannot be
  passed to provider verification and, with ambiguous purpose, returns the durable
  `external_reference_role_unclassified` conflict instead of being claimed.
- The resolver, reference-claim, and reservation RPCs use the same namespaced
  external-reference advisory lock.
- The reservation RPC takes the receiving-account advisory lock, then every
  relevant payment advisory/order row in deterministic order, then current
  projections, sorted epoch rows, sorted capture links, and terminal snapshots,
  and reclassifies the whole candidate, terminal, and unresolved conflict set. A
  concurrent cancellation takes the same account advisory before its order,
  projection, epoch, capture-link, and terminal-snapshot rows; the two directions complete without
  deadlock.
- The TypeScript diagnostic matcher and SQL classifier pass the same fixture
  matrix for receiver-bank normalization plus unique, ambiguous,
  terminal-conflict, and zero-candidate outcomes. The SQL RPC re-normalizes the
  raw verified bank and never accepts account-number-only authority.
- A verified customer-code or assigned-email mismatch yields no eligible
  candidate even when bank, account, amount, currency, and current order email
  match. A legacy epoch missing either field is adopted only after exact audited
  proof; otherwise it appears in the unresolved conflict set.
- A second invoice whose locked outstanding balance becomes an exact match
  after preliminary TypeScript matching changes the RPC result to `ambiguous`
  without mutating either order.
- A cancellation, refund, or manual payment committed before the RPC obtains
  its row locks changes the locked outcome and fails closed.
- A linked DVA transaction is adopted by exact transaction id and preserves its
  BAC reference and fee fields.
- Reservation selects the exact matching assignment epoch, including a
  superseded epoch, and cannot adopt the display-current epoch's transaction
  merely because both epochs belong to the same order.
- A linked pending DVA intent whose amount became stale after a partial or
  manual payment remains the epoch's immutable `assignment_intent` pointer,
  is marked cancelled with the exact replacement id, and receives one correctly
  priced `matched_capture` transaction through an append-only reciprocal capture
  link. The epoch pointer and current projection mirror never change.
- Replaying that provider reference resolves the matched-capture transaction;
  it does not create a second capture link, revive the cancelled assignment
  intent, or route through fresh epoch matching.
- Reference attachment and claim preserve `gateway_reference_role` and
  `dva_epoch_link_role` byte-for-byte. A transaction marked
  `assignment_intent` without the reciprocal epoch pointer, or `matched_capture`
  without the reciprocal capture-link row, fails closed before claim.
- A linked assignment transaction that is processing, completed, externally
  referenced, differently owned, or not tagged for that epoch cannot enter the
  stale-balance capture-link branch.
- An unrelated pending Paystack card transaction with the same order and amount
  is never adopted.
- An unlinked legacy assignment with no audited transaction id creates a new
  tagged and linked BAC transaction even when unrelated pending Paystack rows
  exist.
- An audited `expected_legacy_transaction_id` is adopted only after every
  order, merchant, gateway, type, status, amount, currency, epoch-assigned
  email, and provider-customer-code check passes, then becomes the selected
  epoch's durable current link.
- A linked or explicitly selected transaction with mismatched ownership or
  payment evidence returns a conflict without mutation.
- A new ₦20,000 transaction stores a ₦400 platform fee and ₦19,600 merchant
  amount.
- Tony's ₦2,072,925 gross amount applies the ₦2,050 cap and stores a
  ₦2,070,875 merchant amount.
- The RPC rejects missing, negative, over-precision, or non-balancing fee
  values.
- The canonical index preflight reports duplicate references across both
  storage forms and does not mutate financial rows.
- The contract application writes a non-null immutable role for every new
  ordinary and DVA Paystack transaction before the fixed legacy-writer drain
  starts. The role audit refuses to pass with one non-empty unclassified
  `gateway_reference`, a stale fingerprint, a manual blocker, or a role whose
  reciprocal ordinary/DVA evidence is missing.
- Before the index release, two transactions racing for one provider reference
  serialize on the same advisory lock and exactly one claim succeeds. A provider
  reference equal to a classified internal BAC is permitted to reach the
  intended receiver-identity classifier rather than being rejected by a
  premature uniqueness rule.
- The canonical index excludes an explicitly `internal_bac`
  `gateway_reference` until `metadata.paystack_reference` is attached, then
  indexes only that provider reference. Its catalog assertion contains the
  exact role-aware `CASE` expression and predicate.
- The separate cleanup-candidate and Paystack-reference concurrent migrations
  each use their stable expected name and `IF NOT EXISTS`. A simulated failure
  after either index creation but before migration-history registration
  succeeds on retry without rebuilding or renaming the index; a same-name
  catalog mismatch fails before use.
- The operator runbook refuses to merge the index release before the signed
  role report verifies and is archived. Independently, an unclassified or
  evidence-mismatched database row fails the migration's own preflight before
  `CREATE INDEX CONCURRENTLY`; a row introduced during the build fails the
  post-create preflight and prevents history registration. After repair, retry
  accepts the exact existing index and generated Supabase types remain
  byte-for-byte unchanged.
- A same-name invalid, wrongly unique, or differently defined index fails with
  actionable catalog diagnostics instead of being accepted by `IF NOT EXISTS`.

### Webhook tests

- Reproduce the July 15 incident shape and prove the webhook completes the
  order rather than filing a zero-candidate review, including exact verified
  receiver account/bank and immutable assigned-email/provider-customer identity.
- Prove agentic, order, and wallet DVA paths all receive the same checked
  receiver identity and none queries or reserves by account number alone. A
  mismatched signed/verified bank, missing receiver bank, or same-number
  different-bank row mutates no checkout session, transaction, assignment,
  wallet, or order and reaches one durable diagnostic review.
- Prove a missing or conflicting verified Paystack customer code or email never
  mutates an invoice even when the webhook payload and current order email look
  plausible; exact-reference replay remains independently resolvable.
- Prove a linked assignment causes the reservation RPC to adopt the exact BAC
  transaction and preserve `platform_fee` and `merchant_amount`.
- Prove an unlinked legacy DVA path creates one new tagged BAC transaction with
  calculated fees instead of adopting an unrelated pending transaction.
- Prove the ordinary webhook cannot supply or infer
  `expected_legacy_transaction_id`.
- Prove cancellation, refund, or manual payment between preliminary matching
  and RPC reservation fails closed.
- Prove a captured payment whose finalizer encounters a cancelled or refunded
  order creates/reuses the transaction/reference-scoped review plus operations
  and sole-merchant alerts atomically, sends no fulfillment or paid-order side
  effect, and returns retryable failure if review/alert persistence fails.
- Prove an account-level race that introduces a second locked candidate returns
  an ambiguous review rather than crediting the preliminary winner.
- Prove the canonical finalizer and claimed notification executors run once.
- Prove pending and completed replays are idempotent through both external
  reference storage forms.
- Prove a uniquely referenced `processing`, `failed`, or `cancelled`
  transaction creates one
  `external_reference_transaction_status_conflict` review and alert set without
  changing the transaction or dispatching fulfillment.
- Prove the claim RPC reacquires the external-reference lock, revalidates the
  owner, amount, and currency, and changes only an exact `pending` row to
  `completed`.
- Prove existing-reference and freshly reserved Paystack transactions from
  agentic, order-DVA, and wallet-DVA paths all pass through the claim RPC before
  transaction-type dispatch.
- Prove a race before the claim RPC that changes the transaction to `completed`
  returns `completed_replay`, while a race to `processing`, `failed`, or
  `cancelled` returns `status_conflict`.
- Prove a changed, missing, or duplicate owner returns
  `external_reference_conflict` without mutation.
- Prove the webhook contains no direct generic transaction-completion update;
  any retained non-Paystack application claim uses an exact `pending`
  predicate.
- Prove a Paystack reference already attached to another order fails closed.
- Prove an ambiguous payment creates one detailed review and its deduplicated
  alert rows, then returns `2xx`.
- Prove a zero-candidate payment creates one detailed review and its
  deduplicated alert rows, then returns `2xx`.
- Prove review or alert persistence failure returns `500`.

### DVA creation tests

- `/api/payments/initialize` imports no admin/service client. Guest, mobile
  Bearer, and cookie-session fixtures use the request-scoped client; cookie
  mutation requires the CSRF contract, while guest/Bearer calls retain their
  non-cookie capability path.
- Static/logging tests reject the raw request-body log and prove customer PII,
  DVA account identity, consent-link nonces, challenge ids/codes, proof material,
  claim tokens, and unsanitized provider responses are redacted.
- `get_payment_initialize_context` returns the exact bounded merchant/order,
  authoritative residual, currency, status, subaccount configuration, and
  gateway-policy fields for the right order/email scope and rejects terminal,
  inconsistent-credit, merchant-mismatch, and cross-customer requests. No
  direct table read in the route supplies those values.
- Ordinary gateway provider success is persisted only through
  `persist_initialized_gateway_payment` with its exact proof action. A changed
  amount/status/settings row, altered provider reference/fees/metadata, stale
  proof, or reused reference for another order fails under lock and the route
  does not expose the provider checkout result. Valid-proof state drift creates
  one exact-fingerprint `gateway_initialization_persistence_conflict` review
  and operations alert; forged proof creates neither.
- DVA initialization invokes only the assignment RPC, and partial
  internal-credit initialization invokes only claim/finish; neither also calls
  ordinary gateway persistence or inserts a duplicate transaction.
- The preparation application probes the customer-consent capability before
  every order-DVA provider call. An absent/malformed capability, missing current
  link secret, or invalid previous-secret expiry fails closed without Paystack,
  privileged client construction, account persistence, or bank disclosure.
- Capability tests accept only exact `consent_v1`; only exact named
  `42883`/`PGRST202` absence represents the pre-expand state. Timeout,
  permission, generic schema-cache, malformed/empty, and unknown-version
  responses remain unavailable. The migration emits the exact committed
  PostgREST reload notification, and a request crossing installation performs
  at most one capability reread without a second provider call.
- The fixed `order_dva_v1` disclosure and explicit checkout bank-transfer
  action record one receipt before Paystack. Missing/false consent, implicit or
  default payment selection, wrong disclosure, merchant/staff identity,
  cross-order/customer/email/provider/currency evidence, changed amount/due
  terms, stale proof, and a changed payload create neither a
  receipt nor a provider call; an exact retry
  returns the same receipt.
- A signed-link token exists only in the URL fragment. The generic `GET` and
  same-origin fragment-to-session bootstrap send no email, create no database
  row, and make no provider call; the bootstrap clears history immediately and
  sets only the sealed path-scoped link-session cookie. Tests require no query/
  path token, analytics request or runtime analytics-SDK import, referrer, cache,
  indexability, or raw-body/fragment logging; every POST rejects a
  missing/mismatched CSRF token,
  any `Authorization` header, or non-canonical `Origin` before capability
  handling, and the bootstrap reuses
  `/api/csrf` plus the existing API client rather than setting a cookie from the
  page render. Route tests prove the isolated platform path does
  not inherit the storefront layout, current proxy tests prove the reserved
  `/auth` path is not interpreted as a merchant slug and receives auth CSP/
  permissions headers without changing `proxy.ts`, and the client
  `RootDynamicBody` gate uses `usePathname()` rather than the response-only
  `x-pathname`. Its tests prove all four current analytics/insights reporters
  remain unmounted on the exact segment-bounded consent prefix, unrelated routes
  retain them, and transitions among unrelated routes retain the existing
  reporter lifecycle. Source-contract tests forbid `next/link`, `router.push`,
  and `router.replace` for every consent-surface entry/exit and require ordinary
  full-document links, so an already-running analytics SDK cannot cross into the
  page through an application-produced SPA transition. Mail tests require the dedicated
  `ZEPTOMAIL_CONSENT_TOKEN`, reject the generic/merchant transport, and preserve
  the exact fragment href with no tracking pixel or rewritten redirect in a
  controlled-inbox source fixture. URL construction uses `URL`, merchant/
  customer-facing text and HTML attributes are escaped through existing email
  template utilities, all route bodies use the dedicated Zod schema, and the
  page contains no `dangerouslySetInnerHTML`. Definite pre-dispatch, accepted, and
  transport-indeterminate challenge sends prove only the first can become
  replacement-eligible after cooldown; the latter two preserve the same usable
  challenge and send no immediate duplicate. An authenticated matching customer
  can consent on explicit `POST`; a guest's first `POST` issues one bounded challenge and sends
  its raw code only to the server-resolved invoice email, and the second `POST`
  must present both sealed path-scoped cookies and consume the challenge before
  receipt creation. Missing/tampered/cross-order cookies, wrong origin, expired
  or forwarded-without-mailbox-access links, wrong recipient, amount/terms
  drift, changed disclosure, and previous-secret-after-expiry requests
  fail safely. Wrong code attempts commit only the bounded counter; expiry or
  exhaustion prevents consent, an exact successful replay is idempotent, and a
  provider failure leaves only the receipt reusable. Rotation tests require the
  seven-day-plus-ten-minute previous-secret overlap, accept an in-flight old-key
  link/challenge only within that window, and issue all new material with current.
- Generate-DVA and ship-on-credit can reuse an exact receipt but cannot mint
  one. Without it, generate-DVA returns `409`, ship-on-credit returns
  `virtualAccount: null`, and automatic invoice mail contains the ordinary
  payment link plus consent CTA but no bank details.
- The shared render projection returns one current, consent-linked
  Paystack DVA only for a still-payable order and supports a mixed batch without
  N+1 reads. Merchant invoice download/reminder, storefront order list/detail,
  storefront-account JSON/invoice/receipt, and their serializers all use it.
  Pre-cutoff unlinked, superseded, stale-identity, wrong-customer, changed-terms,
  paid, cancelled, failed, refunded, abandoned, returned, and retained-wallet-
  purpose-conflicted fixtures return no DVA; a projection-query error fails
  without details. Static merchant bank
  instructions remain distinct. The presentation source-contract fixture fails
  when any non-test outward account serializer adds a raw payment-account read.
  A past account `expires_at` on an otherwise payable overdue invoice remains
  renderable and does not become a terminal/stale fixture by timestamp alone.
  Authenticated customer and merchant-owner/staff fixtures return only their
  orders. Staff fixtures require active membership plus effective
  `orders.view`; active staff without that permission, inactive staff,
  unrelated users, and `anon` learn no order/collision existence. Batch
  duplicates are deterministic, 101 direct ids fail, wrapper chunking succeeds,
  and one failed chunk fails the response without partial details. Exact absent
  capability returns a null map during preparation; timeout, permission,
  malformed, and unknown versions do not authorize a raw-read fallback.
- Consent migration tests prove append-only RLS, exact anon/authenticated RPC-
  only grants, rejected merchant/staff actors, `ON DELETE RESTRICT`, immutable
  database time/cutoff, one evidence fingerprint per bound scope, no raw email,
  IP, user-agent, link token, challenge code, or payment credential, and the
  exact two allowed sources. Receipt tests prove locked amount/currency and the
  canonical consent-subject fingerprint cannot be reused after payment-term
  drift. Challenge tests prove recipient/link/disclosure/subject
  binding, domain-separated code HMAC, ten-minute maximum expiry, cooldown,
  bounded attempts that persist on failure, single consumption, and no provider
  access before consumption. The issue RPC derives its delivery address under
  lock; the route uses a request-scoped client and never accepts, logs, or
  returns an email, challenge id, or raw code from/to the public boundary. Cookie
  tests require `Secure`, `HttpOnly`, `SameSite=Strict`, and the exact path for
  both cookies; the link session cannot outlive its signed seven-day expiry, the
  challenge has a ten-minute maximum age, both bind order/link nonce, and both
  are sent to the same-order child action but not `/api` or another order, and
  both clear after successful consumption or terminal invalidation.
  Cleanup tests require cron authentication,
  service-role-only RPC execution, 30-day retention, 500-row batches, at most
  ten batches per run, and zero receipt deletion. A post-cutoff account insert
  or receiving-identity change without one earlier exact receipt fails; a stale
  request crossing the cutoff cannot expose its already-created provider account.
  A schema-window insert/update whose provider/bank/account already belongs to
  a retained wallet row in any status, including `disabled`, returns zero
  persisted rows, commits
  one exact purpose review/alert, and exposes no provider or prior projection
  result. Each of initialize, generate-DVA, ship-on-credit, and automatic
  invoice exercises its real legacy insert/upsert shape with plural
  `return=representation` and an application-side exact-one cardinality check.
  A database integration fixture proves the zero-row HTTP response commits the
  trigger-created review/alert; static tests reject `.single()` and
  `.maybeSingle()` on these writes because a PostgREST singularity failure
  condemns the transaction. Zero or multiple rows are conflict/invariant
  omission; no route performs its duplicate-read fallback or builds bank details
  from the provider result.
  Concurrent
  wallet and legacy order writes serialize on the receiver advisory so only one
  purpose can become newly exposed; exact retry reuses the review.
- Agentic-cutover tests prove production rejects a missing or unknown
  `AGENTIC_PAYSTACK_DVA_MODE`; `paused` removes
  `paystack_bank_transfer` from Agent Commerce, ACP, agent-native, UCP, and
  OpenAPI discovery while leaving pay on delivery and independently configured
  Google Pay intact. Every normalized Paystack bank-transfer completion with no
  pre-cutoff exposed account returns `409 AGENTIC_PAYSTACK_DVA_PAUSED` before a
  payment claim, provider call, account/session write, order creation, bank
  detail, or webhook. Exact stored idempotency responses and exact
  `payment_pending` grandfathered sessions remain read-only replayable, but a
  changed buyer, amount, account, order, or terms fails closed. The checked
  cutover audit reports only bounded counts/opaque ids. The separate drain is
  dry-run by default, requires an exact state/fingerprint for one opaque id,
  makes no provider create/get call, and either releases a no-account claim or
  resumes an already-stored pre-pause account idempotently; drift alerts and
  changes nothing. Together they prove `claiming_payment`,
  `payment_account_ready`, and `order_finalizing` are all zero before
  owner-expand and never log an account number. A source inventory covers every
  raw dedicated-account endpoint and the exact transitive helper/caller graph;
  it rejects any unclassified provider edge, order caller not dominated by
  consent, wallet caller outside the wallet contract, or agentic caller not
  dominated by the paused gate. Dedicated-account logging fixtures prove raw
  or masked account/customer/provider canaries never reach helper, route,
  audit, or drain structured logs. Exact
  `consent_v1` does not change these expectations.
- Assignment-identity fixtures require Paystack-proved normalized customer email
  and exact customer code from both general and subaccount helper families.
  Embedded-DVA/customer-read disagreement, missing identity, request/order-email
  substitution, non-NGN currency, malformed bank/account, and a failed bounded
  identity reread create no proof, epoch, transaction, or returned account. The
  synthetic order email succeeds only when the provider customer response
  returns that exact normalized value.
- All four order-DVA creation paths atomically persist `assigned_at`,
  `payable_amount`, the Paystack-supplied bank identity, exact normalized
  provider-assignment email, provider customer code, identity source and
  evidence fingerprint,
  exact post-cutoff `customer_consent_id`,
  immutable `payment_transaction_id`, and reciprocal `assignment_intent` DVA
  transaction metadata.
- If Paystack returns an identity already retained as a wallet DVA of any
  status, including `disabled`, every order-assignment path returns/omits the
  stable wallet-purpose conflict without an epoch, transaction, order-state
  change, or account exposure. Matching owner evidence does not authorize
  cross-purpose reuse; contradictory evidence is also blocked. Exact replay
  reuses one fingerprinted review/alert, and concurrent order/wallet assignment
  under the shared provider/account lock cannot make both persist.
- Every new DVA transaction marks its `gateway_reference` role
  `internal_bac` plus exactly one immutable DVA link role—`assignment_intent`
  or `matched_capture`; every new ordinary Paystack transaction marks the
  gateway role `external_provider`, and provider-reference attachment never
  changes any role.
- They never update a previously exposed identity or payable snapshot in place;
  a genuine change appends and links one epoch, atomically supersedes the prior
  current epoch for display, and leaves the prior epoch matchable.
- Migration tests preserve and catalog-verify the exact baseline
  `unique_order_account` constraint, create the exact epoch-table partial
  current index and capture-link epoch/transaction uniqueness, and prove the deferred
  reciprocal/acyclic/same-order projection and link-role checks roll back a
  zero-current, dual-current, cross-order, projection-drifted, cyclic,
  assignment-pointer-replaced, orphaned-capture, or role-mismatched chain.
  Catalog assertions require `confdeltype = 'a'`, `condeferrable = true`, and
  `condeferred = true` for every cyclic epoch/projection/self-reference foreign
  key and reject `RESTRICT`, whose delete action cannot be deferred.
- A literal old-application `upsert` conflict on `order_id,provider` succeeds
  before and after the contract bundle. Tests observe the `BEFORE INSERT`
  normalizer and `BEFORE UPDATE` conflict path both firing while only the
  update trigger appends exactly one new epoch; no speculative/orphan epoch or
  duplicate current epoch survives. A plain insert appends exactly one initial
  epoch through `AFTER INSERT`. A changed identity/payable
  payload leaves the old epoch immutable, appends one touched unlinked epoch,
  clears the projection transaction mirror, and remains blocking until audited
  repair; an expiry-only update creates no epoch and preserves the touch time.
- Under `SET LOCAL ROLE authenticated` with the real merchant/staff claims, the
  legacy generate-DVA and ship-on-credit insert shapes pass the existing base-
  table RLS policy and the PostgreSQL-owned trigger captures their epochs even
  though direct epoch/capture-link/terminal-snapshot writes and trigger-function execution remain
  revoked. An unrelated authenticated or anonymous insert still fails at the
  base-table policy, and direct function/table calls remain denied. Catalog
  assertions require `prosecdef`, owner `postgres`, empty pinned search path,
  the exact three trigger bindings/phases, and no executable grant to runtime roles.
- The exact old automatic-invoice payload with no assigned/payable fields
  receives a locked timestamp and authoritative NGN residual from the
  `BEFORE INSERT` normalizer, then exactly one initial epoch from `AFTER INSERT`;
  a stale supplied amount or terminal order aborts and exposes no DVA.
- A held proof-RPC account/order advisory makes the compatibility trigger's
  nonblocking lock attempt raise `40001` and release its already-held projection
  row without deadlock. The preparation application exposes no DVA after that
  failed legacy write; once the advisories release, retry succeeds.
- The audit repairs current and superseded post-cutoff legacy epochs only
  through `repair_paystack_order_dva_epoch_link`, preserving current projection
  identity, updating its transaction mirror only for the current epoch, and
  linking one explicitly priced/tagged BAC transaction. A payable order receives
  a pending intent; a terminal order receives cancelled evidence and is never
  reopened. Foreign, differently linked,
  pre-cutoff, non-NGN, stale-fingerprint, or unproved evidence is rejected. An
  exact already-linked replay is accepted only to validate the link and resolve
  its matching current review; a contradictory link remains blocked.
- Audited legacy customer identity is filled once only from exact provider or
  linked-transaction proof and records its fingerprint; current order email is
  never a source. Audited legacy terminal residual is inserted only from an
  exactly reconstructible locked ledger; otherwise the terminal row remains a
  durable unresolved blocker.
- Assignment failure, transaction failure, or link failure rolls back every
  projection, epoch, transaction, and capture-link mutation, and explicit DVA
  routes return a stable application-owned `5xx` code without bank details or
  raw provider/database text.
- Ship-on-credit remains successful with `virtualAccount: null` when its
  optional DVA persistence fails.
- The automatic invoice never embeds an account whose assignment transaction
  link was not committed.
- Existing DVA retrieval remains idempotent, reuses its linked transaction, and
  does not refresh `assigned_at`.
- Existing DVA retrieval after the outstanding balance changes appends one new
  display-current epoch and linked intent while preserving the old epoch,
  pending intent, immutable pointer, payable snapshot, and `assigned_at` as
  late-payment evidence.
- A provider identity change does the same under sorted old/new account locks;
  a concurrent duplicate response leaves exactly one current epoch, and a
  retry with the same identity and payable amount is idempotent.
- Existing unlinked DVA retrieval creates and links a new tagged transaction;
  if repair fails, the route does not return the account.
- A pre-cutoff current epoch with null consent is not rendered until an exact
  receipt exists. Its first proof-gated retrieval audits one null-to-receipt
  link without changing assignment identity/timestamps; exact replay is stable,
  a different receipt cannot replace it, and superseded/non-current epochs
  cannot use this path.
- Partially paid invoices persist only their remaining payable balance.
- Creating or superseding that DVA intent leaves the order
  `payment_status = partially_paid`; an unpaid invoice may advance to `pending`
  and a pending invoice remains pending.
- An overdue but payable invoice still renders its DVA.
- A cancelled invoice never renders a payable DVA.
- A legacy pre-cutoff no-consent DVA remains eligible for exact payment
  matching but is not newly rendered. Missing consent alone never changes a
  captured transfer from matched to ambiguous/zero-candidate or prevents the
  cancelled-order payment-review path from preserving the money evidence.
- A non-NGN order cannot create or persist a Paystack DVA assignment.
- All four routes create the same canonical
  `payment-orchestration-rpc-proof:v1` assignment action only after receiving the Paystack account,
  and call the persistence RPC through their request-scoped authenticated or
  anonymous client. Static tests reject a new admin/service-role assignment
  call in these user-facing paths.
- Current-secret and unexpired previous-secret proofs succeed; missing secret,
  mismatched app/database configuration, stale/future issued-at, malformed
  canonical payload, invalid signature, altered
  account/reference/fee/amount/consent receipt or fingerprint, and expired
  previous secret fail before mutation or account disclosure.
- Proof actions are domain-separated: a consent-challenge issue, consent
  recording, assignment, ordinary initialization, gateway-initialization claim,
  or finish proof cannot be replayed as any other action even when ids and
  payload fields overlap.
- An identical proof replay is idempotent. If the order balance changes after
  proof creation, the RPC rejects the proof-bound stale amount and requires a
  new provider/persistence attempt rather than silently re-pricing it.
- The contract bundle's touch triggers record every legacy application
  insert or identity/amount/linkage/current-state assignment write during the
  migration-first window, but an expiry-only cancellation preserves its legacy
  timestamp. The post-contract audit blocks on any post-cutoff null link,
  reciprocal metadata mismatch, in-place identity rewrite, dual-current epoch,
  orphaned supersession, replaced non-null assignment pointer, missing or
  mismatched immutable customer identity/terminal snapshot, orphaned or
  role-mismatched capture link, or lost historical evidence; it repairs only
  through the verified atomic RPC and creates one durable exact-fingerprint
  review/alert for an unresolved row.
- The enforcement bundle fails while any post-cutoff assignment is
  unresolved. After a passing audit it revokes all client writes, preserves
  scoped reads, rejects future unlinked epochs and in-place identity/payable
  rewrites at the trigger, enforces one current epoch, and permits the
  proof-gated append/supersede RPC plus explicit service recovery. An authorized
  cancellation may still change only `expires_at` on a pre-cutoff unlinked row
  without refreshing its legacy touch timestamp; changing any account,
  assignment, amount, provider, or link field remains blocked.
- The migration-manifest test enumerates the complete preparation, fence,
  abandonment-index, owner-expand, contract, paystack-reference-index, and
  enforcement catalog, then requires only the prefix through
  nullable `materializedThrough` to exist and every later entry to be absent.
  Null requires all 74 feature files absent. Lane tests bind the reviewed
  `20260719115600..20260719120220` interval, reject every `20260716*` feature
  version, and require trusted pre-bootstrap inventory to prove both repository
  and production tails precede the lane. A simulated tail collision requires
  one atomic 74-entry reallocation and regeneration of every path/hash consumer;
  a mixed or phase-only renumber fails. It rejects
  an out-of-order, unlisted, unhashed, future-phase, or oversized file and fails
  when a migration advances contract state before its bundle gate. The global
  replay-verifier test accepts that same hash-bound prefix without changing any
  frozen historical source or exceptional mapping.
- Replay-scope tests prove every exact feature component has either an absence
  marker or its pre-feature definition/ACL digest, the reviewed scope/query
  hashes and count include it, the frozen 299-line base query still produces
  the same ordered 76 component bytes, and the composed query is the only query
  executed and hashed. They reject an unsafe/duplicate manifest identity,
  omitted or extra output, direct raw-query capture, and any mismatch among the
  base, template, manifest, and composed hashes. The no-migration
  baseline converges without changing any historical source or P0 relation.
  Fixtures with different generated cutoffs, UUIDs, actors, or timestamps yield
  the same normalized contract-state effect, while a changed state label,
  version, grant, definition, or expected presence changes the digest; no
  customer, payment, or audit-decision row enters the fixture.
- Release-guardian tests run entirely against synthetic signed webhooks and
  mocked GitHub REST pages. Transport fixtures require literal
  `maxBodyBytes = 26_214_400`, return `413` above it, return bounded `400` for a
  missing/malformed HMAC or GUID, and return bounded `401` for a raw body changed
  after signature computation or any failed HMAC. After a valid HMAC, fixtures
  durably acknowledge and terminally
  `ignore`/`reject` wrong repository/installation, stale events, unrelated
  pull-request actions, non-main pushes, self check events, mandatory App system
  events, and unsupported actions without creating a check or GitHub-failed
  delivery. Fork release lanes, oversized blobs/trees, redirects, truncated
  pagination, wrong event base/head, symlinks, submodules, duplicate paths,
  mutable ref substitution, or non-allowlisted permission fail evaluation but
  retain the durable delivery outcome. Architecture tests reject
  candidate checkout, archive extraction, child-process/Git/package execution,
  candidate dynamic import, or a code path that sends candidate bytes to a
  shell. Durable-ingress fixtures require local SQLite WAL with effective
  `synchronous = FULL`, `foreign_keys = ON`, literal `busy_timeout = 2000`, checked
  schema version, successful integrity/fsync/online-backup restore probes, and a
  committed `received` row before a sub-ten-second `202`. They reject `NORMAL`,
  deferred, memory/network filesystem, file-copy backup, or pre-commit success;
  prove no GitHub evaluation runs in the request handler; reclaim a worker lease
  after restart; process one delivery exactly once across duplicate/redelivered
  requests and return the same `202` for an identical GUID/digest. Lock-timeout,
  disk-full, readonly, I/O, fsync, and commit-failure fixtures return generic
  `503` plus `Retry-After: 5` inside the handler deadline, emit only a
  secret-free journal alert, create no falsely durable row, and prove a later
  GitHub-failed redelivery succeeds after storage recovery. Collision fixtures
  race changed-body reuse before claim, during a worker lease, immediately
  before check-run write, after PR success while still open, during squash
  merge, after merge/main-check success, after deployment preflight success,
  and after a terminal ignored/rejected non-release event.
  They require one atomic collision record, never evaluate the second body,
  quarantine/revoke unfinished work, enter persistent `security_hold`, change an
  already emitted affected check to `failure` only through the exact authenticated
  check-run `PATCH` and response binding, and keep all future checks
  non-successful when that update fails or mismatches. A no-release-identity
  fixture is accepted only from the committed original delivery's proven
  terminal classification, performs no check/run write, and still requires the
  full hold recovery ceremony; an unresolved original or any attempt to derive
  identity from the conflicting body is uncertain. PR-collision fixtures
  derive identity only from the committed original record, reconcile the exact
  PR through the late-merge window, accept an unmaterialized result only under
  unchanged no-bypass protection, and otherwise require the API-returned merge
  SHA to satisfy the pinned base/sole-parent/tree-equality squash proof. A
  merged PR causes the exact guardian main-SHA check to be created as failure
  when absent or updated to failure when present and its deployment run to be
  contained. Duplicate guardian checks are all failed and remain uncertain;
  stale-head, alternate-base, missing merge SHA, non-squash, protection drift,
  mismatched check, and API ambiguity all produce the maybe-started
  classification without guessing an id.
  Materialized-main fixtures paginate the all-event workflow runs and every
  attempt's jobs, accept only the exact
  repository/`deploy.yml`/main/head-SHA identity, require exactly one canonical
  `push` run, force-cancel every queued or in-progress same-SHA run including an
  unauthorized `workflow_dispatch`, reject caller-selected or adjacent
  PR/check/run identities, poll a terminal state, and bind
  PR/merge/main/check/run/event/job/step/timestamp evidence. Races before run
  discovery, before a side-effect step starts, while migration apply is
  in-progress, while production deploy is in-progress, after either completes,
  and during API/cancel/poll failure must classify exactly: only a proven
  unmaterialized PR or never-started terminal run is
  `no_release_side_effect_stage_started`; every started or uncertain path is
  `release_side_effect_may_have_started`. They prove force-cancel acceptance is
  not rollback evidence, the bounded late-merge and late-enqueue polls catch a
  delayed merge/run, the maybe-started outcome requires application
  rollback/production-ledger inspection and post-materialization recovery when
  applicable, and neither outcome permits ordinary restart/re-arm.
  Redelivery fixtures follow multiple
  cursor/`Link` pages to exhaustion, recover a GitHub-failed PR/main event,
  redeliver once and recover a GitHub-OK delivery missing locally, reconcile a
  terminal ignored event without redelivery, skip an already completed
  delivery, never persist a JWT, reject an API/page failure or malformed/repeated
  cursor, reject missing/wrong API headers, a redirect, or a caller-selected
  delivery id, bound pending redelivery/backoff, alert on stale
  backlog/timer/integrity failure, and fail closed beyond the three-day recovery
  window. The same delivery and check reconciliation is idempotent across
  restart.
  App-configuration fixtures derive `GET /app`, webhook configuration, and
  installation pages with an App JWT, then mint one unrestricted ephemeral
  installation token and use it only for the selected-repository pages;
  canonicalize the exact permission/event/hook/selection/suspension/repository
  object; and bind its digest into policy, bootstrap receipt, `ciTrustAnchor`,
  and check output. The exact permission fixture requires literal `actions =
  write` plus the five read permissions above, with no extra key, and proves the
  implementation exposes only run discovery, job/attempt reads, and
  force-cancel for the containment state machine—never dispatch, rerun,
  workflow mutation, artifact deletion, or unrelated-run cancellation. They
  reject an extra/missing permission or event, HTTP hook,
  non-JSON hook, insecure SSL, suspended/broad/all-repository installation,
  second/missing repository, page mismatch, caller override, or drift at
  bootstrap/startup/timer/evaluation.
  Containment-probe workflow fixtures accept only the pinned manual-only,
  `permissions: {}`, one-job, five-minute, literal-wait shape. They reject a
  checkout/action, expression, repository command, matrix, container/service,
  environment, secret, artifact/cache/network/deploy step, added trigger or
  permission, second job/step, or guardian-side dispatch attempt. Bootstrap and
  recovery tests derive the exact run from GitHub, cancel it, prove terminal
  job/step evidence, and refuse an adjacent non-probe run.
  Bootstrap-receipt fixtures derive every SHA/id/digest/setting from mocked APIs
  and installed paths, including the source PR's exact final-head review
  evidence, canonicalize the exact schema, and verify two distinct
  pinned Ed25519 keys over the domain-separated bytes. They reject a caller
  override, unknown field, noncanonical JSON, changed receipt/artifact/policy/
  setting/review/probe/spoof/containment-probe fact, repeated signer, wrong role/context/key,
  malformed base64, or missing signature. State-machine fixtures permit the normal
  `bootstrap_only -> receipt_materialization -> armed` path plus a collision
  transition from any state to persistent `security_hold`; they allow the
  three-file receipt PR exactly once, reject a payment lane before arming, and
  reject every ordinary restart/re-arm transition out of the hold. Dedicated
  receipt-materialization fixtures require the exact installed three-file tree,
  bootstrap-hashed controls, downstream checks, live App/protection equality,
  squash parent/tree binding, and bootstrap-domain PR/main `external_id` values;
  they prove no dispatcher or `ciTrustAnchor` is required before `armed` and that
  a crash before the durable transition leaves the state unarmed. Armed root and
  later fixtures require the normal committed `ciTrustAnchor` instead.
  Policy fixtures accept only the exact signed-receipt materialization,
  bootstrap-to-replay, and
  legacy-deploy-to-prepared transitions, then freeze them; they reject a changed
  CI/dispatcher/assertion/guardian/CODEOWNERS byte, an added workflow, duplicate
  required job name, candidate-proposed hash, later deploy drift, or policy
  downgrade. Check aggregation rejects missing, skipped, neutral, stale,
  duplicate, wrong-App, wrong-SHA, or rerun downstream checks and never recurses
  on its own App. Protection fixtures canonicalize unordered API responses but
  reject a missing expected-App binding, loose branch, disabled admin
  enforcement, force push/deletion, bypass actor, zero/self/stale review,
  unenforced CODEOWNERS, changed independent reviewer, unknown rule, or
  settings drift. They also reject an active merge-queue rule or `merge_group`
  delivery. PR and main-push fixtures produce the
  exact domain-separated `external_id`; a spoofed candidate Actions workflow
  cannot produce an accepted guardian success.
  Review-evidence fixtures paginate all reviews and require the policy-pinned
  collaborator's numeric id/login, non-bot identity, `APPROVED` state, exact
  current-head `commit_id`, and no later dismissal or changes request. They
  reject owner-only or alternate-owner approval, matching display name with the
  wrong id, author approval or a latest-pusher approval that live protection
  would reject, prior-head approval, truncated pages,
  a superseding review, aggregate-count substitution, and CODEOWNERS lines that
  list the owner or omit any of the three protected guardian-control patterns.
  Migration-freeze fixtures activate after the replay-scope main check, allow
  only the exact manifest-derived next candidate migration set, keep every
  receipt PR migration-free, and reject an unrelated/renamed/modified top-level
  migration in every materialized phase. They prove only drift detected before
  the replay-scope root's successful guardian main-push check may regenerate the
  null baseline. Immediately after that check, no fixture can issue a second
  replay-scope receipt even while `materializedThrough = null`; a post-preparation
  simulated bypass additionally returns the explicit
  post-materialization-recovery-required outcome with no next-phase approval.
- Secretless-dispatcher tests build temporary Git repositories for
  `pull_request` and `merge_group` payloads. They require exact event-derived
  base/head SHAs, the PR synthetic merge's exact parent/tree binding, full
  history and blob content
  already local, and both production variables to be absent. A controlled root,
  candidate, or receipt diff invokes exactly its matching verifier; a
  controlled diff without its receipt, a receipt-only mutation, stale base,
  second lane, caller CLI argument, malformed/unfetched SHA,
  partial-clone/promisor configuration, missing old blob for a modified,
  deleted, or renamed path, missing blob for an unrelated changed path, missing
  receipt/predecessor tree or blob, or synthetic-tree mismatch fails with
  `GIT_NO_LAZY_FETCH=1` before verifier dispatch. The fixtures make the remote
  unavailable and prove no missing-object case makes a network request; the
  same histories pass when all enumerated objects are present locally. Only a
  diff with no frozen controlled path may no-op. A merge-group fixture with any
  controlled path fails with `LATE_PAYMENT_MERGE_QUEUE_FORBIDDEN`; an unrelated
  merge-group fixture proves the bounded no-op without invoking a phase verifier.
  Workflow/package shape assertions require the exact package command and a
  `quality-misc` step for every controlled PR diff and every merge-group
  controlled-path rejection with both variables removed. They require checkout
  `fetch-depth: 0`, no `filter` or
  `sparse-checkout` input, and `persist-credentials: false`; reject
  `blob:none`, every other partial-clone filter, sparse checkout, shallow
  history, or persisted credentials; and prove the top-level required `quality`
  job still depends on `quality-misc` and that targeted `vitest --changed`
  cannot replace the command.
- Production-secret boundary tests run the dependency-free script against the
  current workflow tree and synthetic `.yml`/`.yaml` fixtures. They allow
  exactly the two Supabase secret references in `deploy.yml`'s main-only,
  production `db-migrations` job. They accept zero retention-token references
  only in the exact replay-scope baseline before the assertion is introduced;
  when the exact invocation exists, they require exactly one
  `BACI_ACTIONS_RETENTION_READ_TOKEN` reference as step-local environment on the
  first executable assertion. Positive fixtures cover that exact baseline and
  the prepared canonical assertion/apply mappings with literal
  `runs-on: ubuntu-24.04`, absent workflow/job defaults, absent workflow env, and
  the exact job/step environment allowlists. Negative fixtures reject an omitted
  shell; any non-literal or custom shell template; workflow/job
  `defaults.run.shell` or `defaults.run.working-directory`; step
  `working-directory`; a block/folded or otherwise multiline `run`; wrappers,
  chaining, pipes, redirects, or backgrounding; assertion `id`, `if`,
  `continue-on-error`, or `timeout-minutes`; and any extra workflow/job/step env
  key, including `NODE_OPTIONS`, `NODE_PATH`, `PATH`, every proxy variable, and
  `NODE_EXTRA_CA_CERTS`. They also reject controlled-node anchors, aliases, merge
  keys, explicit tags, duplicate keys, alternate scalar/flow forms, an
  unrecognized controlled field, a container/service, a nonliteral runner, or a
  custom-shell apply step. They reject a
  token without the invocation, an invocation without the token, any name
  elsewhere, workflow/job-scoped retention credentials, a later/duplicate
  assertion, Vercel exposure, a workflow-level alias, PR-capable deploy trigger
  (`pull_request`, `pull_request_target`, or `merge_group`), `secrets: inherit`,
  dynamic whole-secret serialization, reusable-workflow forwarding, missing
  production environment/ref guard, or a second named-secret reference under an
  alias.
  CI-shape assertions require this script and the exact dependency-free
  `node --test` command for both `.test.mjs` files to run in the always-executed
  `changes` job immediately after checkout and before the path-filter action, so
  a workflow-only PR cannot route around them.
- Replay-scope root-receipt tests require the exact base SHA, complete Git diff
  with only the receipt self-omitted, `materializedThrough = null`, all 74
  migrations absent, literal production, the stored production-target hash,
  v3/v4 effect bindings, and both normal replay modes in `enforce`. Target-helper
  unit tests isolate `process.env`, install only synthetic valid project refs,
  restore the original environment after each case, and never load a real
  production secret. They reject a missing/malformed ref, local
  `supabase/.temp/project-ref` fallback, alternate environment variable, raw-ref
  logging, and any target injection, CLI override, or receipt override. Trusted
  capture tests derive the hash from that synthetic environment and use a mocked
  Management API. The secretless root-PR verifier explicitly unsets both
  `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`, still recomputes the exact
  schema/tree/replay bindings, and does not claim to authenticate the root
  target. Its architecture test rejects any import of the production-target
  helper or a Management API client. Trusted deployed-root verification reads
  receipt bytes with `git show`, binds exact workflow run/job and existing
  health evidence plus the guardian main-SHA check/live protection snapshot,
  and rejects a changed tree, pending migration, stale live ledger/effect or
  trust hash, target mismatch, wrong-App check, or unverified deployment head.
- Every phase candidate test runs chronological and production-effect replay in
  `classify`, requires identical local effect hashes, and checks the candidate
  receipt's predecessor deployment digest, extension-manifest hash, SQL-check
  hashes, exact production-target hash, exact sorted changed components, and
  strict `ciTrustAnchor` object. Replay-root and phase capture fixtures mock
  App/installation/webhook/repository plus Administration/Checks APIs and derive
  the exact App configuration/digest, App ids, policy/artifact/bootstrap
  receipt/signature digests, signer-key fingerprints, CODEOWNERS identity,
  required check/App pairs, protection/ruleset digests, and GitHub `Date`
  without caller overrides. They reject App-configuration drift, an unknown rule, bypass,
  local time, stale observation, changed reviewer, unbound/wrong App, or policy
  identity not equal to the independently configured guardian.
  Trusted candidate and deployment-receipt capture tests use an isolated
  synthetic production ref and mocked Management API, independently derive its
  hash, and reject a target argument, staging/local-linked ref, or cross-project
  predecessor. Secretless candidate and receipt PR-verifier tests explicitly
  unset both production variables, inherit the target hash from the verified
  root/immediate predecessor and phase candidate as applicable, and reject any
  target-hash mutation while still deriving the complete Git diff themselves.
  A static architecture test rejects a live-verification mode, credential read,
  or import of the production-target helper or a Management API client in the
  PR verifier. The tests also reject a caller-selected path set, wrong merge
  base, merge in the candidate range, unrecorded extra path, second omitted
  path, rename/copy, symlink, submodule, type change, or undeclared executable.
  A squash fixture proves the sole-parent/base and exact candidate-tree
  contracts, while rebase, merge-commit, intervening-commit, extra-parent, and
  different-tree fixtures fail. The
  separate post-deploy receipt test binds the candidate digest to exact GitHub
  job metadata/semantic log, linked inventory, live effect hash, current P0
  fixture/provenance/manifest bindings, and zero pending migrations, then runs
  both ordinary replay scripts in `enforce`. Attempt-ledger fixtures accept a
  successful contiguous six-attempt run and the boundary sequence `1..51`.
  Capture fixtures derive `N` from `Get a workflow run`, call each numbered
  attempt endpoint exactly once in ascending order, paginate both canonical-run
  discovery and every attempt's job list, and download the exact migration-job
  log for each attempt. A second same-SHA run hidden on workflow-run page two
  and a required migration job hidden on job page two are both detected. They reject
  an attempt 404, absent/duplicate migration job, missing/expired/non-HTTPS log
  redirect, forwarded authorization header or logged signed URL, wrong/missing
  API version or accept header, job `total_count` mismatch, truncated page,
  gap, duplicate, reordered or omitted failure, attempt zero or
  52, a changed run id or SHA, returned `run_attempt` mismatch, API latest-
  attempt mismatch, job-only/failed-job-only rerun, second same-SHA workflow
  run, caller-selected run/attempt/subset, and a non-successful final attempt or
  an earlier successful workflow followed by another rerun. Attempt 51 ending
  in failure returns the explicit exhausted outcome, writes no receipt or
  fixture byte, and leaves the next phase blocked.
  Retention fixtures accept the live-compatible 90-day policy and the exact
  32-day lower boundary, and reject 31 days, `days` above
  `maximum_allowed_days`, a missing or malformed GitHub `Date` header, local
  time substitution, 401/403/404, wrong repository or API version, a candidate
  snapshot more than 24 hours before canonical-run creation, run creation before
  observation, any candidate-to-final retention or trust-anchor drift, missing
  or wrong-App guardian check, retry at or after the 30-day boundary, and capture
  after the 31-day boundary. The checked rerun
  command proves the retention GET happens before the full-rerun POST, discovers
  the canonical run without caller-supplied ids, and has no code path to
  failed-job, job-only, `workflow_dispatch`, or replacement-run endpoints. It
  accepts a latest attempt with a successful preflight or an allowed retryable
  pre-side-effect failure only when the latter has zero side-effect lines and
  the exact guardian check subsequently succeeds. It rejects an unknown/fatal,
  missing, duplicate, mismatched, or side-effect-followed failed preflight, so a
  terminal failure cannot be papered over by a later successful attempt.
  Dependency-free assertion fixtures cover no materialized phase, every closed
  prefix, each of the seven single-open pairs, and the fully closed sequence.
  They reject two open pairs, a gap, deployment without candidate, later phase
  after an open pair, wrong candidate digest, repository/ref/branch mismatch,
  run id/attempt/SHA/event/workflow mismatch, an active `workflow_dispatch`, and
  a settings/check request in a closed window. Active-window fixtures require
  exact live protection/ruleset/CODEOWNERS equality and one successful guardian
  check on `GITHUB_SHA`, accept success on the sixtieth five-second poll, and
  classify only absent/queued timeout plus bounded transport/429/502/503/504 or
  explicitly header-proved 403 rate limiting as retryable. They reject
  retryability for every other 4xx, malformed rate-limit headers, duplicate
  pagination,
  wrong external id/App/SHA, completed failure, skipped, neutral, stale,
  protection drift, or pre-push completion. No-phase and fully closed fixtures
  succeed without a retention token and emit only `not_applicable`. Shared
  parity tests fail if the assertion's seven-pair table drifts
  from the migration-release sequence or phase path policy. Migration-log
  fixtures require exactly one preflight semantic line on every candidate
  attempt. They accept success before side effects and either allowed retryable
  failure only with zero side-effect lines; they reject missing, duplicate,
  unknown/fatal failed, `not_applicable`, reordered, forged-policy, or
  post-migration lines. A two-attempt fixture records `GUARDIAN_PENDING` with no
  side effects on attempt one and a successful preflight/deploy on attempt two.
  Secretless PR verification validates the stored retention/trust schemas,
  canonical digests, and deadline arithmetic without attempting the
  administration-only live APIs. Credential
  boundary tests reject token serialization, command-line forwarding,
  raw-header logging, a pull-request/Vercel exposure path, or acceptance of an
  anonymous public-repository response.
  A next-phase candidate appearing in the same receipt PR fails.
- `late-payment-deploy-release-shape.test.ts` proves every phase-control change
  under `apps/web/**` selects the web path and makes
  `deploy-production` eligible, all required Vercel build/target identity values
  are injected beginning with preparation, the dependency-free retention
  assertion is the first executable `db-migrations` script after checkout on
  both push and full rerun, both controlled steps use their exact single-command
  built-in-bash mappings and environment allowlists, workflow/job defaults
  cannot alter them, `apply-pending-migrations.sh` is the immediate success-only
  successor, and a protected production-alias attestation runs after deploy. It
  rejects `continue-on-error`, `if: always()`, an omitted/custom/default shell,
  working-directory drift, multiline/wrapped/chained commands, environment
  poisoning, YAML indirection, shell error suppression, a duplicate/bypass apply
  path, a deploy job not hard-dependent on successful `db-migrations`, or any
  action/install/script inserted before the assertion. The earlier standalone
  boundary script, not this preparation-only test, owns the workflow-wide
  production-secret inventory and the fail-closed canonical-shape grammar.
  Removing any protected-production condition, identity, secret, or attestation
  step fails before a reference-index or enforcement PR can be treated as having
  a deployable application artifact.
- Phase-path-policy tests exhaustively assign every mutable implementation
surface to replay scope, one candidate, one receipt, or an explicitly named
shared-output class. They prove replay scope owns only the named CI/package/
secret-boundary/retention-assertion files and cannot contain the deployment-attestation
  workflow/route, preparation owns those exact attestation files, later phases
  cannot alter either frozen control surface, every guardian bootstrap path is
  forbidden from all payment lanes and bound only as predecessor evidence, and
  no broad prefix can hide an unrelated change.
- Live-ledger schema-factory tests preserve the exact historical replay
  constants while accepting only a supplied current receipt. Capture tests
  validate two consecutive derived receipts in memory and reject a fixture,
  provenance document, or manifest that still carries the predecessor count or
  tail; normal checked-in schema exports remain bound to the checked receipt.
- Audit-report tests prove canonical serialization is byte-stable, HMAC
  comparison is constant-time, current and explicitly unexpired previous keys
  verify, and a changed count, digest, phase, SHA, environment, project-ref
  hash, timestamp, nonce, key id, or signature fails. They also reject expiry
  beyond two hours, stale reports, weak secrets, unknown fields, non-`0600`
  output, and accidental secret/report logging; no test or deploy fixture holds
  a real secret.
- Adapter migration tests prove every renamed oversized inner has no runtime
  execute grant, every supported wrapper is below the line cap and delegates to
  exactly one versioned inner/helper path, owner/allocation capture still commits
  atomically, and no migration copies the current oversized function body.

### Recovery reference tests

- A BAC-preserving Paystack DVA transaction resolves
  `metadata.paystack_reference` as `external` for provider verification while
  retaining its BAC `gateway_reference` for settlement; before binding it
  resolves `internal_unbound` and no provider call occurs.
- A positively ordinary legacy Paystack transaction without provider-reference
  metadata is classified and falls back to `gateway_reference`; a possible
  internal-BAC row with no provable role remains `unclassified`, makes no
  provider call, and fails closed to review.
- `reconcile-wedged-gateway-orders` verifies the external Paystack reference,
  not the BAC reference, and passes both reference roles to the finalizer.
- `drain-failed-paid-order-side-effects` does the same whether it must
  re-verify the charge or already has a stored `gateway_response`.
- DVA settlement passes the BAC `transactions.gateway_reference` to
  `record_order_gateway_settlement_for_transaction` while storing the resolved
  Paystack reference in settlement metadata. Direct webhook, wedged
  reconciliation, and failed-row drain retries produce the identical settlement
  key/reference pair; an ordinary card or legacy transaction without a distinct
  BAC reference falls back to its provider reference.
- A prior matching settlement keyed by the external Paystack reference returns
  `legacy_reference_replay` and changes no merchant balance. An exact BAC row is
  `exact_replay`; contradictory legacy evidence is `conflict_filed` with one
  durable review/alert; and a distinct additional capture remains insertable.
- The migration-first old `record_merchant_settlement` caller and new wrapper
  serialize on the same order/gateway lock, so a held race cannot insert both
  reference forms for one capture. The old function takes that advisory before
  wallet/settlement mutation; the new wrapper reads identity without a row
  lock, takes the advisory, then locks and revalidates transaction/order. A
  forced mixed-version race completes without advisory/row-lock inversion. An
  identity change between pre-read and row lock returns the checked conflict
  and never acquires a second settlement advisory while holding those rows.
- Non-Paystack gateways continue using `gateway_reference`.
- Wallet, savings, and store-credit failed or stale-claimed steps dispatch to
  `runInternalCreditPaidOrderSideEffects` without calling
  `verifyGatewayCharge`, without requiring a provider reference, and without
  installing or seeding `merchant_settlement`.
- An unsupported transaction gateway preserves the existing terminal/manual
  reconciliation behavior rather than being cast to a gateway or
  internal-credit runner.
- The reconciliation CLI calls reservation, then
  `claim_paystack_transaction_reference`, then the finalizer for `claimed` or
  `completed_replay`.
- Recovery `status_conflict` and `external_reference_conflict` outcomes never
  call the finalizer and remain durably reviewable.

### RPC security tests

- `anon` and `authenticated` cannot execute the resolver, reference-claim,
  reservation, retry-seed, legacy owner/allocation classification,
  review-filing, or alert worker RPCs, or the internal-credit status, pause,
  pause-finalization, stale-intent reconciliation, activation, or historical
  audit-decision RPCs, or provider-cancellation recovery claim/finish and
  manual-review decision RPCs.
- Every service-role-only RPC fails before reading financial rows when
  `auth.role()` is absent or not `service_role`.
- `persist_paystack_order_dva_assignment` accepts a valid proof plus the
  proof-bound merchant/staff, customer, or guest order capability, and accepts
  `service_role` only for the checked-in repair CLI. It rejects unrelated users,
  inactive staff, cross-customer access, unproved anon calls, caller-supplied
  merchant spoofing, and any payload change after signing.
- `persist_initialized_gateway_payment` applies the same proof/capability rules
  to ordinary gateway initialization, while `get_payment_initialize_context`
  is read-only and bounded to the exact order/email scope. Static route tests
  reject `createAdminClient`, `createServiceClient`, direct privileged table
  reads, and `create_payment_transaction` in `/api/payments/initialize`.
- Intent begin, gateway handoff completion, and safe pre-credit abort accept
  only the authenticated user who owns the merchant-scoped customer or
  `service_role`. Abort rejects foreign intents and any committed credit or
  payment evidence.
- The internal-credit finalizers accept only the authenticated user who owns
  the order's merchant-scoped customer or `service_role`, and reject `anon`,
  unrelated users, and cross-merchant customer collisions.
- Provider cancellation prepare/result/local-finalize rejects `anon`, unrelated
  merchants, inactive staff, foreign attempts, invalid dispositions, oversized
  or secret-bearing provider payloads, and cross-shipment tokens before
  mutation. Recovery claim/finish and manual decision reject every non-service
  role. Attempt events are append-only and each committed state transition has
  exactly one corresponding event.
- The private wallet and savings inventory-compensation helpers have no
  `PUBLIC`, `anon`, or `authenticated` execute grant and can be reached only
  through the authorized finalizers.
- The private receiver-bank normalizer has no client execute grant; the
  reservation RPC receives raw verified bank evidence and recomputes the
  canonical database value rather than accepting caller classification.
- The private cancellation-compensation helper has no direct execute grant and
  is reached only through the authorized customer, merchant, provider, or
  service cancellation wrappers.
- The private typed review-and-alert primitive has no direct execute grant even
  to `service_role`. Registered security-definer finalizers and terminalizers
  can call it only after their own authorization, while webhook/CLI code reaches
  it only through the fail-closed service-role wrapper. An authenticated
  cancellation conflict can therefore commit its review and alert atomically
  without granting the customer either helper.
- No client can read, insert, update, or delete the private one-shot
  terminalization authorizations or execute their mint/apply helper. A direct
  terminal order update without the exact current-transaction token fails even
  when the order has no internal-credit evidence; a token for another order,
  target transition, function identity, or transaction is not reusable.
- The old amount-taking finalizer signatures no longer exist. Direct RPC calls
  cannot provide a smaller amount, select a payment method, or complete an
  order using a redemption row owned by another order, customer, or merchant.
- The old tokenless redemption/finalizer signatures no longer exist. The begin
  RPC succeeds only while the control state is enabled, and every later credit
  mutation requires the same authenticated, bound, open intent. A valid intent
  may continue while the database is draining its captured generation; a new,
  foreign, stale-generation, completed, or aborted intent fails before mutation.
- The behavior-neutral preparation bundle changes no current financial function.
  The prepared application becomes live and route traffic drains before the
  separate fence bundle replaces the legacy amount-taking finalizers. Its final
  gate records `fence_v1`; owner-expand atomically refreshes every replaced
  definition, records `owner_expand_v1`, and changes terminalization from
  `legacy_direct_v0` to `allocation_safe_v1` only after the strict token trigger
  is live; the late-payment contract bundle removes retired signatures, records
  every intent-aware and compensation-aware terminal signature, but does not
  advance active state until the owner-contract module is staged; the final
  contract gate atomically changes terminalization to `compensation_v1` and
  records `late_payment_v1`. Activation
  refuses a stale version, an extra or missing active signature, or any
  definition digest or grant mismatch.
- `internal_credit_checkout_ready()` exposes only a boolean and cannot read or
  mutate the control singleton through client table APIs.
- `get_order_terminalization_contract_version()` exposes only its checked
  literal; a malformed/missing result fails closed. Static SQL tests prove the
  order trigger consumes only a private token and never locks or queries
  control, financial, allocation, unit, or catalog evidence after the order
  row is locked.
- `begin_internal_credit_checkout` and `pause_internal_credit_checkout` race on
  the same locked control row. The winner either creates one captured-generation
  intent before drain or changes readiness to false before begin; no intent can
  appear after drain starts.
- An identical begin idempotency replay returns the same intent; a changed
  request hash conflicts; and the partial unique open-intent constraint prevents
  one authenticated customer from creating unbounded pause-blocking intents.
- A recognized pre-credit order failure closes an unbound intent, or
  terminalizes and unwinds a bound no-credit order, through the authenticated
  abort RPC. Any wallet, savings, payment, or contradictory evidence makes
  abort fail with reconciliation-required and leaves all rows unchanged.
- `pause_internal_credit_checkout` increments the pause generation once and
  returns `paused` when no checkout intent or gateway initialization is active,
  or `draining` with the exact separate active ids. Existing
  captured-generation work can finish, but new keys fail. An identical existing
  key remains readable without mutation.
  `finalize_internal_credit_checkout_pause` refuses to report paused while any
  open/reconciling/reconciliation-conflict intent or
  pending/claimed/reconciliation-required gateway initialization remains.
- A stale intent with no order aborts safely; an order-only intent terminalizes
  and unwinds; committed credit is compensated before terminalization; an
  already-paid transaction heals to completed; and contradictory evidence
  creates one durable intent-conflict review. The pause script never force-closes
  an unresolved intent and exits non-zero if a bounded drain cannot complete.
- Intent and gateway-initialization reconcilers reject enabled/paused control
  states, a foreign checkout generation, or stale evidence before provider,
  order, inventory, or ledger mutation; only the retained draining generation
  is service-reconcilable.
- Reconciliation rejects a stale evidence fingerprint. An unchanged conflict
  returns the same review; a repaired fingerprint is re-evaluated under locks
  and may close the review plus complete/abort the intent only when ledger truth
  proves it. Directly resolving the review or updating the conflict intent
  cannot satisfy activation.
- A stale or wrong expected SHA, stale pause generation, blank/oversized reason,
  or invalid operator identity fails without changing control state.
- Activation rejects a stale pause generation. Reactivation after emergency
  pause reruns every gate and may store the same SHA or an exact verified repair
  SHA without deleting or rewriting prior events. Invalid operator identity
  fails before state mutation.
- The activation script rejects a missing, stale, or mismatched signed Paystack
  reference-role report before calling the RPC. The RPC independently rejects
  a missing/drifted index or any currently unclassified, evidence-mismatched,
  or duplicate referenced row, including one created after the signed report.
- The order route calls the internal-credit finalizer through its authenticated
  client and never constructs either `createServiceClient()` or
  `createAdminClient()`, fetches a privileged rich-order projection, or claims a
  paid-order side effect. The best-effort transaction-id nudge crosses the
  `CRON_SECRET`-protected worker boundary before any service-role work begins;
  nudge failure leaves the periodic drain as the durable fallback.
- The hardened `claim_payment_side_effect` rejects non-service roles before
  reading the transaction or side-effect row, validates the requested
  transaction/order relationship, and never rewrites a row's transaction owner.
- Migration tests assert pinned empty `search_path`, revoked default execute
  privileges, explicit grants, fully qualified relation access, and RLS on the
  alert, migration-state, legacy-owner decision, control, control-event,
  checkout-intent, function-contract/state, terminalization-contract state,
  private one-shot terminal authorization, cancelled-order audit-decision,
  inventory-allocation/state/decision, provider-cancellation-attempt, and
  inventory-unwind tables, plus denied client access to the private
  payment-orchestration proof-secret configuration.

### Ledger and side-effect tests

- Successful finalization sets `amount_paid = total`, invoice balance to zero,
  and the same checkout intent to `completed/fully_paid`.
- Cancelled and refunded finalization branches do not change `amount_paid`.
- A pause racing the intent begin has only two outcomes: the intent commits
  under the draining generation and may finish, or begin fails before order
  creation. A pause between order creation, redemption, and finalization never
  sends the order to a gateway merely because readiness changed.
- A recognized insufficient-wallet outcome may hand off to gateway only after
  the database proves the exact credit mutation state and atomically creates one
  durable gateway-initialization record while completing the intent as
  `gateway_handoff`. A pause/fence error, malformed result, timeout, or unknown
  redemption error leaves a durable replayable intent and initializes no
  gateway.
- A process crash after handoff commit but before the provider call resumes the
  same gateway-initialization id. A crash after provider success but before the
  HTTP response retrieves the same provider object and BAC transaction by the
  stable reference. An uncertain provider result files reconciliation and never
  performs a blind second initialization.
- Gateway-initialization claim and finish accept only the owning authenticated
  customer plus the exact current server proof action/payload. A direct client,
  stale proof, changed claim token/provider result, or cross-customer record
  fails before lease or transaction mutation, and the initialize route contains
  no service-role client for this path.
- During emergency drain, a retained-generation pending/claimed gateway
  initialization may finish or reconcile, but pause cannot finalize while it
  remains mutable. Once paused, ready/aborted outcomes remain readable and no
  fresh provider call is allowed; a conflict remains readable while keeping the
  state draining. Proven not-started initialization
  compensates credit and terminalizes the order before abort.
- Same-key replay covers every phase: started and order-bound resume only their
  missing step, credit-redeemed reuses exact evidence, gateway-handoff resumes
  the one initialization, fully-paid returns the deterministic transaction,
  aborted exposes its compensation proof, and reconciliation-conflict returns
  its review without mutation.
- A process crash after order creation, after wallet redemption, after savings
  redemption, and after partial-credit persistence is recovered from ledger
  truth by the intent reconciler without duplicate redemption, double unwind,
  or a silently payable abandoned order.
- Wallet-only finalization succeeds only with the exact completed
  `order_redemption` transaction linked to the locked order and fails for a
  foreign, pending, failed, or missing wallet transaction. An exact prior
  strict-inventory reversal returns `inventory_unavailable_reversed`
  idempotently; any other reversal is a ledger conflict.
- Savings-only and mixed store-credit finalization succeeds only with the exact
  order-linked savings redemption and optional wallet redemption. The locked
  component sum must equal the fresh candidate-excluding outstanding balance;
  partial and excess evidence fail without inserting a transaction.
- A caller cannot turn a ₦1 redemption into a fully paid order, cannot reuse one
  order's redemption against another order, and cannot select `wallet`,
  `savings`, or `store_credit` independently of the locked evidence.
- A deterministic internal-credit transaction whose stored redemption ids or
  component amounts differ from the replay request returns a conflict rather
  than `completed_replay`.
- With redeemed wallet/savings evidence but no deterministic transaction, an
  active provider-cancellation attempt returns
  `payment_held_for_provider_cancellation` with its durable review, preserves
  the bound intent/evidence, and seeds no payment or side effect. A locked
  provider rejection permits exact replay to complete; proven cancellation
  compensates and aborts through terminalization. DVA assignment, ordinary
  initialization persistence, and gateway-handoff claim reject the same hold
  before starting another provider call. A hold after claim makes finish
  persist a non-exposed `reconciliation_required` result; rejection promotes it
  to ready, while cancellation safely aborts it and the checkout intent. A
  cancellation attempt beginning after initialization is already `ready`
  atomically changes it to `reconciliation_required`; a concurrent ready replay
  performs the same transition and returns no launch URL. Pending remains
  unclaimable and claimed completion follows the finish-time hold, so no state
  depends on a later customer retry to become drain-visible.
- The fresh internal-credit baseline excludes the supplied wallet and savings
  evidence. A full-balance redemption succeeds once even when
  `orders.wallet_amount_used` reflects the same candidate amount.
- After that completion sets `amount_paid = total`, replay checks the
  deterministic transaction and exact evidence first and returns the same
  transaction id instead of recomputing a zero outstanding balance.
- A completed deterministic transaction whose order is not fully paid produces
  `INTERNAL_CREDIT_LEDGER_CONFLICT` rather than being treated as a replay or a
  reason to insert another transaction.
- A fresh internal-credit completion whose selected paid-order step already
  belongs to another transaction rolls back its payment transaction, order
  update, and step inserts together.
- A fresh internal-credit completion confirms inventory inside the finalizer
  transaction. A strict serialized shortage rolls back the transaction row,
  order-paid update, fulfillment snapshots, inventory mutations, and every
  seeded side-effect row together.
- After that strict rollback, wallet-only compensation creates exactly one
  deterministic `order_reversal`; savings-only compensation restores the exact
  pre-redemption goal snapshot and marks one redemption reversed; mixed credit
  performs both atomically. The finalizer returns
  `inventory_unavailable_reversed` with no payment transaction or side-effect
  steps, invokes the policy-aware terminal inventory unwind, and terminalizes
  the order with the exact system cancellation reason.
- Replaying the same strict-inventory outcome does not consume or restore funds
  again, release inventory again, or rewrite the terminal reason. A savings goal
  changed after redemption or a mismatched wallet reversal returns
  `inventory_reversal_conflict_filed` with one durable
  `internal_credit_inventory_reversal_conflict` review and operations alert
  rather than an inferred balance mutation. Failure to persist that review or
  alert raises `INTERNAL_CREDIT_INVENTORY_REVERSAL_CONFLICT`.
- Every exact customer, merchant, provider webhook, provider cancellation,
  payment-failure, abandonment, and system terminalization signature reverses
  exact active wallet and savings redemption evidence before entering any
  listed terminal state when no completed deterministic payment exists. The
  matrix includes shipping `cancelled`, `canceled`, `failed`, and `returned`,
  payment `cancelled`, `failed`, `refunded`, `abandoned`, and `expired`, plus a
  null-to-non-null `cancelled_at`. A verified post-paid return/refund follows its
  refund workflow without pre-finalization compensation. Mixed credit is
  all-or-nothing and uses
  `order_cancelled_before_internal_credit_finalization`.
- Every registered first terminal transition for an order with any DVA epoch
  captures one immutable ledger-derived terminal snapshot before the terminal
  update. A partially paid order records the exact residual, an unpaid order
  records its full residual, and an all-unlimited-inventory order follows the
  same snapshot contract without stock mutation. The first transition returns
  `terminal_payment_snapshot_count = 1`; an order with no DVA history returns
  zero. Idempotent replay validates the same ledger fingerprint and returns
  `terminal_payment_snapshot_count = 0`; contradictory evidence rolls back the
  terminal transition, compensation, inventory unwind, and snapshot together.
- Shipment terminalization locks shipment first, then control, bound intent,
  shared credit advisories, sorted DVA account advisories, payment/order,
  evidence, projection, epoch, capture-link and terminal-snapshot rows,
  immutable allocations, and stock.
  Order-only terminalization starts with control and the bound intent. No
  participating function locks shipment after order.
- An `aggregate_decremented` allocation restores its exact original quantity
  once even if current `manage_stock` is false; `serialized_reserved` releases
  only units stamped with its allocation id; `unlimited_noop` never mutates
  stock even if tracking was later enabled; `external_untracked` is a no-op;
  and a deleted catalog target records `catalog_deleted_noop`. Mixed orders
  persist one immutable unwind event per allocation and replay without changing
  any stock twice.
- Storefront creation, serialized quiz reservation, order-item edit/rebalance,
  and imported-item replacement commit allocation evidence atomically with the
  inventory action. Every serialized unit and append-only inventory event
  carries the generated allocation id, and deleting and reinserting
  `order_items` cannot delete or confuse the allocation history.
- Expand migration tests run the live order-item replacement signatures before
  any later migration exists and prove Bumpa/Jumia callers can invoke the
  already-installed unwind helper/event table. A terminal import patch either
  dispatches through the provisional safe branch or rejects uncompensated
  credit before item/status mutation; it never directly writes around the
  guard.
- Before the late-payment contract bundle exists, every other provisional
  terminalizer produces the same allocation summary and one-shot authorization
  behavior. A no-credit order terminalizes and unwinds; active wallet/savings
  evidence returns `INTERNAL_CREDIT_CANCELLATION_REQUIRES_CONTRACT` without
  provider call, status, shipment, item, or inventory mutation. A direct update
  and a stale pre-expand request both fail the token trigger, and the prepared
  dispatcher retries only through the advertised provisional RPC.
- Migration tests stamp a serialized unit and its event before inserting the
  allocation parent, then commit after inserting that parent. Both exactly
  named `DEFERRABLE INITIALLY DEFERRED` foreign keys succeed in that order; the
  same transaction fails at commit and rolls back when the parent is omitted.
- The legacy allocation audit rejects classification from mutable current
  catalog fields alone, blocks unclassified inventory-live items, and requires
  an exact current-fingerprint open review for any manual disposition. A manual
  disposition blocks terminalization rather than authorizing a guessed restock.
- Customer cancellation returns the exact structured `cancelled`,
  `cancelled_replay`, or `cancellation_reversal_conflict_filed` outcome. Only
  `cancelled` sends email; the conflict returns HTTP `409` with its review id;
  and a malformed result cannot be interpreted as boolean success.
- Customer-cancellation migration tests first install the exact
  `20260714225503_reconcile_customer_order_cancellation_reason.sql` baseline,
  then apply owner-expand and contract replacements. They prove null/blank and
  trimmed reasons, the 500-character boundary, `reason_too_long`/`22001`,
  foreign-or-missing `order_not_found`/`P0002`, policy rejection/`P0001`,
  `cancelled_by = 'customer'`, timestamps, one-time account expiry and funding
  intent cancellation, replay without email/restock/unwind, empty
  security-definer `search_path`, and the authenticated-only runtime grant.
- A cancellation/reversal conflict leaves the order uncancelled, commits no
  partial compensation, and creates one durable
  `internal_credit_cancellation_reversal_conflict` review and operations alert.
  Direct transitions into any listed terminal shipping/payment state with
  active unreversed evidence fail at the database backstop.
- Static terminal-write tests cover the chat cancellation, agentic
  compensation, merchant order PATCH, shipping webhook, shipping cancellation,
  customer tracking route, Bumpa/Jumia replacement and notification-suppression
  wrappers, cleanup route, and latest SQL function definitions. The customer
  tracking fixture proves terminal carrier results do not mutate the order. An
  unregistered direct terminal writer fails the contract test.
- Provider cancellation records a prepare attempt before the external call,
  and the preparation revision refuses the route before expand. After expand,
  auth precedes Zod/merchant/CSRF checks, one atomic disposition allows exactly
  one provider call, known rejection releases the payment hold, and timeout or
  transport ambiguity records `provider_outcome_unknown` without collapsing it
  to rejection. Concurrent retries return `in_progress` or the stored result.
  The status-recovery pass never repeats current Topship cancellation, enters
  bounded backoff/manual review on non-definitive tracking evidence, finalizes
  locally exactly once when cancellation is proven, preserves
  `provider_cancelled_local_finalization_failed` on local failure, and retries
  local finalization without calling the provider again. Gateway completion and
  DVA reservation both hold while the attempt is active; their dedicated
  review/alert is idempotent, and neither order-paid state nor fulfillment
  side effects commit. Exhausted retries remain held in `manual_review`; only
  the checked-in service-role CLI with the exact open fingerprint can record
  rejected/cancelled evidence, and a stale or foreign decision cannot release
  the hold. A locked rejection or successful local cancellation resolves only
  that attempt's current hold/unknown reviews with its immutable event.
- The cleanup claim RPC discovers ids without locking order rows and claims at
  most 50 queue rows in a short transaction. Each
  `terminalize_claimed_abandoned_order` call then handles one order in its own
  transaction, and the route processes at most 500 calls with concurrency five.
  Two concurrent workers cannot own the same live token, and stale-token replay
  cannot mutate an order or duplicate unwind. Repeated conflict/error rows enter
  same-fingerprint backoff, later eligible rows progress, changed evidence
  becomes immediately actionable, and `drained` means no immediately actionable
  candidate even when reviewed work remains deferred. The route rejects void,
  malformed, or negative-count claim/terminal/work-state results and aggregates
  no more than ten claim rounds. A database lock test holds the control row on
  one order and proves another completed cleanup transaction never retains that
  lock while moving to a sibling order.
- The pre-contract historical audit finds every terminal order with active
  unreversed internal-credit evidence. Activation cannot pass with an
  undispositioned row, a stale evidence fingerprint, a closed or mismatched
  manual review, or a caller-supplied fingerprint that differs from the
  database recomputation.
- An internal-credit order containing only effective `off` items succeeds with
  zero inventory mutation. A mixed order ignores `off` items, confirms strict
  tracked items, and permits `serialized_then_unlimited` fallback shortages.
- `serialized_strict` is the only effective policy that can produce
  `serialized_inventory_unavailable`; a zero or null stock quantity on an
  unlimited item cannot block payment.
- Per-item inventory counters reset for every order item. A first item that
  reclaims enough serialized units cannot hide a second strict item's shortage;
  the SQLSTATE `55000` detail identifies the second item's exact required,
  reserved, reclaimed, and missing counts.
- Wallet reversal racing finalization serializes on the wallet redemption
  advisory lock; either finalization sees valid unreversed evidence, or it sees
  the committed reversal and fails closed.
- Each internal-credit finalizer returns the exact inserted completed
  transaction, locked owner, amount, currency, gateway, and reference; an
  idempotent replay returns the same transaction id rather than a boolean or a
  newly inserted row.
- A fresh invoice invokes the existing best-effort creation-time new-order push
  once. Its later DVA payment never retries or duplicates that creation-owned
  event and produces only one claimed payment-received push.
- A deferred-payment order that becomes fully wallet-, store-credit-, or
  savings-funded removes both direct pushes and produces one claimed new-order
  push plus one claimed payment-received push through the internal-credit
  runner.
- A creation-owned invoice that is subsequently fully funded by wallet keeps its
  creation-time new-order owner, and the internal-credit runner sends only
  payment received.
- The internal-credit runner claims paid email and ad tracking but never
  installs, seeds, or calls `merchant_settlement`, never requires an
  `OrderWalletFundingIntent`, and never fabricates Paystack/Korapay evidence.
- The shared runner exposes `paymentEvidence`, not `gatewayResponse`; gateway
  settlement receives only verified provider evidence, while internal credit
  carries explicit internal payment-method and transaction evidence.
- The preparation application receives the old completion result before the
  owner-expand bundle and uses the current direct helper only for a fresh order
  flip. The same already-deployed application receives
  `merchant_push_contract = claimed_v1` immediately after the owner-expand gate,
  never calls the direct helper, and runs the exact atomically seeded complete
  payer-owned step set.
- Under `claimed_v1`, a fresh payer and payer replay return their exact
  `payer_transaction_id`; an additional capture returns the other payer and runs
  settlement only; a pre-outbox already-paid replay may return null and sends no
  notification. Mixed payer rows fail closed, and the finalizer never calls
  `getOrderOutboxState` to infer ownership in the claimed branch.
- A fresh Paystack/Korapay completion, or a fresh Juicyway payer reached through
  the current wedge reconciler, returns through
  `complete_order_gateway_payment`; it and its payer replay return
  `inventory_contract = atomic_confirmed_v1`. The order flip, complete seed set,
  and inventory confirmation become visible together; the failed-row drain can
  never observe a fresh seed before inventory succeeds.
- A strict serialized shortage inside any of those shared-finalizer completions
  commits neither the order-paid update nor any seed or inventory mutation. `off` and
  `serialized_then_unlimited` orders still complete according to their existing
  unlimited-stock semantics.
- The schema-first expand window therefore produces no new direct-only cohort
  for Paystack/Korapay payments or shared-finalizer Juicyway payers participating in
  `complete_order_gateway_payment`. Among merchant push rows, an invoice seeds
  only payment received, an ordinary payment-owned Paystack/Korapay or Juicyway
  reconciler-completed order seeds both pushes, and settlement-only captures
  seed neither.
  Both payer flows also atomically seed paid email, ad tracking, and gateway
  settlement before the order flip commits.
- A still-null legacy owner that becomes paid after expand immediately receives
  a durable payment-received row and defers new-order ownership. Classification
  as `payment` atomically seeds the missing new-order row with the same payer
  transaction; `creation` and `not_applicable` do not.
- A pre-expand already-paid replay under `claimed_v1` with no owned push rows
  returns an empty `merchant_push_steps` list and sends no push; it never falls
  back to direct delivery.
- The preparation claim parser accepts the old two-field
  `claim_payment_side_effect` result before expand and requires the hardened
  owner-aware result for `claimed_v1`.
- A failed or stale-claimed row can be taken over only by its stored
  transaction. A different transaction receives
  `ownership_conflict = true`, changes no claim fields, executes no side effect,
  and produces a durable transaction-scoped wedge review.
- The preparation/expand conflict path creates only the generic gateway wedge
  review. The contract path creates only the dedicated retry-conflict review and
  operations alert; it does not duplicate both review types for one claim
  conflict.
- `markCompleted` and `markFailed` include the transaction id predicate. A
  matching token from a mocked or stale caller cannot complete or fail another
  transaction's row.
- `activate_internal_credit_checkout` validates one exact 40-character contract
  commit SHA, normalized deployment id, 64-character immutable release-identity
  digest, and current pause generation; it records all three identifiers in an
  immutable activation or reactivation event and returns idempotently only for
  the already-enabled same identity triple and generation. Route/script tests
  reject the paused deployment id, stale alias/cache response, wrong workflow
  run, wrong environment/project/origin, redirect, checkout mode other than
  `enabled`, agentic Paystack DVA mode other than `paused`, malformed identity,
  or a canonical digest mismatch. They prove
  the expected project hash comes only from the trusted production
  `VERCEL_PROJECT_ID` and cannot be caller-selected. Attestation route tests
  require HTTP `200` for valid false and true readiness and the exact
  `401`/`421`/`503` failure partition. They also prove
  `dbReady` is excluded from the digest: paused-state activation requires false,
  while an exact enabled-state replay requires true, preserves the digest, and
  creates no event or generation increment. Every other state/readiness pairing
  fails. The RPC refuses activation when the owner or allocation
  gate, current-fingerprint terminal-order audit, unresolved prior-generation
  intent, new signatures, old-signature removal, exact
  `late_payment_v1` active registry manifest, terminalization registry, or grant
  audit fails, or DVA assignment enforcement is absent/stale.
- The external DVA wallet-funding runner still installs gateway settlement and
  remains separate from the checkout internal-credit path.
- Both finalizer RPCs seed the owner-selected pushes, paid email, and ad
  tracking before returning a completed outcome. The order route validates that
  committed result, returns without privileged claims, and schedules only a
  best-effort transaction-id nudge; a nudge or worker rich-order-fetch failure
  leaves the same rows available to the periodic drain.
- The targeted internal-credit worker rejects missing/invalid cron
  authorization, malformed transaction ids, non-internal-credit transactions,
  and caller-selected order ids or step lists. It creates the service client
  only after authorization and dispatches exactly the stored transaction.
- Nudge failure does not change a committed paid response to `500`; same-key
  replay can nudge again without reseeding or taking over another transaction's
  rows, and the hourly drain remains sufficient after total nudge loss.
- Wallet- or savings-credit checkout without a valid `Idempotency-Key` fails
  before order creation. Retrying a post-finalization `500` with the same key
  replays the same order and finalizer transaction.
- The active `checkout-page.tsx` receives
  `inventory_unavailable_reversed`, preserves the cart, clears the pending
  terminal order and the old fingerprint key, refreshes balances, and creates a
  fresh idempotency key on the next submission.
- The same active page retains the old order and key for
  `inventory_reversal_conflict_filed` and generic `500` responses so retry
  remains replay-safe.
- Removing the creation route's internal-credit paid email does not remove the
  immediate invoice, pay-on-delivery, or fully covered quiz-voucher email path.
- An ordinary redirected Paystack/Korapay order, or a fresh Juicyway payer
  completed by the current reconciler through the shared completion RPC,
  produces one claimed new-order push and one claimed payment-received push
  after payment when its locked owner is `payment`.
- Pay on delivery attempts one creation-time new-order push and creates no
  gateway payment-received claim; provider failure remains logged rather than
  retried by this design.
- Settlement-only captures install neither push executor.
- Both paid-order merchant push step implementations are claim-gated whenever
  their ownership policy selects them.
- A paid invoice whose process crashes or whose rich-order fetch fails
  immediately after the atomic flip already has failed retry rows for paid
  email, settlement, ad tracking, and
  `merchant_payment_received_push`, but never
  `merchant_new_order_push`.
- A redirected Paystack/Korapay order or shared-finalizer Juicyway payer with
  the same crash or fetch failure already has both owner-selected merchant push
  markers plus paid email, ad tracking, and settlement, while a settlement-only
  capture persists none of the order-scoped rows.
- Changing an invoice order's `payment_method` to card through reuse preserves
  owner `creation`, so later payment sends only payment received.
- Changing a redirected Paystack/Korapay order's `payment_method` to invoice through
  reuse preserves owner `payment`, so its eventual confirmed payment still
  sends both owed events.
- A DVA transaction tag and every later payment-method mutation leave the owner
  unchanged.
- Legacy `not_applicable` orders receive payment received but never acquire a
  retrospective new-order push.
- The primary Juicyway webhook direct-success branch, Klump, Credit Direct, and
  manual paid transitions are asserted as outside this migration's durable-
  notification guarantee. Juicyway reconciliation tests prove that a fresh
  payer entering the shared finalizer receives `claimed_v1`;
  failed-side-effect-drain tests prove that post-cutover durable rows retry but
  an already-paid pre-outbox replay gains no retrospective claims. No success
  criterion counts a provider path as covered merely from its gateway name.
- A failed merchant push persists as failed and is retried by the existing
  failed-paid-order drain.
- The drain retries internal-credit paid email, ad tracking, and owner-selected
  merchant pushes through the no-settlement runner for both `failed` rows and
  stale `claimed` rows. Its tests assert zero gateway-verification calls and
  zero settlement executor installation for `wallet`, `savings`, and
  `store_credit`.
- Retry seeding inserts absent selected steps and refreshes an existing failed
  step only when its transaction owner matches.
- Retry seeding leaves completed, fresh claimed, and stale claimed steps
  unchanged; stale claimed work is recovered only through the ordinary claim
  takeover and drain.
- A retry seed for a step owned by another transaction changes no requested
  side-effect row and atomically creates one
  `paid_order_side_effect_retry_conflict` review plus one deduplicated
  operations alert.
- Replaying that conflict reuses the transaction-scoped review and alert while
  preserving the original completed or claimed side-effect owner.
- Failure to persist the conflict review or alert rolls back the entire seed
  RPC and causes webhook/cron/CLI `completion_failed` or checkout
  `PAID_ORDER_SIDE_EFFECT_STATE_CONFLICT`.
- A later runner failure cannot reset an earlier completed push to `failed`, and
  replays do not create a second logical push claim.
- The retry helpers contain no direct `payment_side_effects` upsert and surface
  retry-seed ownership conflicts for reconciliation.
- New storefront orders persist the expected explicit notification owner;
  idempotency replay, order reuse, imports, and payment-method updates cannot
  mutate it.
- Production env validation requires an explicit
  `INTERNAL_CREDIT_CHECKOUT_MODE`. In paused mode, wallet and savings requests
  return `503 INTERNAL_CREDIT_CHECKOUT_PAUSED` before any order, stock,
  idempotency, redemption, email, or push mutation; ordinary card, invoice,
  pay-on-delivery, and quiz checkout continue.
- Production env validation also requires exact
  `AGENTIC_PAYSTACK_DVA_MODE = paused` for this release. Missing, `enabled`, or
  unknown values fail the release preflight. The setting affects only agentic
  Paystack bank transfer; ordinary storefront/invoice DVA remains governed by
  customer-consent readiness, and agentic pay on delivery or independently
  configured Google Pay remains available.
- The route's readiness truth table proceeds only when environment is `enabled`
  and database readiness is true for a new idempotency key. Every other
  combination returns the paused response before mutation, while an exact
  existing key may retrieve only its authenticated replay state. Direct RPC mutation depends on verified database
  activation, which the rollout never performs before the environment-enabled
  contract application is live.
- The storefront place-order handler preserves the cart and shows the temporary
  internal-credit-unavailable message instead of treating the paused response
  as an abandoned or successful order.
- Expand-migration tests prove legacy rows remain `NULL` until an audited
  classification, the immutable singleton records the database
  `legacy_cutoff_at` and contains no internal-credit activation fields, the
  separate control singleton remains disabled, the check accepts only the three
  named non-null owner values, and the
  transition trigger allows only `NULL -> valid owner`.
- Expand-migration tests also prove `complete_order_gateway_payment` seeds the
  exact complete gateway payer-owned rows atomically, returns `claimed_v1`,
  returns the locked payer plus both the complete step set and merchant-push
  subset, rejects mixed payer ownership, and never writes a transaction
  delivery-mode metadata field.
- An expand-period completion whose required paid email, ad tracking,
  settlement, or merchant-push row belongs to another transaction commits
  neither the order flip nor new rows, files the existing
  gateway-payment-wedge review through the preparation application, returns
  `500`, and never falls back to direct delivery.
- When serialized-strict inventory confirmation fails inside a fresh completion,
  the RPC transaction rolls back the order flip, amount update, exact seed set,
  inventory changes, and fulfillment snapshots. Tests prove the drain never sees
  a seed from that failed transaction and the claimed branch never calls
  application cleanup or paid-status rollback.
- Gateway completion succeeds for an all-`off` order without stock mutation and
  for `serialized_then_unlimited` shortages with the committed missing-unit
  count. Mixed-policy fixtures prove only a strict tracked shortage can abort
  payment.
- Expand SQL tests reproduce the prior cross-item counter defect: item A
  reclaims units, item B is strict and empty, and item B still raises SQLSTATE
  `55000` with its own diagnostics.
- The concurrent-index migration verifies both stable expected index names and
  definitions, resumes after simulated migration-history registration failure
  after either creation, and rejects a pre-existing same-name index with the
  wrong keys, uniqueness, expression, or predicate.
- Expand-migration tests also prove the recreated
  `claim_payment_side_effect` permits same-transaction failed/stale takeover,
  rejects cross-transaction takeover without mutation, returns the stored owner,
  and retains the existing role guard and grants.
- Fence-bundle tests establish the exact `fence_v1` active manifest. Owner-expand
  tests replace registered functions, then the final gate refreshes their
  digests/grants, retires no-longer-active entries, and establishes the exact
  `owner_expand_v1` manifest; comparing a replacement against its old fence hash
  is a test failure. Contract modules leave the active version unchanged while
  staging definitions; final-gate tests refresh all definitions and establish
  the only activatable `late_payment_v1` manifest.
- Expand tests prove every fresh storefront/quiz item receives immutable
  allocation evidence matching the actual aggregate decrement, serialized
  reservation plus unlimited fallback, unlimited no-op, or external-untracked
  action. Item replacement preserves history and either rebalances atomically or
  rejects an unclassified legacy item.
- The classification RPC writes one immutable evidence row and owner update
  atomically, seeds a deferred paid order's new-order row only for a `payment`
  decision, replays an identical decision idempotently, and rejects a
  contradictory second decision, malformed or foreign payer ownership, or any
  order created at or after the persisted cutoff. A historical paid order with
  no claimed payment-received row records its decision without inventing
  retrospective notification work.
- The final contract gate aborts with any null owner, missing pre-cutoff owner
  decision, unclassified inventory-live legacy item, stale/manual allocation
  decision without its matching open review, post-cutoff decision row, or
  prematurely enabled separate internal-credit control singleton, then
  establishes no column default, `NOT NULL`, and a strict trigger rejecting
  every owner change. Its insert-surface scan rejects any unclassified active
  SQL or application order creator.
- The audit CLI reads the database cutoff, proves every pre-cutoff row has one
  decision, separately lists every active unpaid or partially paid order, and
  refuses to produce a passing gate while any row is unclassified.
- The private/public base, savings, quiz-voucher, and discount-code storefront
  RPCs all return the stored owner on insert and replay. Their old return
  signatures are dropped, their current caller grants are restored, and the
  final owner-contract replacements preserve the trailing optional
  checkout-intent argument and exact order binding.
- The private/public chat conversion stamps `creation` and allocation evidence
  atomically with its paid order; Bumpa/Jumia inserts explicitly stamp
  `not_applicable` and external-untracked allocations. Removing any explicit
  stamp makes the no-default insert-surface contract test fail.
- During the schema-first window, an old Bumpa/Jumia insert with exact external
  evidence and no owner is assigned `not_applicable` by the database trigger;
  a conflicting explicit value or any other post-cutoff null insert fails.
  Authenticated direct `NULL -> owner` updates and service classification of a
  post-cutoff row fail, while the exact pre-cutoff classifier succeeds once.
- Both expand and final-cutover storefront RPCs return `creation` for invoice,
  pay-on-delivery, and fully covered quiz-voucher inserts, return `payment` for
  every deferred gateway or internal-credit-capable insert, and return the
  already-stored owner on idempotency replay.
- A serialized quiz reserved order is stamped `creation` by
  `private.create_quiz_product_prize_award_with_inventory`; later voucher claim
  returns that owner without attempting to mutate it.
- The reconciliation CLI awaits scheduled email and push tasks before exit.
- The checked-in Supabase types expose the consent receipt/state tables,
  capability and recording RPCs, new assignment foreign keys, every changed
  storefront and internal-credit RPC, and every RPC added by the transactional
  bundle module.

### Alert outbox tests

- Before expand, the preparation worker detects that the alert contract is not
  installed, logs the bounded no-op reason, and exits successfully.
- Immediately after expand, the already-deployed worker can claim and deliver
  strict-inventory, gateway-wedge, payment-during-cancellation,
  provider-cancellation-unknown, captured-payment-after-cancellation/refund,
  and exact-fingerprint legacy-allocation alerts without an application
  redeploy.
- Review creation and alert enqueue are atomic.
- Two shipment-cancellation attempts on one order receive distinct open reviews
  by attempt token. Re-observing changed evidence updates that attempt's current
  fingerprint instead of colliding through the broad order index; a decision
  carrying the prior fingerprint is rejected.
- Duplicate Paystack webhook delivery reuses the review and alert rows.
- An unresolved historical DVA customer identity or terminal residual reuses
  one epoch/fingerprint-scoped review; closing it directly does not make the
  epoch matchable, while exact audited repair resolves only that fingerprint.
- Exactly one merchant produces merchant email and push rows.
- Multiple possible merchants produce operations-only alerts.
- Failed and stale claimed alerts are retried.
- A strict gateway inventory failure reuses one
  `serialized_inventory_confirmation_failed` review and its operations and
  known-merchant alerts; the webhook acknowledges only after they are durable.
- Before the late-payment contract bundle exists, the allocation audit can create or reuse one
  `legacy_inventory_allocation_ambiguous` review per item and exact fingerprint,
  enqueue its operations alert, and record `manual_reconciliation_open` only
  with that matching open review. A changed fingerprint does not reuse stale
  evidence. Two ambiguous items on one order create independent reviews without
  colliding with the broad order-scoped unique index.
- An internal-credit compensation conflict atomically creates or reuses one
  `internal_credit_inventory_reversal_conflict` review and operations alert and
  returns its review id without committing partial compensation.
- An internal-credit cancellation compensation conflict atomically creates or
  reuses one `internal_credit_cancellation_reversal_conflict` review and
  operations alert while leaving the order uncancelled.
- A stale checkout intent with contradictory ledger evidence creates one
  `internal_credit_checkout_intent_reconciliation_conflict` review and alert and
  keeps database readiness false.
- An ambiguous legacy allocation, terminal allocation contradiction, or
  abandoned-order unexpected error creates its dedicated durable review and
  operations alert before the caller continues or returns a counted result.
- A historical terminal-order manual disposition is accepted only after the
  exact-fingerprint `historical_cancelled_internal_credit_evidence` review and
  its deduplicated operations alert are durable.
- A retry-seed ownership conflict enqueues operations email only and deduplicates
  by the open transaction-scoped review.
- A captured payment after cancellation or refund creates/reuses its
  transaction/reference-scoped review, one operations email, and sole-merchant
  email/push when available. A second distinct capture on the same order creates
  a distinct review; alert failure keeps the gateway path retryable and no paid
  side effect runs.
- An invalid verified wallet `paid_at` or an unclassified Paystack reference
  role creates/reuses its dedicated review and alert set before the webhook can
  acknowledge or mutate financial state.
- An uncanonicalizable legacy wallet bank creates/reuses one
  `wallet_dva_bank_identity_repair_required` review and alert set. Only the
  exact same-provider-identity repair resolves it; a conflicting or incomplete
  repair attempt leaves both the quarantine and review open.
- A persistence attempt against an existing disabled wallet row creates/reuses
  one `wallet_dva_disabled_reactivation_required` review, operations alert, and
  sole-merchant email/push while leaving the row byte-for-byte disabled. Exact
  provider replay does not reactivate or return it, changed evidence receives a
  distinct fingerprinted review, and no automatic path resolves either review.
- A post-cutoff unlinked, projection-drifted, or reciprocal-metadata-mismatched
  DVA epoch creates one epoch/exact-fingerprint-scoped
  `order_payment_account_contract_unlinked` review and operations alert. Two
  epochs on one order remain distinct; enforcement stays blocked until verified
  repair resolves every current review.
- A validly proved ordinary provider initialization whose locked order/config
  changed creates one provider-reference/fingerprint-scoped
  `gateway_initialization_persistence_conflict` review and operations alert,
  inserts no transaction, and never returns the provider checkout payload.
- Contradictory BAC/provider-key settlement evidence creates one
  transaction/reference-fingerprint-scoped
  `merchant_settlement_reference_conflict` review and operations alert, does
  not credit the wallet, and does not collide with another valid capture.
- Missing `PAYMENT_RECONCILIATION_ALERT_EMAIL` fails the production
  configuration gate.
- Missing or mismatched payment-orchestration current proof secrets fail the
  contract preflight; previous-secret rotation is accepted only until its
  explicit expiry, and logs/reports never contain secret material.

### Wallet alias tests

- A clean lexical migration replay with uncanonicalizable active and disabled
  legacy wallet rows proves `20260719120014_payment_review_contract_extensions.sql`
  installs every wallet review type, stable fingerprint index, broad-order-index
  exclusion, private helper branch, and alert whitelist and is dependency-
  complete before `12015` quarantines the active row while preserving the
  disabled row and its disable reason. Applying
  `12015` without the exact `12014` catalog contract fails before touching the
  row; the normal ordered replay commits the quarantine, review, and alerts.
- The preparation application's legacy branch compares the complete immutable
  provider and owner tuple plus retained status after SQLSTATE `23505`. Exact
  replay returns the existing account only for `active`; exact `pending_review`
  and `disabled` fixtures preserve their status and return no account. A
  different bank/account, provider customer, subaccount, or provider account
  id, including a one-sided nullable id, likewise returns the fixed
  `WALLET_DVA_TEMPORARILY_UNAVAILABLE` HTTP `503` response with no account or raw
  error. `12015` advertises only `legacy_direct_v0`, resets the baseline
  service-role `ALL` grant to exact `SELECT, INSERT`, preserves authenticated
  RLS-scoped `SELECT`, and leaves every other runtime privilege absent. Catalog
  tests specifically reject service-role `UPDATE`, `DELETE`, `TRUNCATE`,
  `REFERENCES`, `TRIGGER`, or `MAINTAIN`, any authenticated mutation privilege,
  and every anon/PUBLIC privilege by asserting the exact `aclexplode` rows plus
  every effective `has_table_privilege` result.
  `12020` exposes `rpc_v1`
  only after the full RPC catalog is valid and atomically revokes that remaining
  direct insert. A request that read legacy immediately before the flip fails
  its direct write, rereads once, and retries the same provider response through
  the proof-gated RPC; an unchanged capability, second failure, second direct
  write, or post-`rpc_v1` admin-client mutation fails the test.
- Capability-probe tests permit the legacy branch only for exact `42883` or
  `PGRST202` errors naming the expected no-argument version RPC, or a parsed
  `legacy_direct_v0` result. Timeout, permission, generic schema-cache,
  malformed/empty, unknown-version, and unrelated missing-function results map
  directly to the fixed temporary-unavailable response and perform no table or
  persistence-RPC mutation. An already-active account is read and returned
  through the authenticated client without probing capability. Otherwise the
  probe runs before any Paystack customer/DVA call; every rejected probe proves
  the provider mocks and lazy admin factory were untouched. Exact legacy mode
  invokes that factory only at direct persistence, while `rpc_v1` never invokes
  it and performs every read/persistence operation through the request client.
- Migration-source and integration tests require both capability-changing
  migrations to commit `NOTIFY pgrst, 'reload schema'`. A clean authenticated
  test replay polls the Data API at the `12015` stop for exactly
  `legacy_direct_v0` and after `12020` for exactly `rpc_v1`; the production
  bundle runs the checked authenticated verifier and accepts only its final
  `rpc_v1` result before wallet smoke verification. Script tests require the
  three dedicated verifier environment variables, reject fallback to
  `SUPABASE_SERVICE_ROLE_KEY` or another application credential, and require the
  low-privilege project key only in `apikey` and the short-lived user JWT only in
  `Authorization: Bearer`; they prove the JWT role reaching PostgREST is exactly
  `authenticated`. They reject a missing project key, a publishable/legacy-anon
  key used as the bearer token, any secret/service-role key, a non-authenticated
  user JWT, redirects/non-canonical origins, malformed/unknown responses,
  credential logging, provider calls, and every mutation. Timeout retains fixed
  safe application behavior and is never fallback authorization.
- Migration tests replace both baseline wallet owner cascades with exact,
  validated, non-deferrable `ON DELETE RESTRICT` constraints. Direct customer,
  merchant, and parent-auth deletion fixtures preserve the wallet row and fail
  with `23503`; no trigger or cascading path can erase it. Route tests map only
  either named wallet constraint to the fixed
  `CUSTOMER_PAYMENT_IDENTITY_RETENTION_REQUIRED` 409 response and keep unrelated
  `23503` or database errors generic without leaking constraint or payment data.
- Static and behavioral tests remove `ensureWalletPaymentAccount` from
  `OrderWalletFundingIntentRepository`, remove the dormant consent argument and
  creation branch, and prove the order-funding-intent route never calls Paystack,
  the capability RPC, the wallet persistence RPC, or a lazy admin factory. With
  no existing account it still returns `WALLET_DVA_CONSENT_REQUIRED`; with an
  RLS-visible account it creates only the funding-intent row.
- The shared order-alias module is a pure payable/terminal/cancelled classifier;
  it has no Supabase query and accepts neither provider-assignment nor verified-
  transfer fields. Static contract tests reject reintroducing one
  `hasActivePaystackOrderDvaAlias` database helper into both callers.
- The assignment-time collision guard receives provider-returned account, bank,
  customer code, subaccount, provider-account, and owner identity but no amount,
  currency, `paid_at`, or provider transaction reference. Provider/bank/account
  are the only receiver-key predicates; provider customer code classifies an
  exact alias versus unresolved or contradictory ownership. Merchant mismatch
  remains diagnostic and cannot clear the same receiver key. Subaccount is
  proved against merchant configuration, and provider account id is wallet-side
  replay evidence rather than an order-epoch field. Tests cover exact code,
  missing legacy code, different code, cross-merchant reuse, a same number at a
  different bank, and a cancelled/terminal order that never blocks assignment.
- Missing and contradictory same-receiver provider identity create/reuse their
  exact `wallet_dva_assignment_identity_unresolved` or
  `wallet_dva_assignment_identity_conflict` review, return its review id, and
  create no active wallet row. Same-merchant evidence enqueues operations plus
  that sole merchant's email/push. Cross-merchant reuse sets the review merchant
  to null and enqueues operations only; tests prove no merchant email or push is
  created for either the unresolved or contradictory cross-merchant case. An
  exact replay reuses the null-merchant review through its non-null requesting-
  merchant metadata key; tests reject an index that relies on nullable review
  `merchant_id`. The broad open-order index excludes all four wallet-assignment
  issue types. Exact fingerprint replay reuses the specialized row, while
  changed evidence for the same sole conflicting order creates a distinct open
  review without a broad-index violation. The RPC derives the type; direct
  caller selection or an attempted customer confirmation notification is
  rejected.
  The route returns only `WALLET_DVA_PENDING_REVIEW` with HTTP 409 and leaks none
  of the conflicting order, merchant, customer-code, receiver, or review
  evidence.
- A wallet row owned by a different customer on the same
  provider/canonical-bank/account key returns `receiver_owner_conflict` with a
  null account and its durable `wallet_dva_receiver_owner_conflict` review id;
  it performs no insert or reactivation. Tests cover same-merchant/different-
  customer and cross-merchant ownership, prove the latter is operations-only,
  and prove a concurrent pair serializes on the account advisory so neither
  path falls through to a caller-handled SQLSTATE `23505`. The same account
  number at a different canonical bank remains valid.
- A pre-existing disabled row for the requesting merchant/customer/provider
  takes precedence over exact replay, reactivation, and identity-conflict
  branches. Exact and contradictory provider fixtures both return
  `pending_review` with a null account and the exact durable
  `wallet_dva_disabled_reactivation_required` review id, preserve every row
  field and prior disable-reason code, and map to the fixed 409 response. No
  retry, funding-account request, or provider replay can reactivate it; changed
  evidence produces a new fingerprint without broad-index collision.
- Two concurrent first-creation requests for one merchant/customer/provider that
  receive different Paystack account numbers serialize on the owner advisory
  even though their account advisories differ and no customer/provider row
  existed initially. The owner-lock winner inserts; the other call returns
  `existing_identity_conflict` with a null account and the exact durable
  `wallet_dva_existing_identity_conflict` review id. It performs no insert,
  replacement, reactivation, or active-row mutation, never exposes SQLSTATE
  `23505`, and maps to the fixed `WALLET_DVA_PENDING_REVIEW` response. Replaying
  the same contradictory response reuses the review and operations/sole-merchant
  alerts; changed evidence receives a new database-derived fingerprint. A
  pre-existing active non-exact row exercises the same outcome without requiring
  a race. Combined fixtures prove a non-clear order alias takes precedence over
  receiver-owner and existing-identity classification, receiver-owner takes
  precedence when the order classifier is clear, and exactly one public outcome,
  review branch, and alert set commits for one provider observation.
- Assignment collision classification and wallet insert/reactivation occur in
  one `persist_customer_wallet_payment_account` RPC transaction under the owner-
  then-provider/account advisory order. A concurrent payable-order DVA assignment
  or cancellation cannot enter between check and write. The reciprocal order-
  assignment RPC uses the same provider/account advisory before its order and
  wallet-row locks; a concurrent first order/wallet assignment yields one winner
  and one durable purpose-conflict outcome, never two committed exposures.
  Contract tests reject
  a Supabase select followed by a separate wallet-table insert/upsert, a missing
  owner advisory, reversed owner/account acquisition, or reliance on locking a
  nonexistent customer/provider row. The bounded direct-insert compatibility
  trigger nonblockingly tries the same owner-before-account pair and raises
  SQLSTATE `40001` if either is busy before uniqueness waiting. Direct service-
  role update/delete/truncate/reference/trigger/maintain operations already fail
  after `12015`; an authorized RPC update that
  changes a key proves sorted old/new owner keys precede sorted old/new account
  keys and every trigger check is reentrant. The
  private classifier returns only its four states; public result tests require
  `inserted`, `exact_replay`, and `reactivated` to return the canonical account
  row and every conflict/pending-review outcome to return a null account plus
  the specified nullable review id.
- In the contract application, the funding-account route uses its request-
  scoped authenticated client for the RPC and contains no `createAdminClient`
  or service-client import/call. The preparation revision's bounded admin-backed
  branch is permitted only for the exact expected-function undefined result or
  parsed `legacy_direct_v0` capability and is covered by the crossing tests
  above. Direct
  authenticated RPC calls without a fresh `wallet_dva_account_persist` proof,
  and proofs with the wrong action, user, merchant, customer, consent time,
  provider identity, response fingerprint, generation, or age, fail before
  lookup or mutation. A proof replay with an unchanged provider response returns
  `exact_replay`; changed proof payload is rejected. `anon` remains denied.
- The webhook-time transfer classifier rejects missing amount, currency,
  reference, verified `paid_at`, assigned email, provider customer code,
  receiver account, or receiver bank. It blocks wallet allocation only when the
  complete verified transfer plausibly pays a payable order; assignment-time
  collision output alone is never payment-routing authority.
- Fresh wallet matching calls only `reserve_paystack_wallet_dva_top_up`; static
  tests reject the former application-level wallet lookup, order-alias query,
  review insert, and transaction insert. RPC fixtures cover all five typed
  outcomes, exact replay, multiple/contradictory wallet owners, unique
  `pending_review` and `disabled` receiver rows that return
  `wallet_identity_unresolved`, and a cancelled-only order alias. Concurrent order and wallet reservations for the
  same receiver acquire external-reference then account/order/wallet locks in
  the same order: at most one purpose reserves a transaction and the other
  commits one idempotent review, with no deadlock or duplicate reference.
- A late payment that still plausibly matches a payable order blocks wallet
  allocation and creates a conflict review.
- An invoice and wallet DVA with the same account number at different receiving
  banks do not alias; bank identity is required before either path can block or
  claim the transfer.
- The wallet migration backfills canonical bank identity, moves an invalid
  active legacy bank row to `pending_review`, preserves an invalid disabled row
  as disabled with null identity and durable repair review, and replaces the global account-number
  uniqueness rule with the non-null
  `(provider, bank_identity, account_number)` key under the exact stable index
  name while preserving and catalog-verifying the existing
  `(merchant_id, customer_id, provider)` unique index. Active rows cannot have
  null identity. Two banks may therefore hold the same number, but a duplicate
  within one canonical bank fails.
- Quarantining an invalid row creates its exact durable repair review and does
  not attempt a second customer/provider insert. Fresh Paystack evidence for
  the same customer code, subaccount, account number, and existing provider
  account id repairs that row in place, recomputes bank identity, reactivates
  it, and resolves the review atomically.
- Missing proof or a changed account, customer, merchant, subaccount, provider
  customer, or existing provider account id leaves the row `pending_review`,
  returns `WALLET_DVA_PENDING_REVIEW`, creates no replacement row, and never
  makes the quarantined account matchable.
- Wallet lookup accepts the verified bank only when exactly one stored
  `bank_name` or `bank_slug` alias normalizes to it; missing, contradictory, or
  multiply matching evidence mutates nothing and files the final review. The
  lookup includes every retained status so a disabled receiver cannot disappear
  into order matching or zero-candidate handling; only an active exact row may
  reserve a wallet credit.
- Missing or invalid verified `paid_at` never falls back to webhook receipt
  time and never creates or claims a wallet top-up transaction.
- A fresh wallet-DVA top-up transaction stores its provider reference with role
  `external_provider` and passes through the common reference claim before
  credit.
- A different amount or immutable provider-customer identity does not let an unrelated order alias
  block a legitimate wallet top-up.
- Cancelled aliases never block wallet allocation.
- A cancelled-only alias followed by a valid wallet match credits the wallet
  and does not create an order zero-candidate review.
- `wallet-funding-copy.ts` and `WalletFundingPanel` map
  `WALLET_DVA_ORDER_ALIAS_CONFLICT` to payable-lifecycle guidance that tells the
  customer to complete the order or ask the merchant to cancel it. Regression
  assertions reject `90 minutes`, `90 min`, `reservation window`, or any other
  fixed clearing-time promise in the mapped copy and component comment.
  `WALLET_DVA_PENDING_REVIEW` and the legacy compatibility-only
  `WALLET_DVA_RECEIVER_CONFLICT` both render the fixed safe pending-review copy;
  `WALLET_DVA_TEMPORARILY_UNAVAILABLE` renders only its fixed retry text. A
  fixture containing sensitive server `error` text proves the panel never
  renders it. Both new codes are present in
  `CustomerWalletPaymentAccountErrorCode`, the telemetry reason vocabulary, and
  failure-reason passthrough tests, so the type-level exhaustiveness guard and
  exact PostHog reasons remain green. The copy constant and database wrapper each
  have their required exact colocated test in addition to the creation,
  concurrency, proof, panel, and telemetry suites.

### Current incident recovery tests

- Evidence-only mode performs no database write and, only after an authenticated
  HTTP `200` bounded Paystack Verify response, atomically emits a
  deterministic canonical report for the exact production project, order, and
  reference. Its checked provider-observation object proves HTTP `200` and
  successful schema validation.
- DNS/TLS/connect/read timeout, 401/403, 429, 5xx, unexpected status, malformed
  JSON, oversized/schema-invalid response, and wrong production target each
  exit non-zero with only the appropriate sanitized probe code and leave no
  canonical report or report hash. `--record-evidence-outcome` rejects a
  hand-crafted report that encodes any such failure as unavailable or conflict.
- A fresh authenticated Paystack response becomes `recoverable` only when it
  directly binds that reference to successful status and the complete amount,
  currency, `paid_at`, provider-customer, receiver-account, and receiver-bank
  tuple and every field agrees with the immutable assignment evidence.
- A fresh Verify response that omits receiver bank remains
  `historical_provider_evidence_unavailable` even when the assignment row stores
  the expected bank. The assignment, current order email, a DVA fetch, local
  logs, screenshots, and current reconciliation metadata can corroborate but
  cannot fill a missing transfer-side field.
- A retained `charge.success` payload is accepted only when its HMAC verifies
  with an approved retained secret, its complete receiver/customer identity is
  internally consistent, and fresh Paystack verification agrees on reference,
  status, amount, currency, and `paid_at`. Contradiction produces
  `historical_provider_evidence_conflict`, not a recoverable report.
- Evidence-only unavailable or conflicting runs write no review. Passing their
  exact canonical report to `--record-evidence-outcome` invokes only
  `record_paystack_historical_evidence_outcome`, which creates/reuses only its
  exact-fingerprint review and operations alert and leaves order, transaction,
  inventory, settlement, email, and push state unchanged. Repeated record runs
  return `exact_replay`; recoverable, stale, oversized, wrong-schema, wrong-
  project, wrong-order/reference/hash/fingerprint, raw-payload, and caller-
  selected-issue reports are rejected before mutation.
- The generic `file_payment_match_review` wrapper rejects both historical-
  provider-evidence issue types. Catalog and dependency-closure tests prove only
  the dedicated service-role RPC can derive and file them and that its function
  body cannot reach any financial, assignment-repair, notification-completion,
  or inventory mutation primitive.
- Execution rejects a missing, stale, differently fingerprinted, wrong-project,
  wrong-order, or wrong-reference report and exposes no force/skip switch. Only
  an exact current `recoverable` report reaches reservation and claim.

## Rollout and Verification

Before step 1, first rebase the implementation worktree onto current
`origin/main`, refresh the live ledger/P0 evidence, and prove the complete
`20260719115600..20260719120220` lane remains strictly after both repository and
production tails. If it does not, atomically reallocate all 74 files and
regenerate every dependent expected byte before review. Only then complete and
freeze the separate release-guardian source/receipt bootstrap, distinct-App
required check, independent guardian-control review rule, durable redelivery
proof, probe/spoof evidence, signed receipt, and live protection snapshot described
above. No payment release PR may rely only on a check emitted from its
candidate-controlled workflow tree. Re-read `origin/main` and the production
tail immediately after arming; any lane or protected-byte drift requires a new
bootstrap policy/receipt ceremony before the no-migration replay-scope PR may
open. The root PR's new baseline-aware scope,
null materialization marker, refreshed read-only fixture, and exact current P0
receipt/provenance bindings must converge in both enforce modes and deploy
healthy before any feature migration PR is opened. Its successful guardian main
check activates the global top-level-migration freeze through the final receipt.
After that check, an unprotected application-only merge may require regeneration
of the next phase candidate, but never a second root receipt. Any top-level
migration or protected replay/deploy/guardian change stops the rollout for the
explicit recovery design even while `materializedThrough = null`; after
preparation materializes, that design must additionally bind the already applied
prefix. Neither case may regenerate `replay-scope.json`.

For every migration candidate deployment below, the merge-triggered
`deploy.yml` push run is the canonical run. A retry uses **Re-run all jobs** on
that same run through the checked rerun command so every attempt has a complete
migration-job record; do not use the Actions UI, direct `gh run rerun`,
failed-job/job-only reruns, or `workflow_dispatch` during the candidate-to-
receipt window. Before merge, require the candidate's GitHub-server-timestamped
retention snapshot to be at least 32 days and fresh enough that the canonical
run starts within 24 hours. The standalone boundary guard and preparation shape
test must both prove the exact assertion/apply YAML mappings, built-in shells,
runner, absent defaults, and environment allowlists against the candidate tree;
the external guardian must independently approve the exact PR head from its
pinned policy and distinct App identity. Any active merge-queue rule or
controlled `merge_group` evaluation blocks the rollout.
Any control-byte, live-protection, review, App-binding, or alternate YAML drift
invalidates the candidate before merge. Freeze those policies and require the
guardian's successful post-merge check on the exact main SHA plus the first
executable `db-migrations` script on every side-effecting attempt to emit the
exact successful retention-preflight semantic line before migration
application. Any failed assertion must leave both the Management API migration
step and Vercel deployment skipped. A terminal/unmarked failure ends the
canonical run under this plan. An attempt marked exactly
`GUARDIAN_PENDING` or `GITHUB_API_TEMPORARILY_UNAVAILABLE` with zero side-effect
lines may use the checked full-rerun command on that same run only after the
guardian succeeds and all live trust checks pass; retain the failed attempt in
the receipt ledger. Begin no otherwise-eligible rerun at or after the 30-day
boundary,
and finish receipt capture by the 31-day boundary. Receipt
capture must re-query the policy and bind the candidate/final observations,
deadlines, and complete gap-free attempt ledger described above. If retention
drifts, a deadline is missed, or the canonical run reaches attempt 51 without
success, stop the rollout under the existing merge freeze and safety mode and
commission a new reviewed recovery design. The deliberate `workflow_dispatch`
in step 20 is
outside every migration candidate-to-receipt window and is the separately
authorized armed-application deployment, not a replacement candidate attempt.

1. Capture the current open Paystack reconciliation-review count.
2. Capture pending/failed paid-order side-effect counts, verify the operations
   alert recipient is configured, and record the current direct merchant-push
   and paid-email behavior for invoice, redirected Paystack/Korapay, quiz,
   wallet, savings, and store-credit checkout fixtures. Split Juicyway's live
   baseline by caller: record its primary direct-success webhook as out of
   scope, but inventory the current `ac2564f` tree's wedge reconciler and
   failed-side-effect drain, whose payment behavior was introduced by
   `a332a978`, as existing shared-finalizer callers. Record the reconciler as the
   fresh-completion caller and the drain as already-paid retry only. Record
   Klump, Credit Direct, and manual paid paths as out-of-scope baselines. The
   `CHAT-` conversion is also an out-of-scope direct-notification baseline even
   when its provider is Paystack or Korapay. Inventory agentic Paystack DVA
   sessions by the exact `claiming_payment`, `payment_account_ready`,
   `order_finalizing`, and `payment_pending` states without printing account
   numbers; record the finite already-exposed `payment_pending` cohort by opaque
   session/order ids and immutable evidence digest.
3. Set production `INTERNAL_CREDIT_CHECKOUT_MODE=paused` and
   `AGENTIC_PAYSTACK_DVA_MODE=paused`, then merge the
   route-quiesce preparation release containing only the manifest-listed preparation
   bundle ending in `20260719115690_preparation_contract_gate.sql` plus its dual-schema
   application, complete catalog, `preparation` phase marker and exact hashes,
   global post-base replay extension,
   `preparation-candidate.json`, and tests. Run both replay modes in `classify`
   and require identical local effect hashes before merge. Confirm the migration
   creates the paused singleton, initial
   event, checkout-intent table, readiness/begin/status/pause/drain/reconcile
   signatures, the no-data terminalization version at `legacy_direct_v0`,
   fail-closed pre-contract completion/abort/reconciliation
   behavior, and no changed financial function definition or grant. Verify the new
   route returns `503` before idempotency or order mutation while ordinary card,
   invoice, pay-on-delivery, and quiz checkout still work. Confirm the alert
   worker logs its bounded contract-not-installed no-op and production
   configuration rejects a missing `PAYMENT_RECONCILIATION_ALERT_EMAIL`.
   Force each legacy DVA persistence call to fail and prove explicit routes
   return retryable failure without bank details while optional invoice/credit
   paths omit the account; the initialize route must no longer log-and-expose.
   Prove all four cached Agent Commerce discovery surfaces plus OpenAPI stop
   advertising Paystack bank transfer after the five-minute cache window while
   preserving eligible pay on delivery/Google Pay. A new normalized agentic
   Paystack completion must return `409 AGENTIC_PAYSTACK_DVA_PAUSED` before
   claim/provider/order work. Drain every pre-pause transitional agentic row to
   either exact grandfathered `payment_pending` or a released no-account state,
   using the one-row dry-run-first state/fingerprint contract and no new
   provider call. Any indeterminate row emits the existing operations alert and
   blocks rollout for manual resolution. Require zero
   `claiming_payment`, `payment_account_ready`, and `order_finalizing` rows before
   owner-expand. Existing exact `payment_pending` reads/webhook matching remain
   available and immutable. Archive only opaque ids, counts, and digests.
   Configure and validate
   `ORDER_DVA_CONSENT_LINK_SECRET_CURRENT` before this application deploy; a
   configured previous secret also requires
   `ORDER_DVA_CONSENT_LINK_SECRET_PREVIOUS_EXPIRES_AT` with the required
   seven-day-plus-ten-minute rotation overlap. Provision
   `ZEPTOMAIL_CONSENT_TOKEN` from a dedicated platform-domain Agent with click
   tracking, open tracking, and saved-email-content retention disabled. Send a non-production capability fixture to a
   controlled inbox and inspect its source to prove the exact fragment href is
   preserved with no tracking redirect or pixel; archive no token or live
   capability. Prove every order-DVA
   entrypoint probes `get_order_dva_customer_consent_contract_version` before
   Paystack and, while that exact RPC is absent, makes no provider call: direct
   checkout receives the fixed temporary
   unavailable response, merchant invoice/ship-on-credit still completes
   without an account or signed capability, a synthetic consent-link `GET` is
   disclosure-only, and a synthetic consent-link `POST` fails safely. Drain the pre-preparation route generation before
   owner-expand so only a bounded already-in-flight provider call can cross the
   database cutoff and be rejected by its persistence backstop.
   For wallet persistence specifically, prove a legacy `23505` returns an
   account only for an `active` row with the exact immutable
   owner/provider/receiver tuple; exact `pending_review`/`disabled` rows and a
   non-exact tuple return only fixed `WALLET_DVA_TEMPORARILY_UNAVAILABLE` copy
   without status mutation. The
   dual-schema adapter treats only the exact expected-function `42883`/`PGRST202`
   absence or parsed `legacy_direct_v0` capability as legacy without attempting
   the unavailable persistence RPC; every other capability-probe failure returns
   the fixed safe response without a Paystack call, admin-client construction, or
   direct DML. Prove the initial existing-account read is request-scoped, the
   exact legacy branch invokes its lazy admin factory only when persistence is
   needed, and `rpc_v1` leaves that factory untouched. Prove the order-wallet-
   funding repository no longer exposes the dormant ensure method, its route is
   resolve-only, and the missing-account result still directs consent through
   the dedicated funding-account endpoint without any provider or persistence
   call.
   Exercise the prepared application's terminal compatibility parser against
   legacy and structured fixtures and prove a stable gate error causes exactly
   one capability reread/RPC retry, never a second direct write. Verify the
   provider-cancellation route returns
   `PROVIDER_CANCELLATION_MAINTENANCE` before a provider, prepare RPC, or local
   mutation call while the terminalization version is `legacy_direct_v0`; its
   prepared recovery pass must log a bounded capability no-op.
   Before step 4, merge the separate zero-migration preparation receipt PR:
   capture the exact ordered migration-job attempts, linked ledger, and live effects; require
   them to equal the candidate; update all current P0 post-deploy bindings;
   write `preparation-deployment.json`; and pass both replay modes in `enforce`.
4. Verify the route-quiesce application's dual-schema completion tests: the old
   result uses direct delivery only for a fresh order flip,
   `completed_replay` sends no direct push, and a synthetic `claimed_v1` result
   runs only claim-gated executors when its payer result also carries
   `inventory_contract = atomic_confirmed_v1`. A missing or malformed inventory
   contract fails closed without invoking legacy compensation. Verify the
   dual-schema claim parser, transaction-filtered completion/failure updates,
   locked `payer_transaction_id`, and no legacy outbox-state inference. Verify
   all four old storefront result fixtures preserve current direct behavior,
   while new `creation`, `payment`, and `not_applicable` rows respectively
   direct, defer, or suppress the new-order attempt and malformed owner values
   fail closed. Verify the captured-terminal-payment helper uses the bounded
   direct-review branch before the outbox schema exists, switches to the atomic
   review-and-alert RPC immediately after expand capability appears, and never
   falls back after an RPC error. After
   the application is live, wait the fixed 15-minute route-quiescence interval
   and prove from logs and recent order/redemption rows that no
   internal-credit checkout remains in flight through the route. The same
   evidence must prove no provider-cancellation request from the prior revision
   is still between provider call and local finalization.
5. Merge the separate fence-only PR containing only
   the manifest-listed fence bundle ending in
   `20260719115740_internal_credit_fence_contract_gate.sql`, generated types,
   the phase marker advanced to `fence`, exact extension hashes,
   `fence-candidate.json`, and migration tests. Confirm the prepared application was already live before
   the workflow began. Verify all exact legacy mutation signatures are present
   in the function-contract registry with matching canonical definition
   digests and grants, and registry state is exactly `fence_v1`. Direct
   authenticated calls to wallet redemption, savings
   redemption, storefront-savings creation, and both legacy finalizers must now
   return `INTERNAL_CREDIT_CHECKOUT_PAUSED` without mutation. Wait the fixed
   15-minute direct-RPC quiescence interval and prove from locks, request logs,
   and recent evidence that no pre-fence direct call remains in flight. Then
   merge the separate zero-migration fence receipt PR with exact deployment
   evidence, refreshed P0 bindings, `fence-deployment.json`, and enforce
   convergence. Only then
   merge the index-only PR containing
   `20260719115750_order_abandonment_candidate_index.sql`, the phase marker
   advanced to `abandonment_index`, exact hashes,
   `abandonment-index-candidate.json`, and its tests. Verify
   its exact concurrent index definition and recorded migration version before
   merging its separate zero-migration receipt PR with
   `abandonment-index-deployment.json`, refreshed P0 bindings, and enforce
   convergence. Retry a simulated post-index history-registration failure
   safely; expand cannot begin before the receipt PR is healthy.
6. Merge the separate expand PR containing only
   the manifest-listed owner-expand bundle ending in
   `20260719115890_owner_expand_contract_gate.sql`, its
   expand-compatible application, audit CLI, tests, and expand-generated
   Supabase types, with the phase marker advanced to `owner_expand`, exact
   hashes, and `owner-expand-candidate.json`. Confirm every
   later contract, paystack-reference-index, and
   enforcement filename is
   absent from `main` before the deploy starts and the prerequisite cleanup
   index migration is recorded with its exact catalog definition. Confirm
   `20260719115885_payment_orchestration_proof_config.sql` precedes the ordered
   `20260719115886_order_dva_customer_consent_schema.sql`,
   `20260719115887_order_dva_customer_consent_challenge_rpc.sql`,
   `20260719115888_order_dva_customer_consent_recording_rpc.sql`, and
   `20260719115889_order_dva_customer_consent_backstop.sql` modules, which all
   precede the owner-expand gate. Verify exact `consent_v1`, the committed
   schema-reload notification, immutable database cutoff, append-only receipt,
   exact proof action/grants, and post-cutoff account trigger are catalog-bound;
   a stale no-receipt write crossing the migration fails without exposing bank
   details, while a wallet-purpose collision skips the row, commits one exact
   review/alert, and is omitted by the preparation app. A pre-cutoff account remains immutable legacy matching
   evidence. Until the proof secret is configured in step 8, the already-live
   preparation app must continue to make no order-DVA provider call.
   Verify every new base,
   quiz-voucher, discount-code, and reserved quiz order receives an explicit
   owner and exact immutable inventory allocation while legacy owners and
   allocations remain classifiable. Verify both order-item replacement RPCs
   preserve or atomically rebalance allocation evidence through the
   already-installed unwind helper/event table, both allocation foreign keys
   are `DEFERRABLE INITIALLY DEFERRED`, and terminal import patches either use
   the provisional safe branch or reject uncompensated credit before mutation.
   Verify the terminalization state is exactly `allocation_safe_v1`, the
   one-shot private authorization is required for every terminal transition,
   the trigger takes no financial/inventory locks, and all prepared chat,
   agentic, merchant, customer, shipping, import, payment-failure, and cleanup
   callers now use provisional structured terminalizers. A synthetic legacy
   request crossing the migration must fail then succeed through one RPC retry
   without leaving active allocation evidence on a terminal order. Verify the
   already-prepared provider-cancellation saga keeps the same attempt token and
   public result contract while its local finalizer is replaced by the
   allocation-safe body; no owner-expand bundle module may recreate or reset an attempt.
   Exercise prepare/provider/result/local-finalize, concurrent duplicate
   requests, a known rejection, and an ambiguous timeout. Crash once after the
   provider response; route/worker recovery must reuse the persisted attempt,
   query provider state when needed, and finish only local finalization without
   issuing a second cancellation. Race a gateway completion and a DVA
   reservation against an active attempt in both lock orders: payment-first
   makes prepare reject, while attempt-first holds payment with one durable
   review until provider rejection or terminal cancellation. Verify registry
   state is exactly `owner_expand_v1`. Verify the preparation revision
   that was live during the migration window consumed `claimed_v1`, no
   post-migration Paystack/Korapay completion or shared-finalizer Juicyway payer through
   `complete_order_gateway_payment` called the direct helper, invoice payments
   seeded paid email, ad tracking, settlement, and payment received but no new
   order, and payment-owned Paystack/Korapay or reconciler-completed Juicyway
   orders seeded that fixed set plus both push rows. Verify a primary Juicyway
   direct-success fixture remains on its current best-effort branch, while an
   already-paid pre-outbox Juicyway replay returns no payer-owned step. Verify
   the RPC returns one locked payer,
   `inventory_contract = atomic_confirmed_v1`, and committed inventory counts;
   rejects mixed owners; and classifies an additional capture as settlement-only
   without installing order-scoped executors. Exercise a synthetic failed-row
   takeover to prove only the stored transaction can win; a different
   transaction must leave the row unchanged, file the durable wedge review, and
   return `500`. Exercise one `serialized_strict` shortage and prove the order
   flip, entire seed set, and inventory mutations all roll back before the drain
   can observe them. Verify its review and alert are durable through the
   expand-phase RPC and are drained by the already-live worker.
   Before running either legacy audit, merge the separate zero-migration
   owner-expand receipt PR with exact deployment evidence, refreshed P0
   bindings, `owner-expand-deployment.json`, and enforce convergence.
7. Exercise the replacement inventory-confirmation helper with the cross-item
   regression:
   item A reclaims units and item B has a strict shortage. Verify item B raises
   SQLSTATE `55000` with its own detailed counts. Exercise all-`off`,
   `serialized_then_unlimited`, and mixed orders to prove unlimited inventory
   never blocks payment. Verify allocation rows record zero mutation for
   unlimited items and the exact serialized/fallback split. Internal-credit
   requests must still return the paused response throughout this phase. Also
   prove unit/event stamping before allocation-parent insertion commits only
   when the deferred parent is inserted before transaction end.
8. Run both legacy audit CLIs using their database-persisted expand cutoffs.
   Configure the payment-orchestration current proof secret out of band through the
   checked-in service-role script, with the matching
   `PAYMENT_ORCHESTRATION_RPC_SECRET_CURRENT` already present in the prepared
   application. Run the script's sign-and-validate probe without printing either
   secret; stop on a mismatch. Exercise the now-installed customer-consent
   capability before any legacy audit: an explicit checkout action and an
   authenticated matching-customer consent `POST` each create one immutable
   receipt before the provider call. For a guest link, prove the first explicit
   `POST` only issues/emails a bounded challenge and the second consumes the
   fresh mailbox code through the sealed path-scoped challenge cookie before
   receipt creation. A merchant/staff actor,
   implicit/default selection, scanner `GET`, expired/cross-order link,
   forwarded link without recipient-mailbox access, mismatched disclosure,
   amount/terms drift, wrong/exhausted code, or reused consumed
   challenge creates neither a receipt nor provider call. Prove the merchant routes reuse an exact
   receipt but cannot mint one, the automatic invoice sends only its ordinary
   payment link plus consent CTA when absent, and the cutoff trigger rejects a
   stale no-receipt projection insert without exposing bank details. Then
   classify every pre-cutover order through
   `classify_legacy_order_notification_owner`, store one evidence record per
   order, and explicitly review every active unpaid or partially paid order.
   Record Tony's invoice as `creation`. Classify every inventory-live
   pre-cutover order item through
   `classify-legacy-order-inventory-allocations.ts`, append its
   proven allocation or create the exact-fingerprint open manual review and
   operations alert through the expand-phase contract. A
   serialized classification must stamp the same allocation id onto every
   currently linked unit and its classification event. Sign both
   machine-readable reports, then run `verify-payment-audit-report.ts` against
   the exact environment, project-ref hash, release phase, producing release SHA,
   evidence digest, and current extension-manifest digest. Archive the
   verified mode-`0600` reports before continuing; do not upload either report
   or its HMAC secret to the deploy workflow.
9. Stop the rollout unless all notification-owner and inventory-allocation
   blocking gates pass:
   - orders with a null owner;
   - pre-cutover orders without a backfill-decision row; and
   - active unpaid or partially paid orders absent from the signed audit
     output;
   - inventory-live pre-cutover items without a proven allocation or exact
     current manual-review decision; and
   - stale, closed, or mismatched allocation reviews.
   - missing, expired, or mismatched payment-orchestration route-proof
     configuration.
   A non-zero result leaves the expand release and internal-credit pause in
   place; it must never be bypassed with a blanket owner or inventory update.
10. Prepare a contract PR that adds only the manifest-listed late-payment
   contract bundle ending in `20260719120190_late_payment_contract_gate.sql`
   plus the contract application, phase marker advanced to `contract`, exact
   extension hashes, `contract-candidate.json` classify
   receipt, and regenerated
   final types. Confirm
   `20260719120200_paystack_external_reference_unique_index.sql` and both
   enforcement migrations are absent from the PR. Run the transactionally
   locked, role-aware canonical-reference duplicate preflight and prove an
   internal-BAC DVA row contributes no external reference before provider
   binding. Do not create the concurrent Paystack reference index in this
   release: the contract application must first write immutable reference roles,
   then the legacy-writer drain and role audit must complete. Run the assignment-epoch and
   wallet-bank preflights, including safe wallet `bank_identity` backfill,
   durable invalid-row quarantine, catalog preservation of the customer/provider
   unique key, same-provider-identity in-place repair, old global-index
   replacement, receiver-owner collision review, owner-before-account advisory
   contract, nonblocking compatibility trigger, exact wallet-owner cascade-to-
   restrict replacement, exact legacy runtime-grant narrowing, active
   existing-identity conflict review,
   `legacy_direct_v0 -> rpc_v1` capability transition, and atomic remaining-
   insert revocation. Prove both capability migrations emit the exact committed
   PostgREST schema-reload notification; in the clean test replay, stop after
   each migration to prove the Data API converges to its expected literal without
   treating timeout as legacy. The production bundle requires the final
   `rpc_v1` observation only. Prove the exact `12014` review
   extension, all wallet-type exclusions from the broad order index, and its
   dependency closure are installed before `12015` runs, including a clean
   replay seeded with an invalid legacy wallet row.
   Also prove exactly one display-current epoch per order/provider and
   append-only capture-link reciprocity, immutable provider-customer identity,
   customer-consent linkage for every post-cutoff epoch, and first-terminal DVA
   residual snapshots. A post-cutoff projection without exactly one matching
   receipt must block the contract bundle; pre-cutoff legacy evidence remains
   matchable with a null receipt. Prove the baseline
   `unique_order_account` constraint is unchanged and an old-application
   `onConflict: 'order_id,provider'` insert/update crossing the migration still
   succeeds while preserving both epoch snapshots. Also prove an authenticated
   legacy insert invokes the PostgreSQL-owned trigger topology without
   receiving direct epoch, capture-link, terminal-snapshot, or trigger-function
   access. Explicitly test that `BEFORE INSERT` and `BEFORE UPDATE` both fire on
   the conflict-update path without an orphan or double epoch. The deploy
   workflow applies the already-recorded abandonment-candidate concurrent index,
   then every contract-bundle module in manifest order; it must prove the
   post-contract Paystack-reference index is still absent. The final contract gate
   independently repeats the zero-owner, missing-owner-decision, and
   inventory-allocation preflights and requires a configured, unexpired
   database proof-secret generation. The deployment gate, not migration SQL,
   verifies the matching application proof secret through the checked-in
   no-data challenge; that route-proof secret is separate from the audit-report
   HMAC secret and no migration can inspect either application environment.
   The operator-verified reports from step 8 remain evidence rather than deploy
   authorization. Any missing or drifted half aborts the release.
   Migration tests must prove every catalog file through `contract` is present,
   every later catalog file is absent, and every present file is ordered, one
   concern, hash-bound in the global replay extension, and no more than 300
   physical lines; each renamed-inner adapter is
   private, proof-gated, and transactionally captures or unwinds its exact
   allocation evidence; terminalization state
   `compensation_v1`; the
   final exact registry version `late_payment_v1`, the old
   `claim_paystack_paid_atomic` and every tokenless redemption/finalizer
   signature are absent, no terminal application writer remains direct, and
   `/api/payments/initialize` has no privileged client/direct table path. Its
   ordinary, DVA, and internal-credit fixtures must each persist through exactly
   one proof-gated contract.
11. Before merging that PR, run the route integration test with mocked
   Paystack verification returning a successful `test-bank`-shaped payload
   whose `paid_at` is more than 90 minutes after assignment and whose
   authorization carries the matching receiver account, bank, assigned email,
   and provider customer code. Repeat with a mismatched/missing bank, assigned
   email, and provider customer code to prove each fails to durable review
   without mutation. Edit `orders.customer_email` after assignment and prove
   the immutable epoch identity still governs matching. Also set the verified provider reference equal to
   another pending DVA's internal BAC and prove replay resolution does not own
   that transaction before receiver-identity matching. This verifies the late matching rule without
   pretending Paystack allows callers to choose `paid_at`. Separately run
   wallet-account creation with provider-returned assignment identity and no
   transfer: same-bank/account payable alias blocks persistence, a different
   bank and a cancelled alias do not, contradictory ownership quarantines, and
   neither the caller nor the guard fabricates amount, reference, or `paid_at`.
   Prove the route has no admin/service client, signs the exact
   `wallet_dva_account_persist` proof, invokes the RPC through the authenticated
   request client, and maps inserted/replay/reactivated rows and every null-row
   conflict outcome exactly. A same-bank/account row owned by another customer
   must return the durable `receiver_owner_conflict` result without an insert,
   while a different-bank row succeeds. Concurrent different-account provider
   responses for one owner must serialize on the owner advisory; the lock winner
   inserts and the other call returns the durable
   `existing_identity_conflict` result without changing the active row or
   reaching a unique violation. After `12015`, catalog and execution tests
   require exact service-role `SELECT, INSERT`, authenticated RLS-scoped
   `SELECT`, and no other runtime privilege; direct update, delete, truncate,
   reference, trigger, or maintain operations must fail. Assert the exact direct
   ACL rows through `aclexplode` and the effective matrix through
   `has_table_privilege`. After `12020`, the service-role
   insert fails too. Hold the owner/account advisory
   from one transaction while a direct legacy insert runs; its trigger must fail
   immediately with `40001` before uniqueness waiting. Exercise an authorized
   identity-changing RPC update to prove sorted old/new owner keys precede every
   sorted old/new account key and the trigger calls are reentrant. Simulate a
   prepared request reading `legacy_direct_v0` across
   the `12020` commit: its newly revoked direct write fails, one capability
   reread observes `rpc_v1`, and exactly one proof-gated RPC call persists or
   reviews the original provider response. Direct, stale, changed-payload,
   cross-customer, and cross-merchant RPC calls must fail without mutation.
   Delete the owning customer, merchant, and parent auth user in rollback-only
   fixtures and prove each exact restricted FK preserves the wallet receiver.
   The merchant customer-delete route must map only those named constraints to
   its fixed retention-required 409 and leak no bank, provider, or SQL detail.
   Cross-merchant order-identity evidence must create operations-only alerts and
   a null review merchant, while same-merchant evidence may enqueue exactly one
   merchant email and push. Changed evidence for the same sole conflicting order
   must create a new specialized review without colliding with the broad order
   index.
   Assert the mapped storefront conflict copy and component comment contain no
   90-minute or reservation-window promise. Assert pending-review and legacy
   receiver-conflict responses render only the fixed safe copy, the preparation-
   only unavailable bridge renders its fixed retry copy, none renders sensitive
   server error text, and all retain their exact telemetry reasons and compile-
   time error-code exhaustiveness.
12. Exercise the real provider path separately in Paystack test mode: create a
   `test-bank` DVA, transfer through Paystack's demo bank, and verify webhook
   delivery, reference resolution, reservation, finalization,
   exact receiver account/bank extraction,
   `merchant_push_contract = claimed_v1`, the exact complete durable
   `paid_order_side_effect_steps`, the correct merchant-push subset, and no
   direct helper call using Paystack's actual timestamps.
13. Deploy the test contract application while database readiness remains
    false. Test deployments generate environment-bound candidate/deployment
    receipts as restricted CI artifacts and must not rewrite the checked
    production ledger, effect, provenance, or post-deploy receipt fixtures.
    Wait the fixed 15-minute test legacy-Paystack-writer drain, run
    `audit-paystack-reference-roles.ts`, and require its signed report to prove
    zero unclassified referenced rows and zero cross-storage external-reference
    duplicates. Verify and archive its evidence/report pair with the exact test
    binding before the index release. Deploy only
    `20260719120200_paystack_external_reference_unique_index.sql` with the
    `paystack_reference_index` marker, hashes,
    `reference-index-candidate.json`, and tests; verify its exact concurrent partial-index definition and
    recorded migration version, and confirm runtime application output remains
    unchanged. Then complete the
    separately evidenced fixed 15-minute test legacy-assignment drain, run the
   checked-in assignment audit/repair against the test cutoff, and require a
   signed zero-blocker report for unlinked, reciprocal-metadata, current-epoch,
   supersession, projection-drift, uncaptured-rewrite,
   assignment-pointer-replacement, immutable-customer-identity,
   terminal-snapshot, capture-link-orphan/role, and post-contract wallet-purpose
   checks, with zero unreviewed pre-contract wallet-purpose collision. Verify and
   archive
   that evidence/report pair before the enforcement release. Deploy the exact
   two-file enforcement bundle ending in
   `20260719120220_order_payment_account_enforcement_cutover.sql` as a
   migration-focused test release with the `enforcement` marker, hashes,
   `enforcement-candidate.json`, generated types, and tests, while runtime
   application output remains unchanged. Verify the workflow's `apps/web/**`
   lane deploys that exact commit SHA, then verify
    direct writes fail and `order_payment_account_contract_state` is exactly
    `enforced_v1`. Only then set `INTERNAL_CREDIT_CHECKOUT_MODE=enabled`, deploy
    the same audited test application SHA with zero pending migrations, verify
    both the route and direct RPCs remain blocked while readiness is false, and
    activate using that exact SHA and current pause generation. Exercise
    wallet-only, savings-only, mixed store-credit, partial-credit,
    reversed-wallet-evidence,
    foreign-redemption, caller-amount-tampering, and identical-replay fixtures.
    Verify every flow begins and binds one checkout intent, every credit RPC
    rejects a missing/foreign/stale intent, partial or no-credit gateway handoff
    closes the intent only after atomically persisting one resumable
    gateway-initialization record, and full payment closes it in the finalizer
    transaction. Crash after handoff commit, after the provider call but before
    response, and after full-payment commit; each replay must return or resume
    the same durable outcome without duplicate redemption, provider
    initialization, transaction, or side effects. Race provider cancellation
    separately against pending, claimed, and ready gateway initializations.
    Verify pending cannot be claimed, claimed finish persists a withheld
    `reconciliation_required` result, and ready is atomically demoted before
    prepare or replay can expose its URL; provider rejection alone promotes the
    stored result back to ready, while proven cancellation aborts/compensates
    it. Force one failure before order creation and
    one after a no-credit order bind; verify the abort RPC closes the former and
    terminalizes/unwinds the latter, while any injected credit evidence makes
    abort fail closed for service reconciliation.
    Verify each fresh successful finalizer returns its exact transaction, an
    identical replay returns that transaction before fresh outstanding
    validation, changed evidence conflicts, failed evidence changes no order,
    paid email and owner-selected pushes are claim-gated, the failed-side-effect
    drain dispatches internal credit without provider verification, and no
    merchant-settlement row is created for internal credit. Also exercise
    all-`off`, `serialized_then_unlimited`, mixed-policy, and
    `serialized_strict` shortage fixtures. Verify unlimited inventory completes,
    strict shortage creates no payment or side-effect row, wallet and savings
    evidence is restored exactly once, policy-aware inventory unwind records
    one event per allocation, and the old order is terminalized with the exact system
    reason. Verify the active checkout page clears the old fingerprint key only
    for this proven restored outcome and creates a fresh key/order on retry. A
    forced compensation conflict must retain the old key and return the durable
    review id without claiming that funds were restored.
14. In the test environment, call the checked-in emergency-pause script with
    the active SHA, bounded incident reason, and operator identity. Prove
    readiness becomes false to new begins immediately, `pause_generation`
    increments once, and a zero-intent/zero-gateway-initialization pause reaches
    `paused` directly. Repeat
    with requests held after intent begin, order creation, wallet redemption,
    savings redemption, partial-credit persistence, gateway-handoff commit, and
    provider initialization. Prove the state remains
    `draining`, those captured-generation requests either finish or are
    reconciled from ledger truth, contradictory evidence creates one durable
    intent review, and `finalize_internal_credit_checkout_pause` refuses to
    report paused while any open/reconciling/reconciliation-conflict intent or
    mutable gateway initialization remains. Ready and aborted outcomes remain
    readable while paused; unresolved conflicts leave state `draining`, and no
    fresh provider call is permitted. An identical pause
    replay creates no second event and a stale SHA fails. Re-arm the same test
    revision, reactivate with the new generation and operator identity, then
    repeat with a newer test repair SHA to prove both permitted reactivation
    forms rerun all gates.
15. Exercise every exact terminalization function after wallet, savings, and
    mixed redemption but before finalization: customer cancellation, merchant
    cancellation, provider cancellation, provider webhook shipping
    `cancelled`/`canceled`/`failed`/`returned`, payment status
    `cancelled`/`failed`/`refunded`/`abandoned`/`expired`, and
    the claimed, one-order-per-transaction abandonment terminalizer. Exercise
    the chat, agentic, merchant PATCH,
    shipping webhook, customer tracking, Bumpa/Jumia import replacement paths, and
    provider-cancellation saga callers. Verify the global
    lock order, exact compensation, and allocation-led inventory unwind precede
    the terminal state. Cover aggregate-decremented, serialized with unlimited
    fallback, unlimited no-op, external-untracked, deleted-catalog, mixed, and
    ambiguous legacy allocation fixtures; replay must not restock any allocation
    twice. Prove the cleanup route claims at most 50 orders per round, runs at
    concurrency five, and terminalizes each claimed order in a separate database
    transaction after rechecking the lease and eligibility. Hold one
    order/control lock while another candidate completes to prove the claim
    transaction owns no order, financial, inventory, or control-row lock. Run
    concurrent replacement and terminalization calls against two
    allocations on one order and prove every path locks the order before sorted
    allocation, unit, and catalog rows without deadlock. Verify the customer RPC's three outcomes, cleanup aggregate schema,
    provider-local-finalization retry without a second provider call, and every
    route mapping. Direct terminal updates must be blocked, and a forced
    reversal or allocation conflict must leave order, shipment, and inventory
    unchanged with one durable alert.
16. Merge and deploy the contract PR through `.github/workflows/deploy.yml`
    only after the signed owner and inventory-allocation audits and test layers
    pass. Keep
    `INTERNAL_CREDIT_CHECKOUT_MODE=paused` during the migration-first window and
    after the contract application lands. Confirm the production migration
    versions, exact application `headSha`, health checks, owner/allocation
    gates, intent-aware finalizer signatures, exact `late_payment_v1`
    definition/grant manifest, terminalization registry and caller-surface
    scan, payment-orchestration proof configuration without logging secret
    material, historical-audit schema and RPCs, and that wallet/savings requests
    still receive the paused response. Using an approved low-privilege project
    API key plus a short-lived approved production test-customer session,
    supplied only through the dedicated
    `WALLET_DVA_VERIFY_SUPABASE_URL`,
    `WALLET_DVA_VERIFY_PROJECT_API_KEY`, and
    `WALLET_DVA_VERIFY_USER_ACCESS_TOKEN` operator environment entries, run
    `verify-wallet-dva-persistence-contract.ts` against the canonical Supabase
    URL. Require the key in `apikey`, the session JWT in `Authorization`, and the
    exact `rpc_v1` result; timeout, redirect, missing/misplaced credentials,
    malformed response, or any other result blocks the receipt and wallet smoke
    while the application remains fail-closed. Then merge the separate no-migration
    contract receipt PR: bind the exact ordered deployment attempts and candidate receipt,
    refresh every current P0 post-deploy fixture/provenance/manifest scalar,
    write `contract-deployment.json`, pass both replay modes in `enforce`, and
    health-check the receipt commit while still paused. Step 17 uses that
    receipt commit as its predecessor.
17. Wait the fixed 15-minute legacy Paystack-writer drain, run
    `audit-paystack-reference-roles.ts` from the contract commit, and stop until
    its signed report proves zero unclassified referenced rows and zero
    cross-storage external-reference duplicates. Verify and archive that report
    through the shared report verifier before merging the migration-focused PR
    containing only
    `20260719120200_paystack_external_reference_unique_index.sql`, the
    `paystack_reference_index` marker and exact hashes,
    `reference-index-candidate.json`, and tests. Confirm the deploy records the
    exact concurrent partial index while runtime application output remains
    unchanged and the workflow health-checks that commit's `headSha`. Merge its
    separate no-migration receipt PR with exact attempt/ledger/effect evidence,
    refreshed P0 bindings, `reference-index-deployment.json`, and enforce
    convergence. Then
    complete the separately evidenced fixed 15-minute legacy DVA-assignment drain, run
    `audit-order-payment-account-contract.ts` from the contract commit, and
    repair or durably review every post-cutoff touched assignment until its
    signed report proves no unlinked or reciprocal-metadata mismatch, no
    uncaptured projection rewrite, no dual-current epoch, no projection drift,
    no orphaned supersession, no replaced non-null assignment pointer, no
    orphaned or role-mismatched capture link, no missing/mismatched immutable
    provider-customer identity or terminal snapshot, and no lost historical
    identity/payable/link evidence, zero post-contract wallet-purpose collision,
    and no pre-contract wallet-purpose collision lacking its exact current open
    quarantine review. Verify and archive the report through the
    shared verifier, then merge the migration-focused PR containing
    only the two-file enforcement bundle ending in
    `20260719120220_order_payment_account_enforcement_cutover.sql`, generated
    types, the `enforcement` marker and exact hashes,
    `enforcement-candidate.json`, and migration/replay tests. Confirm the deploy applies that bundle
    with the already-live contract application, direct anon/auth writes now
    fail, the proof-gated RPC still creates/replays a linked assignment, and the
    state is exactly `enforced_v1` with a current preflight. Record and
    health-check this enforcement deployment's `headSha`; it proves the phase
    deployment but is not yet the final armed application SHA. Do not proceed to production DVA
    recovery while enforcement is absent or an assignment review is open.
18. Run `audit-internal-credit-cancelled-orders.ts` across every production
    order in the exact terminal transition set. For each active unreversed
    wallet or savings candidate, either complete a verified repair or create
    the dedicated open reconciliation review and record
    `manual_reconciliation_open` through the decision RPC using the
    database-computed evidence fingerprint, bounded reason, and operator
    identity. Re-run the CLI and stop unless every surviving candidate has the
    exact current fingerprint and matching open review. The database and
    environment remain paused throughout.
19. Capture the exact ordered enforcement deployment attempts plus fresh linked ledger and
    production effects read-only, and require the effect hash to equal
    `enforcement-candidate.json`. Merge an application-only final-receipt PR
    that updates `supabase-history-post-deploy-receipt.ts`,
    `linked-migration-ledger.json`, `production-history-effects.json`, the
    linked-ledger receipt in `production-effect-provenance.json`, all exact
    manifest bindings, writes `enforcement-deployment.json` and
    `final-production.json`, and updates replay tests only. It contains no
    migration, does not advance `materializedThrough`, and must pass both normal
    replay scripts in `enforce`. Deploy and health-check that commit while the
    environment and database remain paused. Record its exact `headSha`, paused
    production target, workflow run id/attempt, paused deployment id, immutable
    identity digest, `agenticPaystackDvaMode = 'paused'`, and `dbReady = false`
    from the protected production-alias attestation; the SHA is the audited armed
    application SHA. Once this healthy
    deployment proves all seven candidate/deployment pairs closed, remove
    `BACI_ACTIONS_RETENTION_READ_TOKEN` from the GitHub production environment.
    The later armed `workflow_dispatch` must emit `not_applicable`, make no
    retention-settings request, and apply zero migrations without that secret.
    Do not remove or unrequire the guardian App check. After activation its
    separately reviewed maintenance policy may stop recognizing payment lanes,
    but it continues protecting CI/workflow/guardian changes until the full
    replacement ceremony completes.
    Freeze merges through activation. If
    `main` moves, stop, regenerate the final receipt at the new head, and repeat
    the paused health check rather than activating a different commit.
20. Change production `INTERNAL_CREDIT_CHECKOUT_MODE=enabled`, run
    `gh workflow run deploy.yml --ref main`, and verify the resulting workflow
    uses the audited final-receipt `headSha` and applies zero new migrations.
    Query the production alias with the service credential and require that
    exact production target, SHA, this workflow run id/attempt, a normalized
    deployment id different from the paused one, `checkoutMode = 'enabled'`,
    `agenticPaystackDvaMode = 'paused'`, `dbReady = false`, externally observable
    `Cache-Control: no-store` and
    `CDN-Cache-Control: no-store`, no redirect, and the same strict
    release-identity schema. Do not require the Vercel-only header after the
    edge has consumed it. Require the attestation response itself to be HTTP
    `200`; while database readiness remains false, prove the armed
    `/api/orders` internal-credit checkout request returns `503`, all direct
    internal-credit RPCs still reject, and ordinary checkout remains healthy.
21. Read the service-only control status, then run
    `apps/web/src/scripts/activate-internal-credit-checkout.ts` with the exact
    production `headSha`, armed deployment id, canonical release-identity digest,
    returned `pause_generation`, and recorded operator identity as the final
    cutover action. Verify state `enabled`, the exact identity triple,
    incremented checkout generation, and one immutable activation event. Rerun
    the script against the same production URL and identity: the route now
    returns `dbReady = true`, the digest remains unchanged, and the RPC returns
    idempotently without another event or generation increment. A different
    SHA, deployment id, identity digest, target, or stale generation is rejected. Activation
    must recheck owner, inventory allocation, prior-generation intent,
    `late_payment_v1` signature/definition/grant, terminalization/caller-surface,
    DVA assignment `enforced_v1`, fence, and historical-evidence gates. No deployment follows this operation.
22. Run a separately approved low-value wallet-only or savings-only production
    smoke. Verify the exact redemption evidence, deterministic completed
    transaction, `amount_paid = total`, claimed paid email and owner-selected
    pushes, completed checkout intent, retry-drain behavior, and absence of
    merchant settlement.
23. Run a separately approved low-value production smoke invoice; document the
   payer, expected amount, settlement, and cleanup before transferring. Use the
   explicit `order_dva_v1` customer action or the signed-link flow with its guest
   mailbox challenge when applicable, verify its
   immutable receipt predates the provider call, and never use merchant
   attestation.
24. Verify order and transaction state, preserved platform fees,
   `amount_paid = total`, zero invoice balance, inventory, paid email, one
   claimed payment-received push, no finalizer-created new-order claim for the
   invoice, the expected immutable notification owner, exact consent-linked DVA
   epoch, and settlement.
25. Verify ambiguous, zero-candidate, strict-inventory,
   cancellation-reversal, checkout-intent, allocation, abandoned-cleanup, and
   retry-seed-conflict fixtures, plus captured payments after cancellation or
   refund, invalid wallet timestamps, wallet-bank-identity quarantine/repair,
   and unclassified reference roles, create durable deduplicated operations
   alerts without crediting or reopening any order.
26. Run Tony's exact `--evidence-only` probe first. If and only if it emits a
   current exact `recoverable` report, repair and verify the production order
   through the audited recovery steps. If it emits unavailable or conflicting
   evidence, pass that exact report only to `--record-evidence-outcome`, verify
   the durable deduplicated review/alert and zero financial mutation, retain the
   order unrepaired, and escalate only for authenticated provider evidence; this
   blocked outcome does not fail the prevention rollout. If the probe exits with
   `PAYSTACK_EVIDENCE_PROBE_RETRYABLE` or
   `PAYSTACK_EVIDENCE_PROBE_REJECTED`, retain no report, never invoke record or
   execution mode, correct credentials/target or retry after the provider
   recovers, and keep Tony's order unrepaired. A provider-probe outage or
   authentication failure is not historical-evidence-unavailable and cannot be
   made durable as that review type.
27. Monitor production logs, owner and allocation audit rows, checkout intents,
   provider-cancellation attempts, terminal-evidence audit rows, inventory
   allocation/unwind events, control events, cleanup aggregates, review rows,
   alert-outbox rows, and failed paid-order side effects for at least one
   payment cycle. If any financial or contract signal fails, run the
   emergency-pause script before changing the environment or deploying a repair.

Success means a valid uniquely matching late invoice transfer confirms
automatically, the invoice shows zero balance, paid email and payment-received
push are durably claimed and delivered, every payment-owned new-order push for
a Paystack/Korapay completion or shared-finalizer Juicyway payer participating in
`complete_order_gateway_payment` or an activated internal-credit completion is
durable, and a creation-owned best-effort new-order attempt is never duplicated
by those payment paths. The primary Juicyway webhook direct-success branch,
Klump, Credit Direct, and manual paid paths remain explicitly outside this
durability guarantee pending their own shared-finalizer migration. Tony's
historical incident reaches a resolved recovery outcome only when it is either
recovered from an exact current `recoverable` provider-evidence report or
remains financially unchanged with a durable unavailable/conflict review and
provider-evidence escalation. A transport, authentication, target, or provider-
response-contract probe failure leaves the incident explicitly pending with no
recordable report or mutation and cannot be called a successful incident
resolution; prevention-deployment success never depends on provider availability
or inventing the missing historical tuple.
Later failures cannot reopen completed notification work or
execute a side effect through another transaction's claim row. Internal-credit
payments cannot silently lose their claimed email or pushes, trust
caller-supplied payment amounts, or create gateway settlement. The schema-first
deployment cannot create an owner-ambiguity window or a new direct-only
notification-loss cohort within that stated completion scope, mutable payment methods cannot change event
ownership, every legacy owner has an auditable decision, terminal aliases are
never credited, every exposed DVA identity remains an immutable match epoch
after replacement, every post-cutover epoch records the exact assigned email
and provider customer code independently of the order's mutable notification
email, no order-DVA provider call or newly exposed bank account occurs without
durable express customer consent, merchant/staff actions never manufacture that
receipt, every post-consent-cutoff epoch links its exact immutable receipt, and
legacy no-consent evidence remains matchable without becoming proof of consent.
Every first terminal transition with DVA history preserves its exact
ledger residual and fingerprint, every unresolved legacy identity or residual
blocks automation and reaches durable review, every post-cutoff DVA assignment epoch keeps one immutable
assignment-intent pointer, every differently priced matched capture is recorded
through append-only reciprocal link evidence, and direct client assignment
writes are revoked. An internal BAC is never
treated as a provider reference before binding, wallet matching requires bank
identity and a real verified payment timestamp, a quarantined wallet account
can be reactivated only by the same provider-proven identity without colliding
with the preserved customer/provider key, a disabled wallet account can never
be automatically reactivated or disappear as historical receiver-purpose
evidence, a receiver owned by another wallet customer returns a durable review
without an insert or customer-data leak, and a captured payment after
cancellation or refund creates durable alerts without reopening the order. The
wallet receiver row cannot disappear through customer, merchant, or auth-user
cascade deletion; those parent deletes fail with a deliberate retention outcome
until a separately approved anonymization/provider-deactivation workflow exists.
The payment-initialize and wallet funding-account routes contain no
admin/service client and persist every provider result only through their
proof-gated specialized or ordinary RPCs, unlimited inventory never blocks
payment, strict inventory
failure cannot expose side-effect work or let one item's reclaimed count hide
another item's shortage, and restored internal credit cannot remain attached to
a payable or browser-reused order. Cancellation cannot strand committed wallet
or savings evidence; terminalization cannot double-restock serialized inventory
or mutate unlimited inventory; and every historical exception must retain an
exact-current evidence fingerprint and durable review. The database fence
cannot be bypassed by direct authenticated RPC calls, stops every new
internal-credit checkout immediately without a deployment, and reaches fully
paused only after captured intents are completed or safely aborted and gateway
initializations are ready or safely aborted. An unresolved reconciliation
conflict leaves the database explicitly `draining` and non-zero to automation;
it cannot be reactivated or mislabeled paused. Unmatched successful payments can no longer
remain operationally silent. Every migration bundle remains within the
repository's 300-line-per-file modularity rule and advances its contract state
only through its final catalog-verifying gate; the review-contract extension is
installed and catalog-verified before wallet quarantine can consume its issue
types. Abandonment cleanup claims work
in short queue-only transactions and terminalizes one order per transaction,
and the external-reference index cannot be recorded or activated against stale,
unclassified, evidence-mismatched, or duplicate Paystack reference roles.
