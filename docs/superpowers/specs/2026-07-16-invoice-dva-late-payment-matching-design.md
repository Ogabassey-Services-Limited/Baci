# Invoice DVA Late-Payment Matching Design

Date: 2026-07-16

## Problem

Paystack Dedicated Virtual Accounts can be reused for the same customer. Baci
currently distinguishes invoice payments using the receiving account, exact
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
3. Fail safely when two genuinely indistinguishable open invoices exist.
4. Make every verified but unmatched Paystack payment operationally visible.
5. Preserve the existing idempotent paid-order finalization, notification,
   settlement, inventory, and side-effect pipeline.

## Non-goals

- Creating a unique Paystack DVA for every invoice. Paystack can return an
  existing customer DVA, so Baci must safely support account reuse.
- Guessing between two open invoices with the same receiving account, customer
  email, and outstanding amount.
- Automatically batch-reconciling historical reviews without individually
  verifying their Paystack references and intended orders.
- Changing card, Korapay, BNPL, wallet, or manual-payment matching behavior.

## Considered Approaches

### Extend the time window

Increasing 90 minutes to 24 hours or several days would reduce failures but
would retain the same arbitrary cutoff. A valid invoice payment could still
arrive later and fail. This approach is rejected.

### Match while the invoice remains payable

Use the persisted DVA identity, exact outstanding amount, customer email,
payment timestamp lower bound, and current order state. Do not impose an upper
time bound while the order remains eligible. This is the selected approach.

### Require one DVA per invoice

This would simplify matching but conflicts with Paystack's customer-DVA reuse
behavior and adds provider and lifecycle complexity. It is not required when
the existing identity fields can produce a unique safe match.

## Matching Contract

The webhook will load `order_payment_accounts` rows for the verified Paystack
receiving account and provider, joined to their orders. Cancelled and other
terminal orders must be excluded at the database-query boundary where
possible, then rejected again by the matcher as defense-in-depth. A cancelled
invoice is never a payment candidate and must never be reopened.

A candidate is eligible only when all of the following are true:

1. The order is active and payable. Cancelled orders are unconditionally
   ineligible, regardless of account, amount, email, or payment timestamp.
2. The order is not fully paid or refunded.
3. The order still has a positive outstanding balance.
4. The verified Paystack amount equals the invoice's exact outstanding amount
   within the existing one-kobo tolerance.
5. The Paystack customer email equals the order customer email after trimming
   and case normalization.
6. The Paystack `paid_at` timestamp is not earlier than the account assignment
   timestamp. `assigned_at` is preferred; `created_at` remains the legacy
   fallback.

There is no upper payment-age limit while those conditions remain true.
`expires_at` may continue to support invoice display or reminder lifecycle, but
it must not override a still-payable, uniquely matching invoice.

The outstanding amount is resolved in this order:

1. Persisted `order_payment_accounts.payable_amount`, when valid.
2. Otherwise `orders.total - orders.amount_paid`, clamped at zero.

New DVA assignments must persist:

- `assigned_at`
- the exact `payable_amount`
- the receiving account identity

Existing rows remain compatible through the legacy fallbacks.

## Match Outcomes

### Exactly one eligible invoice

Create or reuse the Paystack payment transaction using the external Paystack
reference, then continue through the existing atomic gateway finalizer.

The existing finalizer remains responsible for:

- changing the order and transaction to paid/completed;
- inventory confirmation;
- customer paid-order email;
- merchant new-order and payment-received pushes;
- merchant settlement;
- ad conversion and other idempotent side effects.

Webhook retries must remain harmless through the existing transaction and
side-effect idempotency boundaries.

### Multiple eligible invoices

Do not select one automatically. Persist a `payment_match_ambiguous`
reconciliation review containing:

- `merchant_id`;
- Paystack reference;
- receiving account;
- customer email;
- verified amount and paid timestamp;
- every candidate order ID and order number.

Send one operational alert for the unresolved review. No customer payment
confirmation is sent until an operator chooses the intended invoice.

### No eligible invoice

Persist a `payment_match_zero_candidates` review with the same verified payment
evidence and any near-match diagnostics, including candidates rejected because
of order state, email, or amount.

The review must no longer be silent:

- emit an error-level structured production log;
- notify platform operations immediately;
- notify the merchant when the receiving account can identify a merchant;
- deduplicate alerts by the open review's Paystack reference.

The webhook can still acknowledge the verified event after durable review and
alert persistence, preventing an uncontrolled Paystack retry storm.

## Current Incident Recovery

After the prevention change is deployed, recover
`ORD-150726-F2D98D` through the audited Paystack DVA reconciliation path:

1. Re-verify Paystack reference `000013260715125423000067116596`.
2. Confirm the exact amount, currency, customer email, receiving DVA, and
   payable order.
3. Atomically complete the existing pending transaction and order.
4. Run the canonical paid-order side effects.
5. Verify the customer email, merchant pushes, and settlement records.
6. Resolve the existing reconciliation review with the repair evidence.

Other historical zero-candidate reviews must be evaluated individually rather
than automatically included in this repair.

## Testing

### Matcher unit tests

- A unique exact payment still matches after 90 minutes.
- A unique exact payment matches several days later while the invoice is
  pending.
- A payment before account assignment is rejected.
- Cancelled, fully paid, and zero-balance invoices are rejected.
- The exact outstanding balance is used instead of the original total.
- Two identical eligible invoices return an ambiguous result.
- Account reuse across an old cancelled invoice and a current payable invoice
  proves the cancelled row is never a candidate and selects only the current
  invoice.

### Webhook tests

- Reproduce the July 15 incident shape and prove the webhook completes the
  order rather than filing a zero-candidate review.
- Prove the canonical finalizer and notification scheduling are invoked once.
- Prove a replay is idempotent.
- Prove an ambiguous payment creates one detailed review and one alert.
- Prove a zero-candidate payment creates one detailed review and one alert.

### DVA creation tests

- Both invoice-DVA creation paths persist `assigned_at` and
  `payable_amount`.
- Existing DVA retrieval remains idempotent.
- Partially paid invoices persist only their remaining payable balance.

## Rollout and Verification

1. Capture the current open Paystack reconciliation-review count.
2. Deploy through the required prebuilt production flow.
3. Run a controlled late-payment test against a pending test invoice.
4. Verify order, transaction, side-effect, email, push-attempt, and settlement
   records.
5. Repair and verify Tony's production order using the audited recovery steps.
6. Monitor production logs and reconciliation reviews for at least one payment
   cycle.

Success means a valid uniquely matching late invoice transfer confirms
automatically, all expected notifications run, and unmatched successful
payments can no longer remain operationally silent.
