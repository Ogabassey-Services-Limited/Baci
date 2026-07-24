# S0-B runbook — retire the anon `merchants` bank/receipt bridge

**Scope:** the remaining, ordered sequence to complete S0-B — migrate receipt/bank
reads onto an authorization-scoped server boundary, ship the mobile releases,
flip the mandatory min-version gate, then revoke the S0-A anon bank/contact
column grant. Mobile app releases and store submissions are **owner-owned**
(out of scope for the server work); this runbook lists them as gates the server
work depends on.

**Owner:** ogabasseyy · **Bridge removal deadline:** 2026-08-24 (S0-A section (d)).

---

## What already shipped (server side, this PR)

- **Order-scoped RPC** `public.get_order_receipt_bank_details(p_order_id uuid, p_tracking_token text)`
  — `supabase/migrations/20260724120000_order_scoped_receipt_bank_details_rpc.sql`.
  SECURITY DEFINER, `search_path=''`. Authorizes by (a) the order's unguessable
  `tracking_token` (guest), (b) the owning customer (`customers.user_id = auth.uid()`),
  or (c) the order's merchant owner/active staff (`public.has_merchant_access`).
  Returns only the fixed 20-field receipt/bank projection for THAT order's
  merchant. `anon` may EXECUTE (guest checkout) but gets 0 rows without a valid
  capability. Registered in the history-replay manifest (PENDING).
- **Route Handler** `GET /api/storefront/orders/[id]/receipt-bank-details`
  (`apps/web/src/app/api/storefront/orders/[id]/receipt-bank-details/route.ts`)
  — Zod-validated, request-scoped Supabase client (never service-role), 401 when
  neither a token nor a session is present, 404 fail-closed otherwise. This is
  the endpoint the mobile app switches to.
- **Release-policy evaluator** `apps/web/src/lib/mobile-release-policy-evaluation.ts`
  — pure, unit-tested min-version/min-build gate consumed by
  `/api/mobile/release-policy`. Config-driven and permissive by default
  (both flags `false` with nothing configured), so this is safe to merge before
  any release exists.
- **DRAFT revoke** `docs/architecture/discovery/S0B-final-revoke-DRAFT.sql`
  (DO-NOT-MERGE; promote only after step 4 below).

---

## Remaining sequence

### Step 1 — Mobile clients read receipt/bank ONLY via the order-scoped boundary  *(mobile PR; owner-owned)*
Switch `mobile-storefront` `hooks/use-receipts.ts` (`useMerchantReceiptInfo`) from
`rpc('get_storefront_receipt_merchant_info', { p_slug })` to the order-scoped
read: either `rpc('get_order_receipt_bank_details', { p_order_id, p_tracking_token })`
directly, or the Route Handler above. The receipt screen already holds the order
id and its `tracking_token`, so this is a drop-in — the return shape is identical.
Do the same for any admin receipt/bank surface.

Verify (staging build, signed-out + signed-in):
```
# guest capability
curl -s "$BASE/api/storefront/orders/$ORDER_ID/receipt-bank-details?token=$TRACKING_TOKEN" | jq .
# expect 200 + bank_account_number present

# wrong token -> 404, no leak
curl -s -o /dev/null -w '%{http_code}\n' \
  "$BASE/api/storefront/orders/$ORDER_ID/receipt-bank-details?token=wrong"
# expect 404

# no token, no session -> 401
curl -s -o /dev/null -w '%{http_code}\n' \
  "$BASE/api/storefront/orders/$ORDER_ID/receipt-bank-details"
# expect 401
```

### Step 2 — Close the guest-checkout anon bank read  *(server PR)*
Move the `POST /api/orders` merchant verification lookup off the anon cookie
client onto `createAdminClient()` (same fix class as #3063), so a signed-out
shopper never reads merchant bank columns through the anon key. This is the
second of the two anon readers keeping the S0-A bridge alive (S0-A section (d)).

Verify: grep confirms no anon/`createClient(cookies)` path selects `bank_*` /
`cac_rc_number` / `registered_address` / `email_sender_name` from `merchants`:
```
rg -n "from\('merchants'\)" apps/web/src | rg -i "bank_|cac_rc|registered_address|email_sender"
```

### Step 3 — Ship mobile releases and flip the mandatory gate  *(owner-owned release + server config)*
1. Release `mobile-storefront` (and `mobile-admin` if affected) to the stores with
   the Step 1 change. Record the first build number that carries it.
2. Set the release-policy env (config-driven, permissive until set):
   ```
   MOBILE_STOREFRONT_UPDATES_ENABLED=true
   MOBILE_STOREFRONT_IOS_MIN_BUILD=<first build with the boundary>
   MOBILE_STOREFRONT_ANDROID_MIN_BUILD=<first build with the boundary>
   MOBILE_STOREFRONT_IOS_STORE_URL=...   MOBILE_STOREFRONT_ANDROID_STORE_URL=...
   ```
   (admin: the `MOBILE_ADMIN_*` equivalents). The live-build reconciler /
   `mobile_release_gate` keeps `latest_live_build` current for the recommended
   nudge; `MIN_BUILD` is the operator-forced hard floor.
3. Verify the gate returns `nativeUpdateRequired: true` for an older build:
   ```
   curl -s "$BASE/api/mobile/release-policy?app=storefront&platform=android\
&buildNumber=<older>&nativeVersion=2.0.0&runtimeVersion=2.0.0&channel=production" | jq .
   # expect nativeUpdateRequired: true
   ```
4. Prove `MobileUpdateController` blocks (hard update screen) BEFORE any guest or
   authenticated affected Supabase query runs on a build below `MIN_BUILD`
   (mobile QA; see `MobileUpdateController.test.tsx`).

### Step 4 — Revoke the S0-A anon bank/contact bridge  *(server migration; the completion of S0)*
Only after Steps 1–3 are LIVE and proven: promote
`docs/architecture/discovery/S0B-final-revoke-DRAFT.sql` into a real migration
(`supabase/migrations/<ts>_s0b_revoke_anon_merchants_bridge.sql`), recompute its
`shasum -a 256`, and register it in the history-replay manifest
(`PENDING_SOURCES`, `expected-pending-sources.test-support.ts`, count bump in
`verify-supabase-history-replay-manifest.test.ts`).

Verify (as `anon`, all must fail 42501; positive checks must pass) — the exact
`SET ROLE anon` probe set is in the DRAFT file's regression-guard block. S0 is
complete only when **no bank field remains selectable by anon** and current
guest/authenticated receipts still render.

---

## Rollback

- Steps 1–3 are additive/config — revert the mobile change or unset
  `MOBILE_*_MIN_BUILD` to lift the gate; the RPC and route are inert until called.
- Step 4 is the only destructive step. If a supported client regresses, re-grant
  the exact 9 columns (`GRANT SELECT (...) ON public.merchants TO anon;` — the
  S0-A section (d) list) as an immediate hotfix, then diagnose which build still
  reads the raw table.

## Verification standard
For every DB grant change: test direct REST **and** the RPC as anon, unrelated
authenticated user, owning customer, merchant owner, active staff, denied staff,
and service role; reconcile live `pg_class.relacl` / `pg_attribute.attacl` /
function ACLs — never trust migration text alone.
