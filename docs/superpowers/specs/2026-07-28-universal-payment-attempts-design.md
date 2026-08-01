# Universal Payment Attempts and Order Completion Design

Date: 2026-07-28

Status: Proposed for owner review

## Decision Summary

Baci will keep one stable order for a commercial checkout and represent every
external collection initialization, retry, provider switch, manual recording
action, or invoice payment assignment as a separate payment attempt. Confirmed
money stays in `transactions`; attempts are not financial ledger entries.

The design preserves the existing 24-hour checkout idempotency contract for the
non-voucher storefront RPCs that already participate in it. Quiz-voucher orders
retain their deliberate opt-out because their one-time route-proof and award
claim are the stronger replay boundary. The 24-hour window controls whether an
unchanged checkout reuses an order. It does not, by itself, decide whether every
order is still payable.

For Credit Direct, an explicit SDK-success callback protects a still-unconfirmed
order from cancellation for at most 48 hours from `sdk_success_reported_at`. This
is a deliberate reduction from the current live 14-day cleanup exception. The
24-hour checkout-reuse window and 48-hour provider-confirmation window are
separate clocks.

The ordinary browser key still expires at 24 hours. When explicit Credit Direct
SDK-success evidence exists, Baci extends only that order's original checkout
binding through the 48-hour protection deadline. It does not silently create a
second order or launch another payment attempt during that interval. A customer
who genuinely wants the same purchase again must use an explicit, audited “Start
a separate purchase” action that issues a new purchase-intent nonce.

At the 24-hour boundary, checkout rotation and Credit Direct SDK first-report
share one persisted database collision domain resolved through merchant-scoped,
proof-backed subject/request aliases. Hash-version, proof-rotation, and guest-to-
account transitions retain that domain. Whichever wins determines the single
actionable collection authority; only the explicit nonce can authorize an
intentional second purchase.

Invoice orders use merchant-defined due dates. Merchants can set a due date per
invoice and configure a default term of 7 days, with an allowed range of 1 to
30 days. A Paystack Dedicated Virtual Account remains permanent; only its
invoice assignment and automatic-matching window are time-bounded.

All providers eventually complete payments through one database-owned order
completion contract. Provider adapters retain their distinct verification,
amount, settlement, and replay semantics.

## Relationship to Existing Designs

This design extends rather than replaces the completed BNPL order-idempotency
work in
`docs/superpowers/plans/2026-05-28-ogabassey-bnpl-order-idempotency.md`.
The stable checkout key, request hash, provider-independent order identity, and
24-hour browser TTL remain authoritative.

This design incorporates the immutable receiver identity, provider-customer
identity, ambiguity protection, wallet-purpose conflict, terminal-alias veto,
and fail-closed reconciliation rules from
`docs/superpowers/specs/2026-07-16-invoice-dva-late-payment-matching-design.md`.

It intentionally supersedes only that design's “no upper payment-age limit
while the invoice remains payable” decision. Under this design, the merchant's
invoice due date is the automatic-confirmation boundary. A verified transfer
received after the due date is preserved and reviewed; it does not silently
reopen or automatically confirm an overdue order.

## Problem

Baci currently has several partially overlapping payment paths:

- checkout idempotency already prevents many duplicate orders;
- some providers create pending `transactions`, while Credit Direct stores
  active session identity in order notes;
- Paystack and some shared paths use `complete_order_gateway_payment` and the
  durable `payment_side_effects` boundary;
- Credit Direct, Klump, Juicyway's direct-success branch, and manual payment
  paths still have provider-specific completion behavior;
- a successful Credit Direct payment can mark an order paid and send email and
  push while leaving `paid_at`, the transaction marker, settlement evidence,
  and durable side-effect rows inconsistent;
- permanent Paystack DVAs can be attached to multiple sequential invoices, so
  account number and amount alone cannot safely identify an order;
- one `paid_transaction_id` cannot accurately represent wallet plus gateway,
  deposits, installments, or other mixed-tender payments.

The result is inconsistent replay behavior, duplicate-looking pending orders,
provider-specific bookkeeping gaps, and avoidable manual reconciliation.

## Goals

1. Reuse one unchanged non-voucher checkout order for 24 hours across every
   external or manual collection rail that participates in checkout
   idempotency.
2. Record each payment initialization or retry independently without creating
   another order.
3. Preserve `transactions` as the confirmed financial ledger.
4. Support wallet, savings, deposits, installments, and gateway residuals
   without pretending one transaction always paid the whole order.
5. Verify, deduplicate, and durably acknowledge provider webhooks before
   asynchronous work.
6. Complete eligible payments through one atomic database contract.
7. Make email, push, loyalty, FIRS, advertising, and settlement side effects
   durable and retryable.
8. Let merchants set invoice due dates while safely matching payments sent to
   permanent Paystack DVAs.
9. Never guess when more than one invoice matches a transfer.
10. Migrate completion authorities incrementally, with shadow evidence and
    authority-level rollback controls.

## Non-goals

- Replacing Paystack's permanent DVA with one provider account per invoice.
- Inferring order identity from fuzzy email, amount, and time similarity.
- Redesigning provider dispute UX or refund-product policy in this phase. The
  financial contract must nevertheless preserve immutable reversal evidence,
  define compatibility with every existing refund writer, and prevent a refund
  or chargeback from leaving merchant entitlement overstated.
- Rewriting every payment provider in one release.
- Treating a client SDK callback or success page as proof that money settled.
- Storing unredacted webhook bodies indefinitely.
- Automatically assigning an ambiguous or overdue transfer to an order.
- Replacing the existing one-time quiz-voucher award-claim contract with the
  general checkout idempotency contract.
- Creating a provider attempt for cash on delivery before money is actually
  recorded, or for an order already settled entirely by wallet, savings, or
  voucher evidence.

## Core Concepts

### Stable order

An order is the commercial purchase: customer, canonical items, negotiated or
voucher-adjusted prices, tax, shipping, discount, currency, fulfillment, and
inventory allocation.

Order reuse requires the existing explicit checkout idempotency key and matching
server request hash. Baci must not search for a reusable order using only
customer email, cart amount, or a time window. That would collapse intentional
repeat purchases.

Changing any commercial field rotates the checkout identity and creates a new
order. Changing only the payment provider does not.

That rule also applies to merchant/admin edits, not only storefront retries.
Before the first payment attempt or DVA assignment, the existing audited order-
edit path may change commercial terms. After collection evidence has been
issued, item, quantity, price, discount, tax, shipping charge, currency,
customer matching identity, or any other amount/matching field cannot mutate the
same order. A reviewed “Revise and reissue” operation must instead follow the
global financial lock hierarchy for the original and proposed replacement
orders, create a replacement order with a new commercial snapshot, supersede or
cancel revocable attempts and assignment epochs, move or reacquire inventory,
and notify the customer atomically. The original order and provider references
remain immutable evidence. Once any money is verified, commercial revision uses
reconciliation/refund rather than replacement-order mutation. Purely
nonfinancial fields may remain editable only when they cannot affect provider
matching, price, tax, inventory, fulfilment eligibility, or customer authority.

“Revise and reissue” is not an escape hatch from the collection lease. The
operation acquires the complete advisory set before the original order, attempt,
assignment, and collection-lease row locks and before creating a replacement. It
may publish an actionable attempt or
DVA assignment for the replacement only after every prior collection authority
is provably revoked, expired, or transferred under a reviewed provider
contract. If an old attempt is customer-completed, non-revocable, or otherwise
possibly capturable, the operation records a proposed replacement and enters
review without creating a second chargeable obligation. A verified capture on
the original after a commercial revision follows reconciliation; it is never
silently moved to the replacement.

Quiz-voucher orders remain outside this reusable-key path. Cash-on-delivery
orders do not create a payment attempt until staff records actual collection.
Orders fully covered by wallet, savings, or voucher evidence complete through
their internal idempotent ledger path without fabricating a provider attempt.

### Payment attempt

A payment attempt is a request to collect some or all of an order's outstanding
balance through one rail. It exists before confirmed money.

Examples include a Credit Direct popup session, a Paystack checkout reference,
a Kuda session, a PayPal order, a manual-payment request, or an invoice-DVA
assignment.

Retrying the same provider creates a new attempt under the same order and marks
the prior live attempt superseded. Historical provider references remain
immutable matching and audit evidence.

### Confirmed transaction

A `transactions` row represents a verified financial movement and carries a
database-enforced `entry_kind`. `customer_receipt` is inbound customer-paid
money. `refund`, `chargeback`, and reviewed `adjustment` are reversal/outbound
entries linked to an original receipt through the reversal contract. Failed,
abandoned, expired, or merely initialized attempts do not become completed
financial transactions.

Only `customer_receipt` entries own receipt origins and positive gross customer-
disposition lots. Receipt-backed order allocations consume those lots. Spending
an existing wallet, savings balance, store credit, or stored-value voucher is an
internal funding application, not a new inbound receipt; it consumes its source
ledger/reservation through the separate contract below. Both conserved receipt
allocations and conserved internal-funding allocations may contribute to order
completion, but only the original receipt owns receipt settlement/effects.
Reversal entries own reversal provenance, direction, and conserved reversal
effects; they cannot satisfy an order, create a receipt origin, or seed paid-order
effects.

### Payment allocation

An order payment allocation records how much a confirmed transaction contributed
to an order. Receipt-funded and internal-funded totals are separate authoritative
projections; their conserved sum, not one marker column, determines historically
funded `amount_paid`. Reversal projections separately determine net retained
funds and never turn an already completed order into a new collection target.

### Internal funding application

An internal funding application moves value already represented by an immutable
customer-wallet, savings, store-credit, or stored-value-voucher ledger/reservation
into one order. It is not inserted as `transactions.entry_kind='customer_receipt'`,
does not create a receipt origin/canonical provider identity/customer-disposition
lot, and does not seed provider settlement or receipt acknowledgement effects.
The private `order_internal_funding_allocations` row stores order, collection-
contract epoch, source ledger/reservation identity and kind, positive integer
minor-unit amount, currency, immutable database-owned funding-command identity,
actor/system authority, source funding-basis/obligor generation, backing-
availability state,
and timestamps. Funding basis is a closed tagged union: customer-funded value
traces to a conserved receipt asset or its immutable wallet-ledger credit from a
receiving-intent receipt; merchant-issued credit traces to a reserved merchant
liability; platform-funded value traces to an approved platform funding
obligation; and stored-value issuance traces to its funded issuance ledger. A
label such as "wallet" or "voucher" is not solvency evidence. The source
identity is unique to the exact consumed amount or owns a conserved split
contract; database checks prevent the same
wallet/savings/credit value from funding two orders.

An authenticated/system wrapper first creates or reloads the `internal_ledger`
branch of `financial_command_executions` as one immutable funding-command binding
containing merchant, customer, order, collection-contract
epoch, exact source slice/parent, source kind, amount, currency, authorization
snapshot, and scoped idempotency key. It validates current tenant/customer access
and derives every identity from trusted database rows; a caller cannot bind a
source slice to an arbitrary order. The financial execution accepts only that
command ID and revalidates the complete binding under lock.

One guarded internal-funding function discovers the bound order, source ledger,
its immutable typed backing asset, the asset's receipt-lineage root when that
backing branch has one, inventory, and merchant-value resources. For a receipt-
lineage-backed asset, every command executor and completion-wrapper branch
acquires the stable `receipt_lineage_root_guard` before the backing-asset/source-
slice child class. A merchant-issued, platform-funded, or other non-receipt
backing branch requires no receipt root, must not fabricate one, and goes through
the existing typed-backing-asset/source-slice child lock path. Both shapes lock
the remaining rows only in the global hierarchy
(including inventory before customer-wallet rows). Before any debit or split, it
revalidates tenant, customer, source-slice ownership, currency, collection epoch,
order eligibility, the locked residual payable amount, and, when present, the
receipt-lineage guard's generation and active-veto count. A changed generation or
nonzero active count returns the typed retry/fenced result with the source
unchanged; no receipt-backed branch may debit, split, allocate, or complete from
a pre-fence snapshot. Cumulative
historical receipt allocations plus internal-funding
allocations plus the proposed amount must not exceed the immutable payable total;
an excess proposal returns a typed conflict with the source unchanged rather than
converting existing internal value into suspense. Only then does it atomically
consume or split the source reservation, create the internal
allocation, recompute funded balance, and perform the same inventory/paid-state
transition when total external receipt allocations plus internal funding exactly
settle the order. It creates merchant entitlement only through the reviewed
source-liability transfer; it cannot fabricate new customer gross or provider
availability. Merchant entitlement inherits the source's backing availability,
risk holds, obligor, and recovery policy and cannot become withdrawable earlier
than that backing permits. A promotional voucher that changes the commercial
price remains a discount in the immutable order snapshot; only a voucher backed
by a stored-value ledger uses this application contract.

Only a customer refund may restore internal value. It restores that value exactly
once to the same source-liability class, or to a reviewed immutable successor
ledger when the original source is closed; it never invokes a provider cash refund
or consumes the original top-up receipt a second time. A mixed-tender *customer
refund* is split by the authoritative receipt and internal-funding allocations:
the receipt-funded portion follows provider/refund policy, while the internal
portion follows the source-liability restoration contract. Converting an internal
portion to an external cash refund requires a separate finance-authorized
conversion decision, not caller-selected routing.

A chargeback is not a customer refund. It binds only to the original external
customer-receipt transaction and its conserved receipt-funded lots, components,
and receipt allocation portions. It has zero internal-funding source portion,
performs zero internal-allocation restoration, and cannot debit, release, or
otherwise reverse a later internal-funding application. Its liability impact may
trace through an order funded with an internal leg, but that trace may only apply
the backing-loss/recovery policy below. A chargeback of an original top-up
receipt therefore records loss of that receipt's backing asset, not a refund of
the later wallet spend. Loss of an external receipt that backed already-spent
internal value follows immutable backing lineage into the configured reserve/
merchant/platform/customer liability policy and negative-balance recovery; it
does not erase funding history, restore the spent source, or mint a second source
debit.

Wallet-top-up backing loss and internal-value restoration use an asset-level
authority plus per-slice recovery rows, never an assumed order payment
allocation. The typed backing-lineage asset is immutable and database-owned:
customer-funded value uses either a conserved receipt asset or the exact
customer-wallet ledger credit created from a receiving-intent receipt (the
ordinary non-order wallet-top-up case); merchant-issued value uses its reserved
merchant-liability asset; platform-funded value uses its approved platform
funding-obligation asset; and stored-value uses its issuance-ledger asset. The
asset stores its type, immutable identity, obligor, availability, and, where
applicable, its receipt/origin lineage. A label such as `wallet` is not a key or
backing proof.

One private `backing_loss_case` is uniquely keyed by `(typed_backing_lineage
asset, backing_loss_identity)`. `backing_loss_identity` is an immutable tagged
union: `provider_chargeback` carries the original receipt/provider-account scope
and provider dispute identity; `issuer_revocation` carries the verified provider
or reviewed merchant, platform, or stored-value issuer revocation identity. The
case persists immutable recovery amount/currency/evidence, stable idempotency,
asset version, state, and a unique loss-reservation ledger identity. For
`issuer_revocation`, reported and recoverable loss are equal and no provider-
dispute collision amount exists. A `provider_chargeback` child case instead binds
one immutable parent chargeback/collision identity and one immutable parent
source-reservation partition row for this asset. It persists only that row's
non-negative `q_asset` as its recoverable loss; `D`, aggregate `Q`, and finance
`E` are parent-only fields and are database-forbidden on the child. A replay with
a different parent, partition row, `q_asset`, currency, or source facts is
rejected. After every receipt-lineage class required by its cause (none for an
issuer-revocation-only case), the guarded authority takes its typed-backing-asset
and case advisory family and locks only the backing asset and loss case, CAS-reserves `q_asset`
exactly once against still-backed capacity, and installs an immutable loss-fence
generation plus frozen lineage high-water mark. A recoverable loss larger than
remaining backed capacity (after every prior active/final loss reservation) enters
review with no partial plan. A positive recoverable loss starts
`fenced_census_pending`, not a materialized or applicable plan; the special
`E_finance` `provider_chargeback` `q_asset=0` state is
`fenced_finance_disposition_pending`. New spending,
splitting, restoration, or availability transition must revalidate that
fence/version, so it cannot create an unfenced descendant or spend value reserved
for the loss. Each such writer first acquires the stable
`receipt_lineage_root_guard` advisory/row family for its immutable root, before
looking up any parent or taking a typed-backing-asset lock. If it needs parent
authority, it then takes the parent partition, parent veto, and required parent
finance class before its child asset/loss-case/fence/recovery class; a writer that
does not need parent authority goes directly from root guard to its child class.
It reads and later
revalidates that guard's monotonic generation and bounded active-parent-veto
count, then locks/revalidates the asset before changing a source slice. A positive
active count makes an availability-affecting writer abort/retry without scanning
parent-veto rows; a writer that began before the fence either commits before the
guarded high-water snapshot or sees the advanced guard and aborts/retries. It
cannot commit an in-between descendant.

Provider-chargeback intake has a stricter atomic boundary. When the charged
receipt has typed backing-asset lineage, the same bounded database transaction
that accepts/persists authoritative chargeback evidence, its source reservation,
and any `Q`/`E` collision first completes its canonical receipt/reversal/source-
reservation class, then locks the stable `receipt_lineage_root_guard` whose sole
key is the immutable receipt-lineage root, then the parent target-`Q` partition
header, then the parent veto, then the parent finance-scope/disposition class.
In the same transaction it
increments that guard's monotonic generation and active-parent-veto count, then
persists parent `D`, `Q`, `E`, its immutable non-null finance-scope kind
(`zero_E_no_finance` exactly when `E=0`, otherwise `E_finance`), and one immutable
`chargeback_receipt_lineage_availability_veto`. The parent veto is keyed by
parent chargeback/collision identity, accepted evidence identity, and immutable
receipt-lineage root; it records source-reservation identity, currency,
lineage-index high-water, the activated guard generation,
`lineage_census_pending` state, and no expiry. Guard activation occurs before the
high-water snapshot. A pre-guard writer must serialize on that root guard before
its snapshot; a later writer sees the active count and retries. The transaction
locks only those receipt/reversal/source-reservation, root, parent-partition,
parent-veto, and parent-finance families under the global hierarchy, not every
descendant asset. An uncaught
transaction/lock error rolls back guard activation, evidence acknowledgement, and
source reservation together; after this commit, provider acknowledgement is safe
even if no child case exists yet.

The parent lineage veto is the durable availability/non-spend fence, not an
asynchronous promise. The root guard is its bounded ingress gate: it stores only
the immutable root, a monotonically increasing generation, and an authoritative
non-negative `active_parent_veto_count`; it never contains or requires an
unbounded list of active parents. Every current or future descendant asset
writer—spend, split, restoration, availability, merchant-availability,
settlement, reserve release, payout, or withdrawal—derives its immutable root,
locks that guard before any parent lookup or typed-asset lock, and revalidates the
generation/count after its remaining canonical locks are held. A nonzero count
rejects/retries every availability-affecting write in O(1), while parent-specific
workers may continue their own fenced work after refreshing the guard generation.
A writer that began before activation either commits before the guarded high-water
snapshot or sees the advanced guard and aborts/retries; it cannot create an
in-between descendant. Multiple distinct active disputes may increment the same
root count. Every count transition—activation or terminal release—advances the
generation atomically. Each parent may decrement it exactly once only in its own
terminal release transaction, and availability may reopen only when that guarded
count transitions from one to zero. Thus no descendant can become spendable, available,
settleable, or withdrawable while any parent veto remains, even if its individual
child case has not been materialized.

The parent performs three durable bounded phases behind that veto. Each page first
locks/reloads its root guard, parent partition, parent veto, and any required
parent-finance class, in that order, before taking its bounded child class; it
revalidates the recorded guard generation, current parent activity, and its frozen
high-water before it advances the cursor. A generation change from a second parent
dispute reloads the same immutable page rather than using stale observations. First,
`lineage_census_pending` keyset-scans no more than the configured census-page cap
of immutable receipt-lineage index rows through the frozen high-water mark. Each
append-only page records direct-versus-asset source classification, immutable asset
or direct identity, exact reserved-portion capacity, source version, prior cursor,
page ordinal, and chained checksum; it locks no descendant financial rows and
moves no money. A final CAS verifies high-water, count, capacity, and checksum and
seals `lineage_census_sealed`. Second, `partition_pending` reads only that sealed
census in bounded pages and emits draft `Q_nonasset` plus one `q_asset` row per
asset. Under `zero_E_no_finance`, every emitted asset row is strictly positive and
a zero portion is omitted rather than materialized as a child; only `E_finance`
may persist its explicit zero-`q_asset` child binding. A final guarded seal proves
every reserved source minor is classified once, `Q_nonasset + sum(q_asset) = Q`, no
duplicate direct/asset source portion, and a
complete partition checksum. Direct ordinary receipt effects wait for this sealed
partition; child recovery can use only its sealed `q_asset` row.

Third, `child_materialization_pending` creates/reloads child cases and child
fences in bounded partition pages. For each row it either CAS-reserves that
`q_asset` and publishes the child loss fence/high-water, or writes the immutable
child `backing_loss_pending_veto` linked to the parent and partition row. A child
veto can later become a case only under the same parent/partition and child lock
families; it cannot infer or copy parent `D`/`Q`/`E`. The parent keeps its lineage
veto while batches run, so no subset becomes available. The parent veto may release
only after the partition is sealed, every affected child has a durable fenced,
applied, review, or finance-terminal state, direct `Q_nonasset` effects are
durably checkpointed, the immutable scope-specific finance proof below is sealed,
every finance-pending child has reached the exactly-once finance terminal below,
and the parent scope-specific finance rules below are satisfied. Crash, lease
expiry, replay, or divergent parent/source facts reload the same generation/cursor/
checksum. Stale high-water, source version, checksum, capacity, or partition facts
retain the parent veto and force bounded rescan/review; they never publish a partial
partition or release a subset of assets.

If a lineage has more descendants than an ordinary transaction or operational
materialization cap, intake still commits the bounded parent veto and acknowledges
the authoritative chargeback in `lineage_overflow_fenced` state. It emits a typed
overflow/review receipt and resumes census/partition/child batches from durable
cursors; it never takes an unbounded asset lock set, silently drops a descendant,
or releases the lineage fence. The parent veto releases only through the same
complete sealed-partition, child, and scope-specific finance proof, and its guarded
active count can fall only in that release transaction, not on worker timeout or
overflow.

For a provider chargeback, `D`, aggregate source reservation `Q`, and collision
amount `E` live only on the parent authority. Its sealed partition has one direct
`Q_nonasset` amount for ordinary receipt-funded portions and zero or more asset
rows `q_asset`; only `Q_nonasset` enters the ordinary direct receipt component/
merchant path, and only a child row's `q_asset` is eligible for that child's
backing-loss census, plan, application, or customer/merchant/internal recovery.
A child may never infer a share from the parent total or another child.

`E` is parent-owned finance value, never an unspent candidate, consumed-slice
candidate, plan item, recovery row, recovery-ledger amount, or
customer/merchant/internal economic component. Every parent installs one immutable
`provider_dispute_collision_finance_scope` selected from a closed union alongside
its `D`/`Q`/`E` facts; a missing/null scope is invalid.

For `D=Q, E=0`, the only legal scope is `zero_E_no_finance`. It persists
`parent_only_E=0`, forbids every `finance_child_reference` and every
`complete_child_finance_resolution`, and starts a bounded
`zero_E_no_finance_reference_census_pending` worker after the sealed partition
and child materialization. The worker keyset-scans the sealed partition and its
durable child identities in bounded pages, recording only cursor/count,
partition/child/asset identity, ordinary-child classification, and chained
checksum—never a finance reference. Its guarded `zero_E_no_finance_sealed` proof
requires `E=0`, `parent_only_E=0`, zero finance references, no zero-`q_asset`
finance-only child/fence, and only ordinary direct effects plus strictly positive
`q_asset` children. Each such positive child follows its ordinary backing-loss
census/plan/application/recovery lifecycle and must not enter a finance-pending or
finance-terminal state. Thus an `E=0` parent cannot fabricate a `q_asset=0`
finance-only child merely to satisfy a release predicate; release accepts only the
explicit sealed zero-finance proof, never the absence or nullness of finance rows.

For `E>0`, the only legal scope kind is `E_finance`; it remains fenced in
`finance_disposition_pending` until the later parent-owned, finance-authorized,
immutable `E_finance` disposition is recorded. That disposition has its immutable
parent `E` amount, an explicit immutable `parent_only_E` residual, and append-only, bounded
`finance_child_reference` pages. After the sealed `Q` partition has produced its
durable child identities through bounded child materialization, a
`finance_child_reference_pending` keyset worker enumerates every child in
partition-key order. It writes exactly one explicit zero-non-recovery reference
for every `q_asset=0` child (with economic share exactly zero), and may write one
explicit positive non-recovery share for an eligible positive-`q_asset` child. A
reference is a fencing/reconciliation fact, not `q_asset`, and cannot enter any
child recovery path.

The `E_finance` worker records each bounded page's prior cursor, count,
child/asset/partition identity, reference kind, share, and chained checksum. Its
final guarded `finance_child_reference_sealed` proof establishes that every and
only this parent's `q_asset=0` children were referenced once; every positive child
has at most one finance reference; no reference crossed parent, root, partition,
asset, or currency; and zero references sum to zero. It also proves the exact
parent-finance conservation equation `sum(positive child non-recovery shares) +
parent_only_E = E`. The seal is the immutable attachment boundary: a positive
child absent from it is explicitly unreferenced, remains an ordinary `q_asset`
child, and can never receive a late finance reference; replay must return the same
sealed membership and any added, removed, or changed reference is rejected. Thus
parent-owned `E` may remain wholly unassigned to children even when positive or
zero-recovery children exist, but it is never silently omitted.
Missing, duplicate, divergent, unsealed, or over-cap enumeration retains the
parent/root veto for bounded retry or review. Crash/lease expiry resumes the same
page cursor/checksum and cannot duplicate a reference or change `parent_only_E`.
Database checks prohibit `E`, `parent_only_E`, and every non-recovery child share
from any asset-loss or customer/merchant/internal effect path. While parent `E` or
an assigned non-recovery child share remains unresolved, the parent lineage veto
and every affected referenced child fence keep those assets non-spend/non-available.
An `E_finance` `q_asset=0` child persists an immutable zero-recoverable reservation
marker, creates no census candidate, plan item, application item, or recovery row,
and remains `fenced_finance_disposition_pending`; retry/replay cannot turn zero
`q_asset` into recoverable value. An explicitly unreferenced positive-`q_asset`
child has the ordinary loss-case tag and normal `applied` terminal after its own
recovery; it is not finance-pending solely because its parent has unresolved
`parent_only_E`, though the root guard still blocks its availability.

Database-enforced child tags are closed: `ordinary_q_asset` requires positive
`q_asset` and no sealed finance reference, `referenced_positive_finance` requires
positive `q_asset` and exactly one sealed positive reference, and
`zero_finance_reference` requires `q_asset=0` and exactly one sealed zero-share
reference. Only the latter two may enter a finance-pending or finance-terminal
state; `ordinary_q_asset` may enter only ordinary recovery states. The sealed
reference membership and tag are immutable, so no late attachment, tag change, or
ordinary-to-finance transition can be accepted on retry or a divergent command.

Parent-owned finance completion is independently exactly once. The immutable
`E_finance` disposition records one parent terminal
`parent_finance_disposition_resolved` keyed by the disposition identity after its
replacement-backing/reconciliation/liability work proves the entire
`parent_only_E` residual resolved. It neither attaches a child nor mutates an
unreferenced positive child. A crash/replay reloads that same terminal; a changed
residual, evidence, disposition, or post-seal child membership is rejected. Until
this terminal exists, the parent/root guard remains active even if every child has
finished ordinary recovery and there are no positive finance references.

Finance-pending child closure is a separate bounded, exactly-once transition,
`complete_child_finance_resolution`. It is keyed by the immutable pair
`(parent_finance_disposition_id, child_case_id)` and may run only under an
`E_finance` scope for a `q_asset=0` child or for a positive-`q_asset` child whose
sealed recovery application has completed; in either case its sealed immutable
parent disposition must explicitly name that child. A zero child requires its one
explicit zero-share reference, while a positive child requires its one positive
non-recovery share. Its canonical transaction locks the receipt-lineage root
guard first, then parent chargeback partition, then parent veto, then the parent
finance scope/disposition/reference/terminal family, then that one child
asset/loss-case/fence and its bounded recovery/idempotency rows; it reloads the
root generation and parent active state after all locks. It verifies the exact
parent, partition, child, asset, currency,
disposition identity, required sealed reference kind/share, `E` equation/seal,
and (for a positive child) applied `q_asset` checksum before atomically writing
the unique completion result. It creates no
census candidate, plan item, recovery row, or money-moving ledger effect.

The only successful terminal is `finance_no_recovery_resolved`: it records the
immutable finance-disposition identity and an exact local safe-release decision,
not a recovery amount. It makes a zero child permanently non-recoverable and a
positive child permanently non-recoverable for its `E` reference after its own
`q_asset` recovery is complete. It may mark the child locally release-eligible,
but cannot make it available while the root guard's active count is nonzero; the
actual availability release remains the final parent/root release transaction.
A replay with the same pair returns that result, while a different disposition,
child, asset, partition, share, currency, state, or checksum is rejected. A
crash/lease expiry reloads the same pair and cannot duplicate a release decision;
high fan-out processing visits child keys in bounded immutable partition pages.
The parent/root veto cannot release until its immutable scope has either the
`zero_E_no_finance_sealed` proof or the `E_finance` reference seal, every
referenced `E_finance` child pair has this terminal result, every unreferenced
positive child has its ordinary applied/review predicate, and the parent
`parent_finance_disposition_resolved` terminal is complete.

The loss case has three durable, independently resumable phases: census, plan,
and application. In `fenced_census_pending`, a bounded worker first writes the
single `unspent_asset_balance` candidate, then keyset-scans no more than the
configured census-page cap of immutable lineage-index rows at a time up to the
frozen high-water mark. Each append-only census page contains candidate IDs,
still-consumed capacities, source versions, page ordinal, prior cursor, and a
chained checksum. The unspent candidate includes value restored before the fence;
every source-slice candidate contains only still-consumed, not already-restored,
capacity, so one backing minor unit cannot occur twice. No census transaction
locks descendant financial rows or creates a money-moving plan item. On the final
page, guarded CAS verifies the high-water mark, candidate count, capacity total,
and chained census checksum, then seals `census_sealed`; source/version/checksum
drift retains the fence and starts a bounded rescan or review.

Only after `census_sealed` may the separately leased `plan_pending` worker read
those immutable census pages in cursor order and write a bounded page of draft
plan items. It uses prefix apportionment, not a global remainder sort: candidates
are ordered `unspent_asset_balance` first and then source-slice ID in byte order;
with recoverable loss `L` (the provider-chargeback child's `q_asset`, or the
issuer-revocation loss), sealed total capacity `C`, candidate capacity `c_i`, and prior prefix
`P_{i-1} = sum(c_1..c_{i-1})`, the exact allocation is
`a_i = floor(L * (P_{i-1} + c_i) / C) - floor(L * P_{i-1} / C)`. Each page
persists its starting/ending prefix, item count, amounts, cursor, and chained
plan checksum. The formula is deterministic, each `a_i` is within `c_i` because
`L <= C`, and the final prefix telescopes to exactly `L` without a global rank or
unbounded in-memory sort. Every sum, product, quotient, and remainder in this
calculation uses arbitrary-precision integer intermediates. An implementation
without arbitrary-precision support must use checked arithmetic for every
intermediate, including `P_{i-1} + c_i`, `L * (P_{i-1} + c_i)`, and
`L * P_{i-1}`. Before any draft plan item is persisted, an unsupported bound or
overflow returns the typed `allocation_numeric_bounds_review_required` result,
retains the fence and immutable census, and writes no plan item or financial
effect; retry cannot silently narrow, wrap, or saturate a value.

A draft item is not applicable. After the final plan page, one CAS verifies the
sealed census checksum/count/total, final prefix `C`, plan item count, plan amount
sum `L`, and chained plan checksum; only then does it transition to
`plan_sealed`. Any crash between census, plan pages, or that seal reloads the
same immutable cursors/checksums and writes no financial effect. A stale
high-water/version or a different source fact cannot be folded into an existing
case; it remains fenced for rescan or review.

Only the `application_pending` worker may apply a sealed plan. Fan-out never
acquires an unbounded descendant lock set: one application transaction locks the
fenced asset/case plus no more than the configured sorted application-page cap of
sealed plan items, source slices, and `(typed backing asset, consumed source
slice)` recovery rows. It records a checksumed application cursor and each item
has an exactly-once applied ledger identity. The unspent item moves its reserved
amount to unavailable/quarantined value; each source-slice item advances its
recovery row. The case becomes `applied` only after every sealed item and the
application checksum agree. Crash or worker-lease expiry restarts from the same
application cursor; it cannot reserve the loss, move unspent value, or create a
reserve/negative-balance entry twice. Only then can the fence enter its durable
unavailable/recovery state; a failed phase remains fenced and reviewable. A
provider-chargeback child in `E_finance` with an explicit sealed positive
non-recovery reference instead becomes
`recoverable_q_asset_applied_finance_pending` after its `q_asset` items complete
and must pass only through `complete_child_finance_resolution` to
`finance_no_recovery_resolved`; it cannot release availability or become fully
applied merely because its local work ends. An `E_finance` `q_asset = 0` child
skips census/plan/application entirely, remains fenced finance-pending, and reaches
only that same finance-no-recovery terminal. An `E_finance` positive child absent
from the sealed reference set instead reaches ordinary `applied` after its own
`q_asset` recovery and is database-forbidden from finance-pending/terminal states
or later attachment. A `zero_E_no_finance` scope has no zero child and leaves every
positive-`q_asset` child on the ordinary recovery path.

Each per-slice recovery row remains keyed by `(typed_backing_lineage asset,
consumed_internal_source_slice)` and records the independently idempotent
backing-loss allocation and customer-refund-restoration transitions, restored
amount, current availability, recovery obligation, and resulting ledger entries.
An internal customer refund first locks/revalidates the asset fence and loss case.
If census or plan sealing is pending, it returns a typed retry/review result rather
than restoring available value; once the sealed item is eligible, it CASes that
same recovery row. Thus restoration-first, backing-loss-first, in-flight batch, and
replay cases all converge: a later loss changes previously restored value to
unavailable or negative recovery without restoring it again, while a later refund
can restore only into the already-unavailable/quarantined destination. No path
duplicates restoration, reserve recovery, or negative-balance entries.

### Partial-collection contract

An order cannot accept an automatic partial allocation merely because a provider
captured less than the outstanding balance. Before collection begins, the order
has one explicit contract:

- `exact_balance_only` — standard instant checkout. A verified amount must equal
  the current outstanding balance after recognized idempotent wallet, savings,
  voucher, or store-credit funding. Those internal checkout tenders may form the
  planned first portion of mixed tender; the external collection must equal the
  resulting residual. An unexpected smaller or larger provider capture is
  preserved in funds suspense and reconciliation without allocation.
- `partial_with_inventory_hold` — approved invoice, installment, deposit, or
  savings plan. It has an immutable collection due time and inventory-hold
  policy. Every partial allocation must atomically secure or extend inventory
  through that deadline.
- `partial_without_stock_commitment` — permitted only for an explicitly
  merchant-configured preorder/backorder product whose customer-facing terms
  disclose that stock is not reserved. It cannot be inferred for ordinary stock.

Changing this contract after money is captured requires an audited
reconciliation decision. A nominal partial payment cannot reserve ordinary
inventory indefinitely.

Collection terms are immutable epochs rather than mutable columns on an order.
Each attempt and allocation links to the exact collection-contract epoch that
authorized it. An extension after expiry creates a new epoch and a new attempt;
it never rewrites the old `collection_due_at` or moves an expired attempt back
to a live state. The extension records actor, reason, previous epoch, customer-
visible revised terms, inventory reacquisition result, and the settlement
disposition of earlier funds. Earlier allocations retain their original epoch.

The contract also snapshots a settlement-release policy. The default is
`on_full_payment`: Baci-custodied partial funds remain in suspense until the
order is fully paid. `on_each_installment` is allowed only for merchant-approved
deposit/installment terms disclosed before collection, with explicit
cancellation, refund, and negative-balance recovery rules.

### Verified webhook event

A verified webhook event records provider event identity, payload hash,
normalized safe fields, processing state, and replay outcome. Signature
verification always happens against the exact raw request bytes before parsing
or persistence.

## Data Model

All migrations are append-only. Exact names and constraints must be verified
against current `origin/main` during implementation planning.

### `payment_attempts`

Required fields:

- `id uuid primary key`
- `merchant_id uuid not null`
- `order_id uuid not null`
- `provider text not null`
- `provider_account_id text not null` — stable, non-secret identity for the
  merchant's provider credential, subaccount, or receiving account namespace
- `kind text not null` — instant, BNPL, invoice DVA, or order-bound manual
  collection; internal funding uses its source-ledger allocation contract and a
  non-order wallet deposit uses the receiving-intent contract below rather than
  fabricating an order attempt
- `status text not null`
- `expected_amount_minor bigint not null check (expected_amount_minor > 0)`
- `currency text not null`
- `collection_contract_epoch_id uuid not null`
- `completion_authority_key text not null`
- `routing_generation_id uuid not null`
- `rollout_cohort_key text not null`
- `processor_contract_version text not null`
- `capture_authority_kind text not null` — `external_session` or
  `noncapturable_by_construction`
- `capture_finality_contract_id uuid null` — immutable FK to the active
  provider/account/authority finality generation selected at external-session
  issuance
- `settlement_ownership text not null`
- `settlement_policy_version text not null`
- `transaction_cardinality text not null` — `single_capture` or an explicitly
  reviewed `bounded_multi_capture`
- `provider_session_id text null`
- `provider_reference text null`
- `provider_customer_id text null`
- `session_issued_at timestamptz not null`
- `session_expires_at timestamptz null`
- `attempt_number integer not null`
- `superseded_by uuid null`
- `expires_at timestamptz null`
- `sdk_success_reported_at timestamptz null` — server receipt time for the
  authenticated/tracking-proof-bound but untrusted customer-device SDK report;
  protection evidence only, written once by the guarded first-report function
- `provider_customer_approved_at timestamptz null` — provider event time from
  the signature-verified `Checkout_Customer_Payment_Completed` event; only this
  signal may advance provider approval or create the bounded inventory reservation
- `provider_confirmed_at timestamptz null`
- `failure_code text null`
- `initiated_by uuid null` — required for staff/manual attempts and null only
  for provider/system-created attempts
- `initiation_source text not null`
- `safe_metadata jsonb not null default '{}'`
- timestamps

Uniqueness rules:

- provider reference identity is unique within provider, merchant, and stable
  provider-account namespace when present; implementation must prove a
  provider's stronger global uniqueness before omitting that namespace;
- attempt number is unique within order and provider;
- only one nonterminal attempt per order and provider is active at a time;
- one database-owned collection lease identifies the only attempt the customer
  may currently act on across all providers for an order.

Authority, routing generation, cohort, and processor contract are immutable
after attempt insert. They are selected by one database issuance function from
the locked authority-rollout record, not accepted from a browser or recomputed
from a current feature flag. The referenced routing generation must belong to
the attempt's provider/account/authority scope.

Capture authority is a database-enforced tagged union. `external_session`
requires a non-null capture-finality contract and is mandatory for every
provider checkout, BNPL session, DVA/tranche assignment, customer-actionable
manual transfer request, or other rail that can accept money after issuance.
`noncapturable_by_construction` requires a null capture-finality contract,
forbids provider session/customer identifiers and customer-actionable collection
leases, and is permitted only when an authorized staff workflow records money
already collected. It can never enter provider switching, revocation, expiry, or
successor-session logic.
Its database-enforced state set is closed to
`manual_evidence_pending | manual_evidence_review_required |
manual_receipt_recorded`. Issuance may create only `manual_evidence_pending`.
One expected-version CAS may move it to terminal `manual_receipt_recorded` only
when the same transaction accepts authorized already-collected manual evidence,
records the corresponding receipt/completion result, proves lease absence, and
revalidates `capture_authority_kind='noncapturable_by_construction'`. A typed
evidence conflict may move it to `manual_evidence_review_required`; no other
ordinary attempt transition leaves either terminal/review state. One private
`manual_payment_evidence_resolutions` ledger provides the sole reconciliation-
only exception. Its immutable row binds attempt, conflicting evidence/review,
expected attempt and review versions, selected evidence hash, actor and permission
snapshot, reason, stable idempotency key, and resulting receipt/completion IDs.
An authorized maker/checker resolver locks that row plus the attempt, evidence,
order, and receipt identity in the global hierarchy; revalidates tenant access,
staff permission, lease absence, the manual capture-authority tag, exact review
version, and that no receipt result already exists; then CASes
`manual_evidence_review_required -> manual_receipt_recorded` in the same
transaction that records the reviewed receipt/completion result. Replay reloads
the exact result. Unauthorized, stale, duplicate, changed-evidence, or divergent
resolution attempts fail closed without a second receipt, while the original
conflict and resolution history remain append-only. Database predicates forbid this
branch from provider-only initialized/pending/approved/failed states, expiry,
switching, revocation, supersession, or successor-session transitions.
An application label, synthetic provider namespace, popup closure, or locally
terminal state cannot choose this branch. Deferred checks tie the branch to the
attempt kind, initiation authority, evidence source, lease absence, and receipt
origin. A manual bank-transfer request that may receive money later is therefore
an `external_session` (or receiving-intent) contract, not a shortcut around
external finality.

### Provider routing generations and reference bindings

A private, endpoint-scoped `payment_ingress_contract_generations` registry owns
the immutable signature-key identity, endpoint, authority classifier, parser and
normalized-envelope schema version, activation/drain times, and replay-compatible
successor. It is available before tenant or attempt resolution and never grants
financial authority. Its generation is what an inbox row records at ingress;
the attempt routing generation remains a separate post-binding decision.

The registry enforces one active ingress generation per provider endpoint,
signature-key scope, and classified authority. Activation, draining, rollback,
and retirement are compare-and-set transitions with immutable transition
receipts. A rolling deployment may dual-parse only during a declared overlap in
which both generations prove the same stable provider-event replay identity and
normalized-envelope equivalence contract. The inbox unique key is independent
of parser generation. Concurrent old/new parsers inserting the same event reload
the database winner; equivalent envelopes attach parser evidence, while a
normalized-envelope disagreement enters conflict review instead of returning a
uniqueness error or creating a second row. Retirement requires the declared
redelivery drain, zero unsupported queued rows, replay/equivalence evidence, and
rollback retention of every parser needed for acknowledged rows.

#### Exact Stage 0 ingress-generation schema contract

The first implementation slice creates only the empty private generation registry
and its new-table constraints, indexes, comments, RLS, and ACLs. It creates no role,
policy, function, trigger, seed, active generation, public RPC, route wiring, or
legacy-object mutation. These names and types are frozen for that slice so its
implementation does not invent a contract:

`private.payment_ingress_contract_generations` has:

- `id uuid primary key default gen_random_uuid()`;
- canonical scope keys `provider text`, `endpoint_key text`,
  `signature_key_scope text`, and `authority_key text`, all non-null;
- `signature_key_identity_id uuid not null`, an opaque non-secret key/config
  identity that cannot store signing-secret or ciphertext text;
- `generation bigint not null`, `parser_contract_version text not null`,
  `parser_artifact_sha256 text not null`,
  `normalized_envelope_schema_version text not null`, and
  `replay_identity_contract_version text not null`;
- `status text not null default 'staged'` and
  `control_version bigint not null default 1`;
- nullable `activated_at`, `draining_at`, and `retired_at` timestamptz values;
- nullable `successor_generation_id uuid`; and
- `created_at timestamptz not null default now()`.

The four canonical scope keys match
`^[a-z][a-z0-9_.:-]{0,254}$`. Every text contract version is byte-preserved
but must equal its trimmed value, be non-empty, and contain at most 255 characters.
`generation` and `control_version` are positive. Status is exactly
`staged | active | draining | retired`, with these database-enforced shapes:

- `staged`: all lifecycle timestamps and successor are null;
- `active`: only `activated_at` is non-null and successor is null;
- `draining`: activation and drain are non-null, retirement is null, and successor
  is non-null; and
- `retired`: all three lifecycle timestamps and successor are non-null.

Later timestamps cannot precede earlier timestamps. The successor differs from
the row. Uniqueness on `(provider, endpoint_key, signature_key_scope,
authority_key, generation)` owns a scope generation, while a redundant unique
target `(id, provider, endpoint_key, signature_key_scope, authority_key)` supports
same-scope composite foreign keys. A second redundant target that appends
`parser_artifact_sha256` supports proof-to-artifact equality. A deferrable,
initially deferred composite
self-reference from `(successor_generation_id, provider, endpoint_key,
signature_key_scope, authority_key)` to that target forbids cross-scope
succession. A partial unique index on non-null `successor_generation_id` forbids
two predecessors for one successor. A second partial unique index on
`(provider, endpoint_key, signature_key_scope, authority_key) where
status='active'` permits at most one active generation per ingress scope. The
only ordinary lookup index is that scope followed by `status, generation desc`.

`parser_artifact_sha256` is exactly 64 lower-case hexadecimal characters.
`generation` is not an arbitrary label: it is a strictly increasing, never-reused
sequence within the four-key scope. The empty schema slice cannot allocate it.
Before any row may be created, the separately reviewed guarded creation function
must take the scope advisory lock, derive
`coalesce(max(generation), 0) + 1` with checked
overflow handling, and insert that value; the guarded transition function must
also require every incoming generation to be greater than its outgoing generation.

The chain is forward-only. Core scope, key identity, generation, contract-version,
and creation fields never change. Later guarded CAS may change only lifecycle
state, increment `control_version` by one, set each lifecycle timestamp once, and
install the one previously-null successor while entering `draining`. Neither a
draining nor retired row can reactivate, and no timestamp can be cleared. A
rollback therefore creates a new staged generation whose immutable parser/replay
contracts are proven compatible with the retained earlier artifact, drains the
current active generation, and activates that new forward generation. It never
moves an old row backward or rewrites history.

Before any generation-creation writer or row exists, a later companion migration
creates the reviewed non-secret signature-key-identity catalog and adds a foreign
key from `signature_key_identity_id`. The catalog exposes only UUID identity,
provider/account/endpoint scope, public key/config fingerprint, and immutable
revision metadata; it cannot store secret, ciphertext, credential, or raw key
bytes. The guarded creator derives the UUID from that catalog and never accepts it
as caller-selected authority. That catalog and writer are not part of Task 1.

#### Later Stage 0 companion slice — proofs, receipts, and guarded writers

The following relations and functions are explicitly excluded from Task 1 and
land together only after their own RED tests. They are specified here for the
later companion slice, not as instructions to create or test them in the first
registry migration.

`private.payment_ingress_contract_transition_receipts` is one append-only receipt
per atomic scope operation, not one row per mutated generation. It has:

- retry-stable `operation_id uuid primary key` and the same four non-null canonical
  scope keys;
- `operation_kind text not null`, exactly
  `initial_activate | roll_forward | rollback | retire`;
- nullable outgoing CAS columns `outgoing_generation_id uuid`,
  `outgoing_expected_control_version bigint`,
  `outgoing_result_control_version bigint`, `outgoing_from_status text`,
  `outgoing_to_status text`, expected/result `activated_at`, `draining_at`, and
  `retired_at` timestamptz snapshots, and expected/result
  `successor_generation_id uuid` snapshots;
- the identical nullable incoming CAS column set prefixed `incoming_`;
- `actor_kind text not null`, nullable `actor_user_id uuid` referencing
  `auth.users(id) on delete restrict`, and non-null `actor_reference text`,
  `approval_reference text`, `evidence_reference text`, `evidence_sha256 text`,
  `metrics_snapshot jsonb default '{}'::jsonb`, `reason_code text`, and
  `recorded_at timestamptz default now()`, with every field in this final group
  except `actor_user_id` non-null.
- nullable `compatibility_basis_generation_id uuid` and
  `compatibility_proof_id uuid`.

Each present branch has positive expected/result control versions with result
exactly expected plus one. Its expected and result timestamps satisfy the
corresponding registry status shapes; an already-set timestamp is identical in
both images and a newly set transition timestamp equals the receipt's single
`recorded_at`. `outgoing_generation_id` differs from a present incoming ID.
Deferrable, initially deferred composite foreign keys bind both generation IDs and
every present expected/result successor ID to the receipt's exact scope. Partial
unique indexes on `(outgoing_generation_id,
outgoing_expected_control_version)` and `(incoming_generation_id,
incoming_expected_control_version)` prevent two operations from claiming the same
row version. A scope plus `recorded_at desc` index supports audit lookup.
`compatibility_basis_generation_id`, when present, has the same deferrable
same-scope composite FK and differs from the incoming generation.

Rollback receipts cannot exist until a later append-only migration creates
`private.payment_ingress_parser_compatibility_proofs`. That immutable registry has
`id uuid primary key default gen_random_uuid()`, the four canonical scope keys,
non-null `basis_generation_id uuid` and `candidate_generation_id uuid`, their
non-null lower-case 64-hex `basis_parser_artifact_sha256` and
`candidate_parser_artifact_sha256`, non-null trimmed/bounded
`normalized_envelope_equivalence_contract_version` and
`replay_identity_equivalence_contract_version`, lower-case 64-hex
`verifier_artifact_sha256`, `corpus_manifest_sha256`, and `proof_sha256`,
`result text not null check (result='compatible')`, non-null
`approved_by uuid references auth.users(id) on delete restrict`, trimmed non-empty
`approval_reference text` of at most 512 characters, and
`created_at timestamptz not null default now()`.

Both generation IDs and their repeated artifact hashes use deferrable composite
foreign keys to the generation target that includes scope and
`parser_artifact_sha256`; they must differ. Redundant uniqueness on `(id, provider, endpoint_key,
signature_key_scope, authority_key, basis_generation_id,
candidate_generation_id)` is the receipt FK target; uniqueness on the scope,
basis, candidate, both equivalence-contract versions, verifier artifact, and
corpus manifest prevents duplicate proof identities. The basis/candidate artifact
hashes must equal those immutable generation rows. The proof hash is SHA-256 over
the UTF-8 RFC 8785 canonical JSON object containing exactly the scope, both
generation IDs and artifact hashes, both equivalence-contract versions, verifier
artifact hash, corpus-manifest hash, result, approver, and approval reference.
Proofs are append-only, never deleted, forced-RLS private rows with no policy or
direct `PUBLIC`/`anon`/`authenticated`/`service_role` privileges; their approved
offline verifier artifact and corpus are retained at least as long as any proof,
generation, acknowledged inbox row, or receipt references them.

The receipt's `(compatibility_proof_id, scope, compatibility_basis_generation_id,
incoming_generation_id)` has a deferrable composite FK to that proof target.
`roll_forward` and `rollback` require the proof and basis; `initial_activate` and
`retire` forbid both. The future transition writer reloads the proof, basis, and
candidate generations, requires the proof basis to equal the outgoing generation,
checks their artifact hashes and scope against the proof, and rejects any proof
whose verifier artifact, corpus manifest, equivalence-contract versions,
approval, or retention is not active in the separately reviewed deployment
attestation. The proof registry, receipt table, deployment-manifest binding,
attestation root, and guarded writers land together in a later RED-first slice
before any transition is callable; none belongs to the first generation-registry
slice.

Receipt shape is exhaustive:

- `initial_activate` has no outgoing branch; incoming is `staged -> active`, its
  expected timestamps/successor are null, only result activation is set, and both
  compatibility fields are null;
- `roll_forward` and `rollback` both record outgoing `active -> draining` with
  activation retained, drain set, and successor changing from null to the incoming
  generation, plus incoming `staged -> active` with only result activation set;
  both operations require non-null compatibility fields and bind the incoming
  parser artifact/contract to the retained basis generation through the immutable
  compatibility proof; the later guarded writer validates that proof against its
  proof registry row and pinned deployment-manifest binding before changing either
  generation;
- `retire` has no incoming branch; outgoing is `draining -> retired`, retains
  activation, and successor, sets only retirement, and has both compatibility
  fields null. Only `initial_activate` and `retire` forbid compatibility fields;
  `roll_forward` and `rollback` require them.

`actor_kind` is `operator | service | migration`; `actor_user_id` is non-null if
and only if the actor is an operator. Actor, approval, and evidence references are
trimmed, non-empty, and at most 512 characters. `evidence_sha256` is exactly 64
lower-case hexadecimal characters, `metrics_snapshot` is a JSON object, and
`reason_code` matches `^[a-z][a-z0-9_]{0,63}$`. The receipt itself does not
authorize parsing, acknowledgement, routing, or money.

In its own slice, every generation, proof, receipt, and non-secret identity table
enables and forces RLS, defines no policy, and revokes every table
privilege from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Existing
private-schema privileges remain unchanged. Future narrowly granted
`SECURITY DEFINER` functions are the only intended access path; Task 1 adds none,
while the later companion may add dormant private implementation functions plus
dedicated-schema wrappers under the dedicated control-plane role frozen below.
Before the first writer, each such function is owned by `postgres`, declares
`SECURITY DEFINER SET search_path = ''`, is revoked from `PUBLIC`, `anon`, and
`authenticated`. Only the dedicated-schema wrapper receives `EXECUTE` for
`payment_control_plane`; the role receives no `USAGE` on `private`, so unrelated
private-schema functions remain unreachable. The implementation writer rejects
 a caller whose `current_setting('role', true)` is not exactly
`payment_control_plane`, validates the immutable actor/approval/evidence
authorization inside the function, names every object with
its schema, and exposes no dynamic SQL. `service_role` retains no direct table
privilege; the `postgres` definer is the deliberate RLS-bypassing owner. No other
definer or table owner is authorized, and these ownership/grant conditions are a
pre-activation migration contract.
Task 1 comments identify the registry as pre-tenant/non-financial, the signature
identity UUID as unbound until its reviewed non-secret catalog FK lands, the
authority key as a classifier rather than a grant, and the successor as same-
scope/forward-only. Later-slice comments identify each receipt as append-only CAS
evidence and the metrics snapshot as audit data rather than authority.

The empty Task 1 schema tests prove the generation registry's exact catalog shape/
defaults/checks/FKs/indexes/comments, emptiness, forced RLS and denied direct
privileges; valid and invalid stored registry shapes; one active row per scope;
same-scope succession; and cross-scope, fork, duplicate scope-generation, malformed
canonical key/version/hash, lifecycle-shape, and timestamp-order rejection. They
also prove the migration adds no receipt/proof/key-identity catalog, seed, function,
role, grant, trigger, public/legacy mutation, provider-response, or production
behavior change.

The later companion slice separately tests duplicate operations, actor/hash/JSON/
reason constraints, malformed rollback basis/proof, proof/artifact/catalog FKs,
and receipt shapes. It does not claim that declarative
constraints can compare a receipt with registry before/after images or stop the
table owner from rewriting history. Those temporal/atomic guarantees—including
immutable core fields, append-only receipts, timestamp write-once behavior,
scope-monotonic allocation, `draining -> active` rejection, receipt-to-row snapshot
equality, and a rollback that drains B while activating a new B-compatible C—must
first go RED and then pass in the guarded creation/CAS writer slice before any
writer grant or active row exists.

#### Task 2 companion contract freeze (2026-08-01)

This amendment freezes the later Stage 0 companion so it can be implemented
without inventing authority. It supersedes the phrase "Stage 0 adds none" when
that phrase is read as applying to the companion: Task 1 adds no functions or
writers; this later companion may add dormant private control-plane functions,
but no production caller, active generation, provider route, webhook response,
acknowledgement, parser, money path, or deployment activation may use them.

The companion creates a dedicated `payment_control_plane` `NOLOGIN` database
role with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION` and
aborts if that role already exists, so residual ownership, ACLs, or memberships
cannot enter the executor surface. It is the only executable role for its
guarded functions. Its `USAGE` is limited to
the dedicated `private_payment_control_plane` schema, whose wrappers are the
only role-executable entry points; the role has no `USAGE` on `private`. A later reviewed deployment
credential may be granted membership in that role; the generic `service_role`
and every user-facing edge remain unable to execute the functions. Every new
table is private, forced-RLS, policy-free, and has all table privileges revoked
from `PUBLIC`, `anon`, `authenticated`, `service_role`, and
`payment_control_plane`; only the named functions receive `EXECUTE` for that
role. A reviewed privileged migration/DBA may repair history only through an
audited migration receipt; RLS is a runtime-role boundary, not a claim that a
`postgres` superuser cannot alter rows.

The non-secret identity catalog is
`private.payment_ingress_signature_key_identities` with exactly:

- `id uuid primary key default gen_random_uuid()`;
- `provider text`, `endpoint_key text`, and `signature_key_scope text`, all
  non-null and using the same canonical key expression as the generation table;
- `identity_revision bigint not null check (identity_revision > 0)`;
- `identity_kind text not null check (identity_kind in
  ('public_key','shared_secret_config'))`;
- `material_fingerprint text not null check
  (material_fingerprint ~ '^[0-9a-f]{64}$')`;
- `provenance_reference text not null` (trimmed, non-empty, at most 512
  characters); and
- `created_at timestamptz not null default now()`.

The fingerprint is an externally computed SHA-256 of approved non-secret public
material (`public_key`) or a provider configuration revision descriptor
(`shared_secret_config`); it is never a digest of a secret, ciphertext,
credential, or raw key. The catalog is immutable and unique on
`(provider, endpoint_key, signature_key_scope, identity_revision)`. Redundant
unique targets `(id, provider, endpoint_key, signature_key_scope)` and
`(id, provider, endpoint_key, signature_key_scope, identity_revision)` receive
deferrable `ON DELETE RESTRICT` foreign keys from the existing generation row and
deployment binding respectively. The existing generation row's target is
`(signature_key_identity_id, provider, endpoint_key, signature_key_scope)`;
`authority_key` remains only a classifier and is deliberately not part of key
identity scope. A retired scope is permanently closed; no initial-activation
writer may reopen a scope with prior retired history.

The companion adds an immutable, externally attested deployment binding,
`private.payment_ingress_deployment_manifest_bindings`. Its exact fields are
`id uuid primary key default gen_random_uuid()`, `environment text not null`,
`provider text not null`, `endpoint_key text not null`, `signature_key_scope
text not null`, `authority_key text not null`, `signature_key_identity_id uuid
not null`, `identity_revision bigint not null`, `attestation_id uuid not null`,
`parser_contract_version text not null`,
`normalized_envelope_schema_version text not null`,
`replay_identity_contract_version text not null`,
`parser_artifact_sha256 text not null`, `manifest_sha256 text not null`,
`attestation_sha256 text not null`, `verifier_artifact_sha256 text not null`,
`corpus_manifest_sha256 text not null`,
`normalized_envelope_equivalence_contract_version text not null`,
`replay_identity_equivalence_contract_version text not null`,
`provenance_reference text not null`, `approval_reference text not null`,
`retention_until timestamptz not null`, and `created_at timestamptz not null
default now()`. `environment` matches `^[a-z][a-z0-9_.:-]{0,63}$`; all four
scope keys use the generation-table expression; `identity_revision > 0`; all
hashes are lower-case 64-hex; all version fields are trimmed and bounded to
255 characters; and approval/provenance references are trimmed, non-empty, and
at most 512 characters. Deferrable composite FKs bind
`(signature_key_identity_id, provider, endpoint_key, signature_key_scope,
identity_revision)` to the identity catalog's revision target and
`(attestation_id, environment, manifest_sha256, attestation_sha256)` to the
attestation root. The binding stores metadata only, never artifact bytes or
secrets. It is append-only, uniquely identified by `(environment,
manifest_sha256, attestation_sha256, provider, endpoint_key,
signature_key_scope, authority_key, parser_artifact_sha256)`, and is accepted
by a writer only while the pinned external attestation is active and
`retention_until > clock_timestamp()`.

The pinned external attestation is represented by the append-only
`private.payment_ingress_deployment_attestations` root. Its exact fields are
`id uuid primary key default gen_random_uuid()`, `environment text not null`,
`manifest_sha256 text not null`, `attestation_sha256 text not null`,
`verified_by text not null`, `approval_reference text not null`,
`verified_at timestamptz not null`, `retention_until timestamptz not null`,
`revoked_at timestamptz`, `revocation_reference text`, and `created_at
timestamptz not null default now()`. `revoked_at` is write-once and may be set
only by the same reviewed privileged deployment migration that records a
non-empty `revocation_reference`; runtime roles and the companion functions can
never mutate it. This is the explicit privileged-DBA exception to runtime
append-only history. A named check requires
`revoked_at IS NULL` if and only if `revocation_reference IS NULL`; when present,
the reference is trimmed, non-empty, and at most 512 characters. No later
update may clear or rewrite either field. The companion owns the exact
`private.payment_ingress_deployment_attestations_write_once` `BEFORE UPDATE`
trigger guard: it permits only the first null→non-null revocation pair and
rejects every later update or any change to either value.
It has a redundant unique target on
`(id, environment, manifest_sha256, attestation_sha256)` for the binding FK.
The root, identity catalog, binding, and proof rows are populated only by that
same reviewed privileged deployment migration, which carries the external
signed-attestation receipt; no runtime edge or generic `service_role` may
insert, update, revoke, or delete them. A binding carries
`attestation_id uuid not null` and a deferrable composite FK to
`(id, environment, manifest_sha256, attestation_sha256)` on the root. A binding
is active exactly when its root has `revoked_at IS NULL` and both the root and
binding `retention_until` values exceed `clock_timestamp()`; the transition
writer reloads both rows under lock. The reviewed privileged deployment
migration is responsible for translating an externally invalid attestation into
the write-once revocation update. This is the authoritative database predicate
rather than a hash-shaped text field. The companion migration creates no root,
catalog, binding, or proof rows;
SQL fixtures may create and roll them back as the `migration` actor only.

Parser equivalence proof is required for every two-sided parser overlap:
`roll_forward` and `rollback` both require an approved proof; only
`initial_activate` and `retire` forbid proof fields. The proof registry keeps
the named fields and composite same-scope/artifact foreign keys already frozen
above, adds explicit bounds of 255 characters to both equivalence-contract
versions, makes the generation pair canonical in ascending generation order,
and requires a unique proof identity on scope, basis/candidate generations,
equivalence versions, verifier artifact, and corpus manifest. `proof_sha256` is
computed by the pinned offline RFC 8785 verifier artifact identified by the
deployment binding; PostgreSQL validates the exact bound fields and hash shape,
not a false `jsonb::text` approximation of RFC 8785.

Staged creation is a first-class idempotent operation. The companion adds
`private.payment_ingress_contract_creation_receipts` with `operation_id uuid
primary key`, `request_fingerprint text not null` containing exactly 64
lower-case hex characters, the approved deployment-binding
ID, the derived generation ID/number, scope, and `recorded_at`. The guarded
creator accepts only an approved binding ID and operation ID, takes the scope
advisory lock, allocates `max(generation)+1` with checked bigint overflow, and
derives every generation field and identity UUID from the binding. Replaying the
same operation and fingerprint returns the original staged row; a changed
fingerprint fails with SQLSTATE `PT409` and no mutation. There is no
caller-selected generation, identity UUID, parser artifact, timestamp, actor,
or approval authority.

Transition receipts add a non-null `deployment_binding_id` for every operation
with an incoming branch and retain it for audit, plus a non-null
`request_fingerprint text` containing the exact 64-hex hash of operation kind,
scope, generation IDs, expected control versions, binding ID, proof ID, and the
attested actor/evidence tuple. The writer derives `actor_kind`, actor/reference,
approval/evidence references, `evidence_sha256`, and `metrics_snapshot` from the
locked attestation root and binding; none is caller-selected. `initial_activate` is the only
incoming operation with no outgoing branch; `roll_forward` and `rollback` are
atomic `active -> draining` plus `staged -> active` operations with strictly
increasing generations and an approved compatibility proof whose basis is the
outgoing generation; `retire` is
`draining -> retired` and is permanently rejected until the later inbox,
redelivery-horizon, unsupported-row, and artifact-retention gates exist. The
guarded transition functions are exactly:

- `private.create_payment_ingress_contract_generation(operation_id uuid,
  deployment_binding_id uuid)`;
- `private.activate_payment_ingress_contract_generation(operation_id uuid,
  generation_id uuid, expected_control_version bigint,
  deployment_binding_id uuid)`;
- `private.roll_forward_payment_ingress_contract_generation(operation_id uuid,
  outgoing_generation_id uuid, expected_control_version bigint,
  deployment_binding_id uuid, compatibility_proof_id uuid)`;
- `private.rollback_payment_ingress_contract_generation(operation_id uuid,
  outgoing_generation_id uuid, expected_control_version bigint,
  deployment_binding_id uuid, compatibility_proof_id uuid)`; and
- `private.retire_payment_ingress_contract_generation(operation_id uuid,
  outgoing_generation_id uuid, expected_control_version bigint,
  deployment_binding_id uuid)`.

These five private writers are implementation functions, not the credential
surface. The companion exposes same-signature wrappers in
`private_payment_control_plane`, grants `EXECUTE` only to those wrappers for
`payment_control_plane`, and grants that role no `USAGE` on `private`.

Each returns `(operation_id uuid, generation_id uuid, generation bigint,
control_version bigint, replayed boolean, result_code text)`. Every function
reloads the operation first, compares an immutable request fingerprint, takes
the one scope advisory lock, locks involved rows in generation order, validates
the binding/proof/retention/actor facts, performs the CAS, inserts the complete
before/after receipt, and commits all mutations together. The only successful
result codes are `created`, `activated`, `rolled_forward`, `rolled_back`,
`retired`, and `replayed`; stale versions, non-monotonic or overflowed
generations, `draining -> active`, timestamp clearing, successor replacement,
cross-scope IDs, proof/binding mismatch, permanently closed scopes, and every
retire call before its later gates fail closed. Function execution is dormant
until a later activation receipt grants the dedicated role.

Receipt actor/evidence fields are mechanically derived: `actor_kind` is always
`service`, `actor_user_id` is null, `actor_reference` is the literal
`payment_control_plane`, `approval_reference` is the binding's approval
reference, `evidence_reference` is the attestation root's attestation hash,
`evidence_sha256` is that same attestation hash, `reason_code` is the lower-case
operation kind, and `metrics_snapshot` is exactly the empty JSON object. The
creation receipt stores the same request fingerprint and binding ID; a transition
receipt stores it alongside the complete CAS images. These values are never
accepted from a caller.

A private `payment_authority_routing_generations` registry owns provider,
provider-account/endpoint scope, completion-authority key, monotonically
increasing generation, processor contract/version, adapter/identity contract,
status, issuance start/stop times, predecessor/successor, and immutable timing-
policy version. Generations are never deleted or reassigned. Status controls new
issuance, while an already-issued attempt permanently retains its generation.

A private `payment_attempt_reference_bindings` table provides the indexed ingress
locator that one `provider_session_id`/`provider_reference` pair cannot. Each row
records attempt, provider/account/authority/generation, immutable lookup
namespace and normalized reference key, reference kind (`signed_session`,
`popup_transaction`, `provider_reference`, `superseded_reference`, or reviewed
provider-specific kind), discovery source/evidence, effective/retired time, and
timestamps. A scoped unique constraint permits one reference key to resolve to
only one attempt/generation in a provider lookup namespace. Retiring or
superseding a binding closes it once but never deletes it; delayed money can
still resolve historical bindings.

Initialization inserts the attempt and its initial binding atomically. A later
verified popup or webhook reference is installed or reloaded under the order,
attempt, and reference-family lock before financial processing. Credit Direct's
metadata/order fallback may propose an unpersisted popup binding only when the
current signed session, order, provider account, event time, superseded set, and
amount all revalidate; the database atomically elects the binding. Ambiguous or
conflicting proposals create review evidence and cannot choose a processor.
Ingress durably records the signature-verified envelope under its immutable
ingress contract generation before acknowledgement, even when an attempt binding
cannot yet be resolved. A worker handling an order-attempt event must resolve
exactly one binding and its pinned attempt generation before selecting a
financial processor. A receiving-intent or safely unattributed provider-account
receipt does not fabricate an attempt; it must instead create the typed financial
routing proposal whose accepted resolution is elected by the receipt transaction
as defined below. Zero or ambiguous routing candidates remain
acknowledged durable quarantine/review evidence and cannot write money. Order-
note search may remain shadow/backfill evidence but is not the canonical router.

### Financial routing proposals and resolutions

Every verified money-bearing ingress first freezes its child manifest and creates
or reuses one immutable financial source proof per manifest child. Every child
source proof, or the singleton source proof for a non-webhook provider-
verification command, creates or reuses exactly one immutable
`payment_financial_routing_proposal` before receipt recording. The parent inbox
and manifest are replay containers, never routing or money-writing units. A
proposal records the verified child source identity, provider/account
scope when known, candidate target, candidate completion authority and routing
generation, policy versions, candidate snapshot, reason, and proposal timestamp.
It does not contain an accepted canonical receipt identity or authorizing-evidence
link, cannot select a financial processor, and grants no money, allocation,
settlement, inventory, order, or fulfilment authority. Zero or ambiguous
candidates produce a typed unattributed/conflict proposal rather than an accepted
route.

Each child receipt transaction converts exactly one eligible child proposal into
one immutable
`payment_financial_routing_resolution`. This database-enforced tagged union has
exactly one target:

- `order_attempt`, with one attempt reference binding and its immutable
  completion authority and attempt routing generation;
- `receiving_intent_epoch`, with one eligible epoch and its immutable completion
  authority and routing generation; or
- `unattributed_provider_account`, with the verified provider/account namespace
  and the immutable provider-account authority epoch effective for the event.

The resolution stores the canonical receipt/event identity, authorizing evidence,
provider/account scope, merchant when safely known, completion-authority key,
routing generation, processor contract/version, timing-policy version, routing
reason, candidate snapshot, and decision timestamp. Its constraints require the
selected target to belong to that authority/generation and forbid target or
policy mutation after acceptance. Exact attempt binding is mandatory only for
the `order_attempt` branch. The other branches can record confirmed money in an
intent or unattributed origin without an order, allocation, or fulfilment right.

Election occurs under the canonical receipt/reference resource lock. Before any
row lock, the receipt transaction reads the immutable child source proof and
proposal only to derive the complete canonical-family/advisory set; those reads
grant no authority. After it acquires and revalidates that full advisory set, it
locks any existing canonical identity and transaction rows before locking the
verified child source proof and proposal, following the global row hierarchy. A
missing canonical identity or transaction is represented by absence under the
already-held family advisory lock and is inserted only after source revalidation;
the family lock and scoped unique constraints prevent a competing insert, so no
later-class row lock is taken before an existing earlier-class row. The function
then creates or reuses the typed confirmation-evidence row pinned to the
proposal's authority/generation and atomically elects that evidence, the
accepted financial routing resolution, the receipt-origin resolution, origin,
transaction, and evidence link. None of those accepted records becomes visible
without the others. Equivalent concurrent proposals reload and corroborate the
winner; different targets, authorities, generations, or economic facts enter
conflict review and cannot select a processor. This sequencing accepts one
routing resolution per canonical identity and winning authorizing evidence
without requiring either accepted object to exist before the transaction that
creates both. A singleton webhook is the degenerate one-child manifest. For a
bounded multi-capture webhook, every child independently owns its source proof and
proposal. Every authorized child owns its receipt command, and every completed
child owns its canonical identity, evidence, resolution, origin, and transaction;
no parent-level proposal or command may be consumed by several children. The
inbox becomes financially terminal only after every immutable child is completed
or durably placed in review.

### Completion-authority rollout control

A private `payment_authority_rollouts` row is unique per provider/account/
completion-authority scope and owns `legacy | shadow | canary | active |
paused | draining | rollback` state, current issuance generation, monotonically
increasing control version, allowlist/cohort-policy checksum, threshold-policy
snapshot, shadow/canary observation window, stop reason, authorized actor, and
timestamps. Append-only transition receipts record expected prior version,
from/to state and generation, actor/approval, metrics snapshot, exact-reference
evidence, reason, and resulting version.

Only guarded database functions may transition rollout state. They use expected-
version compare-and-set and reject widening when required parity, latency, soak,
sample, exact-reference, unresolved-stop, or maker/checker evidence is absent.
Checkout issuance reloads and enforces the current rollout row before selecting
a generation. Financial workers reload it for stop/audit visibility, but
authorize an existing attempt from its immutable generation and binding rather
than the rollout's current issuance state. Cached flags may hide a payment option
or request a transition, but cannot grant money-writing or issuance authority.
A stop transition atomically prevents new canary issuance while leaving existing
attempt bindings and their compatible completion path unchanged.

Shadow parity is source-complete rather than evaluator-reported. Private
`payment_shadow_comparison_manifests` and child census rows are created only by
the generation-aware legacy boundary from a database-selected cohort. Each child
owns immutable authority/generation, evaluator kind, safe input hash, approved
evaluator-artifact checksum, input-schema generation, legacy outcome hash/status,
eligibility reason, and expected observation cardinality.
The shadow role cannot create, exclude, or change census rows or legacy outcomes;
direct table insert is revoked and it may attach exactly one typed observation
only through a guarded insert. The observation has a composite foreign key or
equivalent deferred equality constraint binding its child ID, authority,
generation, evaluator kind, safe input hash, artifact checksum, and input-schema
generation to that exact immutable census-child tuple. The guarded insert locks
the child, derives the immutable tuple and approved runtime attestation rather
than trusting caller-selected binding fields, and rejects any cross-child,
cross-authority, cross-generation, evaluator-kind, input-hash, artifact, or schema
mismatch. Uniqueness on child ID enforces cardinality only; it is never accepted
as binding proof. Missing,
failed, timed-out, duplicate, version-mismatched, or input-hash-mismatched
observations remain explicit denominator failures rather than disappearing from
the sample. Exclusion requires an enumerated predeclared reason plus a separate
maker/checker decision and remains visible in both gross and eligible counts.
Shadow instrumentation is fail-open for the legacy production result but fail-
closed for rollout: census dispatch/write, legacy-outcome attachment, or evaluator
failure cannot change the legacy response/acknowledgement or roll back its money/
order work. Every window reconciles its database census against independently
owned authority-route invocation and legacy-outcome counters/source rows that the
shadow role cannot write. A missing census row, unattached legacy outcome, or
counter mismatch is an explicit capture gap and blocks closure/widening; it is
never inferred as parity. Thus source completeness is a rollout property without
making shadow availability part of the live payment availability path.

A guarded rollout-receipt function computes coverage, parity, latency, exclusions,
and every zero-tolerance disagreement directly from frozen census/observation
rows for one closed window. It accepts only observations carrying the approved
pure-evaluator artifact checksum and input-schema generation; the checksum is tied
to the reviewed build/deployment attestation. The transition cannot accept caller-
supplied aggregate numbers. Widening requires the configured minimum gross and
eligible sample, the declared coverage threshold (100% for zero-tolerance money/
authority classes), no missing required observations, and no unresolved source or
artifact mismatch. Maker/checker approval cannot override a zero-tolerance or
coverage failure; it can only approve an explicitly permitted exclusion already
counted in the receipt.

Every authority-bearing issuance operation—attempt creation, receiving-intent-
epoch creation/succession, provider-account-authority-epoch creation/succession,
and purchase-intent nonce issuance—uses one explicit control-plane precursor.
Provider authority uses its rollout row; nonce issuance uses the private checkout
request-contract control row. Before acquiring any order, collision, intent,
provider-reference, or other financial advisory/row lock, it locks the applicable
control row, validates its expected control version, and snapshots the selected
generation; external-session attempt issuance also snapshots the matching active
capture-finality contract FK and conformance receipt, while the guarded
noncapturable-by-construction branch proves its forbidden session/lease shape. It
then inserts or succeeds the authority-bearing record under the
ordinary financial hierarchy in the same transaction. Each operation has a
stable issuance idempotency key and reloads the elected row on concurrency.
No path holding an order or other financial lock may subsequently acquire a
rollout or checkout-contract control row. A control transition locks only its
control row and never waits
on an order. Ordinary financial completion does not lock that mutable control row
or require the current issuance state to remain `canary`: it validates the
immutable generation registry and binding, so an attempt issued before `paused`,
`draining`, or `rollback` may still finish on its compatible processor. If that
processor is unavailable or unsafe, completion preserves the verified event and
enters review rather than switching generations. This one-way dependency avoids
control-plane/order deadlocks and makes stop-versus-issuance linearizable.

Provider switching obtains the order and collection-lease locks. Any old attempt
with an initialized external session/reference must have matching
`payment_attempt_noncapturability_evidence`; every old attempt must be made locally
non-actionable before the new lease is published. If the old attempt has
`provider_customer_approved`,
verified possible-capture protection, or cannot be made non-actionable under its
reviewed provider contract, ordinary switching is denied until confirmation,
expiry, cancellation, or reconciliation. Baci does not deliberately expose two
chargeable sessions as a normal “bounded handoff.” Late verified captures from
a revoked, expired, or superseded reference still follow the terminal-attempt
review contract below.

Manual and internal rails use reviewed synthetic namespaces such as
`manual:<merchant_id>` and `wallet:<merchant_id>`; they never place credentials,
email addresses, or user-supplied labels in `provider_account_id`.

Attempt states:

- `created`
- `provider_pending`
- `provider_customer_approved`
- `provider_confirmed`
- `partially_succeeded`
- `succeeded`
- `failed`
- `expired`
- `superseded`
- `review_required`
- `manual_evidence_pending`
- `manual_evidence_review_required`
- `manual_receipt_recorded`

No client request can write `provider_customer_approved`, `provider_confirmed`,
`partially_succeeded`, or `succeeded`.
Database checks and generated API/shared payload unions discriminate status by
`capture_authority_kind`: external attempts cannot emit a manual status, manual
attempts cannot emit a provider status, and request payloads cannot select either
status family. Customer-safe projections map `manual_evidence_pending`,
`manual_evidence_review_required`, and `manual_receipt_recorded` explicitly rather
than relabeling them as provider pending, failed, or succeeded.

Allowed transitions are compare-and-set operations enforced by the database:

- `created -> provider_pending | failed | expired | superseded`;
- `provider_pending -> provider_customer_approved | provider_confirmed | failed |
  expired | superseded | review_required`;
- `provider_customer_approved -> provider_confirmed | failed | expired | superseded |
  review_required`;
- `provider_confirmed -> partially_succeeded | succeeded | review_required`;
- `partially_succeeded -> partially_succeeded | succeeded | review_required`
  only for a `bounded_multi_capture` attempt while the conserved linked gross
  remains within its immutable authorized collection amount;
- `review_required -> provider_confirmed | partially_succeeded | succeeded |
  failed` only through an authorized reconciliation decision with actor and
  reason;
- `manual_evidence_pending -> manual_receipt_recorded |
  manual_evidence_review_required` only for
  `capture_authority_kind='noncapturable_by_construction'` under the authorized
  already-collected evidence CAS described above;
- `manual_evidence_review_required -> manual_receipt_recorded` only through the
  private expected-version, maker/checker-authorized manual-evidence resolution
  ledger and atomic reviewed receipt/completion transaction described above;
- `manual_evidence_review_required` is terminal for every ordinary transition and
  `manual_receipt_recorded` is fully terminal;
  manual states are forbidden for `external_session`, and every provider,
  expiry, revocation, switching, supersession, or successor-session transition
  is forbidden for the manual branch;
- `succeeded`, `failed`, `expired`, and `superseded` are terminal for ordinary
  attempt updates.

A verified capture for a terminal failed, expired, or superseded attempt does
not move that attempt backward. It records the confirmed transaction while the
attempt remains terminal, and the linked reconciliation case enters
`review_required`. Only provider-signature-verified server routes may write
`provider_customer_approved` or `provider_confirmed`; only the completion function may write
`partially_succeeded` or `succeeded`.
Initialization callers may create attempts and perform the non-financial
pending transitions allowed for their actor class. The SDK-success wrapper may
write only `payment_sdk_possible_capture_evidence`, its matching non-money
authorization/corroboration evidence, its matching non-money protection claim or
`late_sdk_success`/`cross_order_collision_review` row, and the guarded
`sdk_success_reported_at` projection.

All canonical monetary comparisons use integer minor units and the ISO currency
exponent. Provider decimal or major-unit values are normalized once at the
adapter boundary with exact conversion; non-integral or unsupported precision
fails closed into review. Existing numeric ledger columns remain compatibility
projections until a separately reviewed migration proves conversion parity.

### Collection-contract epochs

Collection terms live in immutable, order-scoped epochs. Required fields include
`id`, `merchant_id`, `order_id`, monotonically increasing `epoch_number`, mode,
canonical payable amount and currency, `collection_due_at`, inventory-hold
policy, settlement-release policy, customer-terms version, `effective_from`,
`effective_to`, `supersedes_epoch_id`, creation actor/source, and reason.

The interval is half-open: `[effective_from, effective_to)`. Only one epoch may
be effective for an order at a time. Closing an epoch and creating its successor
happen under the order resource lock and global row hierarchy. Attempts and
allocations retain their epoch foreign key permanently. An expired or superseded
epoch cannot be edited or reactivated.
An extension is therefore a new promise with a new epoch, new inventory result,
and new attempt rather than a timestamp update.

### Order collection leases

An order-scoped lease row contains `order_id`, current actionable `attempt_id`,
monotonic generation, state, acquired/updated timestamps, revocation evidence,
and provider-policy key. The order ID is unique. Attempt creation, switching,
supersession, and lease generation changes occur under the order lock. Client
launch and provider-signing routes require the current generation so a stale
page cannot reopen an old charge session after a switch.

A private append-only `payment_provider_capture_finality_contracts` registry is
the database authority for external noncapturability semantics. Each immutable
generation is keyed by provider, provider account, completion authority, and
generation ID; stores processor/evidence-schema versions, approval and conformance-
test receipt checksums, effective interval, predecessor/successor, and
`shadow | active | draining | retired` state; and uses a database-enforced tagged
union:

- `hard_deadline` stores the immutable session-fact-to-deadline derivation,
  precision, clock source, and proof that no capture accepted, authorized, queued,
  or in flight before that instant can settle afterward;
- `verified_revocation_status` stores the authoritative verification/revocation
  evidence schema, allowed terminal status semantics, endpoint/adapter contract,
  and mandatory finality delay.

Exactly one generation may be active for new sessions in a provider/account/
authority scope. Activation requires maker/checker approval plus a matching
adapter conformance receipt; activation, rollback, and drain use expected-version
CAS under the same provider rollout row that precedes attempt issuance and never
change an issued attempt's FK. External-session attempt issuance snapshots the
active contract in that transaction; the noncapturable-by-construction branch is
ineligible for this registry and creates no
`payment_attempt_noncapturability_evidence` row. Evidence for an
`external_session` predecessor stores the same required non-null contract FK and
its derived deadline/status proof; deferred equality checks reject
cross-account, cross-authority, changed-delay, inactive-at-issuance, missing-
receipt, or unregistered policy claims. A retired generation remains verifiable
for its issued sessions throughout their finality and financial-retention horizon.

A private append-only `payment_attempt_noncapturability_evidence` row is the only
authority for superseding, replacing, or publishing a successor collection lease
against an initialized predecessor session. A separate-purchase nonce is not
noncapturability evidence and never changes that predecessor. The row stores
predecessor attempt, provider/account/authority, normalized provider session, evidence kind
`provider_revoked | contract_expired`, pinned capture-finality-contract FK,
provider proof/reference or exact database-evaluated expiry, verifier, and server
time. `provider_revoked` requires a verified provider acknowledgement under the
pinned adapter contract. `contract_expired` requires that contract's immutable
provider-side capture deadline—not merely an SDK/UI session TTL—a post-deadline
database clock, and a pinned reviewed hard-finality property proving no capture
accepted, authorized, queued, or in flight before that deadline can settle after
it. A deadline without that provider guarantee is never evidence. Providers
without hard deadline finality must use verified status/revocation that proves the
exact session has no captured or in-flight authority, plus any adapter-pinned
finality delay; if the provider cannot prove that state, switching remains blocked.
Uniqueness and a deferred
trigger reject mismatched attempt/session/authority or mutable local projections.
Popup closure, client time, lease revocation alone, a sent-but-unacknowledged
cancel request, and the 24-hour checkout cutoff can never populate this table.

Only a guarded provider-noncapturability function may create the row. It begins
from the predecessor's immutable registered finality contract, discovers the complete matching
order and collision closure plus provider-reference and canonical-receipt families
without row locks, acquires every order, sorted collision alias/domain,
provider-reference, and canonical-receipt advisory in the global hierarchy, and
revalidates the complete sets before taking rows in canonical order. Under those
same locks it rejects captured or in-flight capture/verification authority,
unclosed SDK possible-capture protection, a mismatched/unregistered finality
generation or absent conformance receipt, and any
revocation acknowledgement that merely blocks future requests. A
`provider_revoked` result requires the pinned adapter to prove that the exact
session cannot already have captured and has no provider-side capture in flight;
`contract_expired` linearizes only at or after the immutable provider capture
deadline plus its required finality delay and revalidates the pinned hard-finality
contract. Evidence creation and successor publication occur in
one transaction, or the evidence may pre-exist and be revalidated under the same
lock set. Capture/webhook/verification writers acquire these identical family
locks, so either capture wins and evidence is refused, or evidence wins and a
later capture is durable late-money review rather than a second authority.
Adapter conformance must reject a pre-deadline accepted capture whose webhook or
verification arrives after the nominal deadline; it defeats expiry evidence and
successor publication. A provider that cannot make this test impossible by
contract cannot enable the `contract_expired` branch.

### Checkout collision domains

A private `payment_checkout_collision_domains` row gives one collision-equivalent
commercial intent a database-owned opaque `collision_domain_id`; an explicit
nonce may authorize more than one intentional order inside it. The ID—not a mutable customer ID,
grant ID, email digest, or request-hash version—is the stable serialization
identity through the checkout reuse/protection horizon. A private append-only
`payment_checkout_collision_aliases` table binds that domain to every independently
proved subject/request representation: merchant, subject-alias kind and opaque
digest, request-contract generation, versioned exact server request hash, proof
authority, effective interval, and binding evidence. A unique alias can resolve to
only one domain. Raw email, OTP, bearer proof, and untrusted client hashes are
forbidden.

A private checkout request-contract registry and control row own immutable
`shadow | active | draining | retired` hash generations, equivalence mapper,
control version, activation/rollback evidence, maximum nonce lifetime, and
`nonce_compatibility_until`. Generation aliases are append-only. Nonce issuance
locks this control row before any financial lock and snapshots the active
generation plus complete commercial alias bundle. A retirement CAS, while
holding only that control row, must either prove zero grants—consumed or
unconsumed—whose expiry or idempotent-result replay horizon is still live, or
retain their alias bundles as nonce-lookup-only through the maximum of those
horizons plus pinned clock-skew/redelivery margin.
Consumption never acquires the control row; it uses the immutable issuance bundle
under ordinary collision locks. Thus retirement cannot invalidate an already
issued valid nonce, and aliases retained only for a nonce cannot bootstrap a new
checkout.

Every participating order, protected-checkout binding, separate-purchase grant,
and SDK possible-capture evidence stores a non-null foreign key to that domain.
The guarded create-order function installs the order/domain link in the same
transaction as first creation, and no route may retarget it. This lets an SDK
report start from its verified order/attempt and still resolve the same domain
when the caller's current subject or request-hash representation has changed.

The private append-only `payment_checkout_subject_equivalences` table owns
accepted identity bindings among authenticated-customer, signed tracking-proof,
and verified email-OTP aliases. It stores merchant, both opaque alias digests and
kinds, proof authority/evidence, verifier, and server time; a canonical sorted
pair is unique. Private subject-component root, membership, and succession rows
give every alias one active root and monotonic generation without rewriting an
old membership. One identity-only writer verifies both proofs, resolves both root
lineages, acquires their sorted
`checkout-subject-component:<merchant>:<opaque-root>:<generation>` advisories,
revalidates the bounded closures, and appends the edge. When roots differ it
creates one successor root containing the union and marks both predecessors
superseded; entry through an old alias always resolves that successor. It never
discovers orders, creates or merges a collision domain, projects request aliases,
freezes collection, or treats two purchases by that customer as equivalent.
Missing, conflicting, cross-merchant, generation-drift, or over-limit identity
proof enters typed identity review without financial authority; the initial
frozen limit is 256 aliases/edges in one subject component.

A separate guarded commercial-alias projection requires one frozen server-owned
commercial request identity in addition to the proved subject aliases. It derives
only that intent's active/draining request-generation aliases, discovers only
orders and collision domains matching that exact commercial identity, acquires
all matching order keys first and then the subject-component plus collision keys,
revalidates the subject generation and commercial alias bundle, and atomically
appends aliases. An identity-only zero-domain binding creates no domain; the
create-order function may create the first domain only from complete trusted
commercial facts. Two legitimate purchases by the same equivalent subject remain
independent.

Collision conflicts use private append-only `payment_checkout_collision_components`,
membership/succession, bridge, and adjudication rows. Every domain initially
belongs to one root with a monotonic component generation. Connecting two domains
never rewrites either domain or order foreign key: it records immutable bridge/
conflict evidence, freezes all affected members, and opens review. A database-
enforced adjudication union permits exactly:

- `confirmed_merge`, which requires the bridge, reviewed authority/evidence, one
  successor root, and immutable complete memberships for every prior member;
- `rejected_bridge`, which requires the bridge plus rejection reason/evidence,
  invalidates only that proposed commercial bridge, preserves the separate active
  roots, and releases each root's freeze only when no other collision/protection
  veto remains.

Both ordinary outcomes hold every affected order and root/member/domain/alias lock
through adjudication. Merge marks prior roots superseded and old roots are never
reactivated; rejection advances each unchanged root generation so waiting
operations revalidate. Create-order, SDK first-report,
rotation, switching, cleanup, equivalence projection, and reconciliation resolve
an input domain through the complete root succession to the active root, discover
all members/orders/aliases, acquire all order keys before the sorted subject-
component/root/member/domain/alias keys, and revalidate membership plus generation.
Drift aborts for a fresh bounded retry, so operations entering through either old
domain cannot resume on disjoint lock sets.

The frozen lock-set policy initially permits at most 64 authority-relevant orders
and 256 active subject/component/domain/alias entries for one commercial intent.
"Authority-relevant" is database-defined: an order remains active while checkout
reuse, result replay, a collection lease or attempt, a DVA assignment, a
separate-purchase grant, possible-capture/captured-money protection, replacement
authority, or another enumerated collection/reopening veto can still affect a
new collection decision. Historical financial/reference evidence is retained but
does not remain in the ordinary collection-authority lock closure forever. No
operation partially locks a larger active set: overflow freezes automatic
collection for that component and writes `collision_component_overflow`
quarantine for bounded operator resolution.

Overflow recovery is a separate platform-only, authority-fenced protocol rather
than the ordinary capped transaction. A private
`payment_checkout_collision_overflow_recoveries` anchor owns recovery ID, expected
source-root generations, monotonically increasing ingress/authority revision,
immutable snapshot checksum and snapshotted revision, staged decision, progress,
and final state. Its database-enforced decision union is `confirmed_merge |
rejected_bridge | compact_closed_authority_entries`. A root-only control transition
first installs that anchor and
marks the component `overflow_recovery_frozen`; it takes no order locks, so operations
already following order-first locking acquire the root later, observe the fence,
and abort. A recovery ID then keyset-scans immutable members into checksumed
snapshots and stages merge, rejection, or closed-authority-entry compaction decisions in batches
within the ordinary 64-order/256-entry cap. Batches lock their orders before the
frozen root and only write recovery staging rows; they cannot unfreeze or publish
authority. After every expected member has one checksumed result, one anchor-row
CAS, while holding every affected source-root/anchor key in sorted order, validates
the full snapshot/checksum and exact unchanged anchor revision, proves the
resulting active authority closure is
within both caps, and atomically activates the staged successor, rejection, or
compaction mapping by flipping the recovery record. Every old-root lookup
consults only a finalized anchor; staged memberships are invisible until that
flip. Crash/retry resumes the same recovery ID, and
checksum or membership drift abandons it while the component stays manual-only.
Thus final publication is one root-generation authority change without an
unbounded order lock, and failed recovery can never partially unfreeze collection.
Concurrent first-create, bridge rejection/merge, overflow recovery, proof
rotation, SDK report, and provider switch cannot commit two unapproved collection
authorities.

`compact_closed_authority_entries` is not deletion or identity reassignment.
Private append-only `payment_checkout_collision_authority_closures` use a tagged
`order | domain | alias_bundle` shape. An order closure locks that order and its
complete attempt/lease/assignment/grant/protection/reference families in the
global order and proves every enumerated collection/replay/reopening horizon is
terminal. It removes only that order from the root's active order-lock projection;
the order FK, domain membership, references, financial evidence, and canonical
late-money disposition remain immutable. A domain can become lookup-only only
after every order in it has an order closure and no live grant, protection,
request alias, rollback reader, or other authority can enter through it. An alias
bundle can become lookup-only only under the separate conditions below. Thus the
protocol never mistakes one closed order for a closed collision-domain member.
Old order/domain entry still resolves through the historical membership and
tombstone, but cannot bootstrap checkout, publish a lease, protect a new order,
or force all active orders into a lock set. A delayed verified receipt follows its
immutable provider reference to the historical order and late-money/
reconciliation path; it cannot revive collection authority. Active nonce-only and
rollback aliases remain active until their separately pinned horizons close.

Subject and request aliases use the same active-versus-lookup-only rule. A guarded
alias compaction may replace a closed historical alias bundle with an immutable
canonical lookup redirect only after no live nonce, replay, protection, rollout,
or rollback contract requires it. Redirects are append-only and never establish
new subject or commercial equivalence. If the staged output still exceeds either
cap, if even one member lacks closure proof, or if a safe compaction cannot be
proved, the final CAS is refused and the component remains manual-only. This
gives legitimate long-lived repeat purchasers a recovery path without weakening
duplicate-order or possible-capture safety.

Overflow cannot make verified money dependent on operator recovery. While a root
is `overflow_recovery_frozen`, cleanup and every collection-authority mutation for
its active orders fail closed on that fence. A separately guarded
`collision_overflow_frozen` webhook-ingress mode may, however, durably acknowledge a signature-
verified event when an immutable provider-reference binding proves exactly one
order. It locks that order, every affected frozen source-root/anchor key, and the
exact provider-reference/source family in normal order; revalidates the fence and
binding; then atomically persists the inbox/manifest/child proof plus a non-money,
non-expiring `webhook_child` protection claim stamped with that ingress mode and
linked to the recovery anchor. It cannot select a processor,
create confirmation evidence or money, allocate, mutate inventory, unfreeze the
root, or use metadata/order similarity as a binding. Ambiguous or unbound ingress
is retained in provider-account/global quarantine without claiming an order.
The guarded exact-reference ingress transaction increments the anchor revision
when it adds a retained child/claim. A staged recovery whose snapshotted revision
is now stale cannot publish: it must incorporate the new claim and rescan affected
closure members under the same recovery ID. The non-expiring claim keeps its order
authority-relevant until ordinary post-recovery processing reaches typed terminal
closure, so compaction cannot silently omit newly acknowledged money evidence.
After recovery publishes a bounded closure, the ordinary generation-pinned worker
revalidates the retained child and existing claim, creates or reloads that child's
single ordinary financial command, and processes it without inserting a second
claim. The original append-only claim continues to veto cleanup through command
retry/review and is consumed only by the matching typed terminal closure committed
with the financial or reviewed terminal result. This exception preserves acknowledgement
and cleanup safety without allowing the oversized component to perform a
collection-authority or financial transition.

Before a domain exists, an operation derives every supported legacy/current
commercial bootstrap alias from trusted server facts and locks those alias keys
in sorted byte order; first creation atomically installs the domain and its first
component root/membership. For an existing domain it resolves the active component
root/generation and discovers the complete bounded member-domain/order/subject/
commercial-alias set without row locks, locks all matching orders, then all
subject/component/root/member/bootstrap-alias/domain keys together in sorted
order, and revalidates the set. Drift aborts the transaction for a fresh bounded retry. While
hash generations overlap for forward or rollback compatibility, every active
generation participates; an unknown generation or ambiguous alias fails closed.
This makes first creation, deployment rollback, proof rotation, and guest-to-auth
binding converge on one collision component without relying on PII or a single
versioned hash.

### Global financial lock hierarchy

Every operation that can create, classify, allocate, move, settle, reverse, or
release financial value or collection authority uses one global hierarchy. This
includes receipt recording, completion, allocation, reconciliation, reversal,
customer-wallet credit/refund/redemption/savings, internal-ledger funding,
provider-availability and settlement transitions, merchant credit/debit,
payout, withdrawal, reserve movement, negative-liability recovery, replacement-
order publication, checkout creation/key rotation, provider switching,
receiving-intent and provider-account
authority-epoch changes, financial-routing and quarantine-resolution election,
order-protection-claim installation, DVA matching, due-date edit/expiry, schedule
transition, cleanup, and financial
maintenance/backfill. Side-effect
workers never retain an outbox/claim row lock while invoking one of these
financial transitions; the transition acquires its own canonical lock set in a
new database transaction.

Each function first discovers resource identities without taking row locks, then
takes PostgreSQL transaction-level advisory locks in one namespace order: all
involved `order:<uuid>` keys in ascending UUID order; all
`checkout-subject-component:<merchant>:<opaque-component>`,
`checkout-collision-component:<uuid>:<generation>`,
`checkout-collision-alias:<merchant>:<opaque-subject-alias>:<request-generation>:<request-hash>`,
and `checkout-collision-domain:<uuid>` keys in one ascending byte order; all
`receiving-intent:<uuid>` keys in ascending
UUID order; all
`provider-reference:<scope>:<lookup-key>` binding-family keys in ascending byte
order; all
`customer-wallet:<merchant>:<customer>:<currency>` keys in ascending byte order;
all version-independent canonical receipt/reversal/internal-funding-plan/reversal-
source-reservation keys in their own class and ascending byte order; then the
following disjoint receipt-lineage classes in this mandatory order: (1)
`receipt-lineage-root-guard:<immutable-root>`; (2)
`parent-chargeback-partition:<parent>:<partition>`; (3)
`receipt-lineage-veto:<parent>:<evidence>:<root>`; (4) the
`parent-finance-scope`, `parent-finance-disposition`,
`parent-finance-reference`, and `parent-finance-terminal` families; and (5) the
`typed-backing-asset`, `backing-loss-case`, `backing-loss-pending-veto`,
`backing-loss-fence`, and `source-liability-recovery` families; then all
`merchant-wallet:<merchant>:<currency>` keys in ascending byte order.
Keys sort only within their named class, never across these classes: a class prefix
or a lexical byte comparison cannot move a parent partition ahead of its root
guard, a veto ahead of its partition, finance ahead of its veto, or a child asset
ahead of any required parent class. A function that does not need a class skips it
but may never invert the remaining sequence.
A recovery key is derived from its typed backing asset plus consumed source
slice, never an order-payment-allocation ID. A backing-loss case family derives
from the same typed asset plus its immutable parent chargeback/partition row or
issuer-revocation identity; its pending-veto family derives from that same asset
plus parent partition row and accepted provider-chargeback evidence identity.
The parent lineage-veto family derives only from parent chargeback/collision ID,
accepted evidence ID, and immutable receipt-lineage root, so it can be locked
without enumerating descendant assets.
The SDK possible-capture stable-source key is not a new advisory class. It is
encoded inside the provider-reference family as
`provider-reference:<provider/account/authority>:sdk-first-report:<attempt-id>:<normalized-provider-session>`.
Every component is database-validated and non-null before lock derivation. An SDK
first-report operation discovers the complete bounded matching order set, active
collision-component root/generation, member domains, subject/commercial aliases,
and SDK key without locks; acquires the order class first, then every sorted
checkout subject/component/root/member/alias/domain key and the complete
sorted provider-reference class; revalidates all three sets; and only then takes
row locks. No SDK helper may acquire the
provider-reference-family key before an order key or invent a source/session lock
outside this frozen hierarchy.
The checkout-collision class is likewise frozen and is acquired after every
currently discoverable matching order key but before receiving-intent and
provider-reference keys. Create-order/key rotation and SDK first-report resolve
the same active collision-component root/generation and complete bounded member/
alias closure from trusted server facts. Each discovers the complete matching
order set without row locks, acquires every matching order key in UUID order and
then every sorted subject/component/root/member/alias/domain key,
re-reads both sets, and aborts for a fresh bounded retry if membership, alias
resolution, or state changed. When no domain or order exists, the complete active-
generation bootstrap alias set proves absence until commit; a later contender
must discover the inserted domain and order during post-lock revalidation.
The identity-only equivalence writer uses only sorted subject-component keys and
never acquires financial rows. Commercial-alias projection and component
resolution use the complete bounded commercial-intent prefix over every matching
order, active component root/generation, member domain, subject component, and
alias; a two-domain conflict freezes all members while those locks remain held.
The guarded noncapturability writer extends that prefix through the
complete provider-reference and canonical-receipt families used by capture,
webhook, and verification processing. No revocation/expiry helper may insert
evidence after locking only its attempt row or provider session.
Resource namespaces and their deterministic advisory-key encoding are disjoint
and frozen in the database contract. An orderless receipt omits the order class;
a reconciliation allocation includes its selected order and any source intent;
a reversal discovers every order and receiving intent touched by its typed
receipt-transaction or internal-funding-plan source legs, including each backing
lineage asset and consumed source slice needed by a recovery transition. If any
generic reversal touches a receipt-lineage parent or child, it derives that root
from the source facts and follows root guard -> parent partition -> parent veto ->
required parent finance -> child; an issuer-revocation-only reversal has no root
class and takes only its child class. A chargeback derives its immutable receipt-lineage root from exact reserved receipt-
lot/allocation and evidence facts, locks that root guard before looking up its
parent partition, locks the parent partition before the parent veto, and locks
the veto before any parent finance scope/disposition/reference/terminal row or
child class. Resource discovery takes no row locks and cannot substitute for this
order. Intake then publishes its parent veto without scanning descendants. It
never enumerates active parent vetoes or locks all backing assets at intake; the
guard's bounded count gates writers while each parent veto governs its bounded
lineage census and later child families. Non-selected candidate orders remain
evidence, not locks.

Asset-level backing loss is deliberately bounded without weakening the hierarchy.
After every receipt-lineage class required by its cause (none for an
issuer-revocation-only case), its initial authority transaction locks only the
sorted typed-backing-asset and loss-case or loss-pending-veto family, revalidates
them, CAS-installs the loss
fence and frozen high-water/phase cursor, and never locks every descendant source
slice. A provider-chargeback acceptance locks and publishes only its bounded root
guard, parent partition, parent receipt-lineage veto, and parent finance-scope
facts, in that order, plus `D`/`Q`/`E`/high-water facts. Bounded lineage census,
partition, and child-materialization workers later acquire root guard, parent
partition, parent veto, and required parent finance classes in that order before
each bounded page of child asset/case/veto families; they cannot make an
individual child spendable before the parent seal.
Separate child census, draft-plan, and sealed-plan application workers take the
root guard and any required parent partition/veto/finance classes before that same
asset/case family, then no more than their configured sorted page of census facts
or immutable plan items, source slices, and recovery rows. Every spend, split, restoration,
merchant-availability, settlement, reserve-release, payout, and withdrawal writer
locks/revalidates the root guard before parent lookup or its asset family. If it
needs parent authority, it then takes parent partition, parent veto, and required
parent finance classes before its child fence/asset/loss-case/recovery class; a
plain descendant writer that needs none of those parent classes takes root then
its child class. Thus no new descendant or available/withdrawable value can evade
the census between those bounded transactions. High-water,
source-version, cursor, or checksum drift keeps the asset fenced and aborts only
the affected phase for retry or review; it never expands the lock set beyond the
cap or makes a draft plan applicable.

The provider rollout-row or checkout request-contract control-row lock used only
by authority-bearing issuance is the sole control-plane precursor to this
hierarchy. Neither is a financial row lock or a general exception: attempt,
receiving-intent-epoch, provider-account-authority-epoch, and nonce issuance
acquires its applicable control row before every financial advisory lock; control
transitions never acquire an order, collision, intent, or provider-reference lock;
and any function already holding a financial lock is forbidden from acquiring a
control row. Dedicated stop/retirement-versus-each-issuance-kind tests prove this
one-way dependency and its absence from ordinary completion or nonce consumption.

After acquiring the proposed advisory set, the function re-reads and validates
the complete set. If an order, collision-domain/alias closure, intent, receipt,
reversal, source reservation, internal-funding-plan, typed-backing asset/loss-
case/loss-pending-veto, or recovery identity is missing or changed, it raises a typed retry
exception that aborts the entire database
transaction. Transaction-level advisory locks are never explicitly released or
retained while rediscovering. The service wrapper starts a fresh transaction and
retries the same immutable command/idempotency key with bounded backoff and a
maximum attempt count; exhaustion becomes a retryable operational state, never
a second financial outcome. No financial row lock or financial/collection-
authority write may occur before the validated advisory set is held.

Row locks then follow one order everywhere: orders; checkout subject components,
collision-component roots/successions/memberships/overflow-recovery anchors,
collision domains, subject equivalence, and collision aliases; receiving intents, intent epochs,
provider-account authority epochs, and capacity
claims/counters; provider capture-finality contract generations; collection
leases, attempts, assignments, provider reference
bindings, payment-attempt noncapturability evidence, SDK customer-authorization
sessions/tracking grants, schedule-change proposals, schedule
epochs, and tranches; canonical
receipt/reversal identities, contract generations, equivalence aliases, and
ordinary identity aliases; transactions in ascending UUID order; verified inbox,
source-manifest, and source-proof rows; SDK possible-capture evidence and its
authorization/corroboration rows; order-protection claims and typed closure rows;
financial-routing proposals; confirmation evidence in
canonical source identity and inbox-child-identity order; accepted financial-
routing resolutions;
origin-resolution proposals and accepted resolutions; receipt origins,
quarantine-resolution proposals/adoptions, reversal cases/source legs/source-
global reservations; then receipt-lineage root-guard rows; then parent chargeback
partition headers, their census/partition pages, and provider-dispute collisions;
then receipt-lineage veto rows; then the parent finance scope, disposition,
replacement-backing evidence, parent-finance-resolution terminal, zero-finance-
reference census page/seal, finance-child-reference page/seal, and internal-
funding reversal-plan rows; then child typed backing-lineage assets, backing-loss
cases/fences/pending-vetoes/cursors, child-finance-resolution idempotency rows,
chained census and draft-or-sealed plan items, and source-liability recovery rows;
customer-disposition lots and economic components; internal-funding evidence;
receipt and internal-funding allocations;
inventory in canonical product/variant/location order; customer-wallet balances,
reservations, and
customer-wallet ledger rows; merchant balances, merchant wallets, settlement,
reserve, payout, withdrawal, and liability ledgers; then durable financial/
outbox claims. Review and command-idempotency rows that serialize one
operation may be locked before this row sequence only after the complete
advisory set is held. A function that does not need a class skips it; it may
never invert the remaining order. For the receipt-lineage rows, keys sort only
within their disjoint class, never across classes: root guard, parent partition,
parent veto, parent finance scope/disposition/reference/terminal, then child
asset/loss-case/fence/recovery/idempotency. A lexical row ID may not move a later
class ahead of an earlier required class.

This sequence governs locks on existing rows. For a deterministic canonical or
transaction row that does not yet exist, absence is proved only while its owning
family advisory lock is held; every writer of its scoped unique indexes must hold
that same advisory. The row may then be inserted later in the atomic graph after
source revalidation without racing another insert. Deferred graph constraints
validate the final evidence/resolution/origin/transaction links at commit. No
route may use speculative insertion or an index-conflict wait as a substitute for
the family advisory, because that would recreate the source-first inversion.

Every customer-wallet credit, refund, redemption, savings movement, merchant
settlement, reserve movement, payout, withdrawal, reversal, liability recovery,
and provider-specific balance hook is inventoried and routed through this order
or fenced before activation. Historical table-lock backfills may run only before
cutover or behind one database-owned global financial-maintenance fence that
prevents every canonical money writer from starting; application traffic and a
table-lock backfill never overlap. A source-specific advisory lock is not an
exception to the global namespace order.

### Durable financial command execution

Every financial child or singleton non-webhook entry point owns retries through a
private `financial_command_executions` row created or reused in a separate, short
intake transaction before the financial RPC. It records authority and routing
generation, source kind and immutable source ID, tenant and authenticated actor
where applicable, immutable idempotency key with a scoped unique constraint,
`queued | claimed | retry_wait | completed | review_required` status, claim token
and lease expiry, attempt count, `next_retry_at`, last typed error, result
identity IDs, and timestamps. The permitted source kinds are
`webhook_child`, `provider_verification`, `authorized_manual`,
`internal_ledger`, `authorized_reconciliation`, and `quarantine_adoption`.
The `internal_ledger` branch requires immutable merchant, customer, order,
collection-epoch, exact source-slice/parent, amount, and currency input columns;
other branches are forbidden from populating them. Its guarded intake derives
and authorizes that binding before queueing, and its financial executor accepts
only the command identity and revalidates every bound row under lock.
A webhook child source proof links to at most one command and, once financially
authorized, exactly one; the inbox parent is not a command owner. Provider
verification, authorized manual, internal-ledger, and reconciliation commands
create it through their own authorization wrappers. A `quarantine_adoption`
command can be created only from an accepted immutable adoption decision; its
authority and tenant scope are derived from that decision rather than caller
input. It links the durable manifest, adoption decision, child source proof and
proposal—not a required inbox foreign key—and uses a unique
`(adoption_decision_id, child_identity)` idempotency key plus the ordinary lease,
retry, exhaustion, review, and result-link contract.
Only a `webhook_child` command may be rediscovered or requeued from its verified
inbox/source-proof chain. Every non-webhook source, especially `internal_ledger`,
is retried solely by its stable command ID and immutable command binding; it must
not require or fabricate a verified inbox child.

Claiming or renewing a command is a short compare-and-set transaction. The
financial transaction verifies the live claim and immutable command, but locks
the command row only in the durable-claim class at the end of the global row
order. A typed lock-set retry or database error rolls back that whole financial
transaction; the outer executor then records `retry_wait`, the typed error, and
backoff in a separate transaction. Exhaustion durably becomes
`review_required` and alerts an operator instead of disappearing in process
memory. Completion stores one source-specific elected result shape by compare-
and-set under a database-enforced `receipt | internal_funding` completion-source
tag. Receipt-authorizing sources store confirmation-evidence and transaction/
result IDs; `internal_ledger` stores internal-funding evidence and allocation IDs
and is database-forbidden from storing a customer-receipt transaction/result ID.
Every other source branch has explicit required and forbidden result columns
rather than a nullable bag of interchangeable IDs. Concurrent
lease expiry is harmless: canonical financial idempotency elects one outcome,
and a stale worker must reload the command and its result rather than execute a
second outcome.

### Receiving intents and immutable receipt origins

`payment_attempts` are order-bound promises and therefore retain non-null
`order_id` and `collection_contract_epoch_id`. Permanent receiving accounts,
wallet top-ups, and unsolicited or not-yet-attributable provider transfers are
not forced into synthetic orders or synthetic order attempts.

A private `payment_receiving_intents` table represents a reviewed non-order
receiving account such as a customer wallet DVA. Its stable fields are intent ID,
merchant, provider and provider-account namespace, immutable account-ownership
binding, creation actor/source, and timestamps. Beneficiary, purpose, currency,
amount limits, and cardinality belong to an epoch because each can change while
the permanent provider account survives. An intent cannot itself assert that
money arrived.

Immutable `payment_receiving_intent_epochs` carry monotonically increasing epoch
number, beneficiary/purpose, currency, per-receipt exact or minimum/maximum
amount, `single_receipt` or reviewed `reusable_receipts` cardinality, maximum
receipt count and cumulative amount where reusable, settlement-policy version,
completion-authority key, routing-generation ID, processor contract/version,
timing-policy version, half-open `[effective_from, effective_to)` interval, status,
predecessor/successor identity, actor/reason, and timestamps. Only one epoch may
be effective for an intent at a time; closing and succeeding an epoch happen
under its receiving-intent resource lock and the global row hierarchy. A
permanent provider account may outlive every epoch and is never treated as
expired merely because one intent epoch ended.

Intent-epoch creation and succession snapshot those financial-routing fields
from the database rollout state before acquiring the intent resource lock, using
the shared authority-issuance control-plane ordering. They are
immutable afterward. Delayed receipts use the intent epoch effective for the
complete verified provider-paid-time interval and that epoch's pinned generation,
never today's rollout generation. Stop, rollback, or later widening does not
reroute a receipt attributable to a historical compatible epoch; an incompatible
or retired processor instead records the money through its retained safe
reconciliation path.

A private `payment_provider_account_authority_epochs` registry supplies the same
immutable authority, routing generation, processor contract, timing policy, and
half-open effective interval for verified provider-account money that cannot be
attributed to an order attempt or receiving intent. Selection uses the complete
verified paid-time interval, or the server ingress instant only when the provider
contract supplies no paid-time evidence and the policy explicitly permits that
fallback. Zero matches, a paid-time interval crossing an epoch boundary, or a
legacy/backfill overlap enter review; new runtime overlap is rejected by the
constraint below. The worker cannot silently use the current generation.

The registry is scoped by provider, stable provider-account namespace,
completion authority, and routing purpose. An exclusion constraint prevents
effective-interval overlap in that scope, and a unique successor/predecessor
chain prevents forks. Creation and succession use the shared rollout-row-first
authority-issuance protocol, expected-version compare-and-set, immutable actor/
reason and transition receipt, and atomic predecessor closure plus successor
insert. A gap is allowed only as an explicit no-automatic-routing interval;
overlap is rejected rather than tolerated. Stop and rollback preserve historical
epochs and their compatible processors, while an unsafe predecessor reactivation
fails closed to review.

Capacity is database-enforced, not advisory. An immutable
`payment_receiving_intent_capacity_claim` uniquely links the intent epoch,
canonical receipt identity, origin, amount, and currency. A `single_receipt`
epoch has a partial unique capacity/origin claim and an atomic unconsumed-to-
consumed compare-and-set. For a reusable epoch, receipt recording holds the
intent/epoch resource and row locks while it validates the per-receipt bound and
atomically inserts the claim and increments guarded receipt-count and cumulative-
amount counters. A deferred invariant trigger rejects direct counter mutation or
commit unless counters equal immutable claims/origins and remain within caps.
Migration backfill disagreement blocks activation. The capacity claim, canonical
receipt identity, origin, and transaction commit together; a distinct transfer
cannot oversubscribe the epoch under concurrency.

Origin resolution evaluates the complete verified provider-paid-time uncertainty
interval against intent epochs, never current status or webhook arrival time.
Automatic receiving-intent attribution is allowed only when the entire interval
fits inside exactly one eligible epoch and verified ownership/purpose still
agree. Zero matches, multiple matches, a boundary crossing, missing paid-time
evidence, or contradictory ownership creates an unattributed receipt and review.
A later epoch cannot retroactively absorb money paid outside its interval.

Every confirmed `customer_receipt` transaction instead has exactly one immutable
`payment_receipt_origin`. Its database-enforced tagged union is exactly one of:

- `order_attempt` with one `payment_attempt_id`;
- `receiving_intent` with one `payment_receiving_intent_id`; or
- `unattributed_provider_receipt` with verified provider-account and source
  identity when no safe attempt or intent match exists; or
- `legacy_unproven_receipt`, allowed only to the migration role for an existing
  confirmed inbound receipt row whose original runtime provenance cannot be
  proved; legacy reversal rows use reversal provenance instead.

Each evidence row may carry an immutable proposed origin resolution recording
the direct-reference or matcher version, routing purpose, result type,
zero/one/many candidate snapshot, selected attempt or receiving intent when
unique, vetoes, and decision timestamp. The one accepted
`payment_receipt_origin_resolution` belongs to the canonical receipt identity
and winning authorizing evidence, not independently to every evidence row.
Direct gateway references may propose immediately; permanent-DVA evidence stays
unresolved until its matcher proposes a result. Exactly-one matches propose an
attempt or intent, while zero/multiple/protected matches propose
`unattributed_provider_receipt` and review.

Under the canonical receipt-identity advisory lock, receipt recording atomically
elects the authorizing evidence and its proposed resolution, creates the
accepted resolution, origin, transaction, and evidence link, and consumes any
receiving-intent capacity. A racing source reloads the winner. Equivalent facts
and resolution attach only as corroborating evidence; conflicting facts or
resolution open review. There can be no orphan accepted resolution or two
accepted classifications for one receipt, and later evidence or manual
attribution cannot rewrite the winner.

The origin stores merchant, provider, provider-account namespace, completion
authority and routing generation, the accepted financial-routing-resolution ID,
currency, authorizing evidence ID, origin reason, selected receiving-intent epoch
where applicable, and immutable policy snapshot applicable at verified provider
paid time. A later allocation,
wallet credit, refund, or reconciliation decision links to the transaction but
never rewrites its origin. An unattributed receipt cannot inherit an order,
merchant-entitlement, or settlement policy merely because a candidate was
suggested later.

`transaction_id` and authorizing evidence ID are each unique and non-null on the
origin. A check constraint requires exactly one union target for attempt and
receiving-intent origins and neither target for an unattributed or legacy origin.
The origin references the canonical receipt identity described below. Amount,
currency, paid time, fee, and status are verified attributes of that identity,
never uniqueness dimensions. Therefore a replay with conflicting economic facts
reaches the existing identity and enters reconciliation rather than minting
another origin or transaction.

### Separate-purchase grants

The private grant table stores nonce hash, merchant, protected order,
`collision_domain_id`, subject kind and verified subject/proof digest, exact
issuance request-contract generation/hash, immutable commercial alias-bundle ID,
authorization kind and immutable issuance authorization snapshot, `expires_at`,
database-owned `idempotent_replay_until`, `consumed_at`, resulting order, and audit
timestamps. The nonce
hash is unique; one partial unique constraint permits only one resulting order
per consumed grant. Its alias bundle remains nonce-lookup-only through the later
of expiry or idempotent replay horizon plus the pinned safety margin even if the
issuance generation retires. Exact consumed-grant lookup by nonce hash precedes
expiry/generation rejection, but possession of an expired nonce or authorization
proof never grants order disclosure. A lost-response retry returns the existing
result without resolving request aliases or creating authority only after it
revalidates merchant, protected/result order, immutable consumption, and either:

- the still-valid original authenticated session/tracking proof; or
- fresh authentication, tracking proof, or email-OTP evidence that resolves under
  the guarded subject-equivalence contract to the same immutable subject component
  and is authorized to view the result order.

The idempotent result-replay horizon is retention, not authentication authority.
The guarded function records the replay authorization used, never extends the
nonce, never creates a new result, and returns only a generic consumed/conflict
response when subject proof is absent, expired without safe reauthentication,
revoked, ambiguous, or cross-merchant. Session rotation or logout therefore does
not destroy a result that the same customer freshly proves, while an old bearer,
nonce, email string, or issuance snapshot alone cannot recover it. Plaintext nonce,
OTP, and bearer values are never stored.

### Financial entry amount and identity contract

For every migrated provider, each confirmed `customer_receipt` exposes a
positive immutable `gross_amount_minor`, currency, provider, merchant,
provider-account namespace, and provider reference to the completion function.
Each reversal entry instead exposes a positive immutable
`reversal_amount_minor`, direction, original-receipt identity, and reversal-ledger
identity. Database checks enforce exactly one shape: receipt entries cannot carry
reversal amount/provenance, and reversal entries cannot carry gross receipt
amount, receipt origins, disposition lots, allocations, settlement effects, or
paid-order effects. These may be new columns or lossless database-owned
projections over existing columns, but implementation cannot derive minor units
with application floating-point arithmetic.

The unique confirmed-money identity is provider, completion authority, merchant
where required, provider-account namespace, and a canonical receipt identity
independent of adapter/parser version. `payment_receipt_identities` owns the
immutable canonical ID and canonical provider key. The canonical scope tuple is
identical everywhere—including tenant where required—and a unique transaction
foreign key permits at most one `customer_receipt` per canonical identity.
`payment_receipt_identity_aliases` uniquely maps provider, account namespace,
authority, adapter identity-schema version, and derived key to that canonical
identity under that same scope. Amount and currency are never added to a stable
provider key: a second delivery of that key with conflicting facts creates
review evidence against the existing transaction. A provider without a stable
receipt identity is not
eligible for automatic completion until a reviewed adapter can derive one from
immutable verified source evidence; ambiguity cannot be hidden by hashing amount
or currency into a new identity. Gateway fee, net settlement, refunded amount,
and chargeback amount remain distinct values. The original confirmed gross
amount is never rewritten to represent a later net or reversal.

Parser identity-schema versions are distinct from a provider's frozen canonical-
identity contract version. Every supported adapter must derive from verified raw
provider evidence the same version-independent canonical locator and advisory
lock key, plus the aliases produced by every concurrently supported parser
version. On a first-ever receipt, before any canonical or alias row exists, the
function locks `receipt-canonical:<scope>:<canonical-locator>`, inserts or reloads
the uniquely scoped canonical identity, installs the full alias bundle, and only
then elects evidence or creates a transaction. If every live parser/event/verify
shape cannot deterministically produce the same canonical locator and alias
bundle, mixed-version automatic completion is forbidden: deployment drains the
old generation for a single cutover or routes that identity to review.

Before a new parser identity-schema version activates, a checksum-verified alias
backfill maps every existing canonical identity to both old and new derived keys,
while shadow fixtures prove first-seen canonical-locator parity for future
receipts. Adapters dual-read supported aliases and never re-key an existing
canonical identity. Ambiguous mappings, alias scope mismatch, or canonical-
locator disagreement are review-only and block activation. Rollback keeps all
installed aliases and the frozen canonical contract so an old worker and a new
worker—or concurrent webhook and verification paths using different versions—
still acquire the same bootstrap lock and elect one transaction.

Canonical identity contract evolution is private, immutable, and generation-
scoped. A registry row records provider, completion authority and account scope,
immutable contract version, `shadow | active | draining | retired` status,
effective routing generation/time, predecessor and successor, equivalence-
mapper version, activation evidence, and retirement evidence. A database
constraint permits exactly one `active` contract generation for new evidence in
a scope. A `draining` generation is lookup-only for delayed events; it cannot
bootstrap a new identity under its old rules.

Rolling overlap is permitted only when verified source evidence makes both
generations derive the identical immutable `identity_family_lock_key`, a
checksumed equivalence/alias backfill is installed before activation, and shadow
parity proves no re-key for existing or first-seen receipts. If two contracts
cannot share that family lock, rolling overlap is forbidden: fence and drain the
old generation before activating the new one, prove their provider identity
spaces disjoint, and route ambiguous or delayed events to review. Existing
canonical identities are never mutated. Rollback retains generations and all
equivalence aliases and may reactivate a predecessor only when the same safety
proof remains valid; otherwise it fails closed to review.

### Payment confirmation evidence

Every confirmed `customer_receipt` transaction is authorized by one immutable,
typed
`payment_confirmation_evidence` row. Evidence source types are
`verified_webhook`, `provider_server_verification`, `authorized_manual`,
`authorized_reconciliation`, and migration-only
`legacy_migration`. The last type can annotate an already-confirmed legacy row
that is proved to be an inbound receipt under a migration manifest but can never
authorize new money, annotate a reversal, or promote a
pending row. A client SDK callback, success page, popup close, or request-selected
status cannot create confirmed evidence.

Required fields include evidence ID, merchant, provider and provider-account
namespace, completion-authority key and routing generation, source type,
verified routing/purpose classification and any non-authoritative candidate
identity supplied by the provider, provider reference, canonical amount and
currency, provider-paid time when applicable or authoritative recorded time
otherwise, time precision/source, adapter/schema version, verification timestamp,
verifier actor class, normalized safe evidence, source identity, request and
response hashes where applicable, and status. Provider-response bodies are
redacted before persistence; credentials, signatures, and prohibited customer
data are never retained.

Every `verified_webhook` evidence row links to exactly one durable webhook child
source proof and, through it, one immutable source manifest and originating
verified inbox identity. The live inbox row is only an optional operational link.
A singleton event has one deterministic child identity such as
`singleton`; a provider contract that explicitly permits bounded multi-capture
may freeze several child source proofs, each with a provider-derived immutable
child identity, and no other contract may create more than one. The durable
`payment_webhook_source_manifests` record copies the complete verified ingress
replay identity into immutable columns with its own unique constraint independent
of the inbox primary key. It stores the normalized child-manifest hash, child
count, conserved amount/currency summary, adapter and ingress-contract generations,
provider/account scope when proved, contract bound, and redacted parent source
identity. Its immutable child
proof rows are unique by `(source_manifest_id, child_identity)` and store the
child reference/capture identity, canonical economic facts and child hash. The
inbox references this durable manifest but does not own its financial lifetime.
The manifest and all children are inserted atomically before any child is
processed. Replay must reproduce that
manifest exactly; added, removed, reordered-with-different-meaning, duplicate, or
economically changed children enter conflict review and cannot mutate the
accepted manifest. `provider_server_verification` evidence has a provider-scoped
deterministic identity for the verification result so a status/verify route,
reconciliation worker, and webhook converge on the same confirmed-money identity
without requiring a webhook to exist. Manual evidence links the authorized actor,
permission snapshot, reason, proof identity, and idempotency key. Internal funding
uses a separate `payment_internal_funding_evidence` row linked one-to-one to the
exact immutable consumed source slice and its guarded allocation; that slice
retains its wallet, savings, voucher, or store-credit ledger/reservation parent.
The evidence cannot satisfy a confirmation-evidence FK or authorize
a customer-receipt transaction. Reconciliation evidence links the accepted decision and cannot exist
before that decision is authorized. Legacy-migration evidence links the original
confirmed transaction identity, source-row hash, migration manifest/version, and
the explicit facts that remain unproved.

`payment_transaction_evidence_links` associates all verified evidence for the
same confirmed-money identity with one transaction. It permits exactly one
`authorizing` evidence link per transaction; later matching webhook or provider-
verification evidence becomes `corroborating`, not a second authorization.
Every evidence row links to at most one transaction. Conflicting evidence for an
already confirmed identity enters reconciliation and is never attached as
corroboration. The receipt-origin record stores the authorizing evidence ID.

The private evidence-creation functions enforce source-specific verification and
deduplication. A verified source proof and financial-routing proposal exist
before receipt matching, so a provider-supplied candidate is never itself origin
authority. The receipt transaction reads those immutable source facts without
row locks to derive its full advisory set, acquires and revalidates that set,
locks any existing canonical identity and transaction rows, and only then locks
the proof and proposal. It may create or reuse the typed evidence row after those
locks but before it elects the evidence as authorizing; the unlinked evidence row
alone grants no money authority. The
origin resolver or DVA matcher creates an immutable proposed resolution; under
the canonical identity lock the receipt function atomically elects one evidence
and proposal, creates the accepted financial-routing and origin resolutions,
origin, transaction, and links, and back-links them to the winner. A rollback
leaves none of those accepted records visible. A completion wrapper accepts
either an existing evidence ID or, for atomic materialization, immutable verified
source-proof and financial-routing-proposal IDs—never loose gateway facts. Inside
the completion transaction, the database derives and locks the canonical family
and any existing transaction before it locks the supplied evidence or source
proof/proposal, creates or reloads evidence when required, and proves it is
verified, unused or idempotently linked, tenant-
consistent, origin-consistent and attempt-consistent when an attempt exists,
authority-generation-compatible, and identical
in reference, amount, currency, and paid-time facts to the transaction being
created. One evidence row cannot authorize two confirmed transactions. An
explicit bounded-multi-capture provider event materializes only the immutable
manifest's distinct child evidence rows. Each child source proof owns exactly one
routing proposal, each authorized child owns exactly one durable command, and each
completed child can authorize exactly one transaction;
each transaction is independently idempotent, and the conserved child totals
cannot exceed the provider event or rail-contract bound. A crash may leave some
children pending, but replay resumes the same manifest and can never invent, omit
as terminal, re-key, or share a proposal/command between children.

### Receipt-to-transaction provenance

Every confirmed `customer_receipt` transaction has exactly one immutable receipt
origin. When that
origin is an order attempt, the attempt remains the origin even if it was
expired, failed, or superseded by the time capture was verified. A
`single_capture` attempt can originate only one
transaction. One attempt may originate multiple transactions only where its
immutable `bounded_multi_capture` rail contract permits multiple captures or
transfers and caps their conserved sum. The relationship is represented by a
private `payment_attempt_transaction_links` table, in addition to the universal
receipt-origin link, rather than inferred from mutable order state or a provider
reference alone. Receiving-intent and unattributed origins never receive a fake
attempt link.

Each attempt link records the attempt, transaction, collection-contract epoch,
confirmation-evidence ID, link reason, and creation timestamp. `transaction_id`
is unique and immutable; `(attempt_id,
transaction_id)` is unique. Tenant, provider-account namespace, currency, and
completion-authority consistency are database-enforced. Backfills create attempt
links only where origin is provable; an unprovable legacy transaction remains
without an attempt link, receives a typed `legacy_unproven_receipt` origin, and
cannot use an attempt-derived settlement policy until reviewed.

Settlement ownership and any provider-specific acknowledgement policy are read
from the immutable receipt-origin policy snapshot. For an `order_attempt` origin,
that snapshot is copied or version-linked from the attempt at confirmation. A
`receiving_intent` origin uses its selected intent epoch; an unattributed origin
is forced to `reconciliation_required`/gross suspense until an authorized
conserved disposition decision. Workers read the origin snapshot, never “the
latest attempt for this order.”

### Funds disposition and settlement suspense

The design uses two separate conservation layers. Customer-funds disposition
answers where the gross amount went; economic components answer who is entitled
to it. Neither layer may be substituted for the other.

A confirmed `customer_receipt` transaction owns one or more database-controlled
customer-disposition lots whose active amounts sum exactly to its immutable
confirmed gross amount. Reversal entries never own these receipt lots or their
economic components; the reversal ledger reduces or replaces the original
receipt's conserved lots and components through linked reversal entries. A
normal one-order payment begins with one lot. Allocation, split
allocation, partial refund, wallet credit, or mixed resolution splits or
transitions that lot atomically without creating or destroying customer-paid
value. Customer-disposition states include `held_in_suspense`, `allocated`,
`wallet_credit_pending`, `wallet_credited`, `refund_pending`, `refunded`, and
`manual_recorded`. An allocated lot may remain economically unsettled.

Each customer-disposition lot has one or more immutable amount-bearing economic
components. Active component amounts sum exactly to that lot amount and use
reviewed beneficiary classes such as `merchant_entitlement`,
`platform_fee_withheld`, `gateway_fee_liability`, `tax_or_regulatory_liability`,
`customer_wallet_liability`, `suspense_principal`, and `rounding_adjustment`. A
confirmed but unattributed receipt begins as one `suspense_principal` component
equal to gross; Baci does not invent merchant entitlement, platform fees, tax, or
an order-specific settlement policy before attribution. A fee billed separately
by a provider and not taken
from customer gross is an external expense/liability record, not a component
invented inside gross conservation. The provider adapter supplies verified fee
evidence where available; otherwise the reviewed fee schedule and calculation
version are persisted. Integer-minor-unit rounding uses a documented deterministic
remainder rule so components always sum to gross.

Economic components separately store immutable custody class and mutable
settlement state. Custody classes are `platform_custodied`,
`provider_external`, `manual_nonsettling`, or `unknown_review_required`.
Settlement states are `held`, `clearing`, `eligible`, `credited`,
`externally_attributed`, `withheld`, `wallet_liability_recorded`,
`reversal_pending`, and `reversed`.
Changing custody or beneficiary classification requires an audited correction
entry rather than overwriting source evidence.

Attribution or reconciliation reclassifies `suspense_principal` through balanced,
immutable predecessor/successor component entries whose amounts conserve the
source lot. The accepted decision records the fee/tax calculation version and
evidence then applicable. A candidate order, suggested merchant entitlement, or
provider net amount alone cannot make suspense withdrawable.

Only a `merchant_entitlement` component may create merchant withdrawable value.
Platform fees, provider liabilities, tax liabilities, and rounding components
never credit the merchant merely because the customer-disposition lot was
allocated. Creating or completing a transaction cannot directly credit a
merchant balance. `captured_inventory_unavailable`, amount mismatch, ambiguous
DVA matching, uncleared funds, and other unresolved custodied amounts remain
held. A reconciliation decision atomically chooses allocation, wallet credit,
refund, or another reviewed disposition without bypassing either conservation
layer.

Wallet credit is an economic transformation, not merely a customer-disposition
label. One private function follows the global financial lock hierarchy for all
orders reached by the source receipt before locking its lot and components,
splits the exact gross amount when necessary, sets the disposition to
`wallet_credit_pending`, and atomically reverses or replaces merchant, platform,
gateway, and tax entitlement according to the reviewed resolution policy. It
creates one equal `customer_wallet_liability` component and posts the matching
customer-wallet ledger credit under the same idempotency identity before moving
to `wallet_credited`/`wallet_liability_recorded`. The transformed amount can
never later transition to merchant settlement. Provider-external money cannot
become Baci wallet liability unless the same decision records the merchant or
platform funding obligation that makes the wallet credit solvent.
That function acquires the customer-wallet advisory key before canonical receipt
and merchant-wallet keys as defined globally; refund-to-wallet, redemption,
savings, and direct wallet-top-up writers use the same key and row order. Every
legacy customer-wallet RPC and trigger is either routed through this function or
fenced, so a source-specific wallet lock cannot race a refund, redemption, or
settlement transition.

Required customer-disposition fields include transaction, amount, currency,
state, linked allocation or review, predecessor lot for a split, wallet/refund
ledger identity, and timestamps. Required economic-component fields include
disposition lot, beneficiary class and identity where applicable, amount,
currency, calculation version/evidence, custody class, settlement state,
provider availability evidence, balance/settlement or reversal ledger identity,
and timestamps. Private transition functions enforce both conservation layers,
legal transitions, and exactly-once ledger effects. A transaction split across
two orders can therefore allocate one gross portion while another remains in
suspense, and can settle only each portion's merchant entitlement rather than
crediting its gross amount.

### `order_payment_allocations`

Required fields:

- `order_id uuid not null`
- `transaction_id uuid not null`
- `amount_minor bigint not null check (amount_minor > 0)`
- `currency text not null`
- `allocation_type text not null`
- `customer_disposition_lot_id uuid not null`
- `collection_contract_epoch_id uuid not null`
- `created_at timestamptz not null`

The pair `(order_id, transaction_id)` is unique unless a future, explicitly
reviewed same-transaction multi-allocation requirement proves otherwise. Every
allocation consumes one conserved customer-disposition lot or an exact split
from one;
the allocation amount must equal the linked allocated lot amount.

Allocation currency must equal both order and transaction currency. The
service-only allocation function follows the global financial lock hierarchy
for the order and confirmed `customer_receipt`, then enforces both conservation
rules before insert:

- historical positive allocations for an order cannot exceed its payable total;
  and
- historical positive allocations across all orders cannot exceed confirmed gross
  amount of the transaction.

The transaction's confirmed gross customer-paid amount is allocatable. Provider
fees and net settlement are separate ledger attributes and never reduce or
inflate the amount available to orders. A transaction can fund multiple orders
only through an explicitly authorized split-allocation workflow; ordinary
provider completion remains one transaction to one order. Violations create
review evidence and no allocation. Refunds and chargebacks use the reversal
contract below; historical successful allocations are not deleted.

For `exact_balance_only`, the external/provider allocation must exactly equal the
locked remaining balance after dedicated idempotent internal-funding allocations
have been recognized. Wallet, savings, voucher, and store-credit legs retain
their own reservation, reversal, and replay contracts. For
`partial_with_inventory_hold`, allocation and reservation creation or extension
through `collection_due_at` commit together; failure leaves the transaction in
funds suspense with no new allocation. For disclosed preorders, the allocation
records the no-stock-commitment contract presented to the customer. No generic
partial-allocation branch may bypass these rules.

`orders.paid_transaction_id` is populated only when one receipt transaction alone
settles the order. It is null for mixed-tender or wholly internal settlement. The
receipt and internal-funding allocation ledgers are authoritative.

### Refund, dispute, and chargeback compatibility

Refunds and chargebacks never rewrite the original confirmed gross amount or
delete successful allocations. The immutable reversal case owns one or more
amount-bearing, typed reversal-source legs and links their lots/components,
order allocations, amount, currency, reason, actor or verified event, and
lifecycle timestamps. Each leg is a database-enforced tagged union:

- `receipt_transaction` requires one original confirmed `customer_receipt`
  transaction and the exact conserved receipt lots/components and receipt-funded
  allocation portions, where any exist, being reversed. It stores its positive
  `provider_amount_minor`, currency, and exactly one immutable provider-reversal
  obligation/claim identity derived from that transaction's pinned provider/
  account/authority contract.
- `internal_funding_plan` requires one immutable internal-funding reversal plan
  with a non-empty, exact set of `order_internal_funding_allocations`, their
  consumed source slices, and their liability-to-merchant-entitlement links. It
  forbids a transaction ID, provider refund/dispute identity, receipt origin,
  receipt evidence, and every receipt-effect field.

The case-level source set is constrained by reason. A receipt-only customer
refund has one or more `receipt_transaction` legs; a wholly internal customer
refund has only one `internal_funding_plan` leg; and a mixed customer refund has
one or more receipt legs plus one internal plan leg. Every leg has a positive
persisted provider/requested amount in the case currency, and a deferred
conservation check requires the sum of all leg amounts to equal the case's
requested amount. For a customer refund, that amount is also the exact economic
source amount. For a chargeback, it is the authoritative provider-disputed amount;
the separately reserved economic source amount may be smaller only through the
provider-dispute collision contract below.
`(reversal_case_id, original_receipt_transaction_id)` is unique, so one receipt
cannot acquire two provider legs. Every receipt leg owns its own provider
obligation/claim, provider execution idempotency key, and terminal/pending state;
provider/account/authority is always derived from its original receipt, never
selected from the refund request. The
immutable internal plan is created or reloaded under the case's stable idempotency
key before effects, so a wholly internal reversal retains the same idempotency,
locking, entitlement-reversal, and generic reversal-effect contract without
fabricating an original or refund `transactions` row. A `chargeback` case has
exactly one `receipt_transaction` leg, has no `internal_funding_plan` leg, and
its original external receipt/dispute identity is mandatory.

Case idempotency is not source authority. Before any provider call, internal
restoration, merchant debit/hold, or economic-component transition, the private
reversal function writes or reloads immutable `reversal_source_reservations` for
every exact receipt lot/transaction allocation portion and internal allocation/
source-slice portion that the case will consume. The reservation key contains the
canonical source kind/identity and portion, reversal case/leg, amount, currency,
and a lifecycle state. Under the same global source-family locks, the function
computes each source's reversible capacity as its conserved amount less the sum
of *all other* economically consuming reservations: `requested`,
`provider_pending`, `failed_retryable`, `review_required`, `completed`,
`chargeback_open`, and any successor state that has not durably returned the
source. A reservation becomes releasable only through one guarded terminal
no-effect/return-source transition; a provider timeout, ambiguous result, worker
crash, or different case idempotency key never releases it.

One economic minor unit has exactly one atomic reservation target: an allocated
receipt-lot portion (or an unallocated receipt-lot portion for non-order money),
or an internal-allocation/source-slice portion. Transaction-level capacity is a
locked aggregate projection over its lot reservations, not a second reservation
for the same amount. Thus the receipt transaction, its lots, and any allocation
all reject an overlap while a single reversal cannot subtract the same minor unit
twice through parent and child identities.

The advisory family is `reversal-source:<kind>:<immutable-source-id>:<portion>`;
all such keys for a case are discovered before row locks and acquired in ascending
byte order with the normal receipt/reversal family. Every writer that can reserve,
refund, charge back, restore, or release that portion must use it, so a partial
source split cannot evade the cumulative calculation through a sibling row.

The database rejects a new reservation that exceeds that source-global remaining
capacity, rather than merely rejecting a duplicate case key. Receipt lots,
receipt transactions, receipt allocations, internal allocations, and consumed
source slices all use the same cumulative rule, so concurrent refund-vs-refund,
refund-vs-chargeback, and retry-vs-new-case attempts serialize on the sources and
cannot reserve, refund, restore, or debit the same economic value twice. A
replay reloads its own reservations; a distinct overlapping case returns a typed
over-reservation conflict or enters review before an external/provider effect.

The canonical implementation uses a typed reversal ledger. If compatibility
requires a separate `transactions` row for a receipt-backed provider refund or
chargeback, that row has `entry_kind='refund'`, `'chargeback'`, or reviewed
`'adjustment'`, a mandatory unique reversal-ledger identity, direction and
positive magnitude, and no receipt origin, receipt evidence authorization,
customer-disposition lot, payment allocation, or paid-order side-effect authority.
Database checks make `customer_receipt` and reversal provenance mutually
exclusive. An `internal_funding_plan` leg, including every wholly internal
reversal, is database-forbidden from creating any `transactions` row, provider
refund/dispute identity, or receipt-scoped effect. A legacy receipt-backed refund
row is migrated or projected into this shape before its writer cuts over.

Collection history and retained-funds state are separate projections.
`amount_funded_minor` and the canonical collection status derive from historical
successful receipt plus internal-funding allocations and never decrease.
`amount_collected_minor` remains the receipt-funded subset rather than relabeling
internal liability value as newly collected money. Once an order reaches
`paid`, a later reversal cannot project it back to `unpaid` or
`partially_paid`. Separate projections expose `amount_refunded_minor`,
`amount_disputed_minor`, `net_retained_minor`, and refund/dispute states such as
`none`, `pending`, `partially_refunded`, `refunded`, `chargeback_open`, and
`chargeback_lost`. Existing `orders.amount_paid` remains a compatibility
projection of historically funded value until consumers migrate; it is not the
receipt-only collected amount or net retained funds.

Legacy `payment_status='refunded'` may remain a display-compatible terminal
state during migration, but it maps to canonical `collection_status='paid'` plus
`refund_status='refunded'`; it never maps to unpaid collection eligibility.
Checkout reuse, abandoned-order cleanup, invoice matching, inventory release,
fulfilment, analytics, and cancellation read the canonical collection and
refund/dispute projections appropriate to their purpose. No cleanup job can
cancel or reopen an order merely because its net retained amount became zero,
and a fulfilled order remains historically paid after refund or chargeback.

One private reversal function owns amount reservation and ledger effects. It
first discovers the case's typed source legs: every order/receipt lot/allocation
reached by a `receipt_transaction` leg, or every order, internal allocation,
source slice, and backing-lineage asset reached by an `internal_funding_plan`
leg. It then follows the global financial lock hierarchy for those sorted
resources, their receipt or internal-funding-plan identities, and the reversal
identity before locking affected financial rows. The stable reversal idempotency
key elects one case, while the source-global reservation ledger elects its
economic capacity across every case. States include `requested`,
`provider_pending`, `completed`, `failed_retryable`, `review_required`, and
`chargeback_open`; ambiguous provider outcomes remain pending or review and
cannot issue a second refund automatically.

Provider execution is per `receipt_transaction` leg, outside the financial
transaction, through the leg's durable obligation/claim and derived idempotency
key. If one provider accepts its leg while another leg fails retryably or is
ambiguous, the accepted leg is immutable, the case remains `provider_pending`
or `review_required`, and only the unfinished leg may retry. Replay reloads every
source amount, provider obligation, and completed result; it cannot re-call a
completed provider or turn partial provider progress into a second customer
refund. Generic reversal effects are seeded exactly once by `(reversal_case_id,
effect_kind)`, never once per provider leg. Effects whose semantics require a
completed refund remain gated on all case legs becoming terminally completed;
the one case-level processing/review notice may reflect the durable pending state.

Only a customer refund may proportionally or explicitly map a partial reversal
across receipt and internal sources. For a proportional mixed-tender customer
refund of `R` minor units, let `s_i` be each authoritative receipt or internal
allocation's source-global still-reversible minor units after every other active
economic reservation is subtracted and `S = sum(s_i)`. While holding every
source-global reservation lock and before calculating or persisting any portion,
the authority recomputes those capacities and requires `S > 0` and
`0 < R <= S`. Failure returns the existing typed over-reservation conflict or
review result with no provider call, source restoration, reservation, or
persisted split. It first assigns
`floor(R * s_i / S)` to each source. It then distributes the remaining minor
units by descending fractional remainder `(R * s_i) mod S`; ties sort receipt-
funded before internal-funded, then by immutable allocation ID in byte order.
All capacity sums, products, quotients, and remainders use arbitrary-precision
integer intermediates. An implementation without arbitrary-precision support
must use checked arithmetic for `S = sum(s_i)`, every `R * s_i`, the base shares,
and the remainder total. If any supported numeric bound would be exceeded, the
authority returns the typed `refund_numeric_bounds_review_required` result before
persisting a split or reservation and before any provider call, source
restoration, or liability mutation; it may not wrap, saturate, truncate, or fall
back to floating-point arithmetic.
An explicit customer-refund source split must independently conserve `R` and
remain within every locked source's recomputed reversible balance and applies
the same `S > 0` and `R <= S` guard. Before any provider call or
liability mutation, one transaction acquires and revalidates every source-global
reservation lock, persists the reversal case's algorithm version and exact
computed source portions, inserts their source-global reservation rows, and
commits the portions and reservations together. Retry and replay reload those
committed portions/reservations rather than recomputing them. A failure between
either write rolls back both: no portion without its reservation and no partial
durable split is observable.

The persisted portions are then coalesced by original receipt transaction into
exactly one `receipt_transaction` leg per receipt, even when that receipt funded
several allocations. Its `provider_amount_minor` and reserved economic source
amount are the same coalesced portion, which is the exact amount on that leg's
provider obligation. Thus a multi-capture or
multi-provider order may have one to many receipt legs while preserving one
customer-refund case and its exact requested total. The corresponding internal
portions are represented by the one immutable internal-funding plan leg. A
chargeback does not coalesce across receipts: its only permitted receipt leg is
the one original provider-disputed transaction.

A chargeback never uses that mixed-tender algorithm. Its single receipt leg
persists the provider's authoritative disputed amount `D`, receipt/provider event
evidence, and the exact receipt-source reservations it can obtain. It has no
internal source portion and performs no internal restoration. If source-global
remaining receipt capacity is at least `D`, its reserved economic amount is `D`.
If a prior refund or another economically consuming reservation has already
claimed any portion, the function reserves only the remaining amount `Q` and
atomically creates one immutable `provider_dispute_collision` with the chargeback
evidence, all overlapping reservation/case identities, and an excess amount
`E = D - Q`. Deferred conservation requires `Q + E = D`.

The parent chargeback/collision authority persists immutable `D`, `Q`, `E`, and
its non-null immutable finance-scope kind once, before any child loss case. After
its canonical receipt/reversal/source class, it atomically takes the root-keyed,
monotonic-generation/active-count guard, target-`Q` partition header, parent
receipt-lineage availability/non-spend veto, and parent finance scope in that
order before taking the lineage high-water snapshot. It persists a partition
header with target `Q`, not an unbounded
complete child partition. Behind that veto, bounded lineage-census and partition
workers revalidate that guard and classify every exact reserved receipt
lot/allocation once as direct `Q_nonasset` or an asset `q_asset`, then seal the
check `Q_nonasset + sum(q_asset) = Q` with page checksums. Only after that seal may
`Q_nonasset` follow ordinary direct receipt components or child cases/vetoes
materialize in pages; every child binds the parent identity and only its own
`q_asset`, never copies `D`, aggregate `Q`, or `E`. The chargeback may be
acknowledged after the parent veto commits, but no descendant becomes spendable and
that parent cannot decrement the root count until the complete child/E/finance
lifecycle proves it safe; another active parent keeps the root fenced.

The authoritative provider debit/dispute evidence is recorded even where
`Q = 0`; it must never be discarded merely because Baci has no reversible
customer/merchant source left. `Q` follows the ordinary receipt-only chargeback
component and merchant-liability path. A nonzero `E` creates an `E_finance`
finance-owned typed reconciliation/provider-dispute liability with its own
idempotency, recovery, provider-verification, and escalation state. It cannot
refund or restore the customer, reverse an internal allocation, debit/hold merchant
entitlement, create a second provider-refund obligation, enter any backing-loss
plan/recovery row, or reappear through a backing-loss effect. Its immutable parent
finance disposition keeps every affected typed asset fenced until resolved. It
keyset-enumerates every zero-recovery child once with zero economic share, may name
an eligible positive child only as a non-recovery reference, never as `q_asset`,
and seals positive shares plus its explicit parent-only residual exactly to `E`.
Conversely `E=0` has the immutable sealed zero-finance scope with no finance
liability, reference, terminal, or fabricated zero child. Any overlapping prior refund provider obligation is durably
marked collision-pending; an unfinished provider call is held for provider
verification/cancellation rather than auto-completed. A prior completed refund
remains immutable and the collision liability represents the possible duplicate
provider impact. Thus refund-then-chargeback preserves the chargeback evidence and
routes its excess to review, while chargeback-then-refund rejects the later refund
as source-over-reserved before a provider call. Neither event order moves customer
or merchant value twice.

For example, an order funded by 50 minor units from a receipt and 50 from
internal value has a 50-minor-unit receipt chargeback: absent an overlapping
reservation it reserves/reverses only the 50 receipt-funded portion, restores 0
internal units, and cannot create an internal source-liability reversal.
Uncredited merchant entitlement is reduced before settlement only for the
reserved receipt portion. Previously credited entitlement creates an exactly-once
merchant balance debit or hold; insufficient balance becomes a typed negative-
balance liability with recovery, payout-offset, notification, and escalation
rules. Platform fees, gateway liabilities, and taxes reverse only under their
reviewed provider and finance policy rather than being assumed refundable.

For a customer refund with an `internal_funding_plan` leg, the reversal function
restores the internal-funded portion through one immutable source-liability
reversal per persisted allocation/source-slice portion, with a unique idempotency
identity and conserved amount. Mixed-tender customer-refund allocation is
deterministic and cannot send the internal portion through a provider refund. A
closed source requires a reviewed successor-ledger resolution; an unavailable
destination remains a durable obligation instead of silently becoming external
cash or disappearing. A wholly internal customer refund uses this same branch
and seeds the generic reversal notice, loyalty, fiscal, advertising, and order-
lifecycle effects from the reversal case; it has no provider-refund claim or
receipt-scoped settlement/acknowledgement effect. A chargeback is forbidden from
this branch. If its original receipt has no typed backing lineage, it must not
fabricate a backing-loss case, root guard, parent loss authority/veto, child, or
recovery obligation. If its receipt has typed backing lineage, the same
authoritative evidence/source-reservation intake transaction must atomically
activate the root guard and install the parent chargeback/collision loss authority
(`D`/`Q`/`E`, target-`Q` header, finance scope, veto, and high-water) before
provider acknowledgement. Only its later bounded census, partition, child-
materialization, and sealed `q_asset` recovery lifecycle may create backing-loss
children or recovery obligations. That path must not restore or otherwise reverse
the internal allocation.

Implementation planning must inventory both existing receipt-backed compatibility
shapes: providers that mutate an original transaction to refund statuses and
flows that create a separate refund transaction. It must separately inventory
wallet/savings/store-credit/stored-value reversal writers that have no receipt
transaction. During migration, every writer calls the private reversal authority
or remains fenced; none may write the new reversal ledger independently. The
typed source union preserves the same conservation, merchant-liability, and
reversal-scoped generic-effect contract for both receipt and wholly internal
reversals. Chargeback evidence follows the receipt-only conservation and
merchant-liability contract even when the provider debits Baci before Baci
receives the event; it cannot use the internal-restoration branch.

### Reconciliation decisions and obligations

Free-text changes to `reconciliation_review` cannot move money. Add a private,
immutable reconciliation-decision ledger with, at minimum, review, merchant,
transaction, customer-disposition-lot, economic-component, nullable selected-
order identity, and an immutable candidate-set snapshot containing zero, one, or
many candidate order/tranche identities and the matcher evidence for each;
expected review version;
stable client idempotency key; selected outcome; amount and currency; actor and
permission snapshot; reason; request/evidence hash; execution state; resulting
allocation, wallet-credit, refund, replacement-order, or external-obligation
identity; and timestamps.

An authorized private resolution function discovers the nullable selected order
without row locks, then follows the global financial lock hierarchy for that
order and transaction identity before locking the review and required financial
rows. Non-selected candidates are immutable review evidence, not advisory or row
lock targets. It rejects a stale
expected version, a different decision for an already-resolving review,
cross-tenant evidence, or an amount that violates funds conservation. Replaying
the same idempotency key returns the original decision. A different key cannot
choose another financial outcome once a decision has been accepted. The
function atomically records the decision and performs the database-owned portion
of allocation, wallet credit, refund reservation, replacement-order linkage, or
other disposition. A zero-candidate or unresolved multi-candidate review remains
transaction-scoped and does not require a fictitious order. Provider calls
execute through a decision-scoped durable
claim and can only advance the chosen outcome.

After locks are acquired, the function revalidates the selected order/tranche's
tenant, currency, outstanding balance, collection epoch, inventory eligibility,
and expected version against the frozen candidate snapshot. A changed or no-
longer-eligible candidate returns a typed stale-decision conflict without moving
money. Lock timeout or serialization failure is retryable under the same
decision idempotency key; it cannot fall through to a second outcome.

Reviews have typed `open`, `resolving`, and `resolved` states. `resolved_at` is a
compatibility projection and free-text notes are never authority. A review
enters `resolved` only when its conserved disposition is terminal or the
remaining provider-external duty is represented by a durable obligation with a
clear owner and lifecycle. External obligations record amount, currency,
merchant, customer-safe remedy, due time, status, provider evidence, executor
claim, completion evidence, and escalation age. They cannot be satisfied twice
or silently deleted. High-risk manual outcomes may require a separately approved
maker/checker threshold, which implementation planning must define with finance.

### Verified webhook inbox

Use a service-only private-schema table. It stores:

- provider plus the signature-key/endpoint ingress scope; resolved merchant and
  provider-account scope are nullable until safely established;
- provider event ID or deterministic replay key;
- event type;
- raw-body SHA-256 hash;
- normalized provider reference, amount, currency, and timestamps;
- adapter schema version;
- signature-verification key identity and verification timestamp, without the
  signature or secret itself;
- classified completion-authority key such as `credit_direct_bnpl`,
  `paystack_card`, `paystack_order_dva`, `paystack_wallet_dva`, or
  `paystack_agentic_dva`;
- immutable `ingress_contract_generation_id` captured from the verified endpoint,
  signature-key, parser, and authority contract before acknowledgement;
- no parent-level financial-routing-resolution ID, attempt binding, financial
  routing generation, receiving-intent epoch, or other authoritative financial
  result; those belong only to immutable child proof/proposal/result graphs. The
  parent may expose checked child counts by terminal category as operational
  projections, but they cannot select a route or transaction;
- non-authoritative aggregate child-decision counts and a database-enforced
  `intake_protection_complete` flag that can become true only when every frozen
  child has exactly one terminal decision. Each decision lives on its child proof
  as `claim_installed` with at most one claim/order, `no_safe_order_claim`,
  `late_ingress`, or `not_order_protecting`, plus decision time, safe reason code,
  review-scope kind (`merchant_reconciliation | global_quarantine | none`), and
  nullable review ID. There is no persisted or acknowledged `claim_pending` child;
- processing status, including `unscoped_quarantine`, `resolution_proposed`,
  `scope_adopted_receipt_pending`, `resolved`, `conflict_review`, and terminal
  processed states, plus attempt count, last error, and processed timestamp;
- immutable normalized child-manifest hash, child count, conserved amount/currency
  summary, contract bound, adapter version, and the durable source-manifest ID;
  these are an operational projection of the durable manifest, singleton
  contracts store one deterministic child, and only explicitly bounded-multi-
  capture contracts may store more;
- a versioned, redacted normalized envelope containing every safe field required
  to process the event after acknowledgement, including receiver, provider
  customer, assignment, amount, currency, and paid-time evidence where relevant.

Do not store credentials, signatures, full customer addresses, card data, or
unredacted request bodies. If a provider contract later requires retained raw
payloads, that requires a separate encrypted-blob design with explicit key
ownership and retention.

The inbox is operational replay infrastructure, not the financial books. Its
success-row retention is configurable per provider and may default to 90 days
only after finance, legal, and provider-contract owners approve that value. A
successful inbox row is prunable only after its durable source manifest and every
child source proof have been verified complete, every existing child command is
terminal, every commandless child has a durable reviewed disposition, and the
retention job has recorded a projection checksum.
Inbox deletion is `SET NULL` only on the durable manifest's optional operational
inbox link; financial evidence links to the durable child source proof, never to a
deletable inbox foreign key. Financial commands have no required inbox foreign
key and resolve their source through the retained manifest/child/adoption links.
The manifest, child proofs, commands, evidence, and accepted financial graph use
financial-record retention and cannot cascade from
inbox deletion. Deletion therefore never deletes or orphans the normalized
confirmed transaction, allocation, assignment epoch, reconciliation decision,
actor evidence, child-cardinality/conservation proof, or immutable audit facts
required by the financial-record retention policy.
After pruning, a redelivery inserts or reloads an operational inbox row but must
first reload the durable manifest through its independent verified replay-key
unique constraint. It reproduces and compares the frozen child manifest, reuses
the retained child proofs, proposals, commands, evidence and results, and either
returns the existing terminal outcome or records conflict. It cannot create a new
manifest, child command, canonical identity, or transaction for the same ingress
replay identity.
Unresolved inbox rows remain until their linked review is resolved and its
durable evidence has been verified. Unscoped rows live in a platform/global
quarantine queue because no merchant-scoped operator has authority before tenant
resolution. Access is limited to an audited operations role and privacy-filtered
projections. Immutable adoption proposals record candidate merchant/account,
candidate non-authoritative financial-routing target for every manifest child,
evidence, proposer, reason, expected inbox version, and manifest hash. A guarded
compare-and-set adoption attaches only the accepted merchant/account scope,
immutable adoption decision, and one non-authoritative
`payment_financial_routing_proposal` per child, or records a conflict. Automatic
whole-manifest adoption is permitted only when every child independently proves
the same provider-account and tenant scope. Mixed-scope, missing-scope, or child-
target disagreement enters conflict review and creates no financial command. The
adoption never creates or attaches an accepted financial-routing resolution,
mutates the raw ingress identity, or silently overwrites a prior proposal.

Accepted adoption enters `scope_adopted_receipt_pending` and creates exactly one
durable `quarantine_adoption` financial command per immutable manifest child,
keyed by `(adoption_decision_id, child_identity)`. Each later canonical child
receipt transaction consumes that child's immutable source-proof and routing-
proposal IDs and alone creates its evidence, accepted routing/origin resolutions,
origin, transaction, and links. Crash, lease expiry, or retry between adoption and
receipt recording reloads the same child command; it cannot mint a second
proposal or accepted graph. One child's receipt conflict changes only that command
to review, and the parent inbox becomes terminal only after every manifest child
is completed or durably reviewed. Receipt processing cannot choose a different
adoption or apply one child's accepted scope to a disagreeing child.
Unresolved rows and proposals cannot be deleted, and retention starts only after
terminal receipt or reviewed disposition. Provider-specific acknowledgement-to-
triage, adoption-to-receipt, and triage-to-resolution SLOs own paging, escalation,
and named operational ownership.

Deterministic adoption is allowed only when independently verified provider-
account ownership and stable reference/receiver evidence prove one merchant and
routing scope. Any operator-selected cross-tenant adoption is a high-risk
financial action: one authorized operations principal proposes it and a distinct
finance-approved checker accepts it against the immutable evidence snapshot and
expected version. Neither actor may be the affected merchant or derive authority
from the proposed tenant. A single proposal, note, amount, email, or operator can
never grant money-writing authority.

Operator-selected adoption may bind the verified provider account and merchant
scope only to an `unattributed_provider_account` proposal. The adoption itself
does not record money. Its durable follow-on receipt command records confirmed
money as gross suspense through the canonical receipt transaction and cannot
select an order attempt or receiving intent, allocate merchant entitlement,
expose customer/order detail to the adopted merchant, reserve inventory, or
authorize fulfilment. Allocation requires a separate authorized reconciliation
decision against a fresh immutable evidence snapshot. That decision re-proves
current tenant, customer/order or receiving-intent authority, amount/currency,
allocation capacity, inventory disposition, and fulfilment state, uses its own
expected version and idempotency key, and applies the applicable maker/checker
threshold; acceptance of the adoption is not acceptance of the receipt or
allocation. If an accepted mapping is later disproved,
the original adoption remains immutable and correction occurs through conserved
reversal/reclassification entries plus an incident record, never by rewriting
the inbox or routing resolution.

A verified inbox row is ingress evidence, not by itself transaction authority.
For each account-scoped child financial-routing proposal and source proof, one
child receipt transaction may create or reuse `verified_webhook` confirmation
evidence pinned to the proposed attempt, receiving-intent, or provider-account
generation; it then accepts that child's routing resolution and elects the
authorizing evidence in the same commit. Neither the proposal nor an unlinked
evidence row can write money. An unresolved child remains ingress evidence and
review only. Inbox replay therefore converges independently per immutable child
on zero or one accepted evidence/transaction graph; provider verification can
independently create its own typed evidence that converges on the same child
confirmed-money identity.

The normalized envelope is the asynchronous worker contract, not merely a
diagnostic sample. An adapter may acknowledge success only after signature
verification, endpoint/authority classification, ingress-contract-generation
capture, schema validation, and one transaction commits the durable inbox, the
independently replay-keyed source manifest, its complete immutable child set,
manifest checksum/count/conservation facts, and a terminal intake-protection
decision for every child. Before that transaction writes or row-locks any
financial/collection row, it parses the frozen manifest and discovers the complete
bounded child/order resource set, acquires and revalidates the complete sorted
advisory set, and locks all required order rows in canonical order. It then writes
or reloads inbox/manifest/child proofs followed by child claims according to the
global row hierarchy. Each safely associated child commits its protection claim or
terminal `late_ingress` decision before acknowledgement. A child for which no safe unique order can be derived commits an
explicit `no_safe_order_claim` decision with its review scope before
acknowledgement. If
merchant and provider-account scope are independently established and every
candidate remains within that tenant/account, the decision opens merchant-scoped
payment reconciliation using a privacy-minimized projection. Global quarantine
is reserved for unresolved, conflicting, or cross-tenant merchant/account scope;
mere same-tenant order ambiguity cannot escalate authority to platform operations.
There is no acknowledged `claim_pending` state. If the shared locks cannot be
acquired within the provider-specific acknowledgement budget, the transaction
rolls back and the endpoint returns the provider's retryable non-success response;
the replay key makes the retry idempotent. Acknowledgement does not assert a
tenant, attempt, financial-generation match, or confirmed payment. Workers
reject unknown ingress versions into durable review rather than interpreting
them with new code, and they cannot acquire financial authority until exactly
one typed financial routing resolution and its pinned generation are elected.
Provider server-to-server re-verification may strengthen this evidence but
cannot be the only way to reconstruct an already acknowledged event.

The unique replay key copied independently onto both inbox and durable source
manifest is provider-specific and is frozen from the facts verified at first
acknowledgement:

- Svix providers: provider, completion authority, verified signature-key/endpoint
  namespace, verified `svix-id`, and event type;
- Paystack and similar gateways: provider, completion authority,
  provider-account namespace, verified provider reference, and event type;
- providers without a stable event ID: a deterministic operational locator over
  verified provider, completion authority, endpoint/signature-key namespace,
  event type, reference, amount, currency, provider timestamp, and raw-body hash,
  with an attached immutable ingress-scope snapshot. The locator itself excludes
  mutable/adopted tenant and provider-account fields and is the unique lookup key;
  the snapshot stores their verified values or explicit `unresolved` sentinels
  exactly as known at first acknowledgement.

That last locator deduplicates an inbox envelope only. It does not become a
confirmed-money identity. Adoption or later scope discovery never changes the
locator or its ingress-scope snapshot; it appends routing evidence separately.
Redelivery must look up the frozen locator before applying newly known scope, so
unscoped acknowledgement, later adoption, and post-pruning redelivery converge on
the same manifest. If the adapter cannot establish a stable receipt key
independent of conflicting economic facts, the event remains durable evidence in
review and cannot automatically create a transaction.

The inbox and durable source-manifest unique constraints each use the complete
verified ingress replay identity;
it is safe before merchant resolution because Svix event identity is scoped to
the verified endpoint/key, not to an untrusted provider reference. Financial
receipt identity and reference binding remain separately account-scoped. A
provider reference from one merchant account can never deduplicate money from
another. If merchant/account scope cannot be established, the inbox row remains
in durable unscoped quarantine and is acknowledged, but it cannot create
confirmation evidence, select a financial route, create a merchant-scoped
review, or use an unscoped reference as a financial identity.

### SDK possible-capture evidence

A private `payment_sdk_possible_capture_evidence` table is the non-financial,
non-confirmation source for Credit Direct SDK first reports. It is not a branch of
`payment_confirmation_evidence` and can never authorize a receipt. Each immutable
row stores:

- evidence ID, merchant, order, non-null collision domain, payment attempt,
  non-null provider/account/
  authority, and normalized non-null provider-session identity. Missing or empty
  session identity fails before advisory-key derivation;
- authorization kind (`authenticated_customer | signed_tracking_grant`) and an
  immutable authorization snapshot. Authenticated-customer evidence stores the
  verified customer subject/session epoch and has no grant ID. Guest evidence
  stores the consumed signed tracking-grant ID. Neither stores a caller-supplied
  email or raw bearer token;
- a versioned exact request hash, expected amount/currency, database-owned
  `received_at`, and an ordinary write-once `protection_expires_at` column. The
  guarded function assigns both from one captured database timestamp, with the
  latter exactly 48 elapsed hours later only for `protected`; it is null for
  `late_sdk_success` and `cross_order_collision_review`;
- result kind `protected | late_sdk_success | cross_order_collision_review` and
  immutable reason/status metadata. The collision result freezes predecessor and
  successor order IDs plus collision-domain ID and alias-set snapshot; it owns one typed reconciliation
  review, never a protection claim or collection authority.

The stable source identity has an ordinary unique constraint across non-null
provider/account/authority, attempt, and normalized provider session; a consumable authorization or tracking grant is not part of
that identity. Order, versioned request hash, amount, currency, and authorization
subject are frozen equality/conflict facts. Under the declared provider-reference-
family SDK key, after the order key,
the function looks up exact existing evidence before generic consumed-grant
rejection. A consumed signed grant is accepted only when that exact evidence row
has an immutable authorization row proving it consumed the grant and every frozen
fact matches; a replacement valid grant appends a corroborating authorization row
for the same evidence but can never mint new evidence, change its result, or extend
its timestamp. A private append-only
`payment_sdk_possible_capture_authorizations` table stores evidence ID,
authorization kind, authenticated subject/session epoch or tracking-grant ID,
frozen request-fact hash, consumed/corroborated time, and verifier actor. Its
tracking-grant identifier is globally unique to one evidence row; authenticated
subject/session authorization is unique only within the stable SDK source and may
legitimately authorize another purchase through a different attempt/session. The
authenticated-customer branch revalidates the customer/session epoch, writes that
authorization kind, and never invents a consumed grant.

For `protected`, the ordinary expiry column is non-null and exactly one
`sdk_first_report` claim owns a unique `sdk_possible_capture_evidence_id` foreign
key to the evidence before commit.
For `late_sdk_success` and `cross_order_collision_review`, exactly one
reconciliation-review row owns a unique `sdk_possible_capture_evidence_id` foreign
key to the evidence, and no protection claim or confirmation-evidence/transaction
link is permitted; the collision branch additionally requires immutable
predecessor, successor, and collision-key facts. The evidence row
carries neither backlink, so the
insert graph is acyclic. Deferrable foreign keys plus a deferred constraint
trigger validate at commit that `protected` has one claim and no result-review link,
while `late_sdk_success` and `cross_order_collision_review` each have one review
link and no claim. All result kinds preserve the first database receipt time
forever.

Evidence and authorization rows follow verified inbox/source rows and precede order-protection claims
in the global hierarchy. The SDK path skips unused inbox/source classes, locks
order then attempt/session/authorization rows, inserts or reloads this evidence,
inserts/reloads its authorization row, and only then installs a claim or the
idempotent result-review row. Tracking grants
are classified with the attempt/session class for this operation; no helper may
lock them after SDK evidence or claims.

### Order protection claims

A private `payment_order_protection_claims` table gives cleanup an indexed,
order-scoped veto without treating an inbox row as money. Each immutable claim
stores order and merchant, provider/account/authority scope, source kind, claim
kind (`verified_possible_capture` or `verified_money_ingress`), typed evidence,
server `received_at`, optional `expires_at`, status, and timestamps. Its source is
a database-enforced tagged union:

- `webhook_child` requires durable source-manifest and child-proof IDs and forbids
  SDK evidence/session fields; it may create only `verified_money_ingress`. Its
  ingress mode is `ordinary | collision_overflow_frozen`. The ordinary branch
  forbids an overflow anchor. The overflow branch requires the exact immutable
  attempt-reference binding, currently frozen collision root/recovery anchor, and
  selected order equality. A new overflow claim can be inserted only before the
  child has any ordinary financial command/processing link; idempotent ingress
  replay reloads the existing claim. That retained claim is expressly allowed to
  survive into post-recovery ordinary processing and closes only through the
  typed terminal-closure contract below;
- `sdk_first_report` requires one immutable
  `payment_sdk_possible_capture_evidence` row whose result is `protected`, plus
  matching attempt and provider-session identities; authorization provenance is
  frozen on the evidence row and revalidated by the installer. It
  forbids manifest/child fields and may create only
  `verified_possible_capture`.

Partial unique constraints permit one order-associated claim per webhook child
proof and one per SDK first-report evidence/session identity. One immutable source
may protect at most one order, while a bounded parent manifest may protect several
distinct orders only through distinct safely associated children. The order/kind/
cutoff index supports cleanup. Competing order associations for one source create
no claim. Candidates confined to one independently verified merchant/account
enter merchant-scoped reconciliation; unresolved, conflicting, or cross-tenant/
account candidates enter platform/global conflict review. Uniqueness on source/
order alone is explicitly insufficient; source-identity uniqueness prevents one
source protecting two orders.

Claim-shape checks also enforce timing semantics. A separate append-only
`payment_order_protection_closures` table owns a unique foreign key to the claim
through `protection_claim_id`. It is a database-enforced tagged union with exactly
four terminal authorities:

- `confirmed_money_recorded` is permitted only for `webhook_child`, requires
  non-null `financial_command_execution_id`, `confirmation_evidence_id`,
  and `transaction_id`, and forbids `reconciliation_decision_id` and
  `terminal_disposition_id`; the completed command's immutable result IDs must be
  those exact evidence and transaction rows;
- `confirmed_money_reviewed_terminal` is permitted only for `webhook_child`,
  requires non-null `reconciliation_decision_id`, `terminal_disposition_id`, and
  the decision's completed `authorized_reconciliation` command ID, permits only
  `source_not_for_order`, `duplicate_completed_receipt`, or
  `funds_resolved_without_order`, and forbids confirmation, transaction, financial-
  result, and provider-verification IDs;
- `possible_capture_disproved` is permitted only for `sdk_first_report`, requires
  non-null `financial_command_execution_id`, `reconciliation_decision_id`, and
  `terminal_disposition_id`; the command source must be `provider_verification`,
  its immutable evidence/result must be tied to the SDK evidence, and the accepted
  decision permits only `provider_confirmed_no_capture`. It forbids confirmation
  and transaction IDs;
- `possible_capture_reviewed_terminal` is permitted only for `sdk_first_report`,
  requires non-null `reconciliation_decision_id`, `terminal_disposition_id`, and
  the decision's completed `authorized_reconciliation` command ID, permits only
  `provider_confirmed_no_capture`, `capture_resolved_externally`, or
  `protected_attempt_superseded_after_review`, and forbids confirmation and
  transaction IDs.

Check constraints enforce each branch's required and forbidden foreign keys. A
deferred constraint trigger proves that the closure, claim, terminal result,
command, source child or SDK evidence, order, merchant, provider, account, and
authority are identical; the reviewed branches additionally admit only an
enumerated terminal disposition, never an open/escalated/retryable decision. No
route or direct application SQL may insert a closure. The guarded terminal
financial/provider-verification/reconciliation function inserts it in the same
transaction that commits the referenced terminal result, after holding the
claim's complete advisory and row-lock set. Command lease expiry, retry
exhaustion, worker abandonment, or mutable status alone is not a closure; it
retains the veto and opens or escalates review until an authorized terminal result
commits. Claim `status` is only its audit projection. A `webhook_child` money-
ingress claim has `expires_at IS NULL` and stops vetoing only when that
authoritative closure exists. An
`sdk_first_report` claim has `expires_at NOT NULL`, must equal its linked SDK
evidence's write-once expiry under the deferred constraint trigger, and cannot be
extended or reopened.
Cleanup evaluates that timestamp directly; `status` is an audit projection, not
the sole expiry authority.

A guarded webhook installer may create or reuse a claim only after signature
verification and safe child-to-order association from signed metadata plus active
or superseded reference/session, provider account, event-time, amount, and
currency checks. It first parses and freezes the candidate manifest and discovers
the complete bounded child/order identity set without taking row locks or writing.
It then acquires the complete sorted advisory set, revalidates it, locks every
order row in canonical order, and only then inserts or reloads the inbox, durable
manifest, all child proofs, and child claims in the global row order. It records
why each child association was accepted and may precede final attempt or
financial-routing election. After locking, it rechecks every order state and
cutoff. Failure to prove one order for a child records `no_safe_order_claim` for
that child and routes to
merchant reconciliation or global quarantine according to the independently
verified tenant/account scope;
finding an order already terminal records `late_ingress`. Neither outcome creates
an active claim. Lock-budget failure rolls back intake and produces a retryable
non-success response, so acknowledgement can never leave a safely associated
child waiting asynchronously for its protection decision. A claim cannot create
confirmation evidence, select a processor, allocate money, reserve or confirm
inventory, mark an order paid, or grant fulfilment authority.

The `collision_overflow_frozen` ingress mode is the sole exception to complete
component-order discovery at intake. It is available only while the recovery
fence already prevents collection-authority and cleanup transitions, only for one
exact immutable reference binding, and only under the selected order plus every
affected frozen-root/anchor and source-family lock. It persists the same retained
manifest/child and non-expiring `webhook_child` claim, but no financial command is
claimable until bounded recovery finalizes and an ordinary worker revalidates the
complete resulting closure. The worker then links the single ordinary command to
the existing child/claim; it cannot create a replacement claim, and retry or
review leaves the original veto active until matching terminal closure. Metadata fallback, fuzzy matching, multiple candidate
orders, or a missing fence cannot use this mode. Ambiguous evidence remains
provider-account/global quarantine and creates no order claim.

Cleanup queries this table by order in its final locked recheck; it never scans
inbox JSON or assumes nullable inbox merchant/attempt columns are populated.
Claims expire or close only under typed rules. A later routing conflict preserves
the claim and opens review, while a child safely proved to concern another order
cannot be retargeted in place.

### Invoice DVA assignments

Keep `order_payment_accounts` as the current projection and preserve immutable
assignment epochs as defined by the invoice-DVA design. Each epoch includes:

- provider;
- account number and normalized bank identity;
- immutable provider customer code;
- assigned customer email;
- payable amount snapshot;
- matching mode: `exact_invoice_balance` or `explicit_installment_tranche`;
- for an installment tranche, immutable tranche number, expected tranche amount,
  tranche due date, and predecessor/successor tranche identity;
- assignment time;
- invoice due date, merchant timezone, and immutable UTC `due_at` cutoff;
- half-open `effective_from` and `effective_to` boundaries;
- predecessor/successor epoch identity and change reason;
- exact linked payment-attempt ID;
- display-current and superseded state.

The Paystack account remains permanent. Superseded invoice assignments remain
evidence and are never treated as proof that the provider account expired.

Installments additionally use immutable schedule epochs and tranche rows,
separate from assignment epochs. A schedule epoch records the disclosed total,
currency, tranche count, ordered tranche identities, customer-terms version,
half-open `[effective_from, effective_to)` interval, and predecessor/successor
identity. An exclusion constraint permits only one schedule epoch for an order
and collection-contract epoch at any effective instant. Each tranche
records sequence number, exact amount, its exclusive UTC `tranche_due_at`, prior
and next identity, and lifecycle state. `collection_due_at` remains the whole
order's final collection/remediation deadline; `tranche_due_at` is the automatic-
matching cutoff for that tranche.

Schedule issuance runs in one private function under the global financial lock
hierarchy for the order and collection epoch. Database checks and a deferred
conservation trigger require:

- every tranche amount is a positive integer minor-unit value in the schedule
  currency;
- sequence numbers are unique, contiguous from one, and their count equals the
  immutable declared tranche count;
- the exact tranche sum equals the schedule's authorized external-collection
  total and that total equals the installment amount authorized by the linked
  collection-contract epoch, without exceeding the locked order payable balance;
- tranche deadlines are strictly increasing, not earlier than issuance, and not
  later than the order's `collection_due_at`; and
- predecessor/successor links reproduce the same sequence without a cycle or
  orphan.

No tranche becomes issued until all constraints pass. After issuance, schedule
commercial fields and completed/current reserved tranche rows are immutable.
`effective_to` has one database-owned close-once compare-and-set; closing an
epoch is not a general edit or reactivation authority.

A reviewed future-term change first creates an
`installment_schedule_change_proposal`, not a successor schedule epoch. The
proposal stores the order, predecessor schedule/collection epoch, proposed
remaining terms and exact conserved value, customer-consent evidence where
required, actor/reason, idempotency key, expected versions, and lifecycle
`pending_activation | activated | cancelled | review_required`. It creates no
collectible authority and does not supersede predecessor tranches while pending.
A partial unique constraint permits at most one live `pending_activation`
proposal for an order and predecessor schedule/collection epoch. Proposal
commercial terms are immutable after insert. An edit is a cancel-and-replace
compare-and-set under the order lock; replaying the same scoped idempotency key
returns the same proposal. An activated proposal has one non-null
`successor_schedule_epoch_id`, and that successor ID is globally unique across
proposals, making activation one-to-one.

If no current tranche is reserved or possibly capturable, the proposal activates
immediately in one global-lock-hierarchy transaction: close the predecessor at
the database activation time, mark its untouched future `scheduled` tranches
`superseded`, create the immutable successor epoch and successor tranche rows
with that exact `effective_from`, and mark the proposal activated. If a current
tranche is reserved or possibly capturable, the proposal remains pending. The
current tranche's terminal transition revalidates consent, order balance,
inventory, deadlines, and proposal versions, then performs the same close/create/
supersede/activate sequence atomically. The successor row does not exist before
that boundary, so no unknown effective time is later written into an “immutable”
epoch. A failed or crashed activation leaves the predecessor authoritative and
the proposal retryable under its idempotency key; cancellation never mutates the
predecessor.

The current tranche terminal transition locks the live proposal in the global
row order and is the sole arbiter of successor publication. If a valid live
proposal exists, it closes the predecessor, creates and links the successor,
supersedes untouched predecessor future tranches, publishes exactly one first
collectible authority from the successor when eligible, and skips ordinary
predecessor next-tranche publication. With no live proposal it follows the
ordinary predecessor next-tranche path. If the proposal is stale or fails
business revalidation, the verified money and current tranche terminal result
may commit, but the proposal becomes `review_required` and no next collectible
authority is published. Reviewed resolution must explicitly cancel and resume
the predecessor or replace the proposal; there is no silent fallback. A crash,
constraint failure, or database error rolls back the entire terminal transition,
and retry reuses the same proposal, successor, tranche, attempt, and command
identities.

A deferred conservation trigger requires the successor's remaining sum to equal
the locked outstanding authorized installment balance. Candidate queries require
both the tranche and its schedule epoch to be effective for the complete verified
provider paid-time uncertainty interval, preventing a predecessor and successor
from matching the same transfer.

Exactly one unpaid tranche per installment order may be `collectible` under the
order collection lease. Future tranches are `scheduled` and are excluded from
automatic candidate queries even when they have the same amount. After proposal
arbitration, successful allocation atomically marks the active tranche completed,
closes its attempt and assignment, and—only when no successor proposal won and
the predecessor schedule remains payable—creates or activates the predecessor's
next tranche attempt and assignment under the same order/lease lock. A winning
successor publishes only its first eligible tranche. Failure to
publish the next authority leaves it non-actionable and retryable; it cannot
expose two collectible tranches. An early transfer cannot be inferred as payment
for a future tranche from amount alone. It enters review unless immutable,
provider-verified evidence explicitly targets that future tranche under a
separately reviewed early-payment contract.

Before next-tranche publication, the transition recomputes locked outstanding
balance and remaining schedule conservation, revalidates inventory/collection
policy, and requires `now() < tranche_due_at`. If the next tranche is already at
or past its cutoff, has inconsistent remaining value, or cannot retain the
required inventory protection, it stays non-actionable and one typed resolution
case is created. Retry can publish it only through an authorized successor epoch
with a valid future cutoff; ordinary retry cannot revive an overdue tranche.

## Lifecycle Rules

### Standard checkout orders

The unchanged checkout idempotency key is reusable for 24 hours for existing
non-voucher storefront order RPCs. Quiz-voucher award claims retain their
existing idempotency opt-out and one-time redemption contract.

At ordinary 24-hour expiry the browser may rotate the key. It must not rotate or
discard the protected-order binding while the same order has a time-bounded
possible-capture review. The original key and exact server request hash remain
bound to that order until `protection_expires_at`; retries return the existing
order plus “Payment confirmation pending” and cannot initialize another rail.

The create-order RPC also rejects a new key carrying the same authenticated
customer and exact commercial request hash while that protected binding is
active. Guest checkout uses the signed protected-checkout/tracking proof when
available. On another device, exact normalized email plus the exact server
request hash may act only as a collision veto: the response is generic and does
not reveal or reuse the prior order until email ownership is verified. An
explicit “Start a separate purchase” action performs CSRF/auth, prior tracking
proof, or email-OTP validation, records the customer's acknowledgement, and
returns a short-lived single-use purchase-intent nonce that authorizes one new
order. Email, amount, or a time window alone never silently reuses an order.

Rotation is a collection-authority transition, not a browser-only decision. The
create-order function and SDK first-report function resolve the same persisted
checkout collision domain and its complete legacy/current alias closure. Each
discovers every matching predecessor/successor order, locks those order advisories
before all sorted collision alias/domain keys, revalidates both full sets, then
takes order rows and collection leases in canonical order. Without a valid
separate-purchase nonce, SDK-first
installs protection on the predecessor and forces a concurrent or later rotation
to return or generically veto that order; it cannot publish a successor collection
lease. Rotation-first may atomically supersede the old collection lease, insert
the successor, and publish that successor's single actionable lease only after it
locks one `payment_attempt_noncapturability_evidence` row matching the predecessor
attempt, provider/account/authority, and provider session. Local lease state, the
24-hour browser cutoff, popup closure, or
a best-effort cancel request is not revocation evidence. If safe external
non-capturability cannot be proved, rotation creates no successor order or lease,
retains the predecessor veto, and creates one typed
`rotation_blocked_possible_capture` review result. A later SDK report after proved
revocation/expiry records immutable
`cross_order_collision_review` evidence tied to both orders and creates no claim,
reopening, or second actionable lease. A valid nonce authorizes exactly one
distinct intentional result order inside the same collision domain, but it never
satisfies noncapturability, supersedes or replaces the predecessor attempt/lease,
or participates in provider switching. The predecessor remains unchanged under
its existing contract; the nonce branch publishes only the new result order's own
lease after database constraints prove different protected/result order IDs.
Nonce validation and consumption remain in the union collision/order lock
transaction. No unapproved collision domain may commit two actionable collection
leases or two automatically collectible orders outside this explicit separate-
purchase branch.

Purchase-intent nonces are stored only as hashes in a private table and are
bound to merchant, protected order, collision domain, verified customer or guest-
proof subject, and the collision domain's frozen version-independent commercial-
request identity, issue time, expiry, and the one resulting order. That identity
is the database-owned opaque `collision_domain_id`, not any request hash. The
issuance record also snapshots its
request-contract generation and exact hash for audit, but consumption resolves
that identity through database-proved active or draining legacy/current aliases;
a deployment or rollback during the nonce lifetime cannot invalidate equivalent
commercial facts. Unknown, ambiguous, non-equivalent, or retired generations
without the nonce's retained issuance bundle fail closed.
For guests, the subject is the validated tracking proof or email-OTP grant, not
an unverified email string. The create-order function checks every binding and
consumes the nonce under the same transaction that inserts the new order;
concurrent reuse returns the already-created result or a generic conflict. A
nonce cannot authorize another merchant, cart, customer, or changed commercial
payload, and cannot enter the provider-switch branch. Issuance and verification
are rate-limited and audited without storing
the plaintext nonce or OTP.

At 24 hours, the cleanup job may cancel and release inventory only when all of
the following are true:

- the order is unpaid and unfulfilled;
- there is no verified provider success;
- there is no explicit Credit Direct SDK-success protection state
  inside its 48-hour confirmation-review window;
- there is no equivalent provider state inside a provider-specific protection
  window approved before that provider is activated;
- there is no open reconciliation review that protects captured or possibly
  captured funds;
- there is no active invoice-DVA assignment;
- no merchant or fulfillment workflow has made the order non-reusable.

An in-flight or disputed payment is not cancelled merely because the client
checkout key expired.

For Credit Direct, explicit SDK-success evidence protects the order and open
reconciliation case for at most 48 hours from the server-recorded
`sdk_success_reported_at`. The server writes that timestamp when it accepts the
validated SDK-success callback; a client-supplied clock cannot choose it. This
intentionally replaces the current 14-day cleanup exception when Credit Direct
cuts over. Popup-open, popup-close, cron, inferred evidence, retries, and page
refreshes do not start or extend the window.

One guarded first-report database function atomically creates or reloads
`payment_sdk_possible_capture_evidence` and verifies the same merchant, order,
attempt, provider session, authorization subject, authority, request hash, amount,
and currency. It derives stable source identity without the grant ID, rejects a
missing/empty normalized provider session before lock derivation, discovers the
complete bounded matching order set, active collision-component root/generation,
member domains, complete commercial/subject bootstrap/current/legacy alias closure,
and provider-reference-family SDK set without row locks; acquires all matching
order advisories in UUID order, then all sorted subject/component/root/member/
alias/domain keys, then the sorted SDK provider-reference set; revalidates every
set and binding; and only then follows the row
hierarchy and reloads exact evidence before rejecting a generally consumed
tracking grant. Any order or alias-set drift aborts the whole transaction for a
fresh bounded retry. Same-grant replay and a replacement valid grant converge
on that row and its append-only authorization/corroboration records when all frozen
facts match; changed facts conflict without extending protection. For an eligible
nonterminal order, the function captures one database
`statement_timestamp()` as `received_at`, stores it once, and writes the ordinary
`protection_expires_at` column as exactly 48 elapsed hours later. Duplicate and
concurrent eligible reports return the original timestamp and expiry; no retry,
replacement grant, later client callback, or reconciler may update either field
or extend the window. Columns are denied to direct application updates, and a
deferred constraint trigger rejects a result/expiry pair that differs from the
guarded first-write relationship. The ordinary column is deliberate: PostgreSQL
generated expressions require immutable operations, while `timestamptz + interval`
is STABLE. Migration replay verifies this schema in every supported session timezone,
including DST-transition fixtures, while the elapsed instant remains 48 hours.

The function is a collection-authority operation: after the complete advisory set
is held, it takes the same order row lock used by cleanup and revalidates attempt/
session/authorization, stable-source key, and order state before writing. SDK
admission is separate from ordinary checkout reuse: the first valid
report that wins these locks while the order is still unpaid and lacks a typed
terminal closure may install protection even when the 24-hour browser key/reuse
cutoff has passed. If eligible, it follows the global row order and atomically
writes a `protected` SDK evidence row, its
`sdk_first_report` protection claim, first timestamp, and exact expiry. If a
provider-switch or replacement successor won the shared collision transition
first after matching provider revocation or contract-expiry evidence was locked,
the function instead writes `cross_order_collision_review` evidence plus its idempotent review
link and cannot protect the predecessor or publish or revive a lease. If cleanup
already won and terminalized the order, it records one immutable
`late_sdk_success` SDK evidence/result plus its idempotent reconciliation link,
without an active claim, protection expiry, confirmation evidence, transaction,
order reopening, allocation, inventory action, or fulfilment authority.

Credit Direct does not hold serialized inventory for 48 hours. Its unpaid
reservation retains the existing two-hour expiry contract. If provider
confirmation arrives after release, the atomic completion function attempts to
reclaim inventory; unavailable strict inventory produces
`captured_inventory_unavailable`. At 48 hours without provider confirmation,
cleanup may cancel the order and retain the expired review history. Every other
delayed-confirmation provider must define its protection duration and inventory
behavior before cutover; “equivalent” is not an unbounded fallback.

The races between merchant-payment ingress, SDK first-report protection, and
cleanup have one database-owned linearization rule. Both claim installers and
cleanup acquire the identical `order:<uuid>` advisory lock and order-row lock.
After cleanup holds the complete advisory set and order row lock, and after all
potentially blocking acquisition is finished, it captures one database
`clock_timestamp()` as `cleanup_now`. Every claim/closure writer uses the same
order locks, so the final READ COMMITTED claim query needs no later blocking lock.
That captured instant is the cleanup decision's explicit linearization point;
commit may follow it. Immediately after capture and before cancellation, cleanup rechecks
indexed claims using source-specific predicates. A webhook
`verified_money_ingress` claim qualifies when its server
`received_at` is before the order's effective cleanup cutoff, and it has no SDK
expiry; it remains a veto until an authoritative typed closure records completed
confirmed-money processing or an authorized reviewed terminal disposition. An
SDK `verified_possible_capture` claim qualifies only when its linked evidence has
`result = 'protected'`, the claim/evidence one-to-one link is valid, no
database-proved typed terminal closure exists, its non-null `expires_at` equals
the evidence's write-once expiry, and `cleanup_now < expires_at`. SDK cleanup does
not consult mutable claim/review status, webhook ingress cutoffs, or the ordinary
24-hour checkout reuse cutoff. This is a
half-open interval: the SDK claim vetoes immediately before expiry and does not
veto at or after the exact expiry, even if a lagging status projection still says
`active`; while holding the same locks, cleanup may atomically mark that claim
expired as an audit projection. Any qualifying claim committed and visible at
that recheck is a cleanup veto even when final attempt/routing election or the
financial worker has not completed. Because the shared order locks remain held
through commit, no claim can commit between that recheck and cancellation. If an eligible installer
wins the lock, its qualifying claim commits before cleanup can recheck. If cleanup
wins and commits cancellation, the waiting installer rechecks the terminal order
and follows a source-specific outcome: signed merchant-payment ingress records
confirmed money plus reconciliation evidence through the reviewed late-payment
and inventory-remediation path, without reopening or automatic allocation; an
SDK first report records only the idempotent `late_sdk_success` result and review,
with no claim, confirmation evidence, transaction, expiry, reopening, allocation,
inventory action, or fulfilment. Neither source may reverse the cleanup decision.
Because every webhook child claim/no-claim decision commits before
webhook acknowledgement, an acknowledged pre-cutoff child can never lose
protection merely because an asynchronous worker was delayed. The shared-lock winner, locked final-
recheck visibility point, and immutable server ingress time—not worker scheduling
or provider-supplied time—decide this operational boundary; provider paid time
remains immutable financial evidence.

### Invoice orders

Merchants can configure a default due term of 1 to 30 days; the default is 7
days. They can override it per invoice within the same range. A new validated
merchant `business_timezone` setting is the authoritative IANA timezone. New
merchants select it during setup; existing merchants receive an explicit `UTC`
backfill and are prompted to confirm or change it. Country, browser timezone,
request headers, and server location never silently choose a financial cutoff.
The setting is validated against PostgreSQL `pg_timezone_names`.

The assignment epoch captures the merchant timezone in force when it is
created. `due_at` is the exclusive end boundary: local midnight immediately
after the selected calendar due date, converted once and persisted as UTC.
Payment eligibility requires provider `paid_at < due_at`; it never compares
against a server-local date or fabricates an imprecise “last instant” of a day.
Later merchant-timezone changes do not rewrite an existing assignment epoch.

Assignment epochs also have database-recorded `effective_from` and
`effective_to` boundaries using half-open intervals. A due-date edit or explicit
expiry closes the prior epoch and creates a successor under the same locks; it
does not overwrite historical `due_at`. A delayed verified event is matched
against the epoch effective at the authoritative provider `paid_at`, not the
epoch current when Baci receives the webhook. Therefore a payment made before
an edit retains the terms then in force, a payment made after a valid extension
uses the new terms, and an extension cannot retroactively make a payment sent
after the old cutoff eligible. Missing, unverifiable, or contradictory provider
paid-time evidence enters review.

Provider time evidence also records source field, provider timezone/offset,
declared precision, normalized UTC value, and verification method. Matching
constructs an uncertainty interval from the provider's precision plus the
reviewed adapter clock-skew allowance. If that interval crosses an assignment
`effective_from`, `effective_to`, assignment time, or `due_at` boundary, Baci
does not guess which epoch applies: it records a typed boundary-uncertainty
review. Automatic matching is allowed only when the entire uncertainty interval
falls inside one eligible epoch. A later higher-precision provider verification
may resolve the review without rewriting the original timestamp evidence.

For an exact-balance invoice, due-date edits are permitted only while collection
status is `unpaid` and before matching money is reserved. For a disclosed
installment invoice, reaching `partially_paid` does not make future tranches
ineligible: completed or reserved tranches remain immutable, while only a future
unpaid tranche may receive a reviewed successor epoch. That edit preserves the
already collected schedule, requires any customer consent mandated by the
original terms, and cannot reduce the locked outstanding amount below reserved
or collected funds. The edit RPC, DVA matcher, and reservation cleanup all use
the global financial lock hierarchy for the same order, tranche, attempt, and
assignment rows. Every edit
records actor, prior and successor epoch IDs, previous due date and `due_at`,
new due date and `due_at`, timezone, reason, and effective timestamp in the
existing audit-event system. This lock serializes Baci work; the event-time
epoch rule above handles transfers that already occurred at the provider but
whose webhook had not yet reached Baci.

Inventory allocated to an invoice remains reserved through its due date. At the
due date, Baci releases the reservation if the invoice is not fully paid, has no
protected payment or reconciliation state, and its collection contract does not
require a continuing hold for already collected installments.

An overdue invoice remains visible and auditable but is no longer eligible for
automatic DVA confirmation. A merchant can extend its due date before a payment
is received. If inventory is still reserved, the edit atomically extends every
reservation expiry through the new `due_at`; if inventory was released, it
atomically re-reserves every required unit under the same serialized-inventory
rules. Any failure leaves the old due date, assignment, and inventory state
unchanged.

Shortening a due date atomically creates the successor assignment epoch and
shortens the reservation expiry.
The edit RPC rejects `new_due_at <= now()`. Merchants use a separate audited
“Expire invoice now” action to end collection immediately; that action follows
the global hierarchy before locking the order and assignment, marks the
assignment overdue, releases unprotected
inventory, and records the reason in one transaction. DVA matching, due-date
editing, explicit expiry, and cleanup cannot observe a half-updated assignment.

A transfer whose authoritative provider `paid_at` fell after the epoch then in
force remains a manual-review case; a later successor epoch cannot silently
authorize automatic attribution. Manual resolution must revalidate inventory
and record one explicit outcome: confirm and fulfil, merchant-approved
substitute, customer wallet credit, provider refund, or another finance-approved
remediation. Captured money is never silently allocated to an order whose
inventory cannot be fulfilled.

For permanent DVA collection, ordinary invoices remain
`exact_invoice_balance`: one verified transfer must equal the locked current
outstanding balance. Deposits and installments require a pre-issued
`explicit_installment_tranche` assignment epoch. Its attempt
`expected_amount_minor` equals the tranche amount, not the whole invoice
balance. A transfer can automatically satisfy only one unpaid tranche whose
amount and uncertainty-bounded paid time match and whose state is the sole
`collectible` tranche under the order lease. Scheduled future tranches never
enter the candidate set, including equal-amount tranches. Multiple matching
invoices or collectible tranches across different orders remain ambiguous.
Underpayments, early future-tranche payments without explicit targeting,
combined multi-tranche payments, and overpayments enter review unless a
separately reviewed deterministic splitting or early-payment contract is
activated; the matcher never invents an installment schedule from the received
amount.

### Partial-collection expiry

At `collection_due_at`, an incompletely paid order is locked with its attempts,
allocations, customer-disposition lots, economic components, and inventory.
Cleanup releases inventory,
expires remaining attempts, and creates one customer-visible resolution case.
Custodied `on_full_payment` funds remain in suspense for refund, wallet credit,
or an authorized successor contract epoch that can re-secure inventory.
Externally settled or explicitly released installment funds record the
merchant's refund/fulfilment obligation. Extending after expiry creates that new
epoch and a new attempt under the same atomic inventory re-reserve rules as an
overdue invoice; it cannot mutate the expired epoch, revive its terminal
attempts, or silently make earlier funds withdrawable.

### Provider retries and switches

Retrying creates a new attempt, not a new order. The previous attempt becomes
superseded only after the new attempt is durably registered and the order-level
collection lease can move safely. At most one attempt is customer-actionable.
The switch RPC follows the global hierarchy before locking the lease and refuses
a new provider while the old attempt
has possible-capture protection or cannot be revoked/expired under its provider
contract. Provider policy defines the guarded noncapturability evidence and
maximum wait; the
24-hour checkout window does not imply that an old charge session is safe.

Webhooks for superseded references remain verifiable evidence. They may record
captured money and file reconciliation, but they cannot blindly overwrite the
active attempt or reopen a terminal order.

## Paystack Permanent-DVA Matching

Fresh automatic matching uses only verified provider evidence and immutable
assignment evidence.

An eligible invoice candidate must match:

1. merchant and provider;
2. receiving account number and normalized receiving bank;
3. immutable Paystack customer code;
4. immutable assigned customer email;
5. currency;
6. exact current outstanding amount for `exact_invoice_balance`, or the exact
   expected amount of the order's one issued `collectible`
   `explicit_installment_tranche`; scheduled future tranches are excluded;
7. the lower bound of the verified paid-time uncertainty interval is not earlier
   than assignment time;
8. the complete paid-time uncertainty interval fits inside exactly one
   assignment epoch's half-open effective interval;
9. the upper bound of that interval is strictly earlier than the epoch's
   immutable, exclusive UTC invoice `due_at` cutoff or the selected tranche's
   earlier `tranche_due_at` cutoff;
10. a collection status of `unpaid` or `partially_paid`, a `collectible` selected
    tranche where applicable, positive locked outstanding balance, no
    cancellation or fulfilment terminal state, and no unresolved refund/dispute
    state that changes the candidate balance.

Before automatic attribution, the matcher must also apply the existing:

- terminal-alias conflict veto;
- wallet-purpose conflict veto;
- unresolved historical identity veto;
- receiver bank normalization contract;
- immutable assignment-epoch rules.

Outcomes:

- Exactly one eligible candidate and no veto: reserve the payment and run the
  shared completion contract.
- Multiple eligible candidates: record one `payment_match_ambiguous` review and
  do not choose an order.
- No candidate: continue through the wallet matcher when verified wallet
  ownership exists; otherwise preserve the money in the unallocated-payment or
  reconciliation ledger.
- Payment after due date: create `payment_received_after_invoice_due_date` and
  do not reopen or automatically confirm the order.
- Terminal, wallet-purpose, or unresolved identity conflict: preserve the
  verified transaction evidence and require review.

Merchant and customer status surfaces show “Payment received — matching under
review” for ambiguous, overdue, and protected unmatched cases. They must not say
“payment failed” when Baci has verified receipt of funds.

### Atomic receipt-recording contract

One private receipt function records verified money independently of order
allocation. It accepts a verified confirmation-evidence ID and proposed
origin-resolution ID, discovers any proposed order, and follows the global
financial lock hierarchy before taking row locks. It validates the typed
attempt/receiving-intent/unattributed classification and atomically elects or
reloads the canonical identity's authorizing evidence and accepted resolution.
It then idempotently creates the immutable receipt origin, confirmed
`customer_receipt` transaction,
one gross customer-disposition lot, and balanced initial economic components. An
unattributed origin creates `held_in_suspense` plus one equal
`suspense_principal`; a reviewed receiving intent applies only its snapshotted
non-order policy and consumes its epoch capacity in the same transaction. This
function never requires an order ID and never marks an order paid.

For an order-attempt origin, the provider completion wrapper composes receipt
recording and the order-allocation contract below inside one database transaction
so ordinary successful checkout remains atomic. For unmatched, ambiguous,
wallet-intent, or overdue receipts, receipt recording commits first-class money
and review evidence without a fictional order. A later authorized resolution
consumes the existing conserved lot; it cannot create a second transaction for
the same confirmed-money identity.

## Atomic Order-Completion Contract

One private database implementation owns conserved funding allocation and order
completion. It is not directly granted to API roles. Two receipt wrappers invoke
its receipt branch:

- a service-role-only provider wrapper accepts an immutable confirmation-
  evidence ID and origin-resolution ID; receipt origin, optional attempt or
  receiving intent, reference, amount, currency, paid-time, authority, and safe
  provider facts are derived from and cross-checked against those rows;
- an authenticated manual wrapper derives `auth.uid()` and merchant access in
  the database, validates the staff permission and idempotency evidence, and
  creates or reuses an `authorized_manual` evidence row before supplying its ID
  and trusted actor to the private implementation.

User-facing routes never construct a service-role client to record manual
payments. Neither receipt wrapper accepts request-selected merchant or actor
identity as authority. Internal wallet, savings, store-credit, and stored-value-
voucher callers—the complete closed internal-source union—use a third, separately
reviewed wrapper that creates or reloads an immutable database-owned
merchant/customer/order/epoch/source-slice/amount/currency command binding under
derived tenant/customer authority. The financial RPC accepts only that command
ID, revalidates the binding under lock, creates
`payment_internal_funding_evidence`, and invokes the internal-funding branch. It
cannot call receipt recording or manufacture confirmation evidence, a receipt
origin, provider identity, gross disposition, or settlement effect.

For an order-attempt origin, inside one database transaction the composed
receipt-and-completion function:

1. discovers the order and canonical receipt identity without row locks, obtains
   their sorted advisory locks, revalidates that set, then takes row locks in the
   global financial lock hierarchy;
2. validates the typed confirmation evidence, then validates tenant,
   order, attempt, currency, provider reference, authority generation, and
   eligible state;
3. invokes or reuses the atomic receipt result—the unique confirmed transaction,
   immutable receipt origin and attempt link, conserved initial customer-
   disposition lot, and balanced economic components—then row-locks them before
   allocation;
4. validates transaction-level, customer-disposition, economic-component, and
   order-level allocation
   conservation plus the exact collection-contract epoch, then creates the
   allocation only when its required inventory hold can commit atomically;
5. recomputes historically funded `amount_paid` only from authoritative successful
   receipt allocations plus `order_internal_funding_allocations`, without
   subtracting later reversals. Migration must first materialize legacy wallet or
   savings evidence as canonical `payment_internal_funding_evidence` and
   `order_internal_funding_allocations` linked to an immutable source debit or
   split; evidence that cannot prove that graph leaves the order in review and is
   never read directly by completion;
6. commits overpayment, contradictory-reference, or captured-but-unallocatable
   outcomes as transaction plus reconciliation evidence without an allocation;
7. sets `payment_status='paid'` and `paid_at` only when the combined conserved
   funded balance exactly settles the order; the single-transaction marker is set
   only when one receipt transaction alone settled it and remains null for mixed
   or wholly internal funding;
8. when the allocation exactly settles the order, confirms serialized inventory
   from immutable order-item evidence before the allocation and paid transition
   become final; approved partial collection has already secured or extended its
   policy-required hold in step 4, while planned internal mixed-tender legs retain
   their dedicated reservation/reversal contract;
9. transitions the customer disposition and only the corresponding merchant-
   entitlement component; settlement remains held until provider availability
   and risk gates pass, while correctly scoped durable side-effect claims are
   seeded without making suspense amounts withdrawable;
10. returns a structured idempotent outcome.

The internal-funding branch uses the same locked order, collection-epoch,
inventory, paid-state, and order-terminal-effect invariants, but replaces receipt
steps 1–4 and 9 with source-ledger discovery, guarded reservation/debit or conserved
split, one internal-funding evidence/allocation pair, and the reviewed liability-
to-merchant-entitlement transfer. The entitlement inherits the source funding-
basis, availability/risk holds, obligor, and backing-loss policy and cannot become
withdrawable earlier than its backing. It creates no provider/canonical-receipt family,
transaction-scoped receipt effect, or provider settlement claim. A failure after
source consumption rolls back the source debit, allocation, inventory, paid
projection, and effects together; replay returns the same funding result.

External email, push, advertising, FIRS, loyalty, and provider settlement calls
do not execute inside this database transaction. Workers claim and execute the
seeded side effects afterward.

Completion returns a database-enforced source-tagged result union rather than a
shared nullable transaction-shaped payload:

- `receipt` results require confirmation-evidence and customer-receipt transaction
  IDs. `completed` and `partially_allocated` additionally require the conserved
  receipt allocation; `captured_inventory_unavailable` and
  `captured_allocation_conflict` require the committed receipt/reconciliation
  graph and forbid an allocation. Their inventory, paid/review, suspense,
  availability, and external-refund-obligation behavior is the receipt behavior
  described above. Expected business conflicts after confirmed money therefore
  commit first-class receipt evidence rather than losing the capture;
- `internal_funding` results require the immutable `internal_ledger` command,
  internal-funding evidence, and internal allocation IDs and forbid confirmation-
  evidence, receipt-origin, customer-receipt transaction, provider identity,
  customer-disposition, and provider-settlement/result fields. Its terminal kind
  is `completed` or `partially_allocated`; inventory/paid-state and order-terminal
  effects follow the same order invariants, but no captured-money conflict variant
  is available because overfunding, invalid source, or inventory/reservation
  failure rejects and rolls back before source debit;
- `idempotent_replay` retains the original `receipt | internal_funding` tag and
  exact branch payload and returns it without duplicating any row or side effect.

For either successful allocation branch, `completed` requires inventory
confirmation, exact historical funding, paid transition, and order-terminal
claims. `partially_allocated` recomputes `amount_paid`, sets
`payment_status='partially_paid'`, does not seed order-terminal effects, and
commits any policy-required inventory hold while a balance remains. Only the
receipt branch may hold custodied captured funds in suspense or record an external
refund obligation.

Unexpected database or integrity failures still roll back completely. The outer
executor reloads the source-owned `financial_command_executions` row by command
ID, records the typed retry state by CAS, and on every retry first reloads any
already-elected source-tagged result. An `internal_ledger` retry therefore
recovers only from its immutable command plus elected internal-funding evidence/
allocation result; it never depends on a verified inbox child. Verified-inbox/
source-proof rediscovery is restricted to `webhook_child` commands. This split
lets Baci retain captured-money evidence without ever exposing a falsely paid
order. It also replaces the
current application-level “mark paid, attempt inventory confirmation, then
roll status back” shape for each provider only when that provider cuts over.

### Payment resolution state

`orders.payment_status` remains a compatibility financial projection and does
not gain a `payment_review` value. Canonical collection status, refund/dispute
status, and net-retained amounts remain separate as defined above; a terminal
refund display must not become canonical unpaid collection. A database-owned
payment-resolution projection, derived
from open reconciliation evidence, exposes `clear`, `review_required`, or
`resolved`. It stores or derives the active issue type, linked transaction,
review ID, and customer-safe display state. Cleanup treats an open captured-money
review as a veto and a possible-capture review as a veto only while its authoritative
claim/evidence predicate is unexpired, without pretending the order is paid. Dashboard, storefront,
mobile, analytics, and notification mappings render “Payment received — under
review” from this projection while retaining `unpaid` or `partially_paid` as the
financial status.

Order/payment APIs and merchant/customer surfaces expose an authoritative funding
breakdown: receipt-only collected amount and provider/source, internal wallet/
savings/store-credit/stored-value amount and source class, total historically
funded, net retained, and refunded/restored amounts. An internal application is
rendered as value applied, never as a new bank/gateway receipt or provider
transaction. Mixed-tender refunds display the destination split and any pending
source-liability restoration or provider obligation without leaking private
ledger identities.

Review protection is explicit rather than implied by every unresolved row:

- informational reviews do not veto cleanup;
- possible-capture reviews such as Credit Direct SDK success carry a bounded
  `protection_expires_at` and veto cleanup only before that instant;
- verified captured-funds reviews remain protected until an authorized refund,
  allocation, wallet credit, substitution, or other recorded resolution.

This prevents a generic unresolved review from leaving an order indefinitely in
ordinary pending state while preserving money that Baci has actually verified.

The existing reconciliation table receives typed, indexed
`protection_kind`, `protection_expires_at`, and `funds_verified_at` projection
columns. `payment_sdk_possible_capture_evidence` plus its protection claim is the
authority for SDK timing; cleanup reads the claim/evidence half-open predicate,
not a possibly lagging review projection. Captured-money matching reads its typed
financial evidence. Neither path reads timestamps hidden only in JSON metadata. Historical
Credit Direct SDK-success rows are backfilled only when their source and
server-accepted completion time are provable; uncertain rows remain visible but
do not receive fabricated protection.

## Provider Adapter Contract

Every adapter is responsible for:

- signature verification and fail-closed secret handling;
- provider payload validation with Zod;
- authoritative server-to-server verification where the provider supports it;
- canonical event identity and replay key;
- canonical identity contract generation, version-independent family locator/
  lock key, and the complete equivalence/alias bundle for supported generations;
- active and superseded attempt matching;
- verified amount, currency, and paid timestamp extraction;
- provider-specific success semantics;
- explicit capture-finality semantics: either a reviewed hard deadline after which
  no earlier accepted/authorized/queued/in-flight capture can settle, or verified
  no-capture/in-flight status/revocation plus a pinned finality delay; absence of
  either disables `contract_expired` switching authority. The adapter must name
  its registered provider/account/authority generation and matching conformance-
  receipt checksum; caller-selected/free-text contracts are rejected;
- settlement ownership classification;
- normalized safe gateway evidence.
- source-appropriate confirmation-evidence creation before completion.

Adapters cannot directly mark orders paid after cutover.

Manual adapters additionally require an authenticated staff actor, an existing
permission that authorizes recording payment for the merchant, CSRF validation,
an idempotency key, evidence/proof type, and a non-empty reason. Actor identity
is derived from `auth.uid()` by the authenticated database wrapper and stored as
a first-class column and audit fact, not accepted from the request or hidden in
an optional `safe_metadata` field.

### Provider continuity and generation-pinned cutover

An authority cutover never changes the provider-facing webhook URL, dashboard
subscription, signature scheme, or secret merely to adopt this architecture.
The existing Credit Direct ingress remains
`/api/payments/credit-direct/webhook`, and Svix verification remains the
fail-closed ingress boundary. Shadow and canonical processing sit behind that
same verified route. Any provider-dashboard or credential change is a separate,
reviewed operation with its own dual-secret/rollback contract.

Every provider session is stamped at initialization with immutable completion-
authority and routing-generation IDs. Webhook routing uses that stamped session
generation, never the current feature flag alone. A cutover first deploys a
generation-aware router capable of both the legacy-compatible and canonical
paths. Sessions issued before the boundary remain grandfathered to exactly one
legacy-compatible processor through the authority's separately versioned
automatic-processing horizon. The legacy-compatible path must preserve active,
superseded, and safely recoverable unpersisted-popup reference matching. After
that horizon, a delayed verified event is still durably recorded and reconciled;
it is never acknowledged and discarded merely because its generation aged out.

Timing policy keeps distinct clocks for checkout-key reuse, SDK-success order
protection, serialized-inventory reservation, provider session/actionability,
first business-completion/disbursement, webhook redelivery, automatic legacy
processing, rollback compatibility, and financial identity/evidence retention.
The Credit Direct 48-hour protection window governs cleanup/reuse only; it does
not prove when a first merchant-payment event can occur or permit reference
deletion. Each horizon records authoritative provider contract/evidence, policy
version, start/end, precision, owner, and review date. Automatic legacy
processing may retire only after the maximum proved session, first-completion,
and redelivery horizons plus the rollback window. If the provider cannot prove a
finite first-completion or redelivery bound, compatibility identity lookup and a
safe processor/reconciliation path remain available for the financial-record
retention period; implementation cannot invent a deadline to retire them.
Immutable reference bindings and verified evidence outlive every operational
horizon according to the approved financial retention policy.

New-session canary assignment is stable and recorded at initialization; a
session never changes generations in flight. An event therefore reaches exactly
one money-writing authority. Disabling a canary stops issuance of new canonical
sessions but keeps already-issued canary and grandfathered sessions on their
generation-compatible processors until terminal or safely reconciled. Rollback
cannot move a live session between handlers or require a customer to restart
checkout.

Credit Direct has three deliberately separate signals. The untrusted SDK-success
callback creates only authenticated/tracking-proof-bound possible-capture review
evidence and `sdk_success_reported_at`; it may extend cleanup protection but
cannot transition the attempt, reserve inventory, or create verified confirmation
evidence. A signature-verified
`Checkout_Customer_Payment_Completed` event records non-monetary BNPL approval
evidence, writes `provider_customer_approved_at`, and may advance the attempt plus
a time-bounded inventory reservation,
but cannot permanently confirm/decrement sold inventory, begin fulfilment,
create a confirmed receipt, allocation, merchant entitlement, `paid_at`, or a
paid order. The approval reservation never exceeds the existing serialized-
inventory deadline or a shorter collection-contract cutoff, and cleanup releases
it idempotently if merchant payment is absent. A verified
`Checkout_Merchant_Payment_Completed` event is the
confirmed-money event: it validates the server-owned residual amount, creates or
reuses the canonical receipt and allocation, atomically converts a still-valid
reservation to confirmed inventory, and records provider settlement evidence.
If inventory is expired or unavailable, money remains a confirmed receipt in
non-withdrawable suspense with one remediation case; the order is not falsely
fulfilled or silently treated as unpaid money. The expected settlement policy is
`provider_external_settlement`
because the event states that Credit Direct paid the merchant, but activation
still requires contract and production-evidence proof. Either event may arrive
first; merchant-first completion cannot depend on the customer event, and a late
customer event becomes corroborating approval evidence without regressing a paid
order. Merchant-first processing performs the same atomic inventory validation;
it never fabricates a prior approval reservation. Each event has its own replay
identity while only the merchant event owns the receipt identity.

### Settlement ownership

Each successful attempt selects exactly one reviewed policy:

- `platform_wallet_settlement` — creates `platform_custodied` lots; Baci holds
  confirmed funds in suspense until allocation/inventory, provider clearing,
  and any reviewed risk hold all succeed; only the merchant-entitlement
  economic component then becomes eligible and credits the merchant exactly
  once;
- `provider_external_settlement` — provider already disbursed or will disburse
  outside Baci; creates `provider_external` lots and records settlement evidence
  without wallet credit;
- `manual_no_settlement` — creates `manual_nonsettling` lots; staff-recorded
  evidence updates the order ledger but does not fabricate provider custody;
- `reconciliation_required` — creates `unknown_review_required` lots;
  settlement ownership is unclear and no merchant balance mutation occurs.

Credit Direct's merchant-payment-completed event must be explicitly classified
before its adapter is activated. The migration cannot assume that the generic
merchant-wallet settlement executor is correct.

Settlement eligibility requires two independent gates: commercial entitlement
and funds availability. Commercial entitlement comes from a valid allocation,
inventory/fulfilment policy, and unreversed merchant-entitlement component.
Funds availability comes from provider-specific evidence such as a verified
`cleared_at`, settlement event, balance transfer, contractual availability
delay, or an explicitly approved risk-hold expiry. Each adapter defines the
authoritative evidence, maximum wait, retry/escalation behavior, and whether the
provider settles externally. A capture timestamp alone cannot make custodied
funds withdrawable unless the reviewed provider contract proves capture and
availability are the same event.

The cutover inventory includes every writer and projection of customer-wallet or
merchant value,
not only the completed-transaction trigger: `merchant_balances`,
`merchant_wallets`, every `record_merchant_settlement*` RPC, settlement workers,
manual settlement paths, merchant payout/withdrawal/reserve workers,
`wallet_transactions`, customer-wallet credit/refund/redemption/savings RPCs,
refund/chargeback debits, and provider-specific balance hooks. Before an
authority activates, each writer is either routed through the
new private economic-component transition, fenced off for that authority, or
proved read-only. A database invariant rejects a second credit/debit ledger
identity for the same component. Shadow mode compares gross, component totals,
merchant entitlement, availability time, and resulting available/upcoming
balances without dual-writing money.

## Side Effects

The universal outbox distinguishes two idempotency scopes.

Order-terminal effects are keyed by `(order_id, step)` and are seeded only on
the first exact transition to fully paid:

- paid customer email;
- payment-owned new-order push when the creation path did not already own it;
- loyalty points;
- FIRS invoice submission;
- advertising conversion.

Receipt-transaction effects are keyed by `(transaction_id, step)` and are seeded
for every confirmed `customer_receipt`, including partial payments and captured
payments awaiting allocation where the policy permits execution:

- merchant payment-received push or partial-payment receipt;
- settlement recording according to the immutable receipt-origin policy
  snapshot, consulting attempt-to-transaction provenance only for an
  `order_attempt` origin;
- provider-specific confirmed-payment acknowledgement.

Creating the transaction-scoped settlement claim does not itself mean the claim
is executable. The crediting worker requires a `platform_custodied`
`merchant_entitlement` component in `eligible` after both entitlement and funds-
availability gates pass. A provider-external worker records
`externally_attributed` and never mutates a Baci merchant balance. A held claim is
durable and observable but cannot be claimed by the crediting executor until its
funds disposition advances.

An allocation-scoped effect, if later required, must use
`(allocation_id, step)` rather than overloading an order or transaction key. The
current `(order_id, step)` primary key and separate manual side-effect table must
be migrated forward without losing completed claims.

Each effect declares one delivery contract. For a downstream API with a durable
idempotency key, the claim stores that key before dispatch and replay reuses it;
the lifecycle is `pending -> claimed -> completed | failed_retryable`. For a
downstream API without such a guarantee, including email providers whose send
may succeed before Baci can checkpoint it, the lifecycle is `pending -> claimed
-> dispatch_started -> completed | delivery_unknown`. A worker writes
`dispatch_started` before the external call. If it loses certainty afterward,
automatic replay is forbidden; provider audit, delivery lookup, or an authorized
manual decision must resolve `delivery_unknown` to completed or deliberately
issue a new delivery with a new audited identity.

Therefore database effects and idempotency-capable integrations are exactly-once
in effect, while non-idempotent external delivery is fail-uncertain rather than
falsely promised as at-most-once. Replays repair missing or retryable steps but
never resend completed or delivery-unknown claims. Provider-specific order-note
flags may be read during migration but are not the long-term idempotency
authority. Customer-facing operations expose stuck/unknown delivery separately
from payment status so notification uncertainty cannot roll back confirmed
money.

Reversals have their own effect scope keyed by `(reversal_id, step)`; they never
delete, reopen, or reuse the original paid-order claims. The private reversal
function seeds the database-owned claims appropriate to the accepted reversal
state. Reviewed steps include customer and merchant notices, loyalty recovery,
FIRS credit-note or cancellation submission, advertising conversion adjustment,
provider acknowledgement, and a cancellation/return/restock handoff where the
order lifecycle permits it. Financial reversal can commit even when an external
effect is pending, but its required claims must be durable in the same
transaction.

Each reversal step declares whether it runs at refund reservation, provider
completion, chargeback opening, or chargeback resolution, and whether an inverse
operation is legally/provider-supported. Unsupported inverse operations record
an explicit terminal `not_supported` outcome rather than pretending the original
effect never happened. Reversal effects use the same persisted downstream
idempotency-key or `dispatch_started`/`delivery_unknown` contract as payment
effects. Inventory and fulfilment changes remain guarded by the canonical order-
cancellation/return authority; a financial reversal alone cannot restock or
cancel a shipped or fulfilled order.

## Security and Privacy

- Webhook signatures are verified against raw bytes before parsing.
- Missing secrets fail closed in production.
- Service-role access is restricted to server-only provider routes and guarded
  database functions.
- The private completion implementation is ungranted; the provider wrapper
  checks `auth.role()='service_role'`, while the manual wrapper derives
  `auth.uid()` and merchant access without constructing a service client.
- The webhook inbox is private-schema, least-privilege, and not client-readable.
- Confirmation evidence and provenance are private-schema, append-only through
  guarded functions, and not client-writable.
- Provider credentials, signatures, raw card data, and unredacted payloads are
  never logged or stored in safe metadata.
- `provider_account_id` is a stable non-secret namespace identifier; it cannot
  contain credentials, authorization codes, access tokens, or secret hashes.
- Merchant identity comes from the matched attempt/order and never from an
  untrusted request-selected tenant value.
- Every manual reconciliation action records actor, reason, before/after state,
  and linked transaction evidence.
- Existing migration files are never edited.

## Observability and Operations

Required metrics:

- verified webhook to completed-order latency by provider;
- verified webhook classified as unattributed because no safe attempt or
  receiving intent matched;
- provider success with no completed transaction;
- transaction with no allocation;
- paid order with null `paid_at`;
- paid order whose allocations do not equal `amount_paid`;
- order whose receipt plus internal-funding allocations do not equal its
  historical funded projection, or whose receipt-only collected projection
  includes internal value;
- transaction whose historical positive allocations exceed confirmed gross;
- internal-funding allocation without an equal conserved source debit/split, a
  source amount consumed by multiple orders, or an internal application that
  created receipt-origin or provider-settlement artifacts;
- internal-funded merchant entitlement with no immutable funding-basis/obligor
  lineage, with availability earlier than its backing, or with backing loss not
  assigned to one conserved reserve/liability recovery path;
- failed or stale payment side effects;
- non-idempotent side effects in `delivery_unknown` by age and integration;
- customer-receipt transactions missing their transaction-scoped settlement
  effect;
- customer-receipt transactions missing immutable origin-resolution or receipt-
  origin provenance, order-attempt origins missing their conditional attempt
  link, or reversal entries carrying a receipt origin/missing reversal provenance;
- customer-receipt transactions missing verified confirmation evidence, and verified
  evidence not consumed or routed to review within its SLO;
- custodied funds held in suspense by age and reason;
- allocated merchant entitlement awaiting provider funds availability or risk-
  hold expiry by provider and age;
- gross/component conservation failures and non-merchant components incorrectly
  presented as withdrawable;
- reversal reservations, open chargebacks, and negative merchant liabilities by
  age and owner;
- historically paid orders whose refund/net-retained projection makes them
  eligible for unpaid cleanup, which is always an invariant violation;
- wallet-credited disposition with any live merchant-entitlement component or
  missing matching customer-wallet liability;
- blocked duplicate-checkout attempts during active payment protection and
  explicit separate-purchase authorizations;
- acknowledged inbox rows with unknown ingress-contract versions, unresolved
  tenant/account scope, or unresolved/ambiguous financial-routing resolutions by
  age, plus merchant-reconciliation versus global-quarantine scope counts,
  proposal/conflict/SLA age, adopted-receipt-pending age, durable-command state,
  and responsible owner;
- sessions/events routed to a generation different from initialization,
  grandfathered sessions by age/terminal state, provider-redelivery drain age,
  and delayed verified events incorrectly acknowledged without a durable result;
- ambiguous/missing provider reference bindings, receiving-intent/provider-
  account authority-epoch selection, metadata-fallback elections, routing
  conflicts, order-note/router disagreement, acknowledgements attempted before
  atomic durable inbox/manifest/complete-child insertion or any required child
  claim/no-claim decision, retryable lock-budget failures, and financial processing
  attempted before typed child routing/pinned-generation resolution;
- order-protection claims by kind, cutoff, routing state, conflict age, and
  cleanup veto outcome, including signed ingress that could not safely install a
  claim, partitioned by merchant/global review scope;
- webhook child-manifest count/sum/cardinality conflicts, parser disagreement,
  pending-child age, and duplicate/re-key attempts by provider contract;
- SDK first-report duplicates/concurrency conflicts, `late_sdk_success` and
  `cross_order_collision_review` results
  linked to any claim/confirmation/transaction, any attempt to change the original
  `sdk_success_reported_at` or exact 48-hour expiry, grant/session authorization
  reused across evidence, replacement-grant corroboration, missing/duplicate/cross-
  result claim or review ownership, missing/empty/non-normalized SDK sessions,
  attempted standalone SDK source/session locks, collision/provider-reference-
  before-order acquisition, collision-domain/alias-set drift, unknown hash
  generations, ambiguous or cross-merchant subject equivalence, blocked rotations
  lacking provider revocation/expiry proof, externally capturable predecessors
  beside successor leases, or dual actionable leases, cleanup
  wall-clock capture before its final lock wait, and status
  lag after expiry that disagrees with the half-open cleanup predicate;
- subject-equivalence edges that attempted commercial projection, cross-intent
  alias projection, component-root drift/superseded-root entry, component overflow,
  unrelated-order freeze, rejected bridges that stayed frozen, merge/reject
  adjudication mismatch, overflow staging/checksum/crash state, partial publication,
  post-resolution disjoint lock attempts, membership generation mismatch, active-
  closure size after recovery, unsafe compacted orders/domains/aliases, lookup redirects
  used as bootstrap authority, and components that remain frozen because no safe
  bounded result exists;
- overflow recovery revision conflicts, retained children/claims added after a
  staged snapshot, forced rescans, and any attempted publication with a stale
  anchor revision;
- noncapturability adapters lacking hard deadline finality, pre-deadline capture
  arriving after nominal expiry, missing verified no-in-flight proof, or successor
  publication before required finality delay; unregistered/inactive-at-issuance,
  altered-delay, cross-account, missing-approval, or missing-conformance-receipt
  finality contracts;
- shadow-attempt identifiers presented to any canonical lease/reference/evidence/
  completion path, attempted in-place promotion, shadow rows blocking legacy work,
  shadow-role canonical execution/write attempts, outbound provider mutation, and
  canary issuance without a fresh generation-pinned canonical attempt; also gross/
  eligible shadow census count, missing/failed/duplicate observations, unapproved
  exclusions, legacy/outcome cardinality, evaluator artifact/input checksum
  mismatch, coverage by authority/class, and any rollout receipt that disagrees
  with recomputation;
- nonce issuance/retirement CAS conflicts, live grants at retirement, alias
  retention shorter than maximum outstanding expiry/idempotent-replay horizon plus
  margin, lost-response replay failures by authorization kind, expired/revoked/
  rotated proof outcomes, fresh same-subject reauthorization, unauthorized result
  disclosure, and nonce-only aliases used to bootstrap checkout;
- ingress-generation overlap, CAS conflicts, normalized-envelope disagreement,
  old/new parser insert races, queued rows by parser version, and unsafe drain or
  retirement attempts;
- rollout compare-and-set conflicts, rejected widenings, stale control readers,
  cohort-checksum mismatch, missing transition receipts, stop-to-issuance latency,
  and workers disagreeing with the pinned generation;
- Credit Direct untrusted SDK reports versus signed customer-event approvals
  versus merchant-event receipt counts, ordering, replay, missing counterpart
  age, SDK reports that changed attempt/inventory state, money created from
  customer-only evidence, signed-customer reservations past expiry, permanent
  inventory changes from non-money evidence, and merchant events missing
  receipt/allocation or inventory remediation;
- shadow/canary parity and sample age by authority, canary cohort size, stop-
  condition trips, acknowledgement/completion latency, and exact-reference soak
  receipts;
- migration lock waits/timeouts, unexpectedly enforced legacy constraints,
  legacy-writer behavior changes during expand-only stages, and shared-schema
  effects outside the opted-in authority;
- DDL operation attempts, advisory-lock contention, invalid partial indexes,
  manifest/definition checksum mismatch, missing readiness receipts, and schema
  activation attempted before non-transactional DDL completion;
- session, first-business-completion, redelivery, automatic-processing, rollback,
  and retention horizon age/unknown-bound status by provider;
- canonical-locator disagreements, alias scope collisions, ambiguous alias
  backfills, and first-seen identity bootstrap routed to review;
- canonical-contract generation overlap, unsafe predecessor reactivation,
  family-lock disagreement, and draining-generation attempts to bootstrap;
- financial lock-set rediscovery aborts, bounded retry exhaustion, deadlocks,
  and lock-wait latency by function/resource class;
- financial-command queue/claim/retry age, expired leases, typed-error counts,
  exhaustion to review, and completed commands missing result identities by
  source kind;
- customer-wallet and merchant-wallet lock waits, wallet credit versus
  redemption/refund conflicts, settlement/reversal versus payout conflicts, and
  any unfenced value writer;
- receiving-intent capacity rejections and invariant drift between immutable
  claims, receipt count, and cumulative amount;
- ambiguous, overdue, terminal-alias, and wallet-purpose reviews;
- duplicate webhook/replay rate;
- stable receipt identities with conflicting amount/currency/time/status facts;
- reversal entries with receipt provenance or customer receipts with reversal
  provenance;
- active non-confirmed `transactions` rows after an authority's physical cutover;
- installment schedule conservation, pending-proposal age, activation retry/
  review, multiple live proposals, duplicate successor links, predecessor and
  successor next-authority publication, or overdue-activation failures;
- receiving-intent paid-time boundary/ownership reviews;
- active attempts older than their provider expiry;
- orders whose checkout reuse window expired while payment protection remains.

Initial SLOs:

- 99% of uniquely matched verified webhooks complete the database payment
  contract within 60 seconds;
- zero duplicate completed transactions per provider-account reference;
- zero canonical-identity duplicates or alias-scope collisions, including
  first-seen receipts during an adapter-version rollout;
- zero scopes with multiple active canonical-contract generations and zero
  unsafe rolling overlap or re-key;
- zero in-flight sessions processed by a generation other than the one stamped
  at initialization and zero verified delayed payments acknowledged without
  durable financial or reconciliation evidence;
- zero acknowledgements before verified ingress is durably inserted and zero
  financial processing before exactly one account-scoped financial-routing
  resolution and pinned generation are resolved; unresolved ingress remains
  acknowledged quarantine, while valid receiving-intent and unattributed routes
  never require a fabricated attempt;
- zero cleanup cancellations when a qualifying order-protection claim was
  committed before the final locked recheck, and zero protection claims that
  directly create money, inventory, paid state, or fulfilment authority;
- zero SDK retries that alter the first server report timestamp or extend the
  exact 48-hour protection expiry;
- zero ingress scopes with multiple active generations, duplicate inbox rows or
  5xx uniqueness failures during old/new parser races, and zero retirement before
  drain/equivalence/rollback gates pass;
- zero unauthorized/stale rollout transitions or widenings without complete
  database transition receipts;
- zero confirmed money, paid projection, allocation, or merchant entitlement
  from Credit Direct customer-payment-completed evidence alone;
- zero attempt or inventory mutation from an SDK-success report, zero permanent
  inventory confirmation/fulfilment from the signed customer event alone, and
  zero expired approval reservations left unreleased;
- zero expand-only-stage changes to live provider completion behavior and zero
  migration lock waits beyond the reviewed abort threshold;
- zero canary stop-condition violations before widening, and every widening has
  its required shadow sample, soak duration, and exact-reference receipts;
- zero compatibility retirement while a required provider horizon is unknown and
  zero schema activation without a completed DDL operation receipt;
- zero financial deadlocks and zero exhausted lock-set retries that lose or
  duplicate a financial outcome;
- every financial command reaches completed or durable review/retry state within
  its source-specific SLO, with zero in-memory-only exhaustion;
- zero unfenced customer-wallet, merchant-settlement, payout, withdrawal, or
  maintenance writers after cutover;
- zero receiving-intent capacity drift and zero oversubscribed epochs;
- zero overlapping effective installment schedules and no pending schedule-
  change proposal older than its reviewed activation/escalation SLO, multiple
  live proposal, duplicate successor, or double-published next authority;
- zero automatic confirmations from ambiguous DVA matches;
- zero paid orders missing `paid_at` after a completion-authority cutover;
- every verified unmatched payment creates durable operational evidence.

The merchant dashboard needs an explicit reconciliation queue and customer
orders need a non-failure “payment received, under review” state.

## Migration and Rollout

### Stage 0 — Contract and schema foundation

Stage 0 is strictly expand-only and behavior-neutral for every live provider.
It may create private tables, dormant functions/fences, nullable compatibility
columns, and new indexes without redirecting traffic. It cannot replace or drop
a legacy index, attach a trigger to a legacy money writer, revoke an existing
route/RPC grant, add an immediately enforced legacy-row constraint, activate the
maintenance fence, change a webhook URL/secret, or alter current completion
semantics. New invariants initially govern only new canonical tables and
explicitly opted-in canonical writers.

Every Stage 0 bullet below describes schema, an ungranted dormant function, a
registry, a test-only contract, or inventory for a later stage. Operational verbs
such as route, persist, enforce, acknowledge, freeze, or integrate specify the
eventual contract and do not authorize production grants, triggers, route wiring,
dual writes, response changes, or activation during Stage 0.

Large indexes use the reviewed non-blocking deployment mechanism; legacy-table
checks are added `NOT VALID` where supported and validated separately after
backfill parity. Each migration defines conservative lock/statement timeouts,
bounded batches, lock-wait monitoring, abort criteria, and a forward-compatible
recovery receipt. A timeout or unexpected lock aborts the migration without
changing route ownership. Existing index/trigger/function retirement moves to
the owning authority's post-canary cutover after production dependency counters
prove zero use.

Implementation must choose and document the executable DDL lane before Stage 0:
ordinary append-only transactional migrations own tables, functions, nullable
columns, and short metadata changes; operations that PostgreSQL forbids inside a
transaction, including `CREATE INDEX CONCURRENTLY`, run through a separately
reviewed, least-privilege, resumable migration job keyed by immutable operation
ID and migration manifest checksum. That job holds a deployment-operation
advisory lock, sets explicit lock/statement timeouts, detects and safely drops or
resumes only its own invalid partial index, verifies definition/validity and
query-plan readiness, and writes start/attempt/result evidence before the schema
migration may attach or validate a constraint. It never runs an untracked manual
SQL command. Failure leaves route state unchanged and a retryable operation
receipt; production activation requires the completed receipt.

- Add collection-contract epochs, `payment_attempts`, structurally non-authoritative
  `payment_attempt_shadow_observations`, `payment_admin_mutation_shadow_observations`,
  `payment_sdk_first_report_shadow_observations`,
  `payment_webhook_intake_shadow_observations`, and
  `payment_cleanup_shadow_observations`,
  `payment_internal_funding_shadow_observations`, immutable shadow comparison manifests/
  eligible-child census and rollout receipts, non-order receiving
  intents and immutable intent epochs, typed receipt-origin resolutions and
  origins, canonical receipt identities and versioned identity aliases,
  transaction entry kinds, typed confirmation-evidence rows, immutable
  attempt-transaction provenance links, receipt allocations, separate
  `payment_internal_funding_evidence` and
  `order_internal_funding_allocations`, typed reversal-source legs and immutable
  internal-funding reversal plans, per-receipt provider-reversal obligations,
  source-global reversal reservations, receipt-lineage root guards/generations/
  active-veto counters, parent chargeback partitions, receipt-lineage
  vetoes/high-water/census/partition pages, provider-dispute
  collisions/liabilities/finance-scopes/dispositions/parent-finance-resolution
  terminals/zero-finance-reference census pages/seals/finance-child-reference
  pages/seals/child-finance-resolution
  identities/replacement-backing evidence, typed-
  backing-lineage assets,
  asset-level backing-loss cases/fences/pending-
  vetoes/cursors, chained census pages, draft/sealed plan items, immutable typed-asset lineage
  indexes, and per-slice source-liability recovery/reversal links,
  customer-disposition lots,
  economic components, reversal/negative-balance evidence, reconciliation
  decisions/obligations, collection leases, payment-attempt noncapturability
  evidence, provider capture-finality contract generations/receipts, checkout
  subject components, collision domains, collision-component
  roots/successions/memberships, overflow-recovery anchors/staging, immutable
  tagged order/domain/alias authority-closure evidence, active-versus-lookup-only
  redirects, append-only alias/equivalence bindings, and the `webhook_child`
  `ingress_mode='collision_overflow_frozen'` retained-source/protection shape,
  purchase-intent nonces, and the
  private webhook inbox through new append-only migrations.
- Add endpoint-scoped ingress-contract generations, provider routing generations,
  provider-account authority epochs, financial routing proposals and accepted
  resolutions, attempt
  reference bindings, rollout control rows/transition receipts, and versioned
  timing policies before generation stamping or shadow acknowledgement is
  enabled. Enforce one active ingress generation per endpoint/key/authority,
  stable replay identity across parser versions, CAS transitions, dual-parser
  equivalence, and drain/rollback receipts. The first ingress slice is exactly the
  one empty private generation registry and its catalog contract above; it has forced RLS, no
  policies or production-role privileges, and no function, trigger, seed, or live
  integration.
- Add the checkout request-contract registry/control row, append-only generation
  alias bundles, nonce-compatibility retention receipts, and retirement CAS before
  issuing any canonical nonce or activating a new request-hash generation.
- Add `financial_command_executions`, its scoped idempotency constraint, leases,
  typed retry state, explicit `webhook_child | provider_verification |
  authorized_manual | internal_ledger | authorized_reconciliation |
  quarantine_adoption` source union, source links, result links, and review
  escalation before any entry point adopts the canonical financial RPC.
- Add the private legacy-attempt archive and checksumed transactional drain
  function before any authority stops writing pending legacy transactions.
- Add indexes, RLS/private-schema grants, security-definer role guards, and
  migration replay contract tests.
- Add a dedicated `payment_shadow_evaluator` database role and separate pure
  evaluator functions, plus private comparison manifests/child census rows and
  database-computed parity receipts. The generation-aware legacy boundary—not the
  shadow role—creates the immutable eligible-source census and records the legacy
  outcome. The role receives `SELECT` only on reviewed safe projections and
  `EXECUTE` only on the matching guarded observation-insert functions. Direct
  `INSERT`, `UPDATE`, and `DELETE` on every shadow-observation table are revoked;
  the guarded functions derive and validate the immutable child binding, approved
  runtime attestation, and evaluator artifact before inserting. The role may read
  only an approved observation projection needed for idempotent result display;
  it has no execute or write path to canonical payment/admin RPCs, attempts,
  leases, references, inbox/manifests, claims, protection/confirmation evidence,
  orders, cleanup, inventory, wallets, or money. Shadow evaluation runs in a
  separately bundled worker/runtime with no provider mutation SDK imports,
  provider/payment credentials or secret mounts, and default-deny egress. Its sole
  runtime identity is a short-lived `payment_shadow_evaluator` database credential,
  and its sole network allowlist is the private database/proxy endpoint required
  for reviewed reads and observation inserts; public internet, provider, queue,
  metadata-service, and arbitrary DNS egress are denied. Build-graph and
  deployment-policy checks fail if broader capabilities appear. Each observation is unique to one
  census child and stores the approved evaluator artifact/input-schema checksums;
  missing, failed, duplicate, mismatched, or excluded children remain in the
  database-derived rollout denominator and cannot be hidden by the evaluator.
- Add the frozen canonical-identity-contract registry, disjoint advisory-resource
  key encoding, typed whole-transaction lock-set retry signal, bounded wrapper
  retry policy, and invariant checks before any canonical writer activates.
- Freeze customer-wallet and merchant-wallet advisory namespaces, inventory
  wallet/payout/withdrawal/settlement writers and maintenance jobs, and add the
  global financial-maintenance fence before shadow traffic.
- Inventory incompatible legacy global/order-only gateway-reference unique
  indexes and add shadow provider-account-scoped identities without changing the
  old enforcement. Replacement/removal occurs only in the owning authority's
  post-canary retirement step after dependency and cross-account proof, without
  weakening unrelated agentic, wallet, domain, or Klump guarantees.
- Add funds-disposition/suspense state and inventory every merchant-value writer,
  including the completed-transaction balance trigger,
  `record_merchant_settlement*`, `merchant_wallets`, settlement workers, manual
  writers, and reversal debits. Route or fence all of them per completion
  authority before activation; gating only the trigger is insufficient.
- Create dormant, ungranted enforcement functions for the existing admin order-
  edit RPC and other commercial-order mutations, but do not wire, grant, or change
  any live mutation path in Stage 0. Integration of edit-before-collection versus
  atomic replacement-order behavior belongs to the owning authority's Stage 1
  shadow/canary route transition.
- Add completion-authority feature keys—not provider-wide booleans—for legacy,
  shadow, canary, active, and rollback modes, plus stable session-cohort and
  routing-generation assignment. Credit Direct, Paystack card, order DVA,
  wallet DVA, and agentic DVA are independently fenced.
- Persist authority and ingress-contract generation on every acknowledged inbox
  row and durable source manifest; prohibit parent-level financial result fields,
  and persist each accepted attempt, receiving-intent, or unattributed provider-
  account routing generation only on its child graph after typed financial-routing
  resolution.
- Add the platform-owned unscoped-quarantine lifecycle, immutable resolution
  proposals, guarded scope-adoption/conflict transitions, durable adopted-to-
  receipt commands, privacy grants, retention, ownership, and escalation SLOs
  before acknowledging unbound events in shadow. Adoption may attach only a
  non-authoritative routing proposal; accepted routing remains receipt-owned.
- Add private immutable `payment_sdk_possible_capture_evidence`, its guarded
  source identity, three-way protected/late/collision-review result constraint, exact
  database-owned write-once 48-hour expiry, and explicit global-row-order
  position. Add append-only authorization/corroboration rows whose tracking-grant
  identifier cannot authorize two SDK evidence rows and whose authenticated-
  session identity is scoped to the stable source. Make claims own unique protected-evidence foreign keys and
  reconciliation reviews own unique review-only evidence foreign keys; evidence owns no
  backlink. Add deferred tagged-union checks and indexed non-money order-protection
  claims as a database-enforced tagged
  union: webhook-child claims require retained manifest/child-proof provenance,
  while SDK-first-report claims require SDK evidence, attempt, normalized non-null
  provider session,
  and authorization provenance frozen on that evidence. Add append-only typed
  claim closures as the four-kind, source-matched, guarded same-transaction
  terminal predicate; command exhaustion is not closure. Add an ungranted, dormant
  guarded Credit Direct SDK first-report function without changing cleanup or any
  live route; map its stable-source key into the
  frozen provider-reference advisory family, resolve every active bootstrap alias
  plus the active collision-component root/generation and full membership after
  complete bounded matching-order discovery, require order-first then sorted
  subject/component/root/member/alias/domain then provider-reference acquisition
  and post-lock set revalidation, and serialize it on the same order advisory plus row lock
  as cleanup. Create a separate dormant, ungranted signed-webhook intake function
  whose durable manifest, complete child set, and child-scoped claim/no-safe-order/
  late-ingress decisions form one acknowledgement transaction; before any source-row
  write or row lock, parse and freeze the candidate manifest, discover the bounded
  order set, acquire and revalidate the complete sorted advisory set, then lock
  orders canonically and persist source rows followed by claims. Any bounded lock
  failure is modeled as a retryable non-success result. Stage 0 contract tests may
  invoke these functions only under migration-test roles; the production routes,
  grants, acknowledgement responses, cleanup behavior, and financial completion
  authority remain byte-for-byte unchanged.
- Freeze fallback replay identity at first acknowledgement, including an immutable
  ingress-scope snapshot or explicit unresolved sentinels. Scope adoption and later
  discovery must look up that frozen locator before enrichment and must never re-key
  the inbox or retained manifest, including redelivery after inbox pruning.
- Add immutable financial-routing proposals separately from accepted routing
  resolutions, and make evidence creation plus routing/origin acceptance one
  canonical-identity-locked receipt transaction before shadow financial writes.
  That transaction reads immutable source facts without row locks to derive the
  full advisory set, then locks existing canonical identity/transaction rows
  before source proof/proposal rows; missing canonical rows are inserted only
  under the already-held family advisory and scoped uniqueness constraints.
- Add financially retained webhook source manifests, immutable child source
  proofs, `(source_manifest_id, child_identity)` uniqueness, one child proposal
  and command per proof, explicit non-cascading inbox foreign keys, and a guarded
  inbox-pruning projection before enabling any bounded-multi-capture contract;
  singleton contracts remain cardinality one and parser disagreement fails closed.
- Restrict operator-selected cross-tenant adoption to an unattributed-provider-
  account proposal whose canonical follow-on receipt records gross suspense;
  require a separate authorized reconciliation decision before any order/intent
  allocation, inventory action, merchant entitlement, or fulfilment.
- Split `no_safe_order_claim` review routing by independently verified scope:
  same-merchant/account ambiguity uses merchant reconciliation, while unresolved,
  conflicting, or cross-tenant/account scope uses platform/global quarantine.
- Do not change live provider completion behavior yet.

### Stage 1 — Dual evidence and shadow comparison

- Persist only `payment_attempt_shadow_observations` alongside current legacy
  provider initialization paths. This separate table may reference an order and
  legacy session for comparison but has no foreign-key target accepted by
  collection leases, provider-reference bindings, confirmation/protection
  evidence, switching, collision decisions, completion, cleanup, or money writers.
  Database grants and deferred constraints forbid promotion, authority-bearing
  state, or use wherever a canonical `payment_attempts.id` is required. Canary
  issuance creates or elects a fresh canonical attempt under rollout-generation
  fencing and never upgrades a shadow row in place; rollback can retain the
  observation without blocking legacy behavior.
- Under one completion authority at a time, route copied, non-secret input/state
  snapshots to the dedicated admin-mutation, Credit Direct SDK-first-report,
  signed-webhook-intake, cleanup, and internal-ledger shadow evaluators behind expected routing
  generation. These are separate pure functions, not a mode inside canonical
  writers. They execute only as `payment_shadow_evaluator`, insert an observation
  only through its matching guarded function, have no direct observation-table
  write grant, and cannot call a provider or any outbound mutating
  adapter method such as cancellation; their database-only identity and one-
  endpoint private-network allowlist make that denial structural. Legacy handlers
  alone own the production
  response, acknowledgement, order, lease, claim, cleanup, inventory, and money
  outcome.
  Before dispatch, the legacy boundary creates or reloads the immutable
  comparison-manifest child selected by the database cohort and later attaches its
  own production outcome hash. Shadow dispatch loss, evaluator failure, or an
  observation that does not match that child/input/artifact stays visible as a
  coverage failure. Instrumentation failure never changes the production result;
  independently owned route/legacy counters expose a missing census or outcome and
  prevent the window from closing. The evaluator cannot choose the population,
  report aggregate parity, or mark a child excluded.
  Canary activation requires explicit route ownership, stable cohort assignment,
  rollback generation, lock-budget SLO, and proof that unrelated providers retain
  their legacy route and acknowledgement behavior.
- Only the authority-scoped canary may make the guarded webhook transaction's
  retryable lock failure control the live acknowledgement response or enforce the
  admin replacement-order path. Canary switches to separately granted canonical
  functions; it never widens the shadow role or enables an authoritative mode in a
  shadow evaluator. Rollback atomically restores the prior route
  generation without deleting canonical evidence; Credit Direct, Paystack card,
  order DVA, wallet DVA, and agentic DVA advance independently.
- Deploy generation stamping and the dual legacy-compatible/canonical ingress
  router before any shadow or canary assignment. Existing sessions are backfilled
  only when their authority, active/superseded references, sign time, amount, and
  generation are provable; otherwise their legacy-compatible ownership remains
  explicit and their eventual verified money cannot be silently dropped.
- Register capture-finality contracts in `shadow`, attach conformance and approval
  receipts, and prove provider/account/authority-specific deadline/status semantics
  before canary issuance may snapshot an `active` generation. Rollback drains the
  generation for new issuance but retains verification for every pinned attempt;
  it cannot substitute another account's contract or alter a delay in place.
- Backfill scoped Credit Direct signed-session, popup-transaction, active,
  superseded, and provider-reference bindings where provable. Exercise the
  metadata fallback through the atomic binding-election function; order-note
  `ILIKE` remains comparison evidence and is never the canonical generation
  router.
- Before activating any new adapter identity-schema version, checksum-backfill
  old and new aliases onto existing canonical receipt identities, dual-read both
  versions in shadow, prove every supported event/verify shape emits the same
  version-independent canonical locator and full alias bundle for first-seen
  receipts, quarantine ambiguous mappings, and prove rollback retains every
  installed alias and locator contract. No adapter version cuts over while one
  receipt can resolve to two canonical identities, one alias can resolve
  ambiguously, or rolling versions can acquire different bootstrap locks.
- Register canonical-contract generations as `shadow`, prove family-lock and
  equivalence parity, then atomically activate exactly one generation per scope.
  An incompatible generation uses a fenced drain with disjoint identity-space
  proof; delayed ambiguity remains review-only, and rollback retains generations
  and aliases rather than re-keying canonical rows.
- Inventory every producer and consumer of non-confirmed legacy `transactions`,
  including initialization inserts, provider verification/status lookup,
  webhooks, reconciliation jobs, cleanup, dashboard/API projections, settlement,
  refunds, and tests. Record the owning completion authority and rollback reader
  for each path; an unlisted path blocks that authority's cutover.
- The inventory must explicitly migrate
  `apps/web/src/app/api/payments/verify/route.ts`, which currently finds a pending
  transaction by gateway reference before provider verification and shared
  finalization. Its canonical branch must resolve the scoped attempt first and
  create/reuse a confirmed transaction only after verified receipt evidence; the
  legacy transaction lookup remains solely behind the authority's compatibility
  flag until drain completion.
- Backfill a payment attempt from a pending/processing transaction only when
  merchant, order, provider-account namespace, reference, amount, currency, and
  collection epoch are provable. Quarantine conflicts and non-order rows into
  typed review/receiving-origin migration evidence; never infer success or an
  order from status alone.
- Record verified webhook inbox evidence without making it completion authority.
- Record shadow confirmation evidence for webhook, server-verification,
  authorized-manual receipt paths and internal-funding paths; compare which
  receipt evidence or source-ledger funding evidence would authorize each legacy
  completion without invoking the new authority or minting a receipt.
- The internal-funding comparison is its own pure `internal_ledger` evaluator and
  typed `payment_internal_funding_shadow_observations` relation, never a receipt-
  branch fallback. It runs in the separately bundled shadow runtime under the
  guarded-observation-only role, with no provider SDK/secret, canonical writer, or
  outbound egress. Its immutable child census is created by the legacy internal-
  funding boundary from every database-authorized source command before the
  legacy result is known. The child binds the stable legacy/shadow command ID,
  merchant, customer, order, collection epoch, source kind/slice, amount,
  currency, command-binding hash, approved evaluator-artifact checksum, and input-
  schema generation. The evaluator cannot select or omit the population.
- One guarded observation per child records the proposed `internal_ledger`
  command classification and safe hashes for the expected
  `payment_internal_funding_evidence` and
  `order_internal_funding_allocations` result, with the same artifact/input-schema
  binding as the child. During canary comparison, an independently owned outcome
  attachment binds the actual `financial_command_executions.id`,
  `payment_internal_funding_evidence.id`, and allocation/result ID back to that
  exact child and proves tenant/order/epoch/source/amount/currency equality. The
  evaluator cannot write command intake, evidence, allocation, or outcome rows.
- Internal-funding window closure reconciles the census against independently
  owned internal-ledger wrapper invocation, command-intake, and legacy/canary
  outcome counters/source rows. Missing/failed/timed-out observations, missing
  commands/results, duplicate or mismatched evidence/allocation, internal result
  carrying any receipt/provider field, or a receipt-tag result for an
  `internal_ledger` child is a denominator failure and zero-tolerance branch
  disagreement; none can be excluded by the evaluator or hidden by a successful
  receipt-path sample.
- Compare proposed canonical matches and amounts against current outcomes.
- Alert on disagreement; do not silently self-correct production money.
- Close each shadow window with one database-computed comparison receipt over the
  complete eligible census. Require source/legacy/shadow one-to-one cardinality,
  approved evaluator artifact and input-schema checksums, minimum gross/eligible
  sample, declared coverage, explicit counted exclusions, and zero missing
  observations for zero-tolerance authority/money classes. Rollout transitions
  reject caller-supplied aggregates or incomplete windows.
- Shadow processing is read-only with respect to order, transaction, inventory,
  settlement, wallet, and customer-visible state. It compares classification,
  references, both Credit Direct event transitions, residual amount, canonical
  receipt proposal, allocation, settlement policy, inventory result, and side-
  effect claims without acquiring money-writing authority.
- After shadow parity for one completion authority, only allowlisted new canary
  sessions switch initialization to attempts and route status/verify, webhook,
  customer polling, and reconciliation lookup through their stamped canonical
  generation. Legacy and grandfathered sessions keep their legacy-compatible
  lookup and writes. Stop that authority's pending-transaction writes only after
  canary widening reaches `active`, the grandfather/redelivery drain completes,
  and dependency counters prove no legacy writer remains. Confirmed receipt
  creation for canonical sessions remains owned solely by the new receipt
  function.
- Create a private, append-only `legacy_payment_attempt_archive` before the first
  drain. It stores the original transaction ID, normalized safe attempt fields,
  original status/timestamps, owning authority, provable attempt link where one
  exists, source-row checksum, migration batch, archive reason, and audit time;
  prohibited gateway payloads or secrets are not copied.
- Drain legacy non-confirmed rows through one transactional migration function:
  lock the source row, insert and checksum-verify its archive record, link a
  provable active attempt or record terminal/ambiguous evidence, then remove the
  non-financial row from the active `transactions` relation. A pending row is
  never promoted to confirmed or assigned a receipt origin. Confirmed rows are
  never moved or deleted by this drain.
- During compatibility, a separately named read-only view may union canonical
  confirmed transactions with archived attempt projections for explicitly
  inventoried legacy readers; it must expose an entry discriminator and cannot
  be used by settlement, allocation, refund, or new payment code. After those
  readers retire, `transactions` itself is physically confirmed-only rather than
  a status-filtered convention.
- Remove legacy pending-transaction reads only after production counters show no
  old writer/read dependency for the reviewed drain window. The unmodified old
  writer may resume only before its writer-shutdown/drain gate. Once physical
  drain begins, rollback to old completion is permitted only through a separately
  tested compatibility adapter that initializes attempts, reads the archive view,
  and never inserts pending financial rows; otherwise rollback fails closed into
  review. Batch counts, source/archive checksums, foreign-key inventory, and a
  zero-active-pending invariant are required receipts for physical cutover.

### Stage 2 — Credit Direct first

- Keep the existing Credit Direct webhook URL, Svix verification, and provider-
  dashboard subscription unchanged; deploy the generation router before moving
  any session to the canonical path.
- Activate the database rollout state machine first. Checkout issuance rejects a
  stale control version, wrong cohort checksum, unapproved transition receipt,
  or selected generation unequal to the rollout's current issuance generation.
  A webhook worker never compares an existing attempt to the current issuance
  generation: it validates that the pinned generation belongs to the attempt's
  immutable scope, was valid when issued, retains a compatible processor, and
  matches the elected binding. Paused, draining, rollback, or later-generation
  rollout state cannot strand that attempt.
- Migrate Credit Direct to attempts and the atomic completion function only for
  newly initialized, generation-pinned canary sessions. Pre-boundary sessions
  remain on the legacy-compatible processor through the full grandfather
  horizon, and delayed verified money after that horizon enters durable
  reconciliation rather than a success-without-recording response.
- Preserve active and superseded Credit Direct references.
- Preserve the signed provider two-event state machine while keeping the
  untrusted SDK-success report separate: the SDK report provides protection only;
  signed customer-payment completion is non-money approval plus only the bounded
  serialized-inventory reservation; merchant-payment completion alone authorizes
  the confirmed receipt, allocation, paid projection, atomic inventory
  confirmation, and externally settled funds. Signed-customer-only expiry
  releases the reservation; captured money with unavailable inventory enters
  suspense/remediation without false fulfilment.
  Prove customer-first, merchant-first, late-customer, duplicate, and missing-
  customer sequences.
- Populate `paid_at`, allocations, transaction linkage, and durable side effects.
- Replace the current 14-day explicit SDK-success cleanup exception with the
  owner-approved 48-hour window while retaining the existing two-hour unpaid
  serialized-inventory reservation behavior.
- Approve separate Credit Direct checkout protection, session actionability,
  first merchant-disbursement, redelivery, automatic-processing, rollback, and
  retention horizons. An unknown first-disbursement/redelivery maximum blocks
  compatibility-reference and safe-processor retirement, not the recording of
  late verified money.
- Decide and test Credit Direct settlement ownership before activation.
- Define Credit Direct funds-availability evidence, risk hold, merchant-
  entitlement calculation, and every legacy balance-writer fence before
  allowing withdrawable credit.
- Activate through stable, owner-approved merchant/session allowlists. Before
  canary, define minimum shadow sample/time, parity thresholds, maximum webhook
  acknowledgement and completion latency, and zero-tolerance stop conditions for
  duplicate/missing receipts, known-reference unattribution, wrong event
  authority, amount/allocation drift, inventory divergence, or settlement/wallet
  mutation. Any stop condition disables new canonical session issuance without
  moving in-flight sessions between generations.
- Verify exact references for fresh completion, concurrent callbacks, replay
  healing, cancellation, refund, inventory failure, and notification retry;
  complete the defined canary soak with no stop condition before widening the
  allowlist, then repeat before `active`. Legacy retirement and old index/trigger
  removal occur only after the grandfather horizon, provider retry drain, and
  zero-dependency counters all complete.

### Stage 3 — Other instant checkout and BNPL providers

Migrate one completion authority per reviewed PR. Suggested order:

1. Paystack card/hosted-checkout and Korapay paths already closest to the shared
   finalizer;
2. Kuda and PayPal;
3. Juicyway direct-success;
4. Klump and remaining BNPL providers.

Each cutover requires shadow agreement, focused regression tests,
generation-pinned grandfathering, stable allowlisted canary and soak gates,
completion-authority rollback, and production reference tracing. A provider that
works on the legacy authority continues there until its own gate passes; one
provider's cutover cannot redirect or fence another provider's authority.

Paystack card/hosted-checkout and Paystack DVA are separate routing authorities
even though they currently enter the same `charge.success` webhook route. Stage
3 must leave order-DVA, wallet-DVA, and agentic-DVA matching on their legacy
authority. Mutually exclusive route classification and feature flags must prove
that a verified event reaches exactly one of card completion, order-DVA,
wallet-DVA, agentic-DVA, or review. Paystack DVA cannot enter the canonical
attempt completion path until Stage 4 is activated.

### Stage 4 — Invoice DVA due-date integration

- Extend immutable DVA assignment epochs with attempt, due-date, and half-open
  effective-time evidence so delayed events use the terms active at provider
  `paid_at`.
- Persist provider-time source, precision, and clock-skew allowance; route any
  uncertainty interval that crosses an epoch boundary to review.
- Keep ordinary DVA invoices exact-balance-only and add explicit immutable
  installment schedules, schedule-change proposals, one-active-tranche leases,
  attempts, and assignments before enabling DVA installments; never infer a
  tranche from the received amount or pre-create a successor with an unknown
  activation boundary.
- Make tranche completion and next-tranche activation one locked transition,
  keep equal-amount scheduled tranches outside matching, and route untargeted
  early payment to review.
- Keep a future-term proposal non-authoritative while a current tranche is
  capturable; at its terminal boundary atomically close the predecessor, create
  the immutable successor, supersede untouched future tranches, and activate the
  proposal, with crash/retry and cancellation coverage.
- Enforce one live proposal per predecessor epoch, immutable cancel-and-replace
  edits, one proposal-to-successor link, and terminal-transition arbitration so
  exactly one of the successor first tranche or predecessor next tranche can be
  published; stale proposals enter review without silent fallback.
- Make `unpaid` and `partially_paid` collection statuses eligible only under the
  exact current balance/tranche contract; update every legacy candidate filter
  and preserve immutable completed tranches during future-tranche edits.
- Preserve the full receiver/customer/terminal/wallet conflict contract from
  the invoice-DVA design.
- Add the approved 7-day default and 1–30-day merchant controls.
- Add overdue-payment review and user-facing status.
- Add every new reconciliation issue type, constraint value, resolution action,
  customer-safe message, dashboard filter, and mobile/shared status mapping in
  the same staged rollout.
- Backfill only identity and due-date evidence that is provable; unresolved
  legacy assignments remain review-only.

### Stage 5 — Manual and mixed-tender completion

- Route wallet, savings, store credit, and stored-value vouchers through conserved
  internal-funding allocations; route deposits, installments, and manual
  collections backed by newly received money through receipt allocations.
- Cut over customer-wallet credit/refund/redemption/savings, stored-value-voucher
  issuance/redemption/refund, and merchant
  settlement/reserve/payout/withdrawal writers only after each uses the global
  advisory and row hierarchy; fence legacy triggers/workers, and permit
  historical table-lock backfills only under the maintenance fence.
- Route non-order wallet deposits through receiving intents and receipt origins;
  later spending consumes that existing wallet liability through an internal-
  funding allocation and never fabricates a second receipt or payment attempt.
- Cut over a reusable receiving intent only after immutable intent epochs,
  provider-paid-time uncertainty matching, ownership/purpose conflict review,
  delayed-event tests, and successor-epoch rollback compatibility are active.
- Require `exact_balance_only`, `partial_with_inventory_hold`, or disclosed
  preorder collection policy before accepting money; partial collection and its
  inventory deadline are never inferred from amount alone.
- Complete fully wallet, savings, store-credit, or stored-value-voucher-funded
  orders from immutable internal-funding evidence/allocation without creating a
  new `customer_receipt`, receipt origin, customer-disposition lot, provider
  settlement effect, or payment attempt.
- Route customer refunds of internal funding back through the same source-
  liability class (or a reviewed immutable successor), split only mixed-tender
  customer refunds by authoritative funding source, and prohibit provider cash
  refund of internal value without a separate finance-authorized conversion
  decision. Route chargebacks only through their original receipt-funded source;
  they must not restore an internal allocation, even when the receipt was the
  backing asset of a wallet spend.
- Create cash-on-delivery evidence only when an authorized staff workflow
  records actual collection. Any resulting manual attempt uses
  `noncapturable_by_construction`; placing a COD order alone is not a payment
  attempt. A customer-actionable bank-transfer request remains externally
  capturable and cannot use this branch.
- Preserve authorization and CSRF boundaries on staff actions.
- Backfill authoritative historical allocations only from existing transaction
  and wallet ledgers; do not infer missing money from order status alone.

### Rollback

Rollback is completion-authority-scoped. Disable the authority's new completion
flag and return to an old handler only when its reviewed compatibility matrix
shows that handler can recognize and idempotently reuse or refuse canonical
identity contract generations and equivalence aliases, canonical receipt
identities and aliases, ingress-contract generations, provider routing
generations/reference bindings, provider-account authority epochs, financial
routing resolutions, unscoped-quarantine proposals/resolutions, and order-
protection claims, checkout collision domains and legacy/current subject/request
aliases, SDK possible-capture evidence and `late_sdk_success`/
`cross_order_collision_review` results, and
`rotation_blocked_possible_capture` review decisions,
SDK authorization/corroboration rows and typed protection-closure rows,
rollout transitions and timing policies, durable financial-command executions
and claims,
transaction entry
kinds, confirmation evidence, receiving-intent epochs and capacity claims/
counters, receipt-origin resolutions and origins, reversal provenance,
conditional attempt-provenance links, allocations, attempts, customer-
disposition lots, economic components, internal-funding evidence/allocations,
funding-basis/obligor lineage, source-global reversal reservations/receipt-lineage
root guards/generations/active-veto counters/parent chargeback partitions/receipt-
lineage vetoes/high-water/census/partition pages/provider-dispute collisions/
finance-scopes/dispositions/parent-finance-resolution terminals/zero-finance-
reference census pages/seals/finance-child-reference pages/seals/child-finance-
resolution identities/replacement-
backing evidence,
backing-loss cases/fences/pending-vetoes/census/plans, and source-liability
reversals, provider-availability claims, reversal reservations, negative-balance
liabilities, reconciliation decisions, and
payment/reversal side-effect claims written by the new path, plus installment
schedule-change proposals and successor schedule epochs, customer-wallet
liabilities/ledgers, and merchant settlement/reserve/payout/withdrawal ledgers
where that authority uses them. Retain all append-only evidence, command results,
contract generations, and frozen identity/equivalence aliases.
A rollback retains the guarded SDK first-report invariant and every original
timestamp/expiry, the normalized non-null session identity, and the SDK key's
provider-reference-family advisory placement. While protected rows remain, it
also retains the post-lock wall-clock cleanup predicate. An older route may read
those fields but cannot extend them, use a stale pre-lock cleanup time, or acquire
a standalone source/session lock.
A rollback must not delete or rewrite confirmed financial rows.
Archived non-confirmed legacy attempts remain outside the active financial
ledger; an old reader may use only the named compatibility view, never restore
them as pending `transactions`.

Every completion-authority cutover PR defines forward and rollback ownership for
event/evidence classification, identity bootstrap and aliases, receiving-intent
capacity, transaction creation and provenance, allocation, inventory
confirmation, schedule proposals/activation, gross disposition, economic
components, wallet-credit transformation, provider availability, settlement,
refund/chargeback reversal, payout/withdrawal concurrency, liability recovery,
durable command retry/exhaustion, and payment/reversal side-effect
claims. Schema remains forward-compatible. A route
flag changes only after in-flight inbox work is drained or fenced by generation,
and rollback tests replay events created before and after the flag change.
Dual-processing is forbidden: exactly one completion authority is active for a
classified event at a time. If the old handler cannot safely consume the new
ledger semantics, rollback means disabling automatic completion and routing to
review, not blindly restoring the old writer.

Rollback is generation-pinned, not a global handler flip. It stops new canary or
canonical session issuance, preserves the original processor for every already-
issued legacy, canary, and active session, and keeps the stable provider URL and
signature verifier online. In-flight canonical sessions either finish on their
compatible generation or enter durable reconciliation; they are never handed to
an old writer that cannot understand canonical rows. Grandfather timers,
ingress-contract generations, session-generation/reference bindings, rollout
transition history, timing
policies, DDL operation receipts, verified inbox evidence, and exact-reference
results survive rollback. Shared expand-only schema remains dormant and cannot
change another provider's route. Retiring compatibility code, old indexes,
triggers, or grants is irreversible for routing purposes until the provider
redelivery drain and rollback window both close.

## Testing Strategy

### Order and attempt tests

- same explicit key and same request hash returns the same order;
- same key with changed commercial payload returns conflict;
- provider switch reuses the order and creates a new attempt;
- direct SQL cannot create noncapturability evidence from local lease state,
  popup/client time, an unacknowledged cancellation, a mismatched attempt/session/
  provider authority, or a contract-expiry clock before the pinned deadline;
- guarded noncapturability creation races provider capture, webhook intake, and
  server verification in both directions using the identical order, collision,
  provider-reference, and canonical-receipt families. Capture/in-flight-first
  refuses evidence and successor authority; proved-revocation/expiry-first permits
  successor publication atomically and routes any later verified money to durable
  late review. Exact effective-finality-instant-minus-one, at-instant, and plus-one
  database-clock fixtures prove the half-open boundary, including any pinned
  delay. A capture accepted just
  before the nominal deadline whose webhook/verification arrives afterward
  defeats expiry evidence and successor publication unless the pinned adapter's
  reviewed hard-finality contract makes that outcome impossible; adapters without
  that guarantee cannot enable bare `contract_expired`;
- finality-contract activation requires matching provider/account/authority,
  maker/checker approval, schema/version, and conformance receipt; missing receipt,
  altered deadline/delay, cross-account reuse, inactive-at-issuance generation,
  and request-selected policy fail closed. Activation, drain, and rollback races
  leave every external-session attempt pinned to exactly one verifiable generation;
- a new key creates an intentional repeat order only when no active protection or
  collision veto exists, or when one valid separate-purchase nonce authorizes it;
  a new key with an active veto and no nonce returns/rejects generically and creates
  no order or lease;
- ordinary key rotation occurs at 24 hours, but a Credit Direct protected binding
  returns the existing order through 48 hours and cannot launch another rail;
- an explicit single-use separate-purchase nonce creates a second intentional
  order during protection and cannot be replayed;
- a nonce is rejected for another merchant, customer/proof subject, protected
  order, non-equivalent commercial identity, or expired grant, and concurrent
  consumption can create only one resulting order;
- a nonce issued under request-contract generation v1 consumes under an equivalent
  active/draining v2 alias and after a rollback to v1, but rejects an unknown,
  ambiguous, commercially changed, or retired generation lacking its retained
  issuance bundle;
- request-generation retirement immediately before issuance, while an unexpired
  nonce exists, and concurrently with consumption shares the checkout-contract
  control protocol. Retirement either observes zero grants with a live expiry or
  idempotent replay horizon, or retains the
  immutable alias bundle for every consumed/unconsumed grant through the later of
  expiry or idempotent replay horizon plus margin; no valid nonce is
  invalidated and a nonce-only alias cannot bootstrap a checkout;
- consume-commit/response-loss/retirement/retry returns the same result through
  exact consumed-grant lookup even after generation retirement. Both consumed and
  unconsumed grants retain aliases through the later of expiry or idempotent replay
  horizon plus margin; rollback cannot remove that replay result. Replay with the
  still-valid original proof succeeds; after logout, session rotation, tracking-
  proof expiry, or OTP expiry it succeeds only with fresh proof resolving to the
  same authorized subject component. An expired proof, nonce plus email string,
  revoked identity, ambiguous equivalence, cross-merchant subject, or missing
  authorization returns no order details and creates no authority;
- nonce-versus-provider-switch, SDK-first-report, provider capture, and cleanup
  races prove the nonce creates only a distinct result order, never supersedes or
  replaces the protected predecessor, never supplies noncapturability evidence,
  and never changes the predecessor attempt or collection lease;
- collision-domain alias tests span request-hash generation rollout and rollback,
  replacement tracking/OTP proofs, guest-proof-to-authenticated-customer binding,
  and simultaneous old/new clients. Every proved alias set resolves and locks one
  domain in sorted order; missing, conflicting, cyclic, cross-merchant, or drifting
  alias sets fail closed without a second order or lease;
- identity-edge insertion never creates a domain or locks orders. Two legitimate
  purchases by equivalent guest/authenticated subjects remain independent, while
  commercial-alias projection for one frozen intent acquires only that bounded
  intent's subject/component/domain/order set. Cross-intent and over-64-order or
  over-256-entry fixtures fail closed into typed review/quarantine without partial
  locks or unrelated-order freezes;
- first-create versus commercial-alias projection, projection versus projection,
  and proof rotation versus projection races converge for one intent. A two-domain
  conflict freezes all members; confirmed merge creates one monotonic successor
  root while rejected bridge keeps separate roots and advances their generations.
  Resolution-versus-create and post-resolution create/SDK/switch races initiated
  through each old domain discover and lock the same active root, full membership,
  orders, and aliases or abort on generation drift;
- false-bridge adjudication preserves distinct active roots and unfreezes only
  roots without another veto. Reject-versus-create and reject-versus-SDK races
  observe the advanced root generations. Overflow recovery stages checksumed
  bounded batches, survives crashes/retries, rejects membership drift, publishes
  one final recovery CAS, and never partially unfreezes or exposes staged mappings.
  Legitimate 65-plus repeat-purchase and 257-plus proof/hash-alias fixtures cannot
  loop freeze/unfreeze: guarded closed-order/domain/alias compaction retains lookup and
  late-money evidence, removes only database-proved non-authoritative members from
  the active lock closure, and final publication is refused unless the resulting
  closure is within both caps. Live grants, protection, leases, rollback aliases,
  or one missing closure proof keep the component frozen;
- while such a component is frozen, exact-reference signed ingress still commits
  one retained manifest/child and non-expiring non-money overflow-mode webhook
  claim under its
  selected order/root/reference locks and can be acknowledged. It cannot process
  money or authority before bounded recovery; ambiguous/unbound ingress remains
  provider-account/global quarantine. Cleanup cannot cancel an order protected by
  the root fence or claim, and replay after recovery consumes the same child. Each
  retained child/claim increments the recovery anchor revision; stale staged
  publication is rejected and rescanned, and the claimed order cannot be compacted
  before typed terminal closure. Post-recovery processing consumes the existing
  claim through one linked command; replay creates no replacement claim, and
  retry/review cannot remove the cleanup veto;
- legacy initialization plus `payment_attempt_shadow_observations` races webhook,
  verification, switching, cleanup, canary issuance, and rollback. Shadow rows
  cannot own leases/references/evidence, satisfy canonical attempt foreign keys,
  block legacy behavior, or upgrade in place; canary elects one fresh authoritative
  attempt under its pinned rollout generation;
- direct SQL and wrong-role tests prove every admin/SDK/webhook/cleanup shadow
  evaluator cannot insert, update, or delete its observation table directly, can
  execute only its matching guarded observation-insert function, and cannot
  execute or mutate any canonical writer/table. Accidental canonical calls and provider cancellation/
  outbound mutation are denied; build/import, secret-mount, credential, and egress-
  policy fixtures prove the shadow runtime has only its short-lived database role
  and private database/proxy endpoint, rejects provider/payment secrets and every
  public/provider/metadata/DNS destination, and cannot broaden either allowlist.
  Shadow/canary
  and rollback races change authority only by routing to separately granted
  canonical functions;
- shadow census tests prove the legacy boundary, not the evaluator, owns cohort
  eligibility and legacy outcomes. Dropped dispatch, evaluator crash, selective
  success-only reporting, duplicate/forged observations, input/artifact checksum
  mismatch, and unapproved exclusion all remain denominator failures and block
  widening. A rollout receipt recomputed from a closed complete window matches its
  source rows and rejects caller-supplied aggregates. Census/dispatch/outcome-
  attachment failure leaves the legacy response and financial result unchanged,
  but independently owned route/outcome counters expose the gap and block window
  closure. Guarded-insert and direct-SQL tests reject an observation whose child,
  authority, generation, evaluator kind, input hash, artifact checksum, or schema
  generation differs from its immutable census child, even when the child ID is
  otherwise unique;
- internal-ledger shadow tests prove the legacy boundary owns the complete command
  census and independent invocation/command/outcome counts. Each observation is
  artifact/input-schema bound to one command child; canary outcome attachment
  requires the exact command, internal-funding evidence, and allocation result.
  Dropped/failed observations, missing or duplicate results, changed source/
  amount/order/epoch, cross-merchant or cross-customer binding, changed currency
  or command-binding hash, a receipt-tag result, or any receipt/provider field on
  an internal result remains a zero-tolerance denominator failure and blocks closure;
- protected guest responses reveal no prior order details without tracking
  proof;
- commercial admin edits remain possible before collection evidence, but an
  issued attempt or DVA assignment prevents in-place financial/matching edits
  and requires one atomic replacement order;
- concurrent edit, attempt creation, and replacement-order requests cannot
  leave an attempt bound to stale commercial terms;
- replacement-order creation cannot publish a new actionable attempt while the
  original order has non-revocable or possible-capture collection authority;
- concurrent attempt creation leaves one active attempt per provider and one
  customer-actionable collection lease across all providers;
- provider switching revokes or expires the old actionable attempt before the
  new lease is exposed and is blocked while old possible-capture protection is
  active;
- superseded references remain auditable;
- every allowed state transition succeeds with compare-and-set semantics;
- forbidden regressions from terminal states fail closed;
- a verified capture for a superseded, expired, or failed attempt records money
  for review without reopening the attempt or order;
- provider references are isolated across different provider-account
  namespaces.
- `external_session` attempts require a matching capture-finality contract, while
  authorized already-collected manual attempts require
  `noncapturable_by_construction`, no provider session/customer identity, and no
  actionable lease. Direct SQL, request-selected kind, synthetic namespace, or a
  manual transfer that can still receive money cannot bypass external finality;
- `noncapturable_by_construction` issuance starts only in
  `manual_evidence_pending`; authorized evidence CASes to terminal
  `manual_receipt_recorded`, typed conflict may enter
  `manual_evidence_review_required`, and direct SQL cannot select expiry,
  switching, revocation, supersession, successor-session, or provider-only states;
  this branch has no finality-contract FK and can never create
  `payment_attempt_noncapturability_evidence`;
- maker/checker-authorized manual reconciliation can CAS a matching
  `manual_evidence_review_required` attempt to `manual_receipt_recorded` only with
  one immutable resolution row and atomic reviewed receipt/completion result.
  Same-key replay returns that result; unauthorized, stale-version, duplicate,
  changed-evidence, invalid-state, and direct-SQL attempts create no receipt or
  transition;
- attempt issuance snapshots authority, generation, cohort, processor contract,
  and initial reference binding atomically; request-selected or stale cached
  routing values cannot override the database rollout state;
- concurrent rollout stop with attempt, receiving-intent-epoch, and provider-
  account-authority-epoch issuance is linearizable through the same rollout-row-
  first protocol; every kind snapshots one generation by expected-version CAS,
  while gaps, overlapping account epochs, forked successors, and lock inversion
  fail closed;
- active, superseded, signed-session, popup-transaction, and provider-reference
  bindings resolve one attempt/generation; concurrent metadata fallback elects
  one binding, while cross-attempt or ambiguous aliases enter review;
- the guarded SDK first-report write is atomic under duplicate and concurrent
  callbacks, preserves the original server timestamp, derives exactly one
  `+48 hours` expiry only for an eligible protected result, rejects cross-order/
  session/attempt evidence without extending protection, and shares cleanup's
  order advisory plus row lock. Same-grant replay, replacement-grant replay, and
  concurrent different-grant reports for one attempt/session return the same
  evidence; changed request/amount/currency facts conflict. Authenticated-customer
  reports exercise the no-grant branch. Missing, empty, or normalization-colliding
  provider sessions fail before lock derivation, and direct SQL cannot insert
  duplicate null-session identities;
  SDK-first-report-first commits one typed SDK claim that vetoes cleanup, while
  cleanup-first records immutable `late_sdk_success` possible-capture evidence
  and one review result without a claim, protection expiry, confirmation evidence,
  transaction, order reopening, allocation, inventory, or fulfilment;
- key rotation and SDK first-report race in both directions immediately before,
  exactly at, and immediately after hour 24 under the shared persisted collision
  domain. SDK-first prevents successor authority without a nonce. Rotation-first
  publishes a successor only after matching immutable provider revocation or
  hard-finality-qualified contract-expiry evidence; otherwise it retains the predecessor,
  creates no successor order/lease, and records
  `rotation_blocked_possible_capture`. After proved non-capturability, a delayed
  SDK report creates one `cross_order_collision_review`; a valid single-use nonce
  permits exactly one intentional successor. Provider-capture-versus-rotation and
  randomized repeats prove no unapproved collision domain has an externally
  capturable predecessor plus successor lease, two protected orders, or an orphan
  review;

### Webhook tests

- valid and invalid signatures for every provider;
- missing production secret fails closed;
- duplicate and concurrent webhook delivery is idempotent;
- the same stable reference/event/child-capture identity with a changed amount,
  currency, or paid-time fact creates one transaction plus conflict review, never
  a second confirmed-money identity;
- an inbox fallback hash containing amount/currency remains operational evidence
  only and cannot authorize completion without a stable receipt identity;
- a provider lacking a stable event identifier freezes its first-acknowledgement
  fallback locator and ingress-scope snapshot, including explicit unresolved
  sentinels; later tenant/account adoption, parser enrichment, duplicate delivery,
  and post-pruning redelivery all reuse that identity and cannot re-key or create a
  second inbox or manifest;
- webhook and provider status/verify completion create source-appropriate typed
  confirmation evidence and converge on one confirmed customer receipt;
- concurrent webhook and provider verification atomically elect one authorizing
  evidence plus accepted origin resolution under the canonical identity lock;
  an equivalent loser becomes corroborating, a conflict enters review, and no
  orphan accepted resolution survives rollback;
- direct-reference and DVA-matcher proposals are immutable; the winning
  canonical receipt identity has exactly one accepted resolution, and
  zero/multiple/protected candidates produce an unattributed origin rather than
  a fake attempt;
- order-attempt, receiving-intent-epoch, and unattributed-provider-account
  children each elect at most one immutable financial routing resolution and
  matching origin; a parent event may aggregate several independent child routes,
  only the order branch requires an attempt binding, and conflicting target/
  generation proposals cannot write money;
- delayed permanent-DVA receipts use the receiving-intent or provider-account
  authority epoch effective at verified paid time through canary stop, successor
  activation, and rollback; overlap, boundary crossing, or missing permitted time
  evidence enters review rather than using the current generation;
- from an empty canonical/alias registry, the same first-ever provider event
  parsed concurrently by identity-schema versions v1 and v2 acquires one
  version-independent bootstrap lock and creates one canonical identity,
  transaction, and complete alias bundle; alias/canonical scope includes the
  required tenant, ambiguous parity blocks activation, and rollback to v1 cannot
  duplicate money;
- canonical-contract generations enforce one active generation per scope;
  compatible rolling activation proves one family lock and preinstalled
  equivalence aliases, while incompatible contracts require fenced drain and
  disjoint identity-space proof; delayed ambiguity and unsafe rollback enter
  review without mutating canonical rows;
- every authorized webhook manifest child plus each provider-verify, authorized-
  manual, internal-ledger, reconciliation, and quarantine-adoption source creates/
  reuses exactly one durable execution record; an unauthorized/review-only child
  creates none, and a bounded-multi-capture inbox never owns one command shared by
  its children;
- receipt-authorizing command results require confirmation evidence and receipt
  transaction, internal-ledger results require internal-funding evidence and
  allocation, and database checks reject cross-branch result IDs;
- internal-ledger command intake derives an immutable authorized order/source-
  slice/amount/currency/epoch binding; direct SQL missing or cross-branch input
  shapes fail, and execution revalidates changed/closed source or order state;
- process crash, typed lock-set retry, database error, lease expiry, and maximum
  exhaustion preserve the same idempotency/result identity and a durable retry
  or review state;
- client SDK callbacks can create only typed possible-capture protection with a
  server receipt time; they cannot transition an attempt, create/extend an
  inventory reservation, or create verified confirmation evidence, and a wrapper
  rejects missing, unverified, cross-tenant, amount-mismatched,
  authority-generation-mismatched, origin-type-mismatched, or—when applicable—
  attempt/receiving-intent-mismatched evidence. A generally consumed tracking
  grant is rejected unless it was consumed by the exact existing SDK evidence and
  every frozen fact matches; an authenticated customer requires no grant;
- SDK protection claims enforce their source-kind shape and partial uniqueness:
  they require `payment_sdk_possible_capture_evidence(result='protected')`,
  attempt and normalized non-null provider session, with authorization provenance frozen in the SDK
  evidence/authorization rows,
  forbid webhook manifest/child identifiers, and one immutable SDK source can
  protect at most one order. Webhook-child claims enforce the inverse shape.
  Their ordinary mode forbids an overflow anchor; `collision_overflow_frozen`
  requires an exact binding, selected order, active frozen root/anchor, retained
  child, no financial command at ingress, and later ordinary-worker revalidation
  after recovery. Post-recovery processing links one command to that existing
  claim and cannot insert a new/replacement claim; retry/review retains the veto
  until matching terminal closure. Wrong mode/anchor, fuzzy candidate, unfreezing
  race, pre-recovery command, or second claim fails closed;
- malformed cross-kind or nullable provenance combinations fail at the database;
- SDK possible-capture evidence enforces one immutable source identity and exactly
  one of three results: `protected` has a non-null write-once expiry exactly 48
  elapsed hours after `received_at` and one claim; `late_sdk_success` has one
  idempotent late review; and `cross_order_collision_review` has one idempotent
  review plus frozen predecessor/successor/collision identity. Both review-only
  results have no claim, protection expiry, confirmation evidence, transaction, or
  collection authority. Same-grant, replacement-grant, concurrent-grant, duplicate,
  cross-order, changed-request, and cross-result fixtures prove stable replay and
  fail closed where facts conflict. Direct SQL fixtures reject missing, duplicate,
  cross-result, orphan claim/review links, nullable SDK identity components, and
  normalization-equivalent duplicate sessions;
- manual receipt evidence and separate internal-funding evidence prove actor or
  source-ledger authority without requiring a webhook row; internal funding cannot
  satisfy a customer-receipt confirmation-evidence FK;
- a verified source may persist one non-authoritative financial-routing proposal
  before receipt matching, but neither that proposal nor an unlinked evidence row
  writes money; one canonical-identity-locked transaction creates/reuses evidence
  and atomically accepts routing, origin, transaction, and authorizing link, with
  fault injection at every step proving no partially accepted graph survives;
- singleton webhook manifests produce exactly one durable child source proof and
  proposal, then one command for an authorized child and one evidence/receipt graph
  for a completed child; bounded-multi-capture manifests apply the same independent
  chain to every deterministic child and conserve the parent total. Duplicate,
  missing, added, changed, mixed-scope,
  or parser-divergent children fail closed; crash/replay resumes pending children
  without changing the accepted manifest, sharing a proposal/command, or
  duplicating completed child transactions;
- signed customer and merchant Credit Direct events can arrive in either order;
- Credit Direct signed-customer-only completion records approval/inventory
  evidence but
  never confirmed money, allocation, `paid_at`, paid status, settlement, or
  merchant value; merchant-first completion succeeds without the customer event,
  and a late customer event only corroborates without regression;
- signed-customer-only approval creates at most the existing bounded serialized-
  inventory reservation, never confirmed sale/fulfilment; expiry releases it
  once, merchant completion converts it atomically, and unavailable/expired
  inventory preserves confirmed money in suspense plus one remediation case;
- the stable Credit Direct URL and Svix verifier accept pre-, during-, and post-
  cutover deliveries; session generation selects exactly one processor while
  active, superseded, and safely recoverable unpersisted-popup references retain
  their legacy-compatible behavior;
- disabling canary issuance does not reroute an in-flight canary session, and a
  verified event after grandfather expiry creates durable reconciliation rather
  than being acknowledged and discarded;
- rollout widening with stale version, changed cohort checksum, missing threshold
  snapshot, unmet sample/soak/latency gate, active stop reason, or missing
  maker/checker receipt is rejected; concurrent stop/widen elects one transition,
  and a stop prevents subsequent issuance without changing existing bindings;
- active, superseded, cancelled, refunded, and already-paid outcomes;
- safe payload retention contains no prohibited fields;
- acknowledgement atomically persists a processable versioned normalized
  envelope, authority key, ingress-contract generation, independently replay-
  keyed durable manifest, complete child proof set, and manifest checksum/count/
  conservation facts before returning success; every safely order-associated
  child also commits its shared-lock protection claim or terminal late-ingress
  result in that transaction, while each unsafe child commits an explicit no-safe-
  order decision whose review scope is
  merchant reconciliation for proved same-tenant/account ambiguity and global
  quarantine only for unresolved/conflicting/cross-tenant scope; lock-budget
  failure returns retryable non-success and no acknowledged claim-pending state
  exists;
- concurrent old/new ingress parsers for one event produce one inbox row using a
  generation-independent replay key; the loser reloads and corroborates an
  equivalent envelope, disagreement enters conflict review, and neither path
  returns a uniqueness 5xx; CAS activation, drain, retirement, and rollback gates
  enforce one active generation per endpoint/key/authority;
- unscoped quarantine allows only audited platform operations to propose and
  atomically adopt merchant/account scope plus one non-authoritative routing
  proposal per manifest child with actor and reason; whole-manifest adoption
  requires every child to prove the same scope, while mixed-scope children enter
  conflict review. Adoption cannot attach an accepted routing resolution, and a
  crash between adoption and receipt leaves one durable idempotent
  `quarantine_adoption` command per child; stale/conflicting proposals fail
  closed, unresolved rows cannot be pruned, and no merchant-scoped review exists
  before safe tenant resolution;
- inbox-pruning fixtures prove a terminal row can be deleted only after a checked
  durable-manifest projection; deletion nulls only the operational inbox link and
  preserves every child source proof, command, evidence link, manifest checksum,
  conservation fact, canonical receipt graph, and review throughout financial-
  record retention, with no cascade or orphan. Redelivery after pruning reloads
  the retained manifest by its independent replay-key constraint, reproduces the
  same child set, and creates no new command, canonical identity, or transaction;
- deterministic quarantine adoption proves provider-account ownership and stable
  reference/receiver scope; operator-selected cross-tenant adoption requires a
  distinct authorized maker and checker, routes only to unattributed gross
  suspense, exposes no merchant order/customer data, and cannot allocate or
  fulfil until a separate fresh-authority reconciliation decision; later
  correction uses conserved entries without mutating the accepted mapping or raw
  ingress;
- unknown ingress-contract versions and unsafe attempt generations enter review
  without completion;
- pausing, rolling back, or advancing the current issuance generation does not
  reject an older in-flight attempt whose pinned generation remains compatible;
- Paystack card and each DVA purpose are classified into exactly one authority;
- identical event IDs or references in different merchant/provider-account
  namespaces do not deduplicate each other;
- Stage 3 flags cannot route a DVA event into card completion;
- configured inbox pruning preserves linked durable financial and audit facts.

### Allocation and completion tests

- one transaction settles an order;
- wallet plus gateway residual settles an order;
- wallet top-up records one external receipt, while later wallet spend records
  one source debit/internal allocation and never a second receipt or attempt;
- concurrent or replayed internal-funding commands cannot consume the same source
  amount twice, and failure after source debit rolls back allocation, inventory,
  paid projection, and terminal effects together;
- internal-funding execution always derives the typed backing asset and derives a
  receipt-lineage root only for a receipt-backed source. That branch takes and
  revalidates the root guard before source-child debit; a concurrent chargeback
  fence wins or forces typed retry with every result unchanged. Merchant-issued,
  platform-funded, and other non-receipt sources use only their typed asset/source-
  slice locks and cannot fabricate a receipt root;
- an internal-funding command is immutably bound to its authorized tenant,
  customer, order, collection epoch, source slice, currency, and amount; cross-
  order/source substitution fails, and cumulative receipt plus internal funding
  above the locked payable total is rejected before debit with the source intact;
- complete, partial, and replayed internal-funding outcomes retain the
  `internal_funding` result tag and command/evidence/allocation IDs while every
  receipt/provider field is required to be `NULL` or structurally absent;
  receipt outcomes prove the inverse, and direct SQL cannot mix either branch or
  select a captured-money variant for internal funding;
- mixed receipt/internal funding preserves receipt-first and internal-first flows.
  Each completion transaction atomically commits only its newly written receipt
  allocation or internal-funding allocation together with the recomputed
  authoritative funded balance, any partial/paid transition, inventory decision,
  and resulting effects; it reloads but does not recreate the already-committed
  historical leg. Both orderings and their idempotent replays converge to the same
  conserved total and terminal state. A promotional discount changes order price
  without becoming stored-value funding;
- a receipt allocation and internal-funding allocation racing from stale reads for
  the final residual serialize on the order and revalidate the locked payable
  balance. Exactly two conserved historical legs may remain and their sum equals,
  never exceeds, the payable amount; one transaction owns the single paid
  transition and order-terminal effect set while the other converges without
  overfunding or duplicate effects. Replay after either winner returns that same
  state;
- customer-funded, merchant-issued, platform-funded, and stored-value internal
  sources preserve their distinct backing/obligor and availability lineage;
  unbacked labels cannot create withdrawable merchant entitlement;
- partial payments leave the correct balance;
- receipt-funded partial allocations write `partially_paid`, seed transaction-
  scoped settlement/receipt effects, and do not seed order-terminal effects;
- internal-funded partial allocations write `partially_paid` without any
  transaction-scoped receipt acknowledgement or provider-settlement claim and
  without order-terminal effects;
- `exact_balance_only` sends underpayment and overpayment to suspense without an
  allocation;
- `partial_with_inventory_hold` commits allocation and inventory through the
  collection deadline together, and rolls both back to suspense when inventory
  cannot be secured;
- default `on_full_payment` keeps custodied partial funds in suspense until exact
  settlement, while reviewed disclosed installment terms can release each
  installment once;
- partial-collection expiry releases inventory and routes suspense/external
  obligations to one resolution case without losing allocations;
- ordinary stock cannot enter `partial_without_stock_commitment`, while an
  explicitly disclosed preorder can;
- overpayment and currency mismatch file review;
- allocations across multiple orders cannot exceed the transaction's confirmed
  gross amount;
- database checks reject a reversal carrying receipt gross/origin/lots,
  allocations, settlement effects, or paid-order effects, and reject a customer
  receipt carrying reversal amount/provenance;
- active customer-disposition-lot amounts always sum to transaction gross across
  allocation, wallet credit, and partial refund, while each lot's economic
  components independently sum to that lot;
- only merchant-entitlement components can credit merchant value; platform fee,
  gateway liability, tax, and rounding components never over-credit gross;
- deterministic component rounding conserves gross for split allocations and
  partial reversals;
- a transaction split across two orders can settle one portion's merchant
  entitlement while a second gross lot remains in suspense;
- provider fees and net settlement do not change allocatable customer-paid
  gross amount;
- unsupported provider precision fails closed before allocation;
- one stable receipt reference/event/child-capture identity cannot create two
  completed customer receipts, including conflicting economic-fact replays;
- every new customer-receipt transaction has exactly one immutable receipt
  origin; order-attempt
  origins have exactly one attempt-provenance link, receiving-intent and
  unattributed origins have none, and ambiguous legacy provenance cannot inherit
  an attempt settlement policy;
- an unmatched permanent-DVA receipt and a verified wallet receiving-intent
  create confirmed money without a synthetic order, while later attribution does
  not rewrite origin or create a second transaction;
- an unattributed receipt begins with one gross-equal `suspense_principal`; an
  authorized allocation reclassifies it through balanced entries, and a mere
  candidate cannot create withdrawable merchant entitlement;
- `single_capture` rejects a second transaction, while `bounded_multi_capture`
  conserves the linked transaction sum and transitions through
  `partially_succeeded` without exceeding its authorized amount;
- mixed tender leaves `paid_transaction_id` null but has exact allocations;
- paid completion writes `paid_at` and seeds every owned side effect;
- inventory failure commits `captured_inventory_unavailable` transaction and
  review evidence without allocation or a falsely paid order;
- unexpected database failure rolls back the complete outcome.
- the provider wrapper rejects authenticated callers and the manual wrapper
  rejects service/client-selected actors, unauthorized staff, and cross-tenant
  orders;
- the authenticated manual wrapper and service provider wrapper converge through
  the same private allocation invariants.
- reconciliation replay with the same decision idempotency key returns the same
  outcome, while a stale version or different financial decision is rejected;
- zero-candidate reconciliation remains transaction-scoped with no order, while
  multi-candidate review preserves its candidate snapshot and locks only the
  selected order when an authorized allocation is chosen;
- completion versus selected-order reconciliation, reversal versus wallet
  credit, receiving-intent receipt versus epoch succession, settlement versus
  liability recovery, replacement/switch versus DVA cleanup, and DVA matching
  versus due-date edit follow the same advisory and row-lock hierarchy without
  deadlock;
- a changed discovered identity set raises the typed exception, rolls back the
  complete database transaction, and succeeds only from a fresh bounded retry
  under the same idempotency key; retry exhaustion preserves one retryable state
  and no partial row, lock-dependent result, or duplicate money;
- concurrent refund, wallet-credit, allocation, and replacement-order decisions
  can accept exactly one conserved outcome;
- two distinct refund/chargeback cases racing for the same receipt lot,
  transaction/allocation portion, internal allocation, or consumed source slice
  subtract every active, ambiguous, completed, or otherwise consuming source-
  global reservation before either provider call or restoration. One case may
  reserve the remaining capacity; an over-reserving rival returns typed conflict/
  review and no source, provider call, customer restoration, or merchant debit is
  duplicated;
- partial/full customer-refund and chargeback replay preserve original
  allocations, reverse the correct economic components, and debit or hold
  previously credited merchant entitlement exactly once;
- a wholly internal customer refund creates/reloads exactly one
  `internal_funding_plan` source with its immutable allocation/source-slice set,
  restores the same source-liability class exactly once, and keeps every
  transaction/provider-refund/receipt-effect field absent while still producing
  the required generic reversal effects;
- a receipt-only or mixed customer refund of a multi-capture/multi-provider order
  creates one to many `receipt_transaction` legs, each with the coalesced source
  amount and the original receipt's provider obligation, plus at most one
  internal plan leg; the persisted leg amounts exactly equal the requested case
  amount and generic reversal effects are seeded once for the case, not per leg;
- when one provider leg completes and a second leg fails retryably or reports an
  ambiguous result, the case stays pending/review with the completed leg immutable;
  retry and idempotent replay resume or reload only the unfinished leg and cannot
  duplicate its provider call, a source amount, or a case-level generic effect;
- mixed-tender *customer refunds* split by authoritative funding source, and no
  internal portion reaches provider cash refund without a finance-authorized
  conversion;
- proportional mixed-tender customer refunds use the persisted integer-minor-
  unit formula, fractional-remainder ordering, receipt-before-internal tie break,
  and immutable allocation-ID tie break; replay returns the identical persisted
  source portions and their sum always equals the requested reversal;
- proportional and explicit refund splits recompute locked source capacities
  before any persisted portion or provider call; `S=0`, `R>S`, or a source-local
  over-cap returns typed conflict/review with no reservation, provider call, or
  source restoration;
- proportional mixed-refund tests exercise `S = sum(s_i)` and `R * s_i` near the
  maximum supported amount. Arbitrary-precision execution remains exact; a
  checked fixed-width implementation returns
  `refund_numeric_bounds_review_required` before any split, reservation,
  provider call, source restoration, or liability mutation;
- fault injection after portion insertion and before reservation insertion, and
  in the inverse statement order, rolls back the complete reversal transaction;
  no retry can observe a portion without its source-global reservation, a
  reservation without its portion, or a partial durable split;
- a 100-minor-unit order funded 50 by receipt and 50 by internal value, followed
  by a 50-minor-unit chargeback of the receipt, persists exactly one receipt
  source portion of 50, zero internal source/restoration, no internal-allocation
  reversal, and exactly-once receipt-component/merchant-liability effects;
- a chargeback against a receipt without typed backing lineage retains its
  authoritative receipt-only evidence/result but creates no root guard, parent
  loss authority/veto, backing-loss case, child, or recovery obligation. A
  chargeback against a typed backing receipt instead commits its root guard plus
  parent `D`/`Q`/`E` authority, target partition, finance scope, veto, and
  high-water atomically with evidence/source reservation before acknowledgement;
  crash/replay may resume only the later bounded child/recovery lifecycle and
  never restores an internal allocation;
- refund-then-chargeback persists authoritative provider chargeback evidence and
  all overlapping source reservations even when no receipt capacity remains. It
  creates one typed provider-dispute collision/reconciliation liability for the
  excess, holds an unfinished overlapping refund obligation for verification, and
  never refunds/restores the customer or debits/holds merchant value a second time
  directly or through backing-loss recovery;
- chargeback-then-refund retains the earlier chargeback reservation/evidence and
  rejects the later overlapping refund before its provider call or internal
  restoration; retry/replay cannot turn that conflict into a duplicate customer,
  merchant, or provider movement;
- an already-consumed 100-minor-unit wallet top-up with a prior 100-minor-unit
  refund followed by an authoritative 100-minor-unit chargeback persists
  parent `D=100`, `Q=0`, and `E=100` with immutable `E_finance` scope,
  `Q_nonasset=0`, and one backing child `q_asset=0`. Intake atomically takes root
  guard -> parent partition -> parent veto -> parent finance scope and records the
  guard activation/high-water; bounded materialization later writes that child
  zero-recoverable marker and child fence plus one parent finance replacement-
  backing/reconciliation disposition. Its bounded finance-child-reference census
  writes the child's one zero-share reference and seals
  `positive_child_shares=0 + parent_only_E=100 = E`, but creates no child census
  candidate, plan/application item, recovery row, customer/internal movement, or
  merchant debit/hold. `complete_child_finance_resolution` then writes exactly one
  `finance_no_recovery_resolved` result keyed by that disposition and child; a
  crash before/after reference pages, their seal, or the terminal and a same-pair
  replay converge, while a missing/duplicate/divergent parent/partition/
  disposition/reference/share cannot make `q_asset` recoverable or lift the
  parent/child/root fence before final parent release, whose guarded active count
  may move from one to zero only after that reference seal, terminal, and explicit
  parent-only-`E` completion;
- one 100-minor-unit charged receipt split across a 30-minor direct receipt-funded
  order portion, a 20-minor customer-wallet top-up, and a 50-minor stored-value
  asset persists one parent `D=100`, `Q=100`, `E=0` plus its lineage veto/target
  header and immutable `zero_E_no_finance` scope with `parent_only_E=0`. Bounded
  census/partition pages then seal exactly `Q_nonasset=30`, `q_asset_wallet=20`,
  and `q_asset_stored_value=50`; the bounded zero-finance reference census seals
  zero finance references and no zero-`q_asset` finance-only child. Only after
  partition seal do direct effects consume 30 and the two ordinary child cases
  reserve, census, plan, and apply only 20 and 50 respectively; neither can enter
  finance-pending/terminal state. A crash/replay during the zero-finance census
  resumes its cursor/checksum, while a divergent attempt to add a reference, make
  `parent_only_E` nonzero, or fabricate a zero child is rejected. Parent intake
  publishes one lineage veto, and no direct or child recovery/availability action
  occurs before the proofs; final release may move the root active count from one
  to zero only after the explicit zero-finance seal and both ordinary children are
  applied. Replay, concurrent intake, or a divergent child/partition cannot
  duplicate, omit, or reassign a receipt minor unit across direct or asset recovery;
- a provider chargeback whose charged receipt backs internal value atomically
  commits one authoritative parent evidence/reservation/collision result, target-
  `Q` partition header, and bounded receipt-lineage root-guard/veto/high-water;
  receipt
  acknowledgement needs no unbounded asset fan-out. Bounded census/partition/
  child-materialization pages later seal one direct-plus-asset partition and one
  durable child case or pending-veto state per affected asset. The parent alone
  persists `D=Q+E`; only sealed `Q_nonasset` reaches direct receipt effects and
  each sealed `q_asset` reaches its own child recovery. An `E>0` parent has one
  immutable `E_finance` replacement-backing/reconciliation scope and never makes
  `E` ordinary child recovery; an `E=0` parent instead has the explicit sealed
  zero-finance scope with no finance child references. The parent veto blocks every
  current/future descendant spend, split, restoration, merchant availability,
  settlement, reserve release, payout, and withdrawal until complete child and
  scope-specific finance release proof; a divergent replay cannot alter parent
  amounts, scope, root generation/count, high-water, a partition, child amount,
  evidence, reservation, fence, or veto;
- issuer revocation creates/reloads exactly one asset-level backing-loss case for
  its `(typed backing asset, loss identity)`; a divergent replay cannot alter its
  amount, evidence, reservation, or fence;
- a partial backing loss against an asset with both unspent value and huge
  consumed-slice fan-out writes bounded chained census pages through the frozen
  high-water mark, then bounded prefix-apportionment draft-plan pages in the
  documented order. No item applies before both census and plan seals verify
  count/total/cursors/checksums; sealed allocations sum exactly to the loss and
  do not exceed capacities;
- prefix-apportionment uses arbitrary-precision or checked integer intermediates
  near the maximum supported amount. Overflow or an unsupported bound returns
  `allocation_numeric_bounds_review_required` before any draft plan item or
  financial effect is persisted and preserves the fence for review;
- if an internal customer refund commits before the loss fence, its restored
  value appears only in the unspent candidate and never also in its former
  consumed-slice capacity; loss-first keeps the slice unavailable for the later
  refund rather than creating a second available balance;
- a huge fan-out backing-loss case remains fenced across crash/worker-lease expiry
  between census, draft-plan, plan-seal, and application phases. Phase cursors,
  chained checksums, stale high-water/source-version detection, and replay resume
  only the affected bounded page; no unsealed draft item applies, no phase takes
  an unbounded descendant lock set, and each sealed item/loss reservation/unspent/
  recovery ledger effect applies at most once;
- a crash or replay after provider-chargeback intake but before the first lineage
  census page reloads the same accepted evidence, parent lineage veto/high-water,
  and target partition header. No path exposes spendable/available/settleable or
  withdrawable descendant value, creates a second loss reservation, or needs
  another provider chargeback call before bounded census resumes;
- a spend/split/refund writer racing the first parent chargeback locks the same
  receipt-lineage root guard before its asset key: it either commits before guard
  activation/high-water snapshot and appears once in lineage census, or observes
  the nonzero active count and aborts/retries. A second chargeback racing that
  split serializes on the same guard, advances its generation, and increments the
  count without an unbounded parent-veto lookup; stale workers reload their parent
  page. Resolving the first parent decrements but does not release at count one;
  only the second complete parent release may transition count one to zero. Neither
  race can create an in-between descendant, make a sealed partition stale without
  a detected checksum/version conflict, or evade a child fence after materialization;
- a root with many simultaneous parent disputes proves a descendant writer needs
  only the root guard's O(1) generation/count, never an enumeration of active
  parent vetoes. Each parent-specific bounded worker can refresh its generation;
  every exact-once terminal parent decrement is non-negative and only the final
  active-parent-veto count transition can permit availability;
- parent intake, `complete_child_finance_resolution`, and a descendant split on
  the same receipt-lineage root are repeatedly interleaved at every lock point.
  After their lock-free discovery, intake takes receipt/source locks then root
  guard -> parent partition -> parent veto -> parent finance; finance completion
  takes root guard -> parent partition -> parent veto -> parent finance -> its one
  child; and the split takes root guard then its child (or the same parent classes
  before that child when it needs parent authority). The randomized regression
  proves no deadlock or cross-class byte-sort inversion, at most one finance
  terminal, and only either the pre-fence split captured by the frozen census or a
  post-fence retry with no descendant mutation;
- an `E_finance` parent with `D=200`, `Q=100`, `E=100`, one positive
  `q_asset=100` child, no positive finance reference, and `parent_only_E=100`
  seals that child as `ordinary_q_asset`. The child completes only its ordinary
  recovery to `applied`; it never enters finance-pending/terminal state, while the
  parent/root guard remains active solely for unresolved `parent_only_E`. Crash or
  replay during parent finance resolution reloads the same disposition terminal
  without changing the child's tag, and a late reference/tag attachment or
  divergent parent/share/disposition command is rejected. Only after the parent
  `parent_finance_disposition_resolved` terminal, the ordinary child predicate,
  and all other parent predicates may its active count move from one to zero;
- `E_finance` resolution has bounded high-fan-out pages containing both `q_asset=0`
  and positive `E`-linked children. The reference census visits every partition
  child once: each zero child receives exactly one zero-share reference; positive
  shares plus explicit parent-only `E` equal `E`; and its final checksum/count
  seal rejects a missing, duplicate, cross-parent, cross-asset, cross-currency, or
  divergent reference. A positive child omitted by that sealed set is ordinary and
  has no finance terminal; each referenced child then reaches exactly one
  `finance_no_recovery_resolved` result. Crash/retry reloads the same page/pair,
  and divergent disposition/child/asset/partition/share/currency/checksum replay
  is rejected. No local terminal result releases availability while another
  parent/root veto remains, and the final active-count transition to zero is
  impossible until the reference seal, every required terminal, and the
  parent-owned `E` condition all complete;
- a receipt lineage with millions of descendant backing assets accepts authoritative
  chargeback evidence through the bounded parent veto/source reservation transaction
  and returns the provider acknowledgement in `lineage_overflow_fenced` state. It
  globally fences every existing and later descendant without an unbounded lock or
  read; durable cursor/checksum batches resume, and overflow/error/review cannot
  release a subset before complete partition, durable child states, and parent `E`
  disposition proof;
- concurrent internal customer refund versus an asset-level backing loss, in both
  commit orders and while a plan batch is pending, converges on the same typed
  asset/fence/consumed-slice recovery state for (a) a customer wallet ledger
  credit from a non-order receiving-intent receipt, (b) merchant-issued credit,
  (c) platform-funded credit, and (d) stored-value issuance. Already-restored,
  unavailable-destination, backing-loss, and command/replay races create no
  duplicate restoration, reserve recovery, or negative-balance entry;
- receipt entry kinds require receipt origin/evidence/disposition while reversal
  entry kinds require unique reversal provenance and reject receipt origins,
  allocations, and paid-order effects;
- a legacy separate refund transaction migrates to reversal provenance without
  being treated as a second customer receipt;
- insufficient merchant balance creates one recoverable negative-balance
  liability instead of losing or duplicating the reversal;
- completed refund or chargeback changes net-retained/refund projections without
  reducing historical `amount_paid`, reopening collection, or making the order
  eligible for unpaid cleanup;
- wallet credit atomically replaces incompatible entitlement components with one
  equal customer-wallet liability and can never later credit the merchant;
- concurrent wallet credit versus redemption/refund and settlement/reversal
  versus payout/withdrawal follow the global advisory/row order, conserve both
  ledgers, and elect one compatible outcome without deadlock;
- a historical wallet/balance backfill cannot overlap canonical writers unless
  it owns the global maintenance fence, and an unfenced legacy writer is rejected;
- provider-external wallet remediation requires a recorded solvent funding
  obligation and cannot fabricate a Baci liability;
- a provider-external obligation remains durable and escalates until completion
  evidence is recorded, without being satisfied twice.

### DVA tests

- permanent account with one eligible invoice auto-confirms;
- two same-amount eligible invoices are ambiguous;
- an exact-balance invoice matches only its full outstanding balance, while an
  installment matches only one pre-issued tranche amount;
- after one installment, a `partially_paid` invoice can match its next unpaid
  collectible tranche while the completed tranche and historical allocation
  remain immutable;
- equal-amount future tranches are excluded until atomic activation, completion
  exposes exactly one next collectible tranche, and publication failure exposes
  none rather than two;
- schedule issuance rejects non-positive amounts, gaps/duplicate sequences,
  count or sum mismatch, currency mismatch, cyclic links, non-increasing dates,
  deadlines beyond collection expiry, or totals above the locked authorized
  installment balance;
- next-tranche activation revalidates remaining schedule/outstanding balance and
  refuses an already-overdue tranche into one resolution case;
- an early transfer matching a scheduled future tranche enters review unless
  immutable provider evidence satisfies the separately reviewed targeting
  contract;
- future-tranche successor edits on partially paid invoices cannot rewrite paid
  tranches or reduce outstanding below reserved/collected funds;
- a future-term edit with a capturable current tranche creates only a non-
  authoritative proposal; terminal completion atomically closes the predecessor,
  supersedes untouched future tranches, creates the immutable successor with the
  known boundary, conserves remaining value, and activates the proposal;
- immediate activation, delayed terminal activation, concurrent webhook/edit,
  cancellation, stale proposal, and crash/retry tests expose exactly one
  effective schedule and never mutate a successor's effective start time;
- concurrent proposal creation permits one live proposal; same-idempotency replay
  returns it, while an edit uses cancel-and-replace compare-and-set and activation
  links exactly one unique successor;
- current-tranche completion arbitrates proposal activation before publication:
  a valid proposal publishes only the successor first tranche, no proposal may
  publish only the predecessor next tranche, and a stale/business-invalid
  proposal records review while publishing neither; crash replay cannot publish
  both;
- underpayment, overpayment, and combined multi-tranche transfers enter review
  rather than causing an inferred installment split;
- bank mismatch, provider-customer mismatch, and pre-assignment payment fail
  closed;
- wallet-purpose and terminal-alias conflicts block automatic attribution;
- payment before the exclusive `due_at` boundary is eligible and payment exactly
  at `due_at` is overdue;
- payment after due date is preserved for review;
- due-date cutoff uses the captured merchant timezone and immutable UTC
  `due_at`, including midnight, timezone-change, and DST-boundary cases;
- due-date extension before payment changes eligibility only after inventory is
  atomically re-reserved or its still-live reservation expiry is extended;
- failed re-reservation leaves the old due date and inventory state unchanged;
- shortening an invoice atomically shortens its assignment and inventory
  reservation, with edit/matcher/cleanup concurrency tests;
- `new_due_at <= now()` is rejected and the separate audited expire-now action
  releases eligible inventory atomically;
- existing merchants use explicit UTC until they confirm another validated IANA
  business timezone;
- due-date edit after payment receipt cannot retroactively auto-match;
- a delayed webhook whose provider `paid_at` predates a due-date edit uses the
  prior epoch, while a payment after a valid extension uses the successor epoch;
- a payment made after the old cutoff but before an extension remains review-
  only even when its webhook arrives after the extension;
- concurrent due-date edit, expire-now, cleanup, and delayed webhook processing
  choose exactly one assignment epoch by half-open effective-time boundaries;
- provider timestamp uncertainty wholly inside one epoch may match, while an
  uncertainty interval crossing assignment, edit, or due boundaries enters
  review until stronger timestamp evidence resolves it;
- delayed wallet/receiving-intent evidence resolves against the immutable intent
  epoch active at provider paid time; current status, a successor epoch, or
  webhook arrival time cannot capture it, and boundary uncertainty enters review;
- concurrent receipts can consume a `single_receipt` epoch only once; reusable
  epochs reject per-receipt bound, count-cap, and cumulative-cap overflow under
  concurrency without leaving a transaction, origin, or counter orphan;
- direct counter mutation, missing/duplicate capacity claims, and migration
  backfill disagreement fail the deferred invariant and block intent activation;
- matcher predicates use interval lower/upper bounds, including exclusive
  effective and due boundaries, rather than scalar `paid_at` comparisons;
- late-payment manual resolution records fulfil, substitute, wallet-credit, or
  refund remediation after inventory revalidation;
- customer and merchant see the under-review state.

### Payment resolution tests

- financial payment status remains `unpaid` or `partially_paid` while verified
  money is under review;
- informational reviews do not block cleanup;
- time-bounded possible-capture reviews block cleanup only until
  `protection_expires_at`; the same locked query allows cleanup exactly at expiry
  even if the claim/review status projection has not yet been updated;
- verified captured-funds reviews remain protected until an authorized
  resolution;
- resolution updates dashboard, storefront, mobile, analytics, and notification
  projections without rewriting confirmed financial evidence.
- funding-breakdown projections show receipt-only collected, internally applied,
  total funded, retained, and reversed/restored amounts consistently; internal
  value never renders as a gateway receipt, and private source-ledger IDs never
  reach customer or merchant payloads.

### Side-effect and settlement tests

- idempotency-capable side effects reuse one persisted downstream key and have
  exactly-once effect under replay;
- a non-idempotent integration interrupted after `dispatch_started` enters
  `delivery_unknown` and is not automatically resent;
- failed retryable side effects retry without duplicating completed or delivery-
  unknown steps;
- refund and chargeback transitions seed one reversal-case-scoped claim per
  required notice, loyalty, fiscal, advertising, acknowledgement, and order-
  lifecycle handoff without deleting original paid claims; multi-provider legs
  reuse that same case scope rather than duplicating generic effects;
- reversal integrations reuse downstream idempotency keys or enter
  `delivery_unknown`, and unsupported inverse effects terminate explicitly;
- two confirmed transactions on one order each receive their transaction-scoped
  settlement while order-terminal email, loyalty, FIRS, and conversion run once;
- custodied captured-but-unallocated funds stay non-withdrawable in suspense;
- only an available `merchant_entitlement` component's `eligible -> credited`
  transition changes the merchant balance, once;
- internal funding seeds order-terminal effects but no transaction-scoped receipt
  acknowledgement/provider-settlement claim; merchant entitlement inherits its
  source backing/availability and credits at most once;
- capture without provider clearing evidence or before risk-hold expiry remains
  non-withdrawable even after order allocation;
- external-settled inventory failures record merchant refund obligations without
  fabricating a Baci balance;
- migration preserves completed legacy order-scoped and manual side-effect
  claims;
- platform-wallet settlement credits once;
- provider-external settlement records evidence without wallet credit;
- manual payment does not fabricate gateway settlement;
- manual payment requires authorized actor, CSRF, reason, proof type, and stable
  idempotency evidence;
- placing a COD order does not create confirmed money;
- ambiguous settlement ownership produces review and no balance mutation;
- every transaction-scoped settlement claim resolves policy through immutable
  receipt-origin provenance and, for order attempts, its attempt snapshot rather
  than latest-order attempt lookup; unattributed suspense has no withdrawable
  settlement policy.

### Migration tests

- schema replay from baseline succeeds;
- SDK evidence migration replay proves `protection_expires_at` is an ordinary
  guarded write-once `timestamptz`, not a generated column; direct updates fail,
  deferred expiry/link invariants fail closed, and UTC plus DST-transition session-
  timezone fixtures preserve exactly 48 elapsed hours. Schema tests require
  non-null provider/account/authority, attempt, and normalized session identity,
  and prove ordinary uniqueness cannot be bypassed with null sessions;
- Stage 0 replay is expand-only: current provider route/RPC behavior, grants,
  triggers, indexes, and enforced legacy constraints remain unchanged; lock and
  statement timeout injection aborts cleanly, concurrent index/deferred
  validation leaves traffic available, and dormant fences cannot block a writer.
  Route snapshots prove admin edits, Credit Direct SDK reporting, cleanup, and
  every signed-webhook status/body/acknowledgement path remain unchanged; dormant
  functions are unreachable by production roles;
- Stage 1 shadow/canary tests prove shadow comparison cannot affect responses or
  financial state; the shadow role cannot execute or write any canonical admin/
  SDK/webhook/cleanup/internal-ledger/payment path, and every observation ID fails canonical
  attempt/lease/reference/evidence foreign-key use. Canary creates one fresh
  canonical attempt and calls separately granted authoritative functions under its
  selected authority/cohort; retryable lock
  failure controls acknowledgement only there, rollback restores the prior routing
  generation, and unrelated provider routes remain isolated;
- the non-transactional DDL runner is manifest/idempotency keyed, resumes or
  removes only its own invalid concurrent index, respects deployment advisory
  lock and timeouts, writes readiness evidence, and prevents constraint/route
  activation when its receipt is absent or mismatched;
- generated Supabase types match new tables and RPCs;
- legacy Credit Direct notes and transactions map only when provable;
- per-authority legacy cutover proves pending-transaction initialization dual-
  write/backfill, attempt-based verify/status lookup, old-writer shutdown,
  drain/archive behavior, and rollback compatibility without creating confirmed
  money from an unproven status;
- archive drain proves source/archive checksum and count parity, retains every
  confirmed row, removes every archived non-confirmed row from active
  `transactions`, exposes legacy attempt projections only through the named read-
  only compatibility view, and reaches the zero-active-pending invariant;
- after drain, an unmodified legacy writer is rejected; only a reviewed rollback
  adapter that creates attempts and never reinserts pending `transactions` may
  resume authority;
- wallet and other non-order legacy rows map to receiving intents or typed
  unattributed origins without synthetic orders;
- `legacy_migration` receipt evidence can annotate only a manifest-listed
  already-confirmed inbound receipt and cannot annotate a reversal, promote a
  pending row, or authorize a new transaction;
- unresolved historical evidence remains review-only;
- completion-authority keys and routing generations guarantee exactly one
  completion authority;
- legacy gateway-reference uniqueness is replaced only after cross-account and
  unrelated specialized-index regression coverage passes;
- completed transactions cannot bypass funds suspense through the legacy
  merchant-balance trigger, `record_merchant_settlement*`, `merchant_wallets`,
  workers, manual writers, or provider hooks;
- shadow comparison proves legacy and canonical gross, fee, merchant-
  entitlement, clearing time, available balance, and upcoming balance parity
  before each writer is fenced;
- existing original-row refund mutation and separate-refund-transaction paths
  converge on one idempotent reversal authority before their cutover;
- rollback leaves confirmed rows intact;
- rollback handlers reuse or refuse frozen canonical identity contracts and
  generations/equivalence aliases, durable financial command records,
  confirmation evidence, receiving-intent capacity claims,
  provenance, disposition/components, schedule-change proposals/successors,
  availability claims, wallet liabilities, reversals, negative balances, and
  both payment/reversal side-effect identities;
- rollback during a parser-version rollout preserves first-seen bootstrap-lock
  parity and aliases; rollback during a pending schedule change leaves the
  predecessor authoritative and neither creates nor activates a successor;
- migration replay proves wallet/payout writer fencing and maintenance-fence
  exclusivity; rollback retains customer/merchant ledger identities, command
  exhaustion state, schedule proposal/successor identity, and contract-generation
  evidence without reactivating an unsafe writer or identity contract;
- lock-order tests cover provider-account authority epochs, financial-routing and
  origin resolutions, verified source proofs, confirmation evidence, quarantine
  adoption, and both webhook-child and SDK-first-report order-protection claims in
  every intersecting operation. Intake instrumentation proves no inbox, manifest,
  child-proof, SDK possible-capture evidence, or claim write occurs before the
  complete advisory set is acquired, revalidated, and all affected orders are
  row-locked. Receipt-path instrumentation proves immutable source facts are read
  without row locks for discovery and that existing canonical identity/transaction
  rows are locked before source proof/proposal rows;
  SDK tests prove its stable-source key uses the provider-reference family, order
  advisories are acquired first, no helper takes an undeclared source/session
  class, and provider switching/replay/cleanup intersections cannot invert locks;
  randomized concurrency produces zero deadlocks, duplicate resolutions, or
  order-cleanup wedges;
- forward and rollback handlers safely replay events from both sides of a flag
  change without double completion;
- stable cohort assignment, shadow parity, canary stop, soak widening, rollback,
  grandfather drain, and post-drain retirement tests prove sessions never change
  generation and unrelated providers remain on their original authorities;
- separate horizon fixtures prove 48-hour checkout protection does not retire
  identity lookup; an unknown first-disbursement/redelivery maximum blocks
  compatibility retirement, and late first-time merchant payment remains durable
  and operationally resolvable throughout financial-record retention;
- Credit Direct explicit SDK-success cleanup protection becomes 48 hours,
  non-qualifying popup evidence does not extend it, and inventory still expires
  under its two-hour unpaid reservation contract;
- Credit Direct remains protected immediately before 48 hours, becomes cleanup-
  eligible exactly at 48 hours even when the claim's status projection still says
  active, and a later verified capture cannot automatically
  reopen or fulfill the cancelled order but does enter the reviewed late-payment
  and inventory-remediation path. A cleanup command that begins before expiry,
  waits on the SDK installer/order lock until after expiry, and then wins proves
  its post-lock `clock_timestamp()` allows cancellation rather than using stale
  statement-start time;
- Credit Direct SDK first-report and cleanup races cover both sides of the 24-hour
  ordinary checkout boundary and the exact 48-hour possible-capture boundary.
  A valid installer that wins immediately before, exactly at, or immediately after
  ordinary 24-hour checkout expiry installs one typed claim on a still-unpaid,
  nonterminal order when no provider-switch/replacement successor has won; that
  checkout cutoff cannot by itself deny SDK admission. SDK-first-
  report-first vetoes cleanup; cleanup-first
  leaves the order terminal and writes one idempotent `late_sdk_success` evidence/
  review result without a claim, protection expiry, confirmation evidence,
  transaction, reopening, allocation, inventory, or fulfilment. Tests run
  immediately before, exactly at, and immediately after the SDK's own 48-hour
  expiry, including stale `inactive`, `active`, or unresolved status projections;
- each safely associated signed merchant-event child installs at most one indexed
  non-money order-protection claim; one bounded manifest may install several
  child-scoped claims after discovering and canonically locking the complete order
  set. A claim committed before the effective cutoff and visible at cleanup's
  final locked recheck vetoes cancellation even if routing/financial work is
  delayed, while unsafe child association installs no claim and routes to
  merchant reconciliation or global quarantine according to independently proved
  tenant/account scope; otherwise cleanup can commit and later ingress follows
  the late-money path, with repeated races proving that exact linearization rule
  rather than worker scheduling;
- claim installation and cleanup contend on the identical order advisory and row
  locks: qualifying installer-first vetoes cleanup; cleanup-first terminalizes the
  order and forces a waiting webhook child to signed late-money handling or a
  waiting SDK report to `late_sdk_success` only; no claim can commit in the final-
  recheck/cancellation gap, and one source can never protect two orders. Separate
  tests prove webhook claims remain non-expiring until typed terminal resolution
  while SDK claims use their protected result, authoritative link/closure, and
  half-open expiry predicate regardless of status lag or the webhook/checkout
  cutoff;
- direct SQL cannot create a protection closure with the wrong source child or SDK
  evidence, wrong order, merchant, provider, account or authority, a cross-tenant
  command/result, an orphan or incomplete branch, a forbidden foreign key, or a
  nonterminal/open/retryable disposition. Each of the four closure kinds succeeds
  only inside its guarded terminal function and in the same transaction as the
  matching terminal result. Fault and race tests prove command lease expiry or
  retry exhaustion alone leaves the claim active, terminal-result rollback leaves
  no closure, terminal-result commit installs exactly one closure, and concurrent
  cleanup observes either the still-active claim or the complete source-matched
  closure with no premature cancellation gap;
- a pre-cutoff webhook cannot return success with only an inbox row: delayed-
  worker and process-crash fixtures prove acknowledgement atomically observes the
  retained manifest, complete child set, and a committed claim or terminal late-
  ingress/no-safe-order decision with correct merchant/global review scope for
  every child. Multi-order manifests lock the complete order set canonically; any
  lock-budget exhaustion rolls back everything and returns retryable non-success
  without an acknowledged claim-pending gap;
- an over-cap collision root does not turn a valid signed event into volatile
  retry-only state: exact immutable reference binding permits only the guarded
  `collision_overflow_frozen` retained-source/webhook-claim outcome, fuzzy or ambiguous
  binding cannot claim an order, cleanup remains fenced, and post-recovery replay
  creates at most one ordinary financial command/result;
- typed protection fields, not JSON-only timestamps, drive cleanup and matching;
- the existing `update_admin_order` path cannot change commercial or matching
  fields in place after an attempt or assignment epoch is issued;
- reconciliation decisions, disposition-lot transitions, collection leases,
  contract/assignment epochs, and nonce consumption retain their constraints
  under migration replay;
- migration replay and direct SQL reject an internal allocation without its exact
  source debit/split and evidence, cross-source currency/tenant/epoch/backing
  lineage, duplicate consumption, receipt artifacts on an internal branch, or a
  source-liability reversal routed as an ordinary provider refund; reject a
  wholly internal reversal that carries a transaction/provider/receipt field, a
  chargeback with an internal source/restoration leg, and a recovery row keyed by
  an order allocation rather than its typed backing asset plus consumed source
  slice; reject a customer-refund case whose receipt legs lack per-leg provider
  obligations, whose source amounts do not equal the requested amount, or whose
  case effects are duplicated per leg; reject a backing-loss case without one
  typed asset/loss-identity reservation (or the explicit `q_asset=0` marker), or
  a provider chargeback parent whose immutable `D`/`Q`/`E` differ from evidence/
  reservation/collision, violate `D=Q+E`, lack its atomic receipt-lineage root-
  guard activation/generation/active-count plus veto/high-water/target-`Q` header,
  or acknowledge after a failed parent fence write. Reject a root guard whose key
  is not exactly the immutable root, whose generation regresses or fails to advance
  on an active-count transition, whose active count is negative, or whose idempotent
  parent activate/release transition is not paired with exactly one parent veto
  state change.
  Reject an intake, generic reversal/chargeback, bounded parent worker,
  `complete_child_finance_resolution`, or descendant writer that locks or derives
  a parent partition before its root guard, a parent veto before its partition,
  parent finance before its veto, or a child asset/loss-case/fence/recovery before
  every required parent class; reject a byte-sort across those classes rather than
  sorting only within each class.
  Reject a sealed parent partition that duplicates a reserved receipt minor unit
  or fails `Q_nonasset + sum(q_asset) = Q`, and reject direct effects or child
  recovery before that seal. Reject a provider-chargeback child/veto that lacks
  its parent/partition binding, copies parent `D`/`Q`/`E`, reserves other than its
  `q_asset`, has a divergent/reassigned partition portion, or becomes spendable
  before parent veto release proof. Reject every current/future descendant spend,
  split, restoration, merchant-availability, settlement, reserve-release, payout,
  or withdrawal that does not lock/revalidate the root guard before parent lookup
  or its asset lock, or that proceeds while its active count is nonzero. Reject a
  parent worker/page that uses a stale guard generation or releases its parent
  veto before the applicable immutable scope proof, every required child, every
  required referenced-child finance terminal, and (for `E_finance`) the parent
  finance-disposition terminal are durable. Reject a parent with a missing/null or
  `E`-inconsistent finance scope: `D=Q,E=0` requires only `zero_E_no_finance`
  with `parent_only_E=0`, while `E>0` requires only parent-owned `E_finance`.
  Reject a zero-finance scope with any finance reference/resolution, nonzero
  `parent_only_E`, zero-`q_asset` partition row or finance-only child/fence,
  finance-pending or finance-terminal child state, or an unsealed bounded zero-
  finance census proving zero references and only ordinary positive-`q_asset`
  child recovery. Reject an
  `E_finance` disposition that lacks immutable `parent_only_E`, fails
  `sum(positive child shares) + parent_only_E = E`, or lets `E`/a non-recovery
  share appear in a census candidate, plan/application item, recovery row,
  customer/merchant/internal component, or availability release. Reject an
  `E_finance` child-reference page/seal that does not enumerate every and only
  `q_asset=0` child once with exact zero share, duplicates any zero or positive
  child reference, crosses parent/root/partition/asset/currency, lacks its bounded
  cursor/checksum proof, seals with a missing/over-cap/divergent child, or admits a
  late reference/attachment after its seal. Reject an `ordinary_q_asset` child
  without positive `q_asset`, with a reference, or in finance-pending/terminal
  state; reject a `referenced_positive_finance` or `zero_finance_reference` tag
  without its exact sealed reference, or a tag transition after the seal.
  Reject an `E_finance` `q_asset=0` child with a plan/recovery item or an unfenced
  finance-pending state. Reject a child-finance-resolution result outside
  `E_finance`, or one lacking its unique `(parent_finance_disposition_id,
  child_case_id)` identity, root-then-partition-then-veto-then-parent-finance-
  then-child lock/revalidation, sealed enumeration/reference, exact
  parent/partition/asset/currency/share proof, or its named
  `finance_no_recovery_resolved` terminal; reject a divergent replay, an
  `E`-linked positive child before its `q_asset` application checksum, or any
  local finance terminal that releases availability while the root count is
  nonzero. Reject a `parent_finance_disposition_resolved` terminal that changes
  `parent_only_E`, attaches/mutates an unreferenced child, or is absent while an
  `E_finance` parent/root release is attempted. Reject an overflow/error/review parent state
  that releases its lineage veto, loses cursor/checksum/high-water evidence, or
  demands an unbounded asset lock/read. Reject a spend, split, restoration,
  merchant-availability, settlement, reserve-release, payout, or withdrawal with
  an active veto/fence, an unfenced descendant, an over-capacity or nonconserving
  plan, or an applied state before sealed census, sealed plan, and every bounded
  application item/checksum is complete; reject a
  reversal source reservation that ignores an active/ambiguous/completed consuming
  reservation, and a chargeback collision with missing provider evidence, wrong
  `reserved + excess = disputed` conservation, or customer/merchant/internal
  economic effects on its excess liability;
- quiz-voucher orders retain their existing checkout-idempotency opt-out.

## Acceptance Criteria

The design is implemented only when all of the following are proven:

1. Retrying or switching payment provider on an unchanged participating
   non-voucher checkout does not create another order within 24 hours, while
   quiz-voucher award claims retain their stricter one-time contract.
2. A new checkout key creates an intentional repeat purchase only when no active
   protection or shared collision veto exists, or when one valid single-use
   separate-purchase nonce explicitly authorizes that second order; ordinary key
   rotation can never bypass the collision contract.
3. Every migrated order collection records attempts separately from confirmed
   money; non-order collection uses receiving intents or unattributed receipt
   origins without synthetic orders.
4. Every migrated confirmed receipt has a unique transaction, and every
   successfully attributed order payment has an exact allocation; no transaction
   is allocated beyond its confirmed gross customer-paid amount.
5. Mixed-tender orders compute historical `amount_paid` from authoritative
   successful receipt plus internal-funding allocations while receipt-only
   collected, net-retained, and refunded amounts remain separate. Raw legacy
   wallet/savings evidence is never a completion input: migration materializes
   the canonical evidence/allocation/source-debit graph or leaves the order in
   review.
6. Migrated paid orders always have `paid_at`.
7. Webhook replay cannot duplicate transactions, allocations, inventory,
   loyalty, FIRS, or settlement. Idempotency-capable notifications reuse one
   downstream key; non-idempotent dispatch uncertainty blocks automatic resend.
8. Credit Direct no longer relies on order-note flags as its durable completion
   or notification boundary.
9. Merchants can set invoice terms from 1 to 30 days with a 7-day default and
   an audit trail.
10. Permanent Paystack DVA payments uniquely matching an eligible invoice by
    due date automatically confirm it.
11. Multiple, overdue, unmatched, terminal-conflict, or wallet-conflict DVA
    payments never auto-confirm and are visible to merchant and customer.
12. No provider can double-credit the merchant wallet during or after cutover,
    and only conserved merchant-net entitlement—not customer gross—can become
    withdrawable.
13. Each completion authority can be rolled back independently without deleting
    financial evidence or activating two writers for the same classified event.
14. Captured money that cannot be allocated because inventory is unavailable
    remains durable review evidence and never leaves the order falsely paid.
15. Invoice extension after inventory release cannot succeed unless inventory
    is atomically re-reserved.
16. Paystack card and each DVA purpose remain mutually exclusive routing
    authorities throughout staged rollout.
17. An eligible Credit Direct `protected` SDK first report receives an expiry
    exactly 48 elapsed hours after its database receipt time and vetoes cleanup
    only until the earlier of an authoritative typed closure or that expiry,
    without extending the two-hour unpaid serialized-inventory reservation.
    Cleanup-first `late_sdk_success` receives no claim or protection window.
18. Attempt transitions, provider-account reference namespaces, integer-minor-
    unit comparisons, and manual actor authority are database-enforced.
19. Authenticated manual and service-role provider wrappers share private
    allocation invariants without widening user-facing service-role access.
20. Every successfully acknowledged webhook atomically contains a processable
    versioned envelope, authority key, ingress-contract generation, independently
    replay-keyed durable manifest, its complete child-proof set and conservation
    facts, and one terminal intake-protection decision per child. Financial routing
    generation exists only on a child after its atomic routing election.
21. One receipt-transaction-scoped side-effect identity exists per confirmed
    `customer_receipt` and step while one order-terminal identity exists per
    fully paid order and step; reversals use one separate reversal-case-scoped
    identity per effect kind, regardless of their provider-leg count, and can
    never seed receipt settlement/payment effects. Claim leases may retry, but
    external delivery follows the integration's explicit idempotent or
    fail-uncertain contract.
22. Financial payment status remains distinct from the derived payment-review
    state across dashboard, storefront, mobile, cleanup, and analytics.
23. Invoice edits extend, reclaim, shorten, or release inventory atomically and
    use a validated, assignment-captured merchant timezone.
24. A protected Credit Direct checkout cannot silently create a second order
    between hours 24 and 48; a separate purchase requires a single-use explicit
    customer-intent nonce.
25. Automatic partial allocations are impossible without an approved collection
    contract, and stock-backed partial collection commits its inventory hold
    atomically through the collection deadline.
26. Custodied captured-but-unallocated funds remain non-withdrawable in suspense
    until allocation, refund, wallet credit, or another authorized disposition.
27. Replay and confirmed-money identities include completion authority and
    provider-account namespace, preventing cross-merchant deduplication.
28. Due-date edits reject past cutoffs; immediate expiry uses a separate audited
    action.
29. Typed protection fields drive cleanup, and legacy gateway-reference indexes
    plus every merchant-value writer are safely routed or fenced before
    activation.
30. Custodied partial funds default to settlement suspense until full payment;
    installment-by-installment release requires pre-disclosed reviewed terms and
    deterministic expiry remediation.
31. Focused regression suites, migration replay tests, lint, typecheck, and the
    required payment test suite pass before each completion-authority activation.
32. No financial or provider-matching order field can change in place after an
    attempt or DVA assignment is issued; revision creates one immutable linked
    replacement order or enters reconciliation after verified money.
33. Due-date edits and explicit expiry create immutable effective-time assignment
    epochs, and delayed events are evaluated under the epoch active at verified
    provider `paid_at`.
34. Every financial reconciliation outcome is versioned, idempotent, actor-
    authorized, amount-conserving, and mutually exclusive with competing
    outcomes for the same review.
35. Customer-disposition lots conserve each `customer_receipt` transaction's
    confirmed gross while economic components conserve each lot by beneficiary;
    only merchant-
    entitlement components may be credited, reversed, suspended, or held for
    provider availability without a contradictory transaction-wide state.
36. An expired partial-collection contract or attempt is never mutated or
    revived; an approved extension creates a successor epoch, new attempt, and
    atomic inventory result while preserving earlier evidence.
37. An order exposes at most one customer-actionable collection attempt across
    providers, and switching is blocked while the prior attempt has unresolved
    possible-capture authority.
38. A separate-purchase nonce is hash-stored, short-lived, atomically consumed,
    and bound to merchant, protected order, collision domain, verified subject,
    frozen version-independent commercial identity, issuance generation/hash for
    audit, and one distinct resulting order. It cannot alter the predecessor.
39. Every new confirmed customer receipt has exactly one immutable accepted
    origin resolution, receipt origin, and authorizing evidence link, plus zero
    or more corroborating links. Order-attempt origins have one attempt link;
    receiving-intent and unattributed origins have none. One attempt may
    originate multiple receipts only where its reviewed rail contract permits it.
40. Refunds and chargebacks retain original allocations, conserve gross and
    economic components, reverse prior merchant entitlement exactly once, and
    create a recoverable negative-balance liability when required. A customer
    refund supports one to many receipt transaction/provider-obligation legs
    whose amounts conserve the case total, while a chargeback binds exactly one
    original receipt-funded source with zero internal restoration; a wholly
    internal refund has only its immutable internal-funding-plan source and no
    fabricated receipt/refund transaction. A partial provider failure preserves
    completed legs and retry/replay may execute only unfinished legs, without
    duplicating a provider call or a case-level generic effect. Source-global
    reservations subtract all active, ambiguous, completed, and other consuming
    cases, so concurrent reversals cannot over-reserve. A later authoritative
    chargeback with no remaining source still records provider evidence and routes
    only its excess to typed provider-dispute reconciliation liability.
41. Settlement requires both commercial entitlement and provider funds-
    availability evidence or an approved risk-hold expiry; capture alone is not
    universally withdrawable evidence.
42. Replacement-order revision cannot publish a second collection authority
    while the original order has unresolved possible-capture authority.
43. Permanent-DVA installments auto-match only the one active, pre-issued,
    immutable collectible tranche; scheduled equal-amount future tranches are
    excluded, while ambiguous, early-untargeted, or combined transfers enter
    review.
44. Provider paid-time precision and clock uncertainty are retained, and an
    uncertainty interval crossing an assignment or due-date boundary never
    auto-confirms.
45. Every new confirmed customer receipt is authorized by one source-appropriate,
    verified confirmation-evidence row; webhook, provider verification, manual,
    and reconciliation receipt paths converge without accepting client success
    state as evidence. Internal-ledger funding uses its separate source evidence
    and cannot mint or authorize a customer receipt. Reversal entries instead
    require their typed reversal provenance.
46. Refunds and chargebacks never move historically paid orders back into unpaid
    collection or cleanup eligibility; collection, retained, refunded, and
    disputed projections remain distinct across every consumer.
47. A wallet-credit resolution atomically replaces incompatible economic
    entitlement with an equal customer-wallet liability and cannot later settle
    the same amount to the merchant.
48. Partially paid DVA invoices can automatically match only their one active
    collectible tranche, while completed tranches remain immutable and future-
    tranche edits use reviewed successor epochs.
49. The DVA matcher applies paid-time uncertainty lower and upper bounds in every
    assignment, effective-epoch, and exclusive-due-date predicate.
50. Every accepted refund or chargeback seeds one durable reversal-case-scoped
    effect per required kind without deleting original payment effects; provider
    legs cannot duplicate those effects, and unsupported or uncertain external
    inverses are explicit terminal/operational states.
51. Completion-authority rollback accounts for every new evidence, provenance,
    disposition, component, availability, reversal, liability, and side-effect
    authority, or fails closed into review.
52. Each completion authority stops creating pending financial transactions only
    after provable attempt backfill and shadow parity, moves verify/status and
    webhook lookup to attempt or receiving-intent identity, drains legacy rows
    without inventing money, and has a tested rollback boundary.
53. Unattributed confirmed money begins as conserved, non-withdrawable suspense
    principal and can become entitlement, wallet liability, or refund only through
    an authorized balanced reclassification; candidate matching alone cannot
    create merchant value.
54. Installment completion atomically closes the current tranche and exposes at
    most one next collectible tranche under the order lease; activation failure
    exposes none and is durably retryable.
55. Stable provider reference, event, or child-capture identity is independent of
    amount, currency, paid time, and status; conflicting facts converge on one
    receipt identity and review rather than creating duplicate money.
56. Database entry-kind constraints make customer-receipt provenance and reversal
    provenance mutually exclusive; separate refund/chargeback rows cannot acquire
    receipt allocations or paid-order authority.
57. Every drained non-confirmed legacy transaction has a checksum-verified private
    archive record, no confirmed row is moved, and the active `transactions`
    relation reaches a physically enforced zero-pending confirmed-only state.
58. An issued installment schedule conserves its authorized total, sequence,
    currency, links, and deadlines in the database; next-tranche activation
    revalidates remaining balance and cannot publish an overdue tranche.
59. Reconciliation locks only the selected order, but every collection-authority
    and money-changing function—including intent succession, replacement/switch,
    customer-wallet movement, settlement, payout/withdrawal, liability recovery,
    DVA edit/expiry, maintenance, and cleanup—obeys one global advisory and row-
    lock hierarchy containing order, intent/capacity, provider-reference binding,
    customer-wallet, canonical-identity/alias, ledger, inventory, merchant-
    wallet/balance, and durable-claim classes.
60. Receiving-intent attribution uses the immutable intent epoch containing the
    complete verified paid-time uncertainty interval; current state, webhook
    arrival time, or a successor epoch cannot retroactively claim the receipt.
61. Receiving-intent epochs database-enforce single-use or reusable per-receipt,
    receipt-count, and cumulative-amount limits; concurrent receipt identity,
    origin, transaction, and capacity consumption commit atomically.
62. Adapter identity-schema upgrades use one frozen, version-independent
    canonical locator and bootstrap lock even for an empty registry; install the
    complete scoped old/new alias bundle before transaction creation, retain it
    on rollback, and route any locator/alias disagreement to review without re-
    keying money.
63. Concurrent verified sources atomically elect one authorizing evidence and
    accepted origin resolution for the canonical receipt identity; equivalent
    losers corroborate, conflicts enter review, and no orphan accepted resolution
    can exist.
64. A future installment edit creates only a non-authoritative change proposal
    while a current tranche is capturable; immediate or terminal activation
    atomically closes the predecessor, supersedes untouched future tranches, and
    creates an immutable successor at the now-known boundary without overlap.
65. Customer-receipt amount, provenance, lots, allocations, and receipt effects
    are database-mutually-exclusive with reversal amount, provenance, and
    reversal-scoped effects.
66. Every financial function acquires and revalidates its complete sorted
    advisory identity set before row locks. Set drift aborts the entire database
    transaction through a typed signal; a fresh bounded retry reuses the same
    idempotency key, and exhaustion cannot preserve partial writes or create a
    second outcome.
67. Every completion-authority rollback matrix includes canonical identity
    contracts/aliases, intent-capacity claims, schedule-change proposals and
    successors, and safely reuses or refuses them while retaining all immutable
    evidence.
68. Cutover observability measures and gates first-seen identity disagreement,
    alias collisions, lock-set abort/deadlock/exhaustion, receiving-capacity
    drift, and pending/failed schedule activation with explicit zero-tolerance or
    reviewed escalation SLOs.
69. One predecessor schedule/collection epoch has at most one live immutable
    proposal and one proposal has at most one successor. Current-tranche terminal
    arbitration publishes exactly one of the successor first tranche or ordinary
    predecessor next tranche; a stale proposal publishes neither and requires
    explicit review resolution.
70. Customer-wallet credit/refund/redemption/savings and merchant settlement,
    reserve, payout, withdrawal, reversal, and maintenance writers all use the
    global lock hierarchy or are fenced; concurrency conserves value and a
    table-lock backfill cannot overlap canonical traffic.
71. Every webhook child, verification, manual, internal-ledger, reconciliation,
    and quarantine-adoption financial command has one durable execution row
    created before its financial transaction. Claims, retries, lease expiry,
    typed errors, source-specific required/forbidden result IDs, and exhaustion
    survive process/database failure,
    and exhaustion becomes durable review rather than an in-memory terminal state.
72. Canonical identity contracts evolve through immutable shadow/active/draining/
    retired generations with one active generation per scope. Rolling overlap
    requires the same family lock and installed equivalence aliases; incompatible
    generations require fenced drain and disjoint-space proof, while unsafe
    rollback or delayed ambiguity fails closed without re-keying old money.
73. Every provider session is immutably pinned to its initialization authority
    and routing generation. Pre-cutover Credit Direct sessions preserve active,
    superseded, and recoverable-popup matching through the full grandfather and
    provider-redelivery horizon; delayed verified money is durably reconciled,
    never acknowledged and discarded because of deployment age.
74. Credit Direct customer-payment completion is non-money approval/inventory
    evidence only. Merchant-payment completion alone may authorize the canonical
    receipt, allocation, paid projection, and proved external-settlement record;
    both event orders and replays converge without regression or duplicate money.
75. Shared foundation migrations are expand-only and behavior-neutral: no live
    provider route, URL/secret, RPC grant, legacy trigger/index/constraint, or
    writer fence changes before that authority's cutover. Non-blocking DDL,
    deferred validation, bounded locks, and clean abort receipts are proven in
    migration replay and production preflight.
76. Every authority advances legacy -> shadow -> allowlisted canary -> active
    only after declared sample, parity, soak, exact-reference, and latency gates.
    A stop condition disables new canonical sessions without rerouting in-flight
    ones, and one provider's rollout cannot alter another provider's authority.
77. Every successfully acknowledged verified webhook, durable source manifest,
    complete child set, and child protection-decision set commit atomically under
    an immutable ingress-contract generation even when tenant or financial routing
    is missing or ambiguous. Ordinary bounded shared-lock failure for any child
    rolls back the whole intake and requests provider retry. An already-frozen
    over-cap root may instead use only the exact-reference overflow webhook mode,
    retained child, and non-money claim from criterion 110. Quarantined children remain
    evidence; every authorized money-bearing child must resolve to exactly one
    account-scoped order-attempt, receiving-intent-epoch, or unattributed-provider-
    account route and pinned generation before a processor is selected. Only an
    order child requires an attempt binding; the parent has no financial result.
78. Credit Direct SDK success and the signed provider customer event are distinct
    typed signals. SDK evidence provides bounded cleanup protection only and
    cannot transition the attempt or reserve inventory. The signed customer event
    may create only the bounded serialized-inventory reservation; it cannot
    confirm money, inventory, or fulfilment. Expiry releases once, merchant
    completion converts atomically, and unavailable inventory leaves confirmed
    money in suspense with one remediation case.
79. Rollout authority is database-owned. Guarded expected-version transitions,
    immutable receipts, actor/approval, cohort/threshold checksums, stop state,
    and issuance enforcement prevent stale flags or concurrent operators from
    widening authority. Completion validates the attempt's historically valid,
    compatible pinned generation rather than equality with the current issuance
    generation, so stop, rollback, or later widening cannot strand in-flight
    payments.
80. Checkout protection, inventory reservation, session actionability, first
    business completion, redelivery, automatic processing, rollback, and
    retention have separate evidenced horizons. An unknown provider completion
    or redelivery bound blocks compatibility retirement, never late-money
    recording or durable resolution.
81. Non-transactional DDL uses one reviewed manifest-keyed, least-privilege,
    resumable runner with deployment locking, timeouts, invalid-index recovery,
    definition/readiness verification, and durable receipts. Transactional
    migrations and route activation cannot assume or bypass its completion.
82. Credit Direct cleanup, signed merchant-payment ingress, and SDK first-report
    use one order-lock linearization rule at the ordinary and protected cutoffs.
    After every advisory and row lock is held and no blocking acquisition remains,
    cleanup captures one `clock_timestamp()` and immediately performs its final
    READ COMMITTED claim query while holding the order lock; that captured instant
    is the decision linearization point even if commit follows. A qualifying signed-money claim remains a
    veto until typed terminal resolution; an SDK claim vetoes only while
    `cleanup_now < expires_at`, where expiry is exactly its evidence receipt time
    plus 48 hours. At or after expiry it cannot veto even if status still says
    active. Cleanup never depends on inbox JSON or nullable attempt fields.
83. Rollout locking is an authority-issuance-only control-plane precursor for
    attempts, receiving-intent epochs, and provider-account authority epochs,
    acquired before every financial advisory lock. Rollout transitions never
    acquire order, intent, or provider-reference locks, no financial-lock holder
    may acquire the rollout row, and ordinary completion does not participate in
    that control-plane dependency.
84. Each receiving-intent epoch and unattributed provider-account authority epoch
    immutably pins completion authority, routing generation, processor contract,
    and timing policy. Delayed permanent-DVA money uses the epoch effective for
    verified paid time through successor activation, stop, and rollback; it is
    never routed by today's generation, and temporal ambiguity enters review.
85. Unscoped ingress has a complete platform-owned quarantine lifecycle with
    privacy-scoped access, immutable proposals, actor/reason, expected-version
    atomic adoption, conflict behavior, ownership/SLO escalation, and no pruning
    before terminal resolution. Adoption attaches only merchant/account scope
    and a non-authoritative routing proposal; a durable idempotent command hands
    it to the canonical receipt transaction. It cannot create a merchant-scoped
    review until safe tenant resolution succeeds.
86. The Credit Direct SDK first-report function and private
    `payment_sdk_possible_capture_evidence` source are write-once and idempotent. It
    uses non-null provider/account/authority plus attempt and a normalized non-null
    provider session as stable source identity,
    verifies frozen order/request/amount/currency and authorization facts, and
    maps its SDK key into the provider-reference advisory family and resolves its
    commercial identity through the active collision-component root. It discovers
    the complete bounded matching order/member-domain set, transitive active
    legacy/current subject/commercial alias closure, root/generation, and full
    provider-reference set without locks; acquires orders first, then every sorted
    subject/component/root/member/alias/domain key and provider-
    reference key; revalidates every set; and acquires
    cleanup's order row lock.
    Exact lookup precedes generic
    consumed-grant rejection, so same- or replacement-grant replay returns the
    original row with an immutable authorization/corroboration record and without
    extension, while authenticated customers need no grant. One tracking grant
    cannot corroborate two evidence rows; authenticated session reuse is scoped by
    the stable attempt/session source.
    For an eligible unpaid nonterminal order—even after ordinary 24-hour checkout
    reuse expiry—it records the first server time once, writes the ordinary guarded
    `protection_expires_at` column as exactly 48 elapsed hours later, returns those
    original values for duplicates, and commits a `protected`
    evidence row plus one typed SDK protection claim. If a provider-switch or
    replacement successor wins the collision transition first after matching
    immutable provider revocation or contract-expiry evidence, it records one
    `cross_order_collision_review` result tied to both orders with no claim or
    second lease. If cleanup wins first, it
    commits one immutable `late_sdk_success` evidence/review result and cannot
    install a claim, set or extend a protection expiry, create confirmation
    evidence or a transaction, reopen, allocate, mutate inventory, or fulfil.
87. Ingress-generation rollover enforces one active generation per provider
    endpoint/key/authority through compare-and-set transitions and immutable
    receipts. Old/new parsers share a generation-independent replay key, converge
    on one inbox row without uniqueness 5xx, quarantine normalized-envelope
    disagreements, and cannot retire until drain, equivalence, and rollback gates
    pass. Lifecycle is forward-only: rollback drains the current active row and
    activates a new staged generation carrying reviewed earlier-compatible
    contracts in one two-sided operation receipt; it never reactivates a draining/
    retired row, clears a lifecycle timestamp, or rewrites a predecessor.
88. Order-protection claims are indexed database-enforced tagged unions. A
    `webhook_child` claim requires a retained manifest and unique child proof and
    forbids SDK provenance; an `sdk_first_report` claim requires SDK evidence,
    attempt and normalized non-null provider session, with authorization provenance frozen on SDK
    evidence, and forbids webhook
    provenance. SDK claims require a `protected` SDK-evidence result and a non-null
    ordinary write-once expiry exactly 48 elapsed hours after its database receipt
    time; webhook-money claims require null expiry. Append-only typed closure rows,
    not mutable status, are terminal authority. Their four source-specific kinds
    database-enforce required and forbidden terminal-result foreign keys and exact
    source/order/tenant/provider-authority equality; only a guarded terminal
    function may insert one atomically with its result, and command exhaustion
    alone never closes a claim. Claims own unique evidence foreign
    keys, reviews own unique review-only evidence foreign keys, and evidence owns no
    backlink; deferred constraints reject missing, duplicate, cross-result, or
    orphan links. Partial unique constraints
    permit each immutable source to protect at most one order. A bounded manifest may protect several orders only
    through distinct children after the complete order set is locked canonically.
    Claims may veto cleanup but can never select a processor, create money,
    allocate, mutate inventory, mark paid, or authorize fulfilment; unsafe
    association creates no claim and uses merchant reconciliation when one tenant/
    account is proved, or global quarantine only when that scope is unresolved,
    conflicting, or cross-tenant/account.
89. A financial-routing proposal is non-authoritative and exists before receipt
    matching. The receipt path reads immutable source facts without row locks to
    derive and acquire the full advisory set, then locks existing canonical
    identity/transaction rows before source proof/proposal rows. Under that
    canonical identity lock, one transaction creates/reuses
    typed evidence and atomically accepts the financial-routing resolution,
    authorizing evidence, receipt-origin resolution, origin, transaction, and
    links. Concurrent equivalent proposals corroborate one winner; target,
    authority, generation, or economic conflicts enter review and cannot create
    a partial graph, second transaction, or mismatched-policy route.
90. Webhook-child and SDK-first-report claim installation serialize with cleanup
    on the identical order advisory and row locks through commit. A qualifying
    installer-first claim is visible to cleanup. Cleanup-first sends signed
    merchant ingress to confirmed late-money review but sends an SDK report only
    to idempotent `late_sdk_success`, with no confirmation evidence or transaction.
    No claim can commit in the final-recheck/cancellation gap. SDK qualification
    uses protected result, authoritative evidence/claim/closure links, and
    `cleanup_now < protection_expires_at`, never audit status or webhook/24-hour
    cutoff; an expired SDK claim cannot veto, and one immutable source can protect
    at most one order.
91. The global advisory-discovery and row-lock hierarchy requires every operation
    to discover without writes or row locks and acquire/revalidate the complete
    sorted advisory set. Signed acknowledgement, which does not touch canonical
    money rows, locks orders canonically and then writes verified inbox/manifest/
    proof rows and claims. The SDK stable-source key is a provider-reference-family
    key, never a separate source/session class; SDK first-report acquires the
    complete matching order set, every sorted checkout-collision bootstrap alias
    and canonical domain advisory, then sorted provider-reference advisories,
    revalidates all sets, and follows
    order row, attempt/session/authorization,
    SDK possible-capture evidence, then claim. Receipt/replay follows criterion
    101 and locks existing canonical/transaction rows before source rows.
    Provider-account authority epochs obey their declared position. Every
    intersecting operation and retry follows it with zero deadlocks, duplicate elections, or
    cleanup wedges.
92. Attempt, receiving-intent-epoch, and provider-account-authority-epoch issuance
    share one rollout-row-first expected-version protocol. Provider-account
    epochs have immutable transition receipts, a unique successor chain, and
    non-overlapping effective intervals; gaps disable automatic routing, while
    stop and rollback preserve historical compatibility.
93. Every transaction-scoped settlement/acknowledgement effect resolves policy
    through immutable receipt-origin provenance. Only an order-attempt origin
    consults attempt provenance; receiving-intent origins use their epoch, and
    unattributed money remains gross suspense with no merchant entitlement.
94. Unscoped tenant/account adoption is automatic only from deterministic
    independent provider evidence. Any operator-selected cross-tenant mapping
    requires distinct authorized maker/checker approval and can create only an
    unattributed-provider-account proposal. The follow-on canonical receipt
    transaction may record gross suspense, with no merchant order/customer
    visibility, allocation, entitlement, inventory action, or fulfilment. Those
    effects require a separate fresh-authority reconciliation decision, and a
    later correction uses conserved entries plus immutable incident evidence
    rather than rewriting ingress, routing, or financial history.
95. A signed webhook has no acknowledged asynchronous protection gap: inbox,
    durable manifest, complete child set, and every child claim or terminal late-
    ingress/no-safe-order decision commit together under the canonically ordered
    cleanup locks before success. Bounded lock failure rolls back the entire
    intake and returns retryable non-success; no `claim_pending` child can be
    acknowledged. Candidate manifest parsing and complete order discovery occur
    before writes or row locks; source rows are persisted only after full advisory
    acquisition/revalidation and canonical order locking. The sole over-cap
    exception is criterion 110's already-frozen, exact-reference selected-order/
    root/anchor lock path; it persists a non-money claim and cannot process finance
    or authority before recovery.
96. Fault injection before and after evidence creation, routing acceptance,
    origin election, transaction insertion, and evidence linking proves that the
    receipt transaction exposes either the complete accepted graph or none of it.
97. Cross-tenant suspense adoption and later allocation have distinct immutable
    decisions, expected versions, idempotency keys, evidence snapshots, and
    authority checks; replay or approval of either decision cannot implicitly
    perform the other.
98. Quarantine adoption cannot create or attach an accepted routing resolution.
    Adoption-to-receipt crash, lease-expiry, and replay tests converge through one
    explicit `quarantine_adoption` command per immutable child on either one
    complete accepted child receipt graph or durable review, with no parent command
    shared across children, orphan routing resolution, or duplicate financial command.
99. Webhook evidence cardinality is contract-enforced: singleton manifests have
    one deterministic child, bounded-multi-capture manifests have one immutable
    child set with unique `(source_manifest_id, child_identity)` proofs and
    conserved limits. Each child has exactly one proposal; each authorized child
    has exactly one command; and each completed child has exactly one evidence,
    canonical identity, and transaction graph. Parser/replay disagreement cannot
    add, remove, re-key, share authority between children, or duplicate money.
100. `no_safe_order_claim` records an independently derived review scope. Proved
    same-merchant/account order ambiguity is merchant-scoped and privacy-minimized;
    only unresolved, conflicting, or cross-tenant/account scope is platform-global.
101. Receipt, replay, and quarantine-adoption transactions first read immutable
    source facts without row locks to derive the complete resource set, acquire
    and revalidate all advisories, and take any order/intent rows. They then lock
    existing canonical identity and transaction rows before verified inbox,
    source manifest/proof, SDK possible-capture evidence and authorization rows,
    protection claim and typed closure row,
    financial-routing proposal, confirmation evidence, and accepted resolution,
    following the remaining global order. A missing canonical/transaction row is
    inserted only under the already-held family advisory and scoped unique
    constraints, never used to justify a source-first existing-row lock. Existing-
    evidence, new-evidence, duplicate-adoption, and concurrent-worker fixtures
    produce zero lock inversion or deadlock.
102. Whole-manifest quarantine adoption succeeds only when every child independently
    proves the same tenant and provider-account scope. Mixed, missing, or conflicting
    child scope creates no command and enters durable conflict review; a parent is
    terminal only when every frozen child is completed or durably reviewed.
103. Successful inbox pruning requires a verified durable source-manifest
    projection, terminal existing child commands, and a durable reviewed
    disposition for every commandless child. Deletion nulls only the optional
    operational inbox link and preserves the manifest, every child proof and
    command, evidence, accepted receipt graph, cardinality/conservation proof, and
    audit trail for the approved financial-record retention horizon without
    cascade or orphaning. For fallback identities, the first acknowledgement's
    operational locator and ingress-scope snapshot—including unresolved
    sentinels—are immutable; adoption or later enrichment never re-keys them. A
    later identical delivery looks up that frozen locator before applying current
    scope, reloads the retained manifest, and cannot create a second manifest,
    command, identity, or transaction.
104. Post-24-hour checkout rotation and SDK first-report serialize on one persisted
    active collision-component root after locking the complete bounded member-
    domain, matching-order, subject-component, and alias sets.
    SDK-first preserves the predecessor and blocks or reuses rotation. Rotation-
    first publishes a successor only after immutable provider revocation or
    contract-proved session-expiry evidence makes the predecessor externally non-
    capturable; otherwise it retains the predecessor veto, creates no successor,
    and opens typed review. A valid consumed separate-purchase nonce may authorize
    one distinct intentional result order but cannot rotate, supersede, replace,
    or make the predecessor noncapturable. Both race directions
    immediately before, at, and after hour 24 produce no unapproved pair of
    actionable or externally capturable collection authorities.
105. Every protection closure is one of the four declared source-specific terminal
    kinds with database-enforced required/forbidden references and exact claim/
    source/order/merchant/provider/account/authority equality. It is inserted only
    by the guarded terminal function in the same transaction as its completed
    terminal result. Wrong-source, wrong-order, cross-tenant, orphan, incomplete,
    nonterminal, direct-SQL, rollback, and cleanup-race fixtures fail closed;
    command exhaustion without an authorized reviewed disposition is not closure.
106. Collision-domain identity survives request-hash generation rollout/rollback,
    tracking/OTP proof replacement, and guest-to-authenticated binding through
    append-only database-proved aliases, but subject equivalence alone never
    creates/merges a domain or touches unrelated purchases. Commercial projection
    requires one frozen intent and a bounded lock set. A conflict freezes every
    member; confirmed merge creates one monotonic successor root, while rejected
    bridge preserves separate roots and conditionally unfreezes them. Every
    old-domain entry path resolves, locks, and revalidates the complete active
    root/membership/order/alias set or fails closed on drift/overflow. Adjudication
    supports both confirmed merge and rejected bridge. Overflow remains frozen
    while checksumed bounded batches stage a decision, and only one final recovery-
    anchor CAS publishes or unfreezes it without an unbounded order transaction.
107. An initialized predecessor session permits successor collection authority only
    with matching append-only `payment_attempt_noncapturability_evidence` from a
    verified provider revocation or database-proved pinned-contract expiry. Local
    lease state, popup/client time, the 24-hour cutoff, and an unacknowledged cancel
    request cannot satisfy the tagged union, and a nonce is never an alternative.
    The guarded evidence writer shares the complete order, collision, provider-
    reference, and canonical-receipt lock families with capture/webhook/
    verification, rejects captured or in-flight sessions, and installs evidence
    atomically with successor publication, or revalidates matching pre-existing
    evidence under that same lock set. Bare deadline expiry is allowed only for a
    registered, active-at-issuance capture-finality generation with matching
    provider/account/authority, approval, and conformance receipt. Bare deadline
    expiry additionally requires that no earlier accepted/queued/in-flight capture
    can settle later; otherwise verified finality plus its registered delay is
    mandatory. Provider-capture/rotation races never
    expose a still-capturable predecessor beside a successor lease.
108. A separate-purchase nonce preserves its protected predecessor unchanged,
    requires different protected/result order IDs, and is bound to a frozen
    version-independent commercial identity represented by its database-owned
    opaque collision domain. Equivalent request-hash aliases survive deploy,
    rollback, and generation retirement during its lifetime through an immutable
    issuance bundle retained until the later of expiry or idempotent result-replay
    horizon plus margin, whether consumed or not. A consumed lost-response retry
    reloads the exact immutable result before alias/generation rejection; ambiguous,
    unknown, unretained, or changed commercial identities fail closed.
109. Stage 0 creates only expand-only schema and dormant ungranted functions; no
    production route, grant, RPC enforcement, webhook acknowledgement, cleanup,
    inventory, or money behavior changes. Those integrations begin per authority
    in Stage 1 shadow/canary with generation fencing, rollback ownership, and
    proof that unrelated providers remain isolated. Stage 1 legacy comparison
    uses structurally non-authoritative shadow-observation rows; they cannot own
    leases/references/evidence or satisfy an attempt foreign key, and canary
    issuance creates a fresh canonical attempt rather than promoting one. Every
    admin/SDK/webhook/cleanup/internal-ledger shadow evaluator is a separate pure function running
    under a role that can insert typed shadow observations only by executing the
    matching guarded insert function; direct observation-table writes are revoked,
    and it cannot execute canonical writers. Its separately bundled runtime has no provider mutation
    imports, provider/payment credentials, secret mounts, public internet/provider
    egress, or arbitrary DNS. It has only a short-lived shadow-role database
    identity and the private database/proxy allowlist, so it cannot invoke outbound
    provider mutations; canary routes to
    separately granted authoritative functions.
110. Collision overflow recovery can restore liveness for a legitimate long-lived
    component only by publishing a bounded active authority closure. Closed order/
    domain/alias compaction requires immutable typed terminal proof, preserves
    lookup/late-money history, and cannot compact a live lease, attempt, assignment,
    grant/replay horizon, protection, rollback alias, or reopening veto. A final
    closure still over either cap remains frozen; it is never repeatedly unfrozen
    into immediate overflow. While frozen, exact-reference signed ingress remains
    durably acknowledgeable through a non-money, non-expiring overflow-mode
    webhook claim and
    retained source child; cleanup and collection authority stay fenced until
    bounded recovery, and later processing reuses that same child. Retained ingress
    advances the recovery anchor revision, so a stale staged snapshot cannot
    publish or compact its claimed order. After recovery, one ordinary command
    processes the existing append-only claim; no new claim is permitted, and the
    veto ends only with its source-matched terminal closure.
111. Capture-finality shape is explicit: every externally capturable attempt has
    one active-at-issuance registered finality contract, while an authorized
    already-collected manual attempt uses the database-enforced
    `noncapturable_by_construction` branch, has no external session or
    actionable lease, has only the manual-evidence pending/review/recorded CAS
    states, creates no finality contract or noncapturability-evidence row, and
    cannot enter expiry, revocation, switching, provider-only, or successor-
    session logic. A review state can reach recorded only through one immutable,
    maker/checker-authorized, expected-version resolution whose transaction also
    creates or reloads the exact reviewed receipt/completion result.
112. Every shadow rollout receipt is computed from an immutable database-selected
    eligible-source census with one frozen legacy outcome and at most one approved-
    artifact observation per child. Missing, failed, selectively omitted,
    duplicated, mismatched, or unapproved-exclusion rows remain in the denominator;
    incomplete or caller-aggregated parity cannot authorize canary widening.
    Every observation is database-bound to its census child's authority,
    generation, evaluator kind, input hash, approved artifact checksum, and schema
    generation; uniqueness by child ID alone is not binding authority.
    Database grants expose only approved safe `SELECT` projections and guarded
    observation-insert `EXECUTE`; direct observation-table `INSERT`, `UPDATE`, and
    `DELETE` are denied, so derived bindings and runtime/artifact attestation cannot
    be bypassed.
    Internal-ledger children additionally reconcile independently owned wrapper,
    command-intake, and outcome counts and bind canary outcomes to the exact
    command, internal-funding evidence, and allocation result; receipt-tag or
    receipt/provider-field mismatch is a zero-tolerance disagreement.
    Shadow instrumentation failure cannot change the legacy response or money
    result, while independent route/outcome reconciliation makes that failure a
    widening blocker.
113. Consumed separate-purchase result replay never treats retention as
    authentication. It returns the existing result only to the still-valid original
    proof or fresh proof of the same authorized subject component; expired/revoked/
    ambiguous/cross-merchant proof reveals no order and creates no new authority.
114. Spending existing wallet, savings, store-credit, or stored-value-voucher
    value creates exactly one conserved internal-funding evidence/allocation and
    source-ledger debit or split, not a new customer-receipt transaction, receipt
    origin, gross disposition lot, provider settlement effect, or payment attempt.
    Combined receipt plus internal funding settles the order only when both source
    classes conserve value atomically; replay cannot consume one source twice.
    Every executor/completion branch derives the typed backing asset. A receipt-
    backed branch also derives and revalidates its receipt-lineage root guard
    before source-child debit or split and returns fenced retry when blocked;
    non-receipt backing uses the typed asset/source-slice path without fabricating
    a receipt root.
115. A customer refund of internal funding restores the same liability class
    exactly once (or a reviewed immutable successor). Only a mixed-tender
    customer refund may use the persisted proportional minor-unit/remainder
    algorithm; under source locks it requires `S > 0` and `R <= S` before
    calculating or persisting portions, and insufficient capacity produces no
    provider call or restoration. Provider cash cannot refund internal value without a separate
    finance-authorized conversion decision. A wholly internal refund uses its
    immutable internal-funding reversal plan without fabricating a transaction,
    while a receipt-backed customer refund persists one provider obligation and
    source amount for each of its one to many receipt legs. A chargeback binds
    exactly one original receipt and has zero internal source or restoration
    amount; if prior source reservations leave insufficient receipt capacity, its
    authoritative provider evidence is retained and only the excess becomes a
    typed provider-dispute liability rather than a second customer/merchant move.
    A receipt without typed backing lineage creates no root guard, parent loss
    authority/veto, backing-loss child, or recovery obligation. For a typed
    backing receipt, the same evidence/source-reservation intake transaction
    atomically installs those parent facts before acknowledgement; only bounded
    post-intake census/partition/materialization and sealed `q_asset` recovery may
    create child loss authority, and neither path restores internal funding.
    The parent chargeback/collision authority alone persists immutable `D=Q+E`
    plus a root-keyed bounded receipt-lineage guard with monotonic generation and
    active-parent-veto count, a parent availability/non-spend veto, and target-`Q`
    partition header. Every descendant writer obtains that guard before parent
    lookup/asset lock and rejects nonzero count without enumerating parent vetoes.
    Any operation that needs more lineage authority takes the disjoint classes in
    this exact order—root guard, parent partition, parent veto, parent finance
    disposition/reference/terminal, then child asset/loss-case/fence/recovery—
    byte-sorting only inside one class and never across them.
    Resumable census/partition pages later seal
    `Q_nonasset + sum(q_asset) = Q`; only then does `Q_nonasset` follow direct
    receipt effects and each backing child own its `q_asset`. Every parent has a
    non-null immutable finance scope. For `D=Q,E=0`, it is
    `zero_E_no_finance` with `parent_only_E=0`, no finance child reference or
    terminal, and a bounded sealed empty finance-reference census proving only
    ordinary positive-`q_asset` children; it cannot fabricate a zero-`q_asset`
    finance child, and release requires that explicit seal rather than absent rows.
    For `E>0`, parent `E` requires finance replacement-backing/reconciliation and
    is forbidden from child, customer, merchant, internal, or backing-loss recovery
    effects. The immutable `E_finance` disposition must keyset-enumerate every
    `q_asset=0` child with one zero-share reference, seal its checksum/completeness,
    and prove positive child shares plus explicit `parent_only_E` exactly equal
    `E`; an unassigned parent-owned `E` is therefore explicit, not an omitted child
    reference. Only zero children and positive children explicitly named in that
    sealed set may close through bounded `complete_child_finance_resolution` to
    `finance_no_recovery_resolved`; an unreferenced positive child completes its
    ordinary `q_asset` recovery and cannot be attached later. The parent/root guard
    remains active for unresolved `parent_only_E` even when those ordinary children
    are applied, and releases only after the scope-specific seal, the parent
    finance-disposition terminal, all referenced-child terminals, all ordinary
    child predicates, and the final active count transition.
116. Every internal funding source carries immutable funding-basis, obligor, and
    typed backing-availability lineage. Its merchant entitlement cannot become
    withdrawable ahead of that backing, and later backing loss follows exactly one
    conserved reserve/liability recovery path without rewriting payment history.
    One asset-level loss case is keyed by the typed backing asset plus immutable
    parent chargeback partition or issuer-revocation identity, reserves only its
    recoverable `q_asset` once, fences descendant changes, and deterministically
    conserves that amount across unspent value plus consumed-slice recovery rows.
    A provider chargeback of its backing receipt atomically commits parent `D=Q+E`
    evidence/reservation/collision plus root-guard generation/count and the bounded
    receipt-lineage veto/high-water; acknowledgement never requires unbounded child
    fan-out. Bounded parent census/
    partition/child-materialization pages then seal every partition and durable
    child case/veto before parent availability releases; unresolved parent `E`
    retains that veto. Multiple active parent disputes retain the root count until
    each exact-once terminal parent decrement; no writer scans all parent vetoes.
    Intake, parent workers, finance closure, generic chargeback/reversal, and any
    descendant writer that needs the corresponding authority share the exact root
    guard -> parent partition -> parent veto -> parent finance -> child class
    order; each class alone is byte-sorted, so a lexical key never reverses the
    hierarchy.
    An `E>0` parent has one `E_finance` replacement-backing/reconciliation scope
    and cannot become child recovery; its `q_asset=0` child has no
    census/plan/application/recovery item, while only a sealed finance-referenced
    positive child requires the exact disposition-child finance terminal. An
    unreferenced positive child retains ordinary recovery/applied state even while
    `parent_only_E` keeps the root guard active. Bounded finance-reference pages
    enumerate every zero child exactly once and seal
    `positive shares + parent_only_E = E` before any child terminal or final root
    release; membership is immutable after the seal, and missing, duplicate,
    late-attached, divergent, or crash-replayed pages remain fenced. The parent
    finance-disposition terminal plus every referenced-child terminal, rather than
    an unreferenced child finance terminal, is required for final release.
    An `E=0` parent instead seals the bounded zero-finance proof with no reference,
    finance terminal, or fabricated zero child; positive `q_asset` children retain
    ordinary recovery, and the explicit seal—not null finance state—permits final
    release. High fan-out overflow remains globally parent-fenced and acknowledged with durable review/cursors,
    never with an unbounded transaction or partial availability. Bounded
    cursor/checksum census,
    prefix-apportionment draft-plan, plan-seal, and application phases make no
    item applicable before the complete sealed plan, including after crash or
    stale-high-water detection. It covers receiving-intent wallet-credit,
    merchant-issued, platform-funded, and stored-value issuance assets, so
    loss/retry/crash and internal-customer-refund races converge without duplicate
    restoration, reserve recovery, or negative balance.
117. APIs, receipts, dashboards, storefronts, mobile clients, analytics, and
    notifications distinguish receipt-only collected money from internally
    applied value and total historical funding. They never fabricate a gateway
    receipt/provider transaction for an internal application and show mixed-
    tender reversal destinations without exposing private ledger identifiers.
118. Internal funding executes only from a database-owned immutable command that
    binds authorized tenant/customer, order, collection epoch, exact source slice,
    amount, and currency. It revalidates that binding under lock and rejects
    cumulative receipt plus internal funding above the payable total before any
    source debit or allocation.
119. Completion results are a database-enforced `receipt | internal_funding`
    union. Receipt results require their transaction graph; internal results
    require command/evidence/allocation and forbid every receipt/provider-result
    field. Partial, replayed, or fully internal completion cannot fabricate a
    customer-receipt transaction or captured-money outcome.

## Implementation Planning Constraints

The implementation plan must split this design into completion-authority-scoped
phases and PRs. It must not produce one cross-provider migration bundle.

Before any code execution, planning must:

- re-open current `origin/main` and both referenced payment designs;
- inventory every provider initialization, webhook, verification, manual,
  reconciliation, and settlement caller;
- verify exact current database constraints and function signatures;
- design a private ungranted completion implementation plus separate
  service-role provider, authenticated manual, and guarded internal-ledger
  wrappers; preserve `auth.uid()` and `has_merchant_access` authority for manual
  writes. Define the internal wrapper as source-ledger funding authority, not a
  receipt-confirmation wrapper;
- define the allowed attempt-transition matrix, actor permissions, and
  compare-and-set implementation;
- define the order-level collection lease, provider noncapturability evidence, and
  switch refusal rules that prevent two customer-actionable attempts;
- define `payment_attempt_noncapturability_evidence` as an append-only
  provider/account/authority/session-scoped tagged union for verified revocation or
  contract-proved expiry, including pinned policy generation, provider proof or
  database-clock invariant, uniqueness, deferred equality checks, row-order
  placement, grants, and denial of local/popup/client/cancel-request substitutes.
  Specify its sole guarded writer, complete order/collision/provider-reference/
  canonical-receipt discovery and revalidation, identical locking with capture,
  webhook, and verification, rejection of captured or in-flight sessions, exact
  expiry-boundary semantics, adapter-pinned hard deadline finality or verified
  no-capture/in-flight status plus finality delay, and atomic evidence-plus-successor publication or
  matching pre-existing-evidence revalidation under the same locks;
- define `payment_provider_capture_finality_contracts` as an append-only provider/
  account/authority/generation registry with database-enforced `hard_deadline |
  verified_revocation_status` branches, immutable deadline/delay derivation,
  evidence-schema and processor versions, approval/conformance receipts, active/
  draining/retired lifecycle, one active generation, attempt/evidence FKs, guarded
  activation/rollback, and denial of unregistered, inactive-at-issuance, altered,
  missing-receipt, or cross-scope contracts;
- define the attempt capture-authority tagged union: `external_session` requires
  the registered finality FK, while `noncapturable_by_construction` is limited to
  authorized already-collected manual evidence,
  requires no provider session/customer identity or actionable lease, and cannot
  enter provider switching/noncapturability/successor logic. Give the latter only
  the closed `manual_evidence_pending | manual_evidence_review_required |
  manual_receipt_recorded` state/CAS matrix, forbid provider-only states, and
  prove that it creates neither a finality-contract FK nor
  `payment_attempt_noncapturability_evidence`. Define the immutable manual-
  evidence resolution ledger and maker/checker, expected-version reconciliation-
  only transition from review to recorded, with atomic receipt/completion,
  idempotent replay, append-only audit, and unauthorized/stale/duplicate/divergent
  denial. Treat a manual
  transfer request that can receive later money as external rather than synthetic;
- define `payment_internal_funding_evidence` and
  `order_internal_funding_allocations` separately from customer receipts: allowed
  source-ledger/reservation kinds, tenant/customer authority, integer amount/
  currency and collection-epoch equality, unique or conserved split consumption,
  closed funding-basis/obligor union, typed immutable backing-lineage assets
  (including a receiving-intent wallet-credit asset rather than an assumed order
  allocation), backing-availability and loss lineage, source liability-to-
  merchant entitlement transfer, lock placement, inventory/paid-state atomicity,
  idempotent command/result, reversal/release behavior, and
  explicit prohibition on receipt origins, canonical provider identity, gross
  customer-disposition lots, provider settlement/effects, or payment attempts;
- define creation/authorization and financial-consumption phases for the immutable
  internal-funding command binding. Require trusted tenant/customer/order/epoch/
  source-slice/amount/currency derivation and typed backing-asset derivation.
  Require conditional receipt-lineage-root derivation, root-guard-before-child
  locking, and immediate pre-debit generation/count revalidation only for receipt-
  backed sources; non-receipt sources must use the typed asset/source-slice path
  without fabricating a root. Apply the appropriate path across every
  executor/completion branch, and require
  rejection of cumulative receipt plus internal allocations above payable total
  before debit;
- define immutable attempt authority/generation/cohort/processor fields, private
  endpoint-scoped ingress-contract-generation registry, routing-generation
  registry, scoped multi-reference binding schema and lookup
  namespaces, active/superseded/popup binding lifecycle, atomic metadata-fallback
  election, durable pre-acknowledgement ingress quarantine, mandatory pre-money
  typed financial-routing proposal plus receipt-transaction-owned accepted
  resolution, order-note shadow retirement, and ambiguity review; define the
  `order_attempt | receiving_intent_epoch |
  unattributed_provider_account` union, branch-specific binding rules, atomic
  election with receipt-origin resolution, and conflict behavior;
- define separate non-authoritative attempt, admin-mutation, SDK-first-report,
  webhook-intake, cleanup, and internal-funding shadow-observation tables plus pure evaluator
  functions. Their dedicated database role can read only reviewed safe projections,
  execute only matching guarded observation-insert functions, has direct
  observation-table `INSERT`/`UPDATE`/`DELETE` revoked, executes no canonical
  writer, and invokes
  no outbound provider mutation. Define a separately bundled no-provider-import,
  provider-secret-free runtime with only a short-lived shadow-role database
  identity and private database/proxy network allowlist, plus default-deny public/
  provider/metadata/DNS egress enforced by CI and deployment policy.
  No observation identifier can satisfy a canonical
  attempt/lease/reference/evidence FK or be promoted; canary must route to separately
  granted authoritative functions and create/elect a fresh canonical attempt under
  generation fencing;
- define immutable shadow comparison manifests and database-selected eligible
  child census, safe input and legacy-outcome hashes, observation-to-child
  uniqueness, approved evaluator artifact/input-schema attestation, and a
  composite FK/deferred equality or guarded-insert contract binding every
  observation to the exact child's authority, generation, evaluator kind, input
  hash, artifact checksum, and schema generation. Revoke direct shadow-role table
  insert and add cross-child/cross-generation/input/artifact/schema negative tests;
  define explicit
  counted exclusions, gross/eligible sample and coverage rules, missing/failed/
  duplicate/mismatch behavior, and a guarded database-computed rollout receipt
  that rejects caller aggregates and incomplete zero-tolerance windows. Define
  fail-open legacy instrumentation with independently owned route/legacy-outcome
  counters or source rows so capture/dispatch/attachment failure preserves live
  behavior but necessarily blocks window closure;
- define ISO currency exponent handling and the compatibility mapping between
  new integer minor units and existing numeric ledger columns;
- define provider-account namespace identity without storing credentials;
- define scoped replay/transaction unique indexes using provider, completion
  authority, provider-account namespace, merchant where required, reference/event
  identity, and event type; explicitly retire or preserve every conflicting
  legacy specialized index;
- define the frozen provider canonical-identity contract and version-independent
  first-seen locator/advisory key independently of parser version and amount/
  currency/time/status; exact tenant/account/authority scope; one transaction per
  canonical identity; complete concurrently supported alias bundles; pre-
  activation checksum-backfill and future-event shadow parity; dual lookup;
  ambiguity quarantine; no-rekey evolution; alias/contract-preserving rollback;
  and review-only behavior where stable bootstrap identity cannot be proved;
- define immutable canonical-contract generations, one-active-per-scope database
  enforcement, active/draining routing semantics, family-lock equivalence proof,
  alias mapper/backfill evidence, incompatible-generation fenced drain and
  identity-space disjointness, delayed-event review, and safe rollback refusal;
- define the universal receipt-origin tagged union, stable non-order receiving-
  intent schema, immutable effective-time epochs, database-enforced immutable
  capacity claims plus guarded single-use and reusable per-receipt/count/
  cumulative limits and drift checks, paid-time uncertainty
  matching, proposed-resolution and atomic accepted-resolution election,
  immutable intent-epoch and provider-account authority/routing generation,
  processor/timing-policy snapshots, delayed-event grandfather/rollback rules,
  conditional attempt-to-transaction provenance table,
  confirmation-evidence link, legacy backfill rules, and policy-snapshot lookup
  used by settlement and acknowledgement workers;
- define the typed confirmation-evidence authority: source-specific schemas and
  functions for webhook, provider verify, manual, internal ledger, and
  reconciliation; deterministic identities; wrapper evidence-ID or immutable
  source-proof/proposal-ID inputs; non-authoritative financial-routing proposals;
  financially retained singleton and bounded-multi-capture source manifests,
  deterministic immutable child source proofs and IDs, exactly one proposal per
  child, exactly one command per authorized child, exactly one evidence/canonical-
  identity/receipt graph per completed child, parent terminal aggregation without
  parent financial-result authority, cardinality/conservation constraints and
  replay conflict rules; atomic evidence creation plus routing/origin acceptance;
  database cross-checks; and client-callback rejection;
- define the versioned webhook worker envelope, completion-authority key,
  immutable ingress-contract generation, nullable post-resolution financial
  generation, endpoint/key-scoped generation-independent replay identity,
  unscoped quarantine, adapter-version rejection, and the acknowledgement boundary
  that atomically commits inbox, independently replay-keyed durable manifest,
  complete child proofs/conservation facts, and terminal child protection
  decisions; define the child-only pre-money routing gate and one-active-generation
  database enforcement,
  expected-version activation/drain/retirement receipts, dual-parser equivalence,
  concurrent insert winner reload, normalized-envelope conflict handling,
  rollback retention, and safe drain gates;
- define the platform/global unscoped-quarantine owner and authorization,
  privacy-filtered projection, immutable resolution proposals, expected-version
  adoption and conflict states, actor/reason audit, SLA/escalation, and retention
  prohibition while unresolved; do not create merchant-scoped review authority
  from an unresolved tenant guess; require deterministic independent provider
  proof for automatic adoption, distinct authorized maker/checker approval for
  operator-selected cross-tenant adoption, require unanimous independently proved
  child scope for whole-manifest adoption, fail mixed-scope children to conflict
  review, allow adoption to attach only one unattributed-provider-account proposal
  per child, create one durable `quarantine_adoption` receipt command per child,
  and reserve accepted routing/evidence/origin/transaction creation for each
  canonical child receipt transaction; keep suspense free of merchant order/
  customer visibility or downstream authority, require a separate fresh-authority
  reconciliation decision before allocation or fulfilment, and use conserved
  correction entries plus immutable incident evidence rather than historical
  mutation;
- preserve provider-facing webhook URL, dashboard subscription, signature
  verification, and secret continuity; define immutable session-generation
  stamping, generation-aware ingress routing, stable canary cohort assignment,
  active/superseded/unpersisted-reference grandfathering, the maximum provider
  redelivery horizon, late-money reconciliation, and no in-flight rerouting on
  canary stop or rollback;
- define the database-owned rollout control/transition schema, allowed state
  matrix, expected-version CAS, actor and maker/checker authority, cohort and
  threshold policy checksums, observation/stop receipts, checkout and worker
  issuance enforcement for attempts, receiving-intent epochs, and provider-
  account authority epochs; define their shared rollout-row-first idempotent CAS,
  provider-account epoch exclusion/successor constraints and transition receipts,
  concurrent stop/widen arbitration, stale-cache denial,
  historical pinned-generation completion validation, and the rule that current
  issuance-generation equality is never required by an existing attempt;
- encode Credit Direct's three distinct signals: untrusted SDK success as bounded
  possible-capture protection only, signed customer-payment completion as
  non-money provider approval/inventory evidence, and merchant-payment completion
  as the only confirmed-receipt authority; define distinct typed timestamps,
  event-specific replay identities, merchant-first/customer-first/late-customer
  behavior, server-owned residual validation, and contract-proved
  `provider_external_settlement` ownership;
- define signed-customer-event inventory as only the existing bounded serialized
  reservation, explicitly deny SDK-driven attempt/inventory mutation, define its
  cutoff/cleanup and no-fulfilment invariant, merchant-event atomic confirmation,
  merchant-first behavior, and confirmed-money suspense plus
  remediation when inventory expired or is unavailable;
- replace the order-only payment-side-effect key with explicit order- and
  transaction-scoped claim identities and migrate completed legacy/manual claims
  without replay;
- define the payment-resolution projection and every consumer that must derive
  “under review” without adding `payment_review` to financial payment status;
- add typed reconciliation protection fields and a proof-safe backfill from
  existing Credit Direct review metadata;
- define the guarded SDK-success first-write function, unique evidence identity,
  same-order/attempt/session/authorization validation, database-owned timestamp,
  ordinary write-once `protection_expires_at`, exact elapsed `+48 hours` invariant,
  duplicate/concurrent return semantics, and direct-update rejection; make stable
  identity exclude consumable grants, look up exact evidence before generic
  consumed-grant rejection, distinguish authenticated-customer from signed-grant
  authorization, and make replacement grants corroborate without extension.
  Require non-null provider/account/authority, attempt, and normalized provider
  session; reject missing/empty sessions before lock derivation. Encode the stable-
  source key in the existing provider-reference advisory family, resolve the
  persisted checkout collision domain plus complete active legacy/current subject/
  request alias closure, discover that closure and the complete matching order set
  plus key set without row locks, acquire orders before every sorted collision
  alias/domain key and the provider-reference class, revalidate all sets, then
  acquire cleanup's identical order row
  lock and atomically
  install `payment_sdk_possible_capture_evidence(result='protected')` plus its
  typed claim. Define cleanup-first as one immutable idempotent
  `late_sdk_success` evidence/review result with no claim, protection expiry,
  confirmation evidence, transaction, reopening, allocation, inventory, or
  fulfilment;
- define the private `payment_sdk_possible_capture_evidence` schema, immutable
  non-null collision domain + provider/account/authority + attempt + normalized non-null session
  source identity, exact order/
  request/amount/currency facts, typed authorization snapshot, database-owned first receipt time,
  `protected | late_sdk_success | cross_order_collision_review` result constraint,
  frozen predecessor/successor links for the collision branch, exact non-extendable 48-hour
  expiry for protected results, claim-owned unique evidence FK, review-owned unique
  review-only-evidence FK, no evidence-side backlinks, deferred one-to-one tagged-union
  invariant, append-only authorization/corroboration schema and uniqueness,
  forbidden confirmation/transaction links, RLS/grants, and explicit
  global-row-order placement before order-protection claims. Add migration replay,
  session-timezone/DST, direct-update, orphan, duplicate, and cross-result tests;
- define checkout protection binding, generic guest response, explicit separate-
  purchase authorization, single-use nonce storage, the shared deterministic
  persisted collision-domain and complete order/alias-set discovery/revalidation,
  SDK-first versus rotation-first winner rules, immutable provider revocation or
  hard-finality-qualified contract-expiry proof before predecessor supersession/successor publication,
  blocked-rotation and collision-review linkage, and 24-hour/48-hour boundary tests
  without fuzzy order reuse, two unapproved actionable leases, or an externally
  capturable predecessor beside a successor;
- define checkout subject components and identity-only equivalence insertion
  separately from commercial-alias projection; identity proof alone never creates
  a domain or touches unrelated orders. Define `payment_checkout_collision_domains`,
  append-only aliases/equivalences, merchant-scoped proof authority/evidence,
  active hash-generation overlap, bootstrap absence locking, canonical domain resolution,
  immutable non-null domain foreign keys on participating orders, checkout
  bindings, separate-purchase grants, and SDK evidence,
  sorted alias/domain advisory encoding, unknown/ambiguous/cyclic/cross-merchant
  fail-closed behavior, RLS/grants, retention, and rollout/rollback migration tests
  spanning guest, authenticated, tracking-proof, and email-OTP transitions. Define
  append-only component roots, memberships, successions, monotonic generation,
  immutable conflict evidence, all-member freeze, tagged `confirmed_merge |
  rejected_bridge` adjudication, branch-specific successor/rejection constraints,
  safe conditional unfreeze, old-root entry resolution, complete bounded order/
  root/member/domain/alias locking, and drift retry. Define 64-order/256-entry caps
  plus platform-only overflow recovery with root fence, immutable checksum snapshot,
  bounded resumable staging, invisible pre-publication memberships, crash recovery,
  and one final recovery-anchor CAS without rewriting order/domain foreign keys.
  Add `compact_closed_authority_entries` recovery, immutable tagged order/domain/
  alias authority-horizon closure evidence, active-versus-lookup-only membership/
  alias redirects, late-money behavior, sorted all-source-root publication locks,
  and a mandatory
  post-staging proof that the resulting active authority closure is within both
  caps; otherwise retain the manual-only fence. Define the exact-reference-only
  `collision_overflow_frozen` webhook ingress mode, selected-order/root/reference
  lock set, retained child plus non-expiring non-money claim, acknowledgement behavior,
  ambiguous/global quarantine outcome, cleanup veto, anchor-revision increment,
  stale-snapshot publication refusal/rescan, and post-recovery lifecycle. Forbid a
  command or second claim at ingress; after recovery require the ordinary worker
  to link one command to the existing claim, retain its veto through retry/review,
  and close it only with the matching typed terminal result;
- define the Credit Direct merchant-ingress-versus-cleanup precedence from
  server ingress time plus indexed, typed, non-money child order-protection claims
  installed synchronously with inbox, independently replay-keyed manifest, and
  complete child proofs under the identical order advisory and row locks used by
  cleanup; for the ordinary mode, discover and canonically lock the complete
  bounded order set, require
  a claim, no-safe-order, or late-ingress decision per child before success
  acknowledgement, and roll back the whole intake on any bounded lock failure;
  define safe signed-metadata/reference/account/amount child association, one-
  order-per-child uniqueness, expiry/status, post-lock order/cutoff revalidation,
  the final READ COMMITTED claim recheck while those locks remain held through
  cancellation commit, installer-first and cleanup-first outcomes, merchant-
  scoped reconciliation for proved same-tenant/account ambiguity, global
  quarantine only for unresolved/conflicting/cross-tenant scope, the post-cleanup
  late-money path, explicit denial of financial/inventory/fulfilment authority,
  and exact-boundary concurrency tests; incorporate only the already-frozen exact-
  reference overflow exception defined immediately above;
- define order-protection claims as a database-enforced tagged union with common
  order/timing fields and source-specific check constraints: `webhook_child`
  requires retained manifest and child-proof IDs and forbids SDK fields, while
  `sdk_first_report` requires SDK evidence, attempt, provider session, and
  evidence-owned authorization provenance and forbids webhook fields. Add partial unique
  constraints per immutable webhook child proof and SDK evidence/session source;
  enforce `webhook_child.expires_at IS NULL` with a unique append-only typed
  terminal-closure row. Define all four closure kinds, branch-specific required
  and forbidden foreign keys, enumerated terminal dispositions, deferred equality
  checks across claim/source/order/merchant/provider/account/authority, and guarded
  same-transaction insertion with the completed terminal result; explicitly deny
  direct SQL and treat lease expiry or command exhaustion as nonterminal. Enforce
  SDK claim expiry equality to the evidence's ordinary guarded write-once expiry
  with non-null expiry and no extension;
- bind the nonce hash to merchant, protected order, verified customer/guest-proof
  subject and frozen version-independent commercial identity as the database-owned
  collision-domain ID, plus issuance request generation/hash and immutable alias-
  bundle ID for audit, expiry, database-owned idempotent replay horizon, and one atomically inserted
  distinct result order. Resolve consumption through database-proved equivalent
  active/draining or retained nonce-only aliases so deploy, rollback, and
  generation retirement cannot invalidate it. Exact consumed-grant/result lookup
  must precede expiry/generation rejection for authorized lost-response replay.
  Define the checkout request-contract
  control row, nonce-issuance control precursor, retirement CAS, zero-live-expiry/
  replay-horizon receipt or retention for consumed and unconsumed grants through the later of
  expiry or idempotent replay horizon plus margin, and prohibition on
  nonce-only aliases bootstrapping a checkout;
  distinguish result retention from authentication: define original-proof replay,
  fresh same-subject reauthentication after session/proof rotation or expiry,
  authorization snapshots/audit rows, generic denial without order disclosure,
  and tests for revoked, ambiguous, expired, cross-merchant, and missing proof;
  consume it under the same checkout-collision and complete-order lock set and
  prove it authorizes only that separate purchase rather than disabling the
  collision domain, satisfying noncapturability, entering provider switching, or
  superseding/replacing/changing the protected predecessor attempt and lease;
- inventory `update_admin_order` and every other commercial-order mutation path,
  then enforce edit-before-collection versus immutable replacement-order rules
  under concurrency with attempt/assignment creation;
- make replacement-order creation acquire the original collection lease and
  withhold any replacement collection authority while the original has possible-
  capture protection or lacks matching
  `payment_attempt_noncapturability_evidence`;
- define partial-collection modes, immutable contract epochs and successor-
  extension flow, inventory-hold behavior, settlement-release policy, preorder
  disclosure, expiry remediation, and concurrency with final payment;
- define receipt-only gross customer-disposition lots separately from
  beneficiary economic components, reversal-only amount/effect shapes,
  deterministic fee/rounding conservation, legal transitions, and prove that
  only merchant entitlement can become withdrawable;
- define gross-equal `suspense_principal` for unattributed receipts and the
  balanced correction-entry contract that reclassifies it only after an
  authorized attribution or disposition decision;
- define the atomic wallet-credit component transformation, customer-wallet
  liability ledger identity, provider-external solvency obligation, replay
  behavior, and permanent merchant-settlement veto;
- inventory and route or fence customer-wallet top-up/credit, refund,
  redemption, savings, merchant settlement/reserve/payout/withdrawal, reversal,
  and maintenance/backfill writers; define customer-wallet and merchant-wallet
  advisory keys, row ordering, cross-operation concurrency tests, and a global
  maintenance fence that excludes canonical writers;
- inventory and route or fence every merchant-value writer—including balance
  triggers, `record_merchant_settlement*`, `merchant_wallets`, workers, manual
  writers, and provider hooks—and define provider clearing/risk-hold evidence
  before any canonical authority activates;
- define one reversal authority with database-enforced typed source legs:
  `receipt_transaction` for original-row refund mutation/separate refund-
  transaction compatibility and `internal_funding_plan` for wholly internal
  reversals without a fabricated transaction. Permit one to many receipt legs
  per customer refund, each with its original provider obligation, source amount,
  child idempotency/execution state, and a case-total conservation check; seed
  generic reversal effects once per case and define partial-provider-failure/
  replay behavior. Define source-global reservation rows/capacity subtraction
  across every active, ambiguous, completed, or other consuming case before any
  provider or internal effect; preserve idempotency, source locks, component/
  merchant-entitlement reversal, ambiguous-provider handling, merchant debits/
  holds, and negative-balance recovery for either legitimate source. Define the
  provider-chargeback-after-refund collision as durable provider evidence plus
  `reserved + excess = disputed` accounting, where excess is a typed finance
  reconciliation liability and cannot move customer/merchant/internal value a
  second time, including through backing-loss recovery; permit the specified
  proportional integer-minor-unit/remainder split only for customer refunds,
  never chargebacks, and require locked source-capacity recomputation with
  `S > 0` and `R <= S` before either proportional or explicit portions persist
  or any provider/restoration effect begins;
- define receipt-only chargebacks as a strict source subset: they bind the
  original receipt lots/components/receipt allocations, carry zero internal
  source or restoration amount. A receipt with no typed backing lineage must
  create no root guard, parent loss authority/veto, backing-loss case, child, or
  recovery obligation; a typed backing receipt must atomically install the root
  guard plus parent chargeback/loss authority and veto in authoritative intake,
  with only later bounded sealed `q_asset` work permitted to create child recovery;
- define an asset-level backing-loss authority keyed by immutable typed backing-
  lineage asset plus parent chargeback partition or issuer-revocation identity.
  Require parent chargeback authority to persist authoritative `D`, aggregate
  source reservation `Q`, finance `E`, its non-null immutable finance-scope kind,
  a target-`Q` partition header, and a stable root-keyed receipt-lineage guard with monotonic generation/active-parent-
  veto count plus its bounded parent availability/non-spend veto/high-water
  atomically with receipt acknowledgement—not an unbounded complete partition or
  child fan-out. Require every current/future descendant spend/split/restoration/
  availability/settlement/withdrawal writer to take that guard before parent lookup
  or its asset lock, revalidate generation/count, and reject nonzero count without
  enumerating active parent vetoes. Define disjoint advisory and row-lock classes
  with the mandatory root guard -> parent partition -> parent veto -> parent
  finance disposition/reference/terminal -> child asset/loss-case/fence/recovery
  order; sort keys only within a class, never across classes, and apply that order
  to intake, generic reversal/chargeback discovery, bounded workers, finance
  closure, and descendant writers. Require bounded resumable lineage census,
  partition, and child-materialization pages with cursor/checksum/high-water and
  guard-generation revalidation, then
  seal `Q_nonasset + sum(q_asset) = Q` before direct effects or child recovery;
  the parent fence releases only after complete sealed partition, durable children,
  its immutable scope-specific finance proof, required finance terminals, and its
  exact-once guarded decrement; availability reopens only at root count one-to-zero.
  Permit a child to
  reserve/census only `q_asset`,
  never parent `D`/`Q`/`E`; parent `E` requires immutable finance replacement-
  backing/reconciliation and can name a child only as a non-recovery reference/
  share that never enters asset-loss census/plan/application, customer/merchant/
  internal recovery, or availability release. Require a non-null immutable parent
  finance scope: when `D=Q,E=0`, `zero_E_no_finance` fixes `parent_only_E=0`,
  forbids every finance reference/terminal and zero-`q_asset` finance child, and
  reaches only a bounded cursor/checksum sealed empty finance-reference census that
  proves ordinary positive-child recovery before release. When `E>0`, enumerate
  every zero child through its separate zero-share reference rather than inferring
  a child share from `E`. Define the `E_finance` zero-recoverable `q_asset=0` child
  with no recovery fan-out and one bounded exactly-once
  `(parent_finance_disposition, child)` finance-resolution transition to named
  `finance_no_recovery_resolved`; apply the same terminal only to a positive child
  that is explicitly present in the sealed `E_finance` reference set and has its
  `q_asset` application checksum. Before either terminal, require immutable
  bounded finance-reference census pages that enumerate every and only zero child
  with an explicit zero-share reference, bind each optional positive reference to
  its child, and seal `sum(positive shares) + parent_only_E = E`; permit all `E`
  to remain explicitly parent-only despite positive or zero children. Define closed
  ordinary/referenced-positive/zero-reference child tags, prohibit a late
  post-seal attachment or tag transition, and require unreferenced positive children
  to finish ordinary `q_asset` recovery without a finance terminal. Require
  missing/duplicate/divergent-reference rejection, root-then-partition-then-veto-
  then-finance-then-child locking, exact disposition/child/share/currency proof,
  crash recovery, high-
  fan-out cursor pages, normal direct-plus-multi-asset `E=0` final-release proof,
  parent-only-`E` with unreferenced positive child proof, and no final active-count-
  zero release before the applicable scope seal, parent finance-disposition terminal,
  every referenced-child terminal, and every ordinary-child predicate. If a full child initialization cannot
  finish, require one immutable evidence-linked loss-pending veto bound to the
  parent/partition and block spend, split, restoration, merchant availability,
  settlement, reserve release, payout, and withdrawal until guarded case/fence
  publication. Define receipt-lineage overflow/error/review behavior that still
  acknowledges the authoritative chargeback and globally fences descendants with
  no unbounded transaction. Require partition replay/divergence and crash proof
  between intake and census, including an already-consumed top-up refund-then-
  chargeback `q_asset=0`, one receipt split direct+wallet, multiple backing assets,
  and high fan-out overflow. Require one CAS `q_asset` reservation, asset-version
  fence, immutable lineage index/candidate census, and deterministic conserved
  allocation over unspent value plus consumed source slices. Define
  separate immutable high-water-fenced, cursor/checksumed
  census; bounded prefix-apportionment draft-plan; complete plan-seal; and
  bounded application phases, with no applicable item before plan seal and no
  unbounded single-transaction descendant lock/read requirement. Define its
  per-slice recovery-row
  and internal-refund race behavior for customer-funded, merchant-issued,
  platform-funded, and stored-value issuance lineages, including huge fan-out,
  census/plan/application crash-retry, stale-high-water, already-restored,
  unavailable, and replay cases;
- define transaction entry-kind constraints and mutually exclusive receipt versus
  reversal provenance, including migration/projection of existing separate refund
  transaction rows;
- define immutable historical funded, receipt-only collected, retained, refunded,
  and disputed projections; migrate every `amount_paid`/`payment_status` consumer
  and prove
  that cleanup, reuse, matching, fulfilment, and analytics never reinterpret a
  formerly paid order as unpaid after reversal;
- backfill legacy wallet/savings funding into canonical internal-funding evidence,
  allocation, and immutable source-debit/split graphs; quarantine unprovable orders
  in review and forbid completion from reading raw legacy evidence;
- define the shared safe funding-breakdown projection and migrate API, receipt,
  dashboard, storefront, mobile, analytics, and notification consumers so internal
  value is labeled as applied value rather than a provider receipt and mixed-
  tender reversal destinations remain explicit;
- define disjoint advisory-resource namespaces and the global discovery/
  revalidation and row-lock hierarchy used by every collection-authority and
  money-changing operation, including order, intent/capacity, canonical identity/
  alias, provider-account authority epochs, verified inbox/source proof, SDK
  possible-capture evidence, financial-
  routing proposal, confirmation evidence, accepted routing/origin resolutions,
  quarantine adoption, order-protection claims, ledger, inventory, balance, and
  durable-claim classes; include every checkout subject-component, active
  collision-component root/generation/membership, member domain, and commercial
  bootstrap alias after the complete sorted matching-order set and before
  receiving-intent/provider-reference classes, with identical bounded transitive alias
  resolution in create-order/key rotation and SDK first-report; specify that set
  drift raises a typed whole-transaction abort and only a fresh bounded wrapper
  transaction may retry the same idempotency key. Specify that SDK first-report
  has no standalone source/session advisory: its non-null normalized stable-source
  key is encoded in the provider-reference family, after order advisories, with
  complete discovery and post-acquisition revalidation. Explicitly model the rollout
  row as an authority-issuance-only control-plane precursor acquired before every
  financial advisory lock for attempts and both non-order epoch kinds, forbid its
  acquisition by a financial-lock holder, and keep it out of ordinary completion;
  then define the reconciliation
  decision/obligation schema with nullable
  selected order and immutable zero/one/many candidate snapshot, expected-
  version and idempotency contract, actor/maker-checker policy, mutually
  exclusive outcomes,
  provider executor claims, selected-order-only order locking, post-lock
  candidate/version revalidation, retry semantics, and atomic funds/inventory
  conservation;
- define receipt/replay lock acquisition separately from signed acknowledgement:
  read immutable proof/proposal facts without row locks to discover the complete
  canonical family, acquire and revalidate the full advisory set, lock existing
  canonical identity and transaction rows before source proof/proposal rows, and
  only then create/reuse confirmation evidence and accepted graphs. Specify how
  absent canonical/transaction rows are inserted under the already-held family
  advisory and scoped uniqueness without a source-first existing-row lock, and
  add fault/concurrency tests for existing-evidence, new-evidence, replay, and
  quarantine-adoption paths;
- for every ordinary signed ingress path, require a single explicit sequence: parse and
  freeze the candidate manifest and discover the complete bounded resource/order
  set without writes or row locks; acquire all sorted advisories; revalidate the
  discovered set; lock affected orders canonically; only then insert or reload
  inbox, retained manifest, child proofs, and typed protection claims in global
  row order. Prohibit helpers that upsert source rows before this prefix. Document
  `collision_overflow_frozen` as the sole narrower selected-order/root/anchor/
  reference prefix, available only after the fence is active and financially
  non-authoritative until ordinary post-recovery replay;
- define cleanup's final locked SQL predicate with one captured database
  `cleanup_now`, captured with `clock_timestamp()` only after the complete advisory
  set and order row locks are held and all potentially blocking acquisition is
  finished, immediately before the final claim query: webhook money-ingress claims
  qualify until typed terminal closure,
  while SDK claims qualify only from protected result, authoritative claim/evidence
  linkage, absence of a typed terminal closure, and `cleanup_now < expires_at`.
  Explicitly exclude audit status, webhook ingress cutoff, and the ordinary
  24-hour checkout cutoff from SDK admission and veto. Make the exact boundary
  half-open, atomically project expiry when convenient, and test SDK installer
  races immediately before/at/after 24 hours and its own 48-hour expiry, including
  stale status and a cleanup statement that crosses expiry while waiting for the
  shared lock, plus signed-webhook non-expiring closure. Add terminal-result versus
  cleanup races and direct-SQL wrong-source/order/tenant/orphan/branch tests for
  every closure kind, including proof that retry exhaustion cannot close a claim;
- define `financial_command_executions` intake, source-specific authorization,
  scoped idempotency uniqueness, claim/lease compare-and-set, typed retry and
  backoff state, end-of-hierarchy claim verification, source-tagged required and
  forbidden result IDs, crash recovery,
  maximum-exhaustion review, and stale-worker convergence for explicit
  `webhook_child`, `provider_verification`, `authorized_manual`, `internal_ledger`,
  `authorized_reconciliation`, and `quarantine_adoption` sources; derive adoption
  authority only from the accepted decision, key it by decision plus child, and
  require child source-proof/proposal/manifest links rather than caller-selected
  tenant or route;
- require receipt-authorizing command results to link confirmation evidence and
  receipt transaction, while `internal_ledger` results link internal-funding
  evidence/allocation and are database-forbidden from linking a customer-receipt
  transaction; test every cross-branch nullable/result combination directly.
  Crash/retry tests reload internal funding by command ID and elected internal
  result with no inbox child, while verified-inbox rediscovery rejects every
  source kind except `webhook_child`;
- define the shared completion result as a database-enforced source-tagged union,
  including allowed terminal kinds, branch-required/forbidden payload fields,
  idempotent replay tag retention, and denial of receipt/captured-money artifacts
  for partial or complete internal funding;
- add and validate merchant `business_timezone`, backfill existing merchants to
  explicit UTC, and include confirmation UX;
- make due-date edit and expire-now create half-open assignment epochs, and
  match delayed verified events against the epoch effective at provider
  `paid_at` rather than webhook receipt time;
- define provider timestamp source, precision, timezone, clock-skew allowance,
  uncertainty-interval matching, and boundary-review resolution;
- define exact-balance versus explicit DVA-tranche assignment modes, immutable
  non-overlapping schedule epochs, close-once boundaries, non-authoritative
  schedule-change proposals, atomic activation-time successor creation and
  predecessor closure/future-tranche supersession, one-active-tranche lease,
  attempts and epochs, per-tranche cutoff,
  deferred total/count/sequence/date/link conservation constraints, atomic next-
  tranche activation with overdue refusal, early-payment behavior, amount/
  ambiguity rules, and reject inferred or combined installment matching until a
  separate split contract is reviewed;
- define the one-live-proposal partial unique constraint, immutable proposal
  fields, cancel-and-replace compare-and-set, scoped idempotency replay, unique
  successor link, and terminal-transition arbitration that publishes either the
  successor first tranche or predecessor next tranche but never both; stale
  proposals publish neither and require explicit reviewed resume/cancel/replace;
- update every DVA candidate/filter contract for `partially_paid` next-tranche
  matching, immutable completed tranches, reviewed future-tranche successor
  edits, and uncertainty-interval lower/upper-bound comparisons;
- define new append-only migration files and update migration replay fixtures;
- make foundation migrations strictly expand-only and provider-behavior-neutral:
  new canonical tables/dormant functions first, no legacy grant/trigger/index/
  constraint/fence changes, non-blocking index creation, `NOT VALID` plus later
  validation where supported, bounded backfills, lock/statement timeouts,
  monitoring/abort receipts, and authority-owned post-canary retirement;
- define the non-transactional DDL runner separately from append-only
  transactional migrations: least-privilege identity, immutable manifest and
  operation idempotency key, deployment advisory lock, concurrent-index invalid
  artifact recovery, timeout/resume rules, definition/query readiness checks,
  durable receipts, and activation dependency;
- inventory every pending-transaction producer and consumer by completion
  authority; identify which legacy fields are read, dual-written, provably
  backfilled, checksum-archived, transactionally removed from the active ledger,
  and retired; specify the named read-only compatibility view, attempt-based
  verify/status switch, old-writer shutdown proof, zero-active-pending receipt,
  observability window, and rollback cutoff;
- include regression tests reproducing the proven Credit Direct bookkeeping gap
  and duplicate-order retry shape;
- deliberately replace the existing 14-day Credit Direct explicit SDK-success
  protection with 48 hours, preserve the two-hour unpaid serialized-inventory
  expiry, and update cleanup migration contracts and tests together;
- inventory every Paystack card, order-DVA, wallet-DVA, and agentic-DVA branch
  and prove mutually exclusive route ownership before Stage 3;
- obtain finance/legal approval for inbox and durable financial-record retention,
  define the durable source-manifest projection and checksum gate, make evidence
  reference the retained child proof rather than the prunable inbox, specify
  `SET NULL` only for the manifest's optional inbox link, prohibit required command-
  to-inbox foreign keys and financial cascades/orphans, retain an independently
  unique verified replay key on the manifest, and prove post-pruning redelivery
  reuses all retained child financial artifacts,
  before enabling automated pruning;
- define fallback replay identity as a first-acknowledgement-frozen operational
  locator with an attached immutable ingress-scope snapshot, using explicit
  unresolved sentinels when tenant/provider-account scope is unknown. The unique
  locator must exclude mutable/adopted scope. Adoption, parser enrichment, and
  post-pruning redelivery must resolve it before applying current scope and must
  never update or replace the replay key;
- enumerate new reconciliation issue types, constraint values, resolution
  actions, customer-safe messages, filters, and shared/mobile mappings;
- enumerate side effects by downstream delivery guarantee, persist downstream
  idempotency keys where supported, and define `dispatch_started` plus
  `delivery_unknown` audit/manual-resolution behavior where unsupported;
- define reversal-case-scoped effect identities, trigger states, fiscal/loyalty/
  ad inverse policies, notices, order-lifecycle handoff, unsupported outcomes,
  multi-provider partial-completion gating, and migration compatibility with
  existing cancellation/refund effects;
- define and test the audited expire-invoice-now action separately from due-date
  editing;
- produce a completion-authority-specific forward/rollback compatibility matrix
  before each cutover;
- define per-authority legacy/shadow/canary/active gates with owner-approved
  cohort, minimum sample and duration, parity and latency thresholds, exact-
  reference receipts, soak stages, automatic stop criteria, in-flight generation
  ownership, unrelated-authority isolation, and the post-grandfather/provider-
  retry retirement proof;
- define separate evidenced provider timing policies for checkout reuse,
  SDK-success protection, inventory reservation, session validity, first
  business completion/disbursement, redelivery, automatic processing, rollback,
  and financial retention; unknown completion/redelivery bounds must block
  compatibility retirement while preserving late-money resolution;
- include canonical identity contracts/aliases, intent-capacity claims,
  confirmation evidence, provenance, disposition/components, schedule-change
  proposals/successors, availability, wallet liabilities, reversals, negative-
  balance recovery, and reversal side effects in that matrix, with review-only
  rollback whenever a legacy handler cannot safely consume them;
- include canonical-contract generations/equivalence aliases, durable financial
  commands, provider routing/reference bindings, rollout transitions/timing
  policies, DDL receipts, customer/merchant wallet and payout ledgers,
  maintenance fences, and single-winner schedule proposals in the forward/
  rollback matrix;
- define cutover metrics and zero-tolerance/escalation gates for first-seen
  identity disagreement, canonical collision-domain/subject/request alias
  ambiguity or drift, unknown hash generations, alias collisions, unsafe rotation
  without provider non-capturability proof, lock-set abort/deadlock/exhaustion,
  capacity drift, and pending/failed schedule activation;
- gate command retry/exhaustion durability, contract-generation overlap,
  unfenced wallet/payout writers, maintenance-fence violations, multiple live
  schedule proposals, duplicate successors, and double next-authority publication;
- require exact-reference production verification after every
  completion-authority cutover;
- preserve dirty roots and use isolated worktrees;
- prohibit deployment until current-head code review and CI gates are clean.

## Amendment — Schema-only durable webhook evidence foundation (2026-08-01)

This dated amendment freezes the next append-only, schema-only ingress slice.
It resolves the preflight blocker without authorizing a route, a writer, a
seeded generation, a provider change, a financial command, an RLS policy, or a
deployment. It is additive to, and takes precedence over, earlier prose only
where this amendment gives an exact name, type, bound, or enforcement boundary.
The implementing migration is ordered after both
`20260731140000_payment_ingress_contract_generation_foundation.sql` and
`20260801140000_payment_ingress_contract_companion.sql`; it must fail its replay
fixture before either prerequisite exists.

### Scope and common primitives

The migration creates exactly these empty relations:

- `private.payment_webhook_inbox`;
- `private.payment_webhook_source_manifests`; and
- `private.payment_webhook_source_proofs`.

It may add the one redundant unique target specified below to
`private.payment_ingress_contract_generations`; it creates no other relation,
role, function, trigger, policy, grant, seed, runtime code, generated type, or
provider behavior. All UUID defaults below are `gen_random_uuid()` and all
timestamps are `timestamptz`.

Unless a more specific check is named, canonical ingress keys (`provider`,
`endpoint_key`, `signature_key_scope`, and `completion_authority_key`) match
`^[a-z][a-z0-9_.:-]{0,254}$`. A contract/version or normalised reference is
byte-preserved, equals its `btrim` value, is non-empty, and has the stated
maximum length. `sha256` values are lower-case 64-hex text matching
`^[0-9a-f]{64}$`; no digest prefix, base64 value, or upper-case form is stored.
Currencies are upper-case ISO-4217 text matching `^[A-Z]{3}$`. Integer money is
minor-unit `bigint`; a non-positive amount is rejected. No table contains a raw
body, signature, credential, secret, ciphertext, card data, full customer
address, or provider response body.

`private.payment_ingress_contract_generations` receives the redundant named
unique constraint
`payment_ingress_contract_generations_evidence_binding_key` on
`(id, provider, endpoint_key, signature_key_scope, authority_key,
signature_key_identity_id, generation, parser_contract_version,
normalized_envelope_schema_version, replay_identity_contract_version)`. Every
generation FK below is `DEFERRABLE INITIALLY DEFERRED`, has `ON DELETE RESTRICT`,
and targets that exact key. This is the composite equality contract: a child
cannot name a generation while changing its provider, endpoint, signature scope,
authority classifier, signature-key identity, generation number, adapter/parser
version, envelope version, or replay-identity version.

### Replay identity — tagged union, canonical preimages, and sentinels

Both parent relations copy the same immutable `replay_key_kind`,
`replay_key_digest`, and `replay_key_preimage`. `replay_key_kind` is exactly
`svix | account_reference | fallback_locator`; `replay_key_digest` is the
SHA-256 of the UTF-8 RFC 8785 canonical JSON representation of the corresponding
object below. The stored `replay_key_preimage` is that safe JSON object, not raw
request payload. Its root must be a JSON object and its `v` value must be the
JSON number `1`; the version-specific ingress validator computes the digest and
compares it before insertion. PostgreSQL checks shape and digest syntax, not a
false `jsonb::text` canonicalisation claim.

The precise v1 preimages are:

```json
{"v":1,"kind":"svix","provider":"<provider>","endpoint_key":"<endpoint_key>","signature_key_scope":"<signature_key_scope>","completion_authority_key":"<completion_authority_key>","svix_id":"<verified svix-id>","event_type":"<event type>"}
{"v":1,"kind":"account_reference","provider":"<provider>","completion_authority_key":"<completion_authority_key>","provider_account_scope":"<verified account scope or __unresolved__>","provider_reference":"<verified normalized reference>","event_type":"<event type>"}
{"v":1,"kind":"fallback_locator","provider":"<provider>","endpoint_key":"<endpoint_key>","signature_key_scope":"<signature_key_scope>","completion_authority_key":"<completion_authority_key>","event_type":"<event type>","reference":"<normalized reference or __unresolved__>","amount_minor":"<base-10 integer>","currency":"<ISO-4217>","provider_paid_at":"<RFC3339 UTC instant or __unresolved__>","raw_body_sha256":"<64 lower hex>"}
```

The key order shown is only explanatory: the canonical bytes are RFC 8785 bytes.
The `svix_id`, account scope, reference, and event type are verified/normalised
adapter facts, not request-selected values. `amount_minor` is a JSON string in
the preimage to avoid JSON-number implementation variance; it is the decimal
rendering of the persisted positive bigint. `__unresolved__` is the exact
sentinel, may appear only in the fields shown, and means "unknown at first
acknowledgement". Merchant ID, adopted tenant/account data, a later routing
decision, an attempt, a financial-routing generation, and a future parser
enrichment never enter any digest preimage. A verified first-ack account scope
may enter only the `account_reference` kind; an adopted account may not replace
it. The fallback locator is operational replay identity only, never a confirmed
money identity.

`replay_key_preimage` must contain exactly the fields for its tagged kind (no
extension fields). `svix_id` and `provider_reference` are trimmed non-empty text
of at most 512 characters. A fallback reference is the same bound or the exact
sentinel. An event type is trimmed non-empty text of at most 255 characters.
The ingress-scope snapshot is separate JSON and must contain exactly
`merchant_id` and `provider_account_scope`, each either a canonical first-ack
value or `__unresolved__`; it is evidence only and is excluded from the fallback
digest. This makes unscoped acknowledgement, later adoption, and post-pruning
redelivery reload the same immutable manifest before applying newly learned
scope.

The table-level JSON predicates are frozen as follows. The inbox and manifest
checks named `*_replay_preimage_check` must require
`jsonb_typeof(replay_key_preimage) = 'object'`,
`jsonb_typeof(replay_key_preimage->'v') = 'number'`,
`replay_key_preimage->>'v' = '1'`,
`replay_key_preimage->>'kind' = replay_key_kind`, and the exact key set for the
tag: eight keys (`v, kind, provider, endpoint_key, signature_key_scope,
completion_authority_key, svix_id, event_type`) for `svix`; seven keys
(`v, kind, provider, completion_authority_key, provider_account_scope,
provider_reference, event_type`) for `account_reference`; and twelve keys
(`v, kind, provider, endpoint_key, signature_key_scope,
completion_authority_key, event_type, reference, amount_minor, currency,
provider_paid_at, raw_body_sha256`) for `fallback_locator`. The exact-key
predicate is written with only native PostgreSQL operators: after the
root/type checks, the required-key array must be present with `?&`, and
subtracting that same array with the `jsonb - text[]` operator must equal
`'{}'::jsonb`. The concrete arrays are frozen per tag. For `svix` the CHECK
uses `ARRAY['v','kind','provider','endpoint_key','signature_key_scope',
'completion_authority_key','svix_id','event_type']::text[]`; for
`account_reference` it uses
`ARRAY['v','kind','provider','completion_authority_key',
'provider_account_scope','provider_reference','event_type']::text[]`; and for
`fallback_locator` it uses
`ARRAY['v','kind','provider','endpoint_key','signature_key_scope',
'completion_authority_key','event_type','reference','amount_minor','currency',
'provider_paid_at','raw_body_sha256']::text[]`. Each selected array appears
once in `?&` and once in `-`; this proves both that every required key exists
and that no extension key is present without relying on a nonexistent
object-length function. Every non-`v` key in the selected array must also
have an explicit `jsonb_typeof(replay_key_preimage->'<key>') = 'string'`
conjunct in the table CHECK; the later adapter/writer checks tagged-field
formats, RFC-8785 bytes, digest equality, and sentinel placement.

The inbox and manifest checks named `*_ingress_scope_snapshot_check` must
require a JSON object with exactly two keys (`merchant_id` and
`provider_account_scope`), both JSON strings, each either the exact
`__unresolved__` sentinel or its canonical trimmed value; the exact-key
predicate is
`ingress_scope_snapshot ?&
ARRAY['merchant_id','provider_account_scope']::text[] AND
ingress_scope_snapshot -
ARRAY['merchant_id','provider_account_scope']::text[] = '{}'::jsonb`, with
`jsonb_typeof(ingress_scope_snapshot->'merchant_id') = 'string'` and
`jsonb_typeof(ingress_scope_snapshot->'provider_account_scope') = 'string'`.
The inbox check named `payment_webhook_inbox_envelope_check` must require a JSON
object with exactly eight top-level keys
(`contract_version,event_type,receiver,provider_customer,assignment,economics,
paid_time,children`), string `contract_version` and `event_type`, object-or-null
values for the five named evidence objects, and an array `children`; its exact
top-level predicate is
`normalized_envelope ?& ARRAY['contract_version','event_type','receiver',
'provider_customer','assignment','economics','paid_time','children']::text[]
AND normalized_envelope - ARRAY['contract_version','event_type','receiver',
'provider_customer','assignment','economics','paid_time','children']::text[]
= '{}'::jsonb`, with
`jsonb_typeof(normalized_envelope->'contract_version') = 'string'`,
`jsonb_typeof(normalized_envelope->'event_type') = 'string'`,
`jsonb_typeof(normalized_envelope->'receiver') IN ('object','null')`,
`jsonb_typeof(normalized_envelope->'provider_customer') IN ('object','null')`,
`jsonb_typeof(normalized_envelope->'assignment') IN ('object','null')`,
`jsonb_typeof(normalized_envelope->'economics') IN ('object','null')`,
`jsonb_typeof(normalized_envelope->'paid_time') IN ('object','null')`, and
`jsonb_typeof(normalized_envelope->'children') = 'array'`. The manifest's
`redacted_parent_source_identity_check` must require a JSON object whose keys
are all drawn from the five safe v1 keys
`event_type,provider_reference,receiver_reference,provider_customer_reference,
provider_paid_at`; the native subtraction check
`redacted_parent_source_identity - ARRAY['event_type','provider_reference',
'receiver_reference','provider_customer_reference','provider_paid_at']::text[]
= '{}'::jsonb` rejects every unknown key and therefore proves the at-most-five
bound. For each allowed key, when present, the value must satisfy
`jsonb_typeof(redacted_parent_source_identity->'<key>') IN ('string','null')`;
missing allowed keys remain valid.
These predicates protect the structural boundary only; recursive safe-field
validation, prohibited nested data, and digest/replay comparisons remain the
explicit adapter/guarded-writer enforcement locus.

### `private.payment_webhook_inbox`

The operational, prunable parent has exactly these columns:

| Column | SQL type and nullability/default |
| --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |
| `provider`, `endpoint_key`, `signature_key_scope`, `completion_authority_key` | `text not null` |
| `signature_key_identity_id` | `uuid not null` |
| `ingress_contract_generation_id` | `uuid not null` |
| `ingress_contract_generation` | `bigint not null` |
| `adapter_schema_version`, `normalized_envelope_schema_version`, `replay_identity_contract_version` | `text not null` |
| `replay_key_kind` | `text not null` |
| `replay_key_digest` | `text not null` |
| `replay_key_preimage`, `ingress_scope_snapshot`, `normalized_envelope` | `jsonb not null` |
| `normalized_envelope_sha256`, `raw_body_sha256` | `text not null` |
| `event_type` | `text not null` |
| `provider_reference` | `text` |
| `amount_minor` | `bigint` |
| `currency` | `text` |
| `provider_paid_at`, `provider_received_at` | `timestamptz` |
| `verified_at` | `timestamptz not null` |
| `merchant_id` | `uuid` |
| `provider_account_scope` | `text` |
| `source_manifest_id` | `uuid not null` |
| `capture_mode` | `text not null` |
| `child_manifest_sha256` | `text not null` |
| `child_count` | `integer not null` |
| `manifest_amount_minor` | `bigint not null` |
| `manifest_currency` | `text not null` |
| `processing_status` | `text not null default 'received'` |
| `processing_attempt_count` | `integer not null default 0` |
| `last_error` | `text` |
| `processed_at` | `timestamptz` |
| `claim_installed_child_count`, `no_safe_order_claim_child_count`, `late_ingress_child_count`, `not_order_protecting_child_count` | `integer not null default 0` |
| `intake_protection_complete` | `boolean not null default false` |
| `received_at`, `created_at`, `updated_at` | `timestamptz not null default now()` |

`provider_reference`, when present, is trimmed non-empty and at most 512
characters. `provider_account_scope`, when present, is trimmed non-empty and at
most 255 characters. `adapter_schema_version` is the copied
`parser_contract_version` and has the common 255-character version bound.
`normalized_envelope_sha256`, `raw_body_sha256`, and
`child_manifest_sha256` use the common digest check. `amount_minor` and
`currency` are both null or both non-null; the former is positive whenever
present. `manifest_amount_minor` is positive. `child_count` is between 1 and 64.
`capture_mode` is exactly `singleton | bounded_multi_capture`, and `singleton`
requires `child_count = 1`. `manifest_currency` has the common currency check.

`processing_status` is exactly `received | unscoped_quarantine |
intake_protection_recorded | resolution_proposed |
scope_adopted_receipt_pending | resolved | conflict_review | terminal_processed`.
`processing_attempt_count` is 0 through 2,147,483,647. `last_error`, when
present, is trimmed non-empty and at most 4096 characters. Every decision counter
is non-negative and no greater than `child_count`; when
`intake_protection_complete` is true their sum must equal `child_count`. The
later writer slice, not a table CHECK, proves that these projections equal actual
child rows and that status transitions/`processed_at` are legal.

The named constraints are
`payment_webhook_inbox_provider_check`,
`payment_webhook_inbox_endpoint_key_check`,
`payment_webhook_inbox_signature_scope_check`,
`payment_webhook_inbox_authority_key_check`,
`payment_webhook_inbox_generation_fkey`,
`payment_webhook_inbox_replay_kind_check`,
`payment_webhook_inbox_replay_digest_check`,
`payment_webhook_inbox_replay_preimage_check`,
`payment_webhook_inbox_ingress_scope_snapshot_check`,
`payment_webhook_inbox_envelope_check`,
`payment_webhook_inbox_hashes_check`,
`payment_webhook_inbox_event_type_check`,
`payment_webhook_inbox_reference_check`,
`payment_webhook_inbox_amount_currency_check`,
`payment_webhook_inbox_manifest_check`,
`payment_webhook_inbox_processing_check`,
`payment_webhook_inbox_error_check`,
`payment_webhook_inbox_decision_projection_check`, and
`payment_webhook_inbox_source_manifest_fkey`.

The named indexes are unique
`payment_webhook_inbox_replay_key_uq` on `(replay_key_kind, replay_key_digest)`,
unique `payment_webhook_inbox_manifest_binding_uq` on
`(id, source_manifest_id, replay_key_kind, replay_key_digest, provider,
endpoint_key, signature_key_scope, completion_authority_key,
signature_key_identity_id, ingress_contract_generation, adapter_schema_version,
normalized_envelope_schema_version, replay_identity_contract_version)`, and
non-unique `payment_webhook_inbox_processing_idx` on
`(processing_status, received_at, id)`. The latter is operational only; it is not
a financial-routing index.

### `private.payment_webhook_source_manifests`

The financially retained parent copies the verified ingress identity independently
of the inbox. It has exactly these columns:

| Column | SQL type and nullability/default |
| --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |
| `inbox_id` | `uuid` |
| `provider`, `endpoint_key`, `signature_key_scope`, `completion_authority_key` | `text not null` |
| `signature_key_identity_id`, `ingress_contract_generation_id` | `uuid not null` |
| `ingress_contract_generation` | `bigint not null` |
| `adapter_schema_version`, `normalized_envelope_schema_version`, `replay_identity_contract_version` | `text not null` |
| `replay_key_kind`, `replay_key_digest` | `text not null` |
| `replay_key_preimage`, `ingress_scope_snapshot` | `jsonb not null` |
| `merchant_id` | `uuid` |
| `provider_account_scope` | `text` |
| `capture_mode` | `text not null` |
| `child_manifest_sha256` | `text not null` |
| `child_count` | `integer not null` |
| `amount_minor` | `bigint not null` |
| `currency` | `text not null` |
| `contract_bound_minor` | `bigint not null` |
| `redacted_parent_source_identity` | `jsonb not null` |
| `created_at` | `timestamptz not null default now()` |

All shared scope, generation, replay, preimage, snapshot, hash, currency,
reference, count, and capture-mode checks have the same values/bounds as the
inbox. `amount_minor` and `contract_bound_minor` are positive; a singleton has
one child. `redacted_parent_source_identity` is a JSON object and may contain
only the safe v1 keys `event_type`, `provider_reference`, `receiver_reference`,
`provider_customer_reference`, and `provider_paid_at`; values are scalars or
null, never a raw payload or identity document. The later writer establishes the
semantic equality of the manifest fields to its inbox and validates the complete
redaction allowlist before write.

Named constraints are
`payment_webhook_source_manifests_provider_check`,
`payment_webhook_source_manifests_endpoint_key_check`,
`payment_webhook_source_manifests_signature_scope_check`,
`payment_webhook_source_manifests_authority_key_check`,
`payment_webhook_source_manifests_generation_fkey`,
`payment_webhook_source_manifests_replay_kind_check`,
`payment_webhook_source_manifests_replay_digest_check`,
`payment_webhook_source_manifests_replay_preimage_check`,
`payment_webhook_source_manifests_scope_snapshot_check`,
`payment_webhook_source_manifests_economics_check`,
`payment_webhook_source_manifests_parent_identity_check`, and
`payment_webhook_source_manifests_inbox_fkey`.

Named indexes are unique `payment_webhook_source_manifests_replay_key_uq` on
`(replay_key_kind, replay_key_digest)`, unique
`payment_webhook_source_manifests_inbox_target_uq` on
`(id, replay_key_kind, replay_key_digest, provider, endpoint_key,
signature_key_scope, completion_authority_key, signature_key_identity_id,
ingress_contract_generation, adapter_schema_version,
normalized_envelope_schema_version, replay_identity_contract_version)`, unique
`payment_webhook_source_manifests_binding_uq` on
`(id, replay_key_kind, replay_key_digest, provider, endpoint_key,
signature_key_scope, completion_authority_key, signature_key_identity_id,
ingress_contract_generation, adapter_schema_version,
normalized_envelope_schema_version, replay_identity_contract_version, currency)`,
unique `payment_webhook_source_manifests_currency_target_uq` on `(id, currency)`,
and `payment_webhook_source_manifests_provider_account_idx` on
`(provider, provider_account_scope, created_at, id)`.

### Inbox/manifest cycle and retention behaviour

The cyclic link is intentional and fully specified. The inbox's
`(source_manifest_id, replay_key_kind, replay_key_digest, provider,
endpoint_key, signature_key_scope, completion_authority_key,
signature_key_identity_id, ingress_contract_generation, adapter_schema_version,
normalized_envelope_schema_version, replay_identity_contract_version)` is a
deferrable composite FK to
`payment_webhook_source_manifests_inbox_target_uq`. The manifest's
`(inbox_id, id, replay_key_kind, replay_key_digest, provider,
endpoint_key, signature_key_scope, completion_authority_key,
signature_key_identity_id, ingress_contract_generation, adapter_schema_version,
normalized_envelope_schema_version, replay_identity_contract_version)` is a
deferrable composite FK to
`payment_webhook_inbox_manifest_binding_uq`, with
`ON DELETE SET NULL` applied only to `inbox_id` (the remaining copied columns
are retained). The first FK uses `ON DELETE RESTRICT`. Both are initially
deferred.

The sole valid insert sequence is: create the manifest with `inbox_id null`;
create the inbox pointing at that manifest; then set the manifest's `inbox_id`
before commit. A later retained-manifest replay may create a new inbox pointing
to it and atomically replace the nullable operational link; the writer must not
change a manifest's replay/evidence fields. Deleting an inbox nulls the manifest
link and cannot delete, null, or cascade to a manifest/proof. A manifest cannot
be deleted while referenced by an inbox or a proof. No financial command or
financial authority may carry a required FK to the inbox.

### `private.payment_webhook_source_proofs`

Each immutable child proof has exactly these columns:

| Column | SQL type and nullability/default |
| --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` |
| `source_manifest_id` | `uuid not null` |
| `child_identity` | `text not null` |
| `child_ordinal` | `integer not null` |
| `child_reference` | `text` |
| `capture_identity` | `text not null` |
| `amount_minor` | `bigint not null` |
| `currency` | `text not null` |
| `provider_paid_at` | `timestamptz` |
| `paid_time_precision` | `text not null` |
| `child_sha256` | `text not null` |
| `intake_decision` | `text not null` |
| `decided_at` | `timestamptz not null` |
| `decision_reason_code` | `text not null` |
| `review_scope_kind` | `text not null` |
| `review_id` | `uuid` |
| `created_at` | `timestamptz not null default now()` |

`child_identity` matches `^[a-z][a-z0-9_.:-]{0,254}$`; a singleton manifest's
only child is named exactly `singleton` (enforced by the later cross-row writer).
`child_ordinal` is 1 through 64. `child_reference`, when present, is trimmed
non-empty and at most 512 characters; `capture_identity` is trimmed non-empty
and at most 512 characters. `paid_time_precision` is exactly
`exact | second | minute | day | unknown`. `decision_reason_code` matches
`^[a-z][a-z0-9_]{0,63}$`.

`intake_decision` is exactly `claim_installed | no_safe_order_claim |
late_ingress | not_order_protecting`; there is deliberately no `claim_pending`.
`review_scope_kind` is exactly `none | merchant_reconciliation |
global_quarantine`. The named
`payment_webhook_source_proofs_decision_shape_check` requires
`claim_installed` and `not_order_protecting` to use `review_scope_kind='none'`
with `review_id is null`; `no_safe_order_claim` and `late_ingress` to use either
non-`none` scope with non-null `review_id`; and no other combination. The review
ID is an opaque durable review reference in this slice: its target FK and the
proof that its tenant/scope matches are deferred until the review registry and
guarded writer land. `claim_installed` stores no order or claim ID here; that
later child-only claim graph must be one-to-zero-or-one and can never grant
financial routing, an attempt, a transaction, allocation, completion, or
fulfilment authority.

The named constraints are
`payment_webhook_source_proofs_manifest_fkey`,
`payment_webhook_source_proofs_child_identity_check`,
`payment_webhook_source_proofs_ordinal_check`,
`payment_webhook_source_proofs_reference_check`,
`payment_webhook_source_proofs_capture_identity_check`,
`payment_webhook_source_proofs_amount_check`,
`payment_webhook_source_proofs_currency_fkey`,
`payment_webhook_source_proofs_paid_precision_check`,
`payment_webhook_source_proofs_hash_check`,
`payment_webhook_source_proofs_decision_check`,
`payment_webhook_source_proofs_reason_check`,
`payment_webhook_source_proofs_review_scope_check`, and
`payment_webhook_source_proofs_decision_shape_check`. The manifest FK is
`ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`; the currency FK is a
deferrable composite FK `(source_manifest_id, currency)` to the named manifest
unique target `payment_webhook_source_manifests_currency_target_uq`, preventing
a child from changing the conserved currency.

Named indexes are unique `payment_webhook_source_proofs_manifest_child_uq` on
`(source_manifest_id, child_identity)`, unique
`payment_webhook_source_proofs_manifest_ordinal_uq` on
`(source_manifest_id, child_ordinal)`, unique
`payment_webhook_source_proofs_manifest_capture_uq` on
`(source_manifest_id, capture_identity)`, and
`payment_webhook_source_proofs_decision_idx` on
`(intake_decision, review_scope_kind, decided_at, id)`.

### Cardinality, conservation, envelope boundary, and deliberate deferral

The contract is singleton-or-bounded-multi-capture only. A singleton has exactly
one `singleton` child with ordinal one. A bounded multi-capture manifest has 1 to
64 distinct, contiguous, provider-derived child identities/ordinals. Each child
has a positive canonical amount in the manifest currency. The sum of child
amounts must exactly equal `payment_webhook_source_manifests.amount_minor`, and
that amount must be less than or equal to `contract_bound_minor`; no upper-bound
interpretation permits an unrecorded child. The manifest hash is SHA-256 of the
RFC-8785 canonical JSON array of child objects sorted by ordinal, each exactly
`{"child_identity":...,"capture_identity":...,"amount_minor":"...",
"currency":...,"provider_paid_at":...,"paid_time_precision":...,"child_sha256":...}`.
The singleton identity and this projection are deterministic replay facts.

The v1 `normalized_envelope` is a closed, versioned worker contract. Its root
has exactly `contract_version`, `event_type`, `receiver`, `provider_customer`,
`assignment`, `economics`, `paid_time`, and `children`; values are safe scalar,
null, or versioned safe objects only. It may not include `raw_body`, `signature`,
`authorization`, `credential`, `secret`, `card`, `address`, or any unknown
top-level key. The verified ingress adapter, before it starts the one
acknowledgement transaction, is the enforcement locus: it validates the chosen
generation's version-specific closed schema, normalises facts, rejects prohibited
data, computes the envelope and manifest digests, and supplies only those frozen
values. The later private guarded intake writer repeats the structural allowlist,
generation equality, digest comparison, replay conflict comparison, and complete
child decision checks under the acknowledgement transaction. Comments and API
validation alone are insufficient and do not authorize a direct table write.

This migration intentionally does **not** add triggers or writers. Therefore the
following cross-row/temporal invariants are explicitly deferred to the next
RED-first guarded intake-writer slice: RFC-8785 digest equality; exact
inbox-to-manifest projection equality beyond the cyclic composite FKs; one active
operational inbox link per retained manifest; contiguous children; singleton
identity; full child count, child hash, and amount conservation; contract-bound
evaluation; exactly one terminal decision per frozen child; decision-counter and
`intake_protection_complete` truth; review target/tenant equality; append-only
fields; legal processing-status transitions; allowed replay replacement after
pruning; and all claim/order/financial-command authority. Until that writer and
its direct-SQL denial tests exist, these tables are dormant retained evidence,
not acknowledgement or financial authority.

Each new relation enables and forces RLS, has zero policies, and revokes all
table privileges from `PUBLIC`, `anon`, `authenticated`, `service_role`, and
`payment_control_plane`; no application role receives a grant and schema-level
`private` privileges are unchanged. Required comments are: inbox —
"Operational webhook replay infrastructure, never completion or financial
authority; raw bodies, signatures, credentials, secrets, card data, and full
customer addresses are forbidden."; manifest — "Financial-retention ingress
evidence independent of the prunable inbox, never completion authority."; and
proof — "Immutable child ingress evidence and terminal intake-protection
decision, never a financial routing, attempt, transaction, allocation, or
completion authority." The migration/replay contract must prove exact catalog
shape, forced RLS, zero policies, zero rows, direct privilege denial, all named
constraints/indexes/comments, cycle deletion behavior, valid/invalid tagged keys,
and rollback cleanliness. Its negative replay fixtures must separately exercise
each closed-object boundary: a missing required key, an unknown extension key,
and a non-string value for every tagged replay preimage; a missing or unknown
scope/envelope key; a non-string value for each of
`merchant_id` and `provider_account_scope`; a non-string `contract_version` and
`event_type`; a non-object/non-null value for each of `receiver`,
`provider_customer`, `assignment`, `economics`, and `paid_time`; a non-array
`children`; and an unknown or non-string/non-null redacted parent value. Each
case must fail at its named table CHECK, while valid sentinel/scalar, object-or-
null, and array forms pass. The migration must not claim deferred writer
invariants as table CHECK coverage.
