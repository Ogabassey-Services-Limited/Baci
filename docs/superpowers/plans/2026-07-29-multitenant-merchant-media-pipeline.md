# Multi-Tenant Merchant Media Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Baci merchant one authenticated, tenant-isolated, CDN-backed media upload path at `media.usebaci.com` while preserving every existing Ogabassey asset and URL byte-for-byte.

**Architecture:** The web API authenticates either a mobile bearer token or a web cookie, derives the active merchant on the server, checks a server-enforced merchant rollout flag, creates a `merchant_media_assets` lifecycle row, and issues a short-lived presigned Cloudflare R2 `PUT` into a private quarantine bucket. Completion reads the quarantined bytes, verifies the declared size and MIME, decodes them with bounded `sharp`, re-encodes a sanitized raster, derives an unguessable final key from a server-only HMAC secret, conditionally writes it into the public bucket, and only then atomically stores that key and marks the row ready before returning its canonical `media.usebaci.com` URL. The private quarantine object remains in place until the presigned URL has expired plus clock-skew grace, preventing conditional-PUT replay, and bounded cleanup records its deletion durably. Existing Supabase Storage and `https://cdn.ogabassey.com/core-assets/...` URLs remain valid through an explicit dual-read and flag-controlled fallback boundary; no migration rewrites or deletes legacy URLs.

**Tech Stack:** Next.js 16 route handlers, TypeScript 6 strict mode, Zod 4, Supabase PostgreSQL/RLS, Cloudflare R2 S3 API, AWS SDK v3, Expo/React Native, Vitest, pgTAP, Biome, pnpm/Turborepo.

## Global Constraints

- `https://cdn.ogabassey.com/core-assets/...` is immutable legacy production state: do not rewrite, copy-over, purge, delete, redirect, or change its transformer behavior.
- New merchant uploads use the neutral public origin `https://media.usebaci.com`; no new generic multi-tenant code may default to `cdn.ogabassey.com`.
- Derive `merchant_id` from `authenticateApiRequest()` plus `getMerchantForApiRequest()`; never accept tenant identity in an upload body, object key, query string, or presigned URL request.
- Presigned R2 URLs authorize one successful conditional `PUT` to the private quarantine key, content type, and declared content length, expire after 180 seconds, and are treated as bearer credentials that never enter logs or analytics. Because Cloudflare presigned URLs are reusable until expiry, no workflow deletes a quarantine object before `put_expires_at + 60 seconds`; retaining the key makes every replay fail `If-None-Match: *`. Browser and mobile code set the exact returned `Content-Type` and `If-None-Match`; the user agent owns `Content-Length`.
- Quarantine keys are `pending/{merchantId}/{assetId}/upload.{extension}` and never have a public origin. Final public keys are immutable and contain both the lifecycle UUID and a server-secret delivery token: `merchants/{merchantId}/{purpose}/{assetId}/{hmacSha256}/original.{extension}`, where `hmacSha256` is 64 lowercase hex characters derived from a non-rotating server-only secret and is never returned or stored before `ready`. Never use overwrite/upsert semantics.
- An upload is usable only after server-side size verification, bounded full image decode, sanitized re-encode, conditional public-bucket write, and lifecycle transition to `ready`. Before that transition, the public key is computationally undiscoverable from every client-visible value. Pending/failed public-object remnants are never returned and are reclaimed only by exact HMAC-derived key after the row is terminal or expired.
- Public merchant storefront media and private/KYC documents use different buckets, credentials, origins, and APIs. This plan implements only public merchant media; it must reject `visibility: 'private'`.
- Existing products continue accepting their current URL projection during migration. A lifecycle asset ID accompanies every new URL, but legacy URL-only records remain readable.
- R2 production configuration, DNS, migration application, deployment, rollout-flag changes, and legacy backfill require explicit owner approval. Tests must not access remote Supabase, production R2, or deploy anything.
- Do not modify `proxy.ts`, existing migrations, or Ogabassey-specific transformer files.
- Every behavior change follows genuine RED → GREEN TDD, each task ends with focused tests, Biome, package typecheck, fresh review, and an atomic commit.
- Use one private production quarantine bucket and one public production bucket with tenant prefixes, plus equivalent non-production buckets and a future private-document bucket; do not create one bucket per merchant.
- `merchant_media_rollout_flags.enabled` is platform-operated and defaults to disabled by row absence. The table grants no access to anon or authenticated users. Both APIs and clients treat only the stable `media_pipeline_disabled` response as permission to use the legacy upload path; all other canonical-pipeline failures remain fail closed.
- Reject init when the merchant already has 10 unexpired pending uploads or has declared more than 500 MiB in the current UTC day. Expired pending rows and quarantine objects are reclaimed by the cleanup workflow.
- Authenticated roles receive no direct lifecycle-table UPDATE privilege. Server-verified `ready` and `failed` transitions use narrow `SECURITY DEFINER` RPCs that require a short-lived route proof signed with the same 32-byte media HMAC secret held in the server environment and a locked private database table; possession of a user JWT alone cannot forge verification state.

## File Map and Boundaries

| File | Responsibility |
|---|---|
| `packages/shared/src/contracts/merchant-media.ts` | Cross-client request/response types and Zod schemas; no network or storage code. |
| `supabase/migrations/20260729180000_create_merchant_media_assets.sql` | Lifecycle and rollout tables, locked media secret, atomic creation/proof-gated transition RPCs, immutable-key constraints, indexes, RLS, and grants. |
| `supabase/tests/merchant_media_assets_rls.sql` | Owner/staff/cross-tenant and immutable-field database contract. |
| `apps/web/src/lib/merchant-media/r2-config.ts` | Server-only validated R2 configuration. |
| `apps/web/src/lib/merchant-media/r2-client.ts` | Private/public S3 clients, quarantine presign/read/delete, and conditional public write primitives. |
| `apps/web/src/lib/merchant-media/object-key.ts` | Safe quarantine keys plus server-secret HMAC derivation of undiscoverable final public keys. |
| `apps/web/src/lib/merchant-media/route-proof.ts` | Server-only canonical payload hashing and short-lived HMAC proof construction for lifecycle transition RPCs. |
| `apps/web/src/lib/merchant-media/sanitize-image.ts` | Bounded `sharp` decode and deterministic raster re-encode; no storage or auth code. |
| `apps/web/src/lib/merchant-media/authorize.ts` | Authenticated merchant resolution and purpose-to-permission checks, split so authentication always precedes body parsing. |
| `apps/web/src/app/api/media/uploads/init/route.ts` | Creates pending lifecycle row and returns a short-lived upload URL. |
| `apps/web/src/app/api/media/uploads/complete/route.ts` | Verifies R2 object and transitions one owned asset to ready. |
| `apps/web/src/app/api/media/assets/route.ts` | Lists only the authenticated tenant's ready neutral assets. |
| `apps/web/src/lib/merchant-media/upload-client.ts` | Browser init → direct PUT → complete orchestration. |
| `apps/mobile-admin/lib/merchant-media-upload.ts` | React Native init → local URI bytes → direct PUT → complete orchestration. |
| `apps/web/src/lib/merchant-media-url.ts` | Recognizes neutral URLs while preserving all legacy sources unchanged. |
| `apps/web/src/scripts/backfill-merchant-media.ts` | Dry-run-first, resumable legacy copy and audit; never rewrites Ogabassey core assets. |
| `apps/web/src/scripts/audit-merchant-media.ts` | Cross-checks database rows, R2 HEAD metadata, tenant key ownership, and public reads. |
| `apps/web/src/scripts/cleanup-expired-merchant-media.ts` | Dry-run-first, exact-key reclamation of replay-safe quarantine objects and expired pending public remnants. |
| `apps/web/src/scripts/set-merchant-media-rollout.ts` | Dry-run-first, one-merchant mutation of the canonical upload rollout flag. |

## Target Interfaces

```ts
export const merchantMediaPurposeSchema = z.enum([
  'product',
  'product-variant',
  'logo',
  'favicon',
  'builder',
  'blog',
]);

export const merchantMediaUploadInitSchema = z
  .object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    filename: z.string().trim().min(1).max(255),
    purpose: merchantMediaPurposeSchema,
    sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
    visibility: z.literal('public'),
  })
  .strict();

export interface MerchantMediaUploadInitResponse {
  assetId: string;
  expiresAt: string;
  headers: { 'Content-Type': string; 'If-None-Match': '*' };
  uploadUrl: string;
}

export interface MerchantMediaUploadCompleteRequest {
  assetId: string;
}

export interface MerchantMediaUploadCompleteResponse {
  asset: {
    id: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    sizeBytes: number;
    status: 'ready';
    url: string;
  };
}
```

The database lifecycle is `pending_upload → ready`, with `failed` and `deleted` terminal states. Repeating or concurrently racing completion for a matching ready object returns the same asset; it never creates a second row. `put_expires_at` is exactly 180 seconds after creation and is returned as `expiresAt`; the pending lifecycle expires independently after 15 minutes. `quarantine_deleted_at` remains null until bounded cleanup runs after the presigned replay window. `deleted` rows preserve verification metadata for audit and additionally require `deleted_at`.

The internal route proof is not part of either client contract. It is `{ version: 'merchant-media-route-proof:v1'; action: 'ready'|'failed'; actorId; assetId; merchantId; issuedAt; payloadHash; proofId; signature }`. The ready payload is the UTF-8 join of `[action, actorId, merchantId, assetId, objectKey, contentType, verifiedSizeBytes.toString(), etag, sha256, publicUrl]` with `\n`; the failed payload is `[action, actorId, merchantId, assetId, failureCode]` joined the same way. `payloadHash` is lowercase SHA-256 of that exact payload. The signed envelope is `[version, action, actorId, assetId, merchantId, issuedAt, payloadHash, proofId]` joined with `\n`; `signature` is its lowercase HMAC-SHA-256. PostgreSQL reconstructs both canonical strings, compares signatures through a dedicated constant-time `merchant_media_compare_signatures` helper, binds `actorId` to `auth.uid()`, allows at most five minutes of age and 30 seconds of future clock skew, and fails closed when its private secret is absent.

---

## Rollout Preconditions (owner-operated, not an implementation task)

**Files:**
- Create: `docs/operations/merchant-media-rollout-receipt.md`
- Inspect only: `apps/web/src/config/cdn.ts`
- Inspect only: `apps/web/src/lib/ogabassey-cdn-image-url.ts`
- Inspect only: `infra/cdn-transformer/*`

**Interfaces:**
- Consumes: current production Ogabassey URLs and current Cloudflare account ownership.
- Produces: an approved neutral R2 bucket/domain configuration and a rollback receipt used by every later task.

- [ ] **Step 1: Record a failing preflight before provisioning**

```bash
curl --fail --silent --show-error --head https://media.usebaci.com/.well-known/baci-media-health
```

Expected before provisioning: non-zero exit because the neutral media surface does not exist. Save the timestamp, exit code, and sanitized response headers in `docs/operations/merchant-media-rollout-receipt.md`; never store credentials.

- [ ] **Step 2: Record immutable Ogabassey controls**

Select at least one currently referenced product URL under `https://cdn.ogabassey.com/core-assets/products/` and one transformed `/image/.../core-assets/products/...` URL from existing tests. Record URL, status, `content-type`, `content-length`, `etag`, and SHA-256 of each body. These exact controls are the no-regression comparison for Tasks 7–8 and the exact-head rollout gate.

- [ ] **Step 3: Provision only after owner approval**

In Cloudflare, create `baci-merchant-media-production-quarantine` (private) and `baci-merchant-media-production-public`, plus matching non-production buckets. Bind only the production public bucket to `media.usebaci.com`; quarantine buckets have no custom domain and keep `r2.dev` disabled. Create separate least-privilege credentials: presign/read/delete for quarantine and put/head/delete for public promotion. Configure browser CORS only on quarantine for Baci web origins with `PUT`, allow `Content-Type` and `If-None-Match`, and expose `ETag`; do not list `Content-Length` because Fetch owns that forbidden request header. Cloudflare documents that a custom domain enables public reads, while presigned URLs use the S3 API domain rather than the custom domain: [public buckets/custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [Fetch forbidden request headers](https://fetch.spec.whatwg.org/#forbidden-request-header).

- [ ] **Step 4: Verify the neutral read surface without touching Ogabassey**

Upload a non-production quarantine health object and prove it has no public URL. Promote a sanitized health image into the non-production public bucket with `Cache-Control: public, max-age=60`, verify it through the neutral test read surface, then rerun the Ogabassey controls and assert their recorded status, type, ETag, and SHA-256 are unchanged. From a real browser, PUT a `Blob` using only the returned `Content-Type` and `If-None-Match` headers and prove R2 accepts the user-agent-generated `Content-Length`. Reuse that same URL before deleting the object and prove the conditional replay returns `412`; Cloudflare explicitly documents that the URL itself remains reusable until expiry, so the rollout receipt must also prove cleanup does not delete the key until at least 60 seconds after the signed expiry.

- [ ] **Step 5: Commit the receipt**

```bash
git add docs/operations/merchant-media-rollout-receipt.md
git commit -m "docs: record merchant media rollout baseline"
```

### Task 1: Define the Shared Upload Contract

**Files:**
- Create: `packages/shared/src/contracts/merchant-media.ts`
- Create: `packages/shared/src/contracts/merchant-media.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: the exact Target Interfaces above.
- Produces: `merchantMediaUploadInitSchema`, `merchantMediaUploadCompleteSchema`, `MerchantMediaUploadInitResponse`, `MerchantMediaUploadCompleteResponse`, `MerchantMediaPurpose`, and `MAX_MERCHANT_MEDIA_BYTES`.

- [ ] **Step 1: Write failing contract tests**

```ts
it('rejects tenant identity and private visibility in upload-init input', () => {
  expect(() => merchantMediaUploadInitSchema.parse({
    contentType: 'image/jpeg',
    filename: 'phone.jpg',
    merchantId: crypto.randomUUID(),
    purpose: 'product',
    sizeBytes: 1024,
    visibility: 'public',
  })).toThrow();
  expect(() => merchantMediaUploadInitSchema.parse({
    contentType: 'image/jpeg',
    filename: 'phone.jpg',
    purpose: 'product',
    sizeBytes: 1024,
    visibility: 'private',
  })).toThrow();
});

it('accepts only bounded public raster uploads', () => {
  expect(merchantMediaUploadInitSchema.parse({
    contentType: 'image/webp',
    filename: 'phone.webp',
    purpose: 'product',
    sizeBytes: 10 * 1024 * 1024,
    visibility: 'public',
  }).sizeBytes).toBe(10 * 1024 * 1024);
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @baci/shared exec vitest run src/contracts/merchant-media.test.ts
```

Expected: FAIL because the contract module and exports do not exist.

- [ ] **Step 3: Implement the exact schemas and types**

Use the Target Interfaces verbatim. Add a strict completion schema containing only `assetId: z.uuid()`. Map MIME to extension with an exported exhaustive constant:

```ts
export const MERCHANT_MEDIA_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export const MAX_MERCHANT_MEDIA_BYTES = 10 * 1024 * 1024;
```

- [ ] **Step 4: Run GREEN and package gates**

```bash
pnpm --filter @baci/shared exec vitest run src/contracts/merchant-media.test.ts
pnpm --filter @baci/shared lint
pnpm --filter @baci/shared typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/merchant-media.ts packages/shared/src/contracts/merchant-media.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): define merchant media upload contract"
```

### Task 2: Add the Tenant-Owned Media Lifecycle Table

**Files:**
- Create: `supabase/migrations/20260729180000_create_merchant_media_assets.sql`
- Create: `supabase/tests/merchant_media_assets_rls.sql`
- Modify mechanically after local migration: `apps/web/src/types/supabase.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-pending-sources.test-support.ts`
- Test: `apps/web/tools/db/supabase-history-replay-sources.test.ts`

**Interfaces:**
- Consumes: `MerchantMediaPurpose`, authenticated `auth.uid()`, a private 64-hex server secret, short-lived `merchant-media-route-proof:v1` JSON, and `public.check_staff_permission(user, merchant, 'products'|'builder'|'settings'|'marketing', action)`.
- Produces: `public.merchant_media_assets` rows queryable only by an authorized owner/staff user, the RLS-locked `public.merchant_media_rollout_flags` platform gate, `public.create_merchant_media_upload(...)` for atomic flag/quota enforcement and pending-row creation, `public.finalize_merchant_media_upload(...)` for proof-gated readiness, and `public.fail_merchant_media_upload(...)` for proof-gated terminal failure. Blog authorization uses the existing `marketing` resource; no `blog` permission resource is introduced.

- [ ] **Step 1: Write the failing pgTAP contract**

The test must create two merchants, an owner, a products editor, and a foreign user, then prove:

```sql
SELECT throws_ok(
  $$ INSERT INTO public.merchant_media_assets
       (id, merchant_id, created_by, purpose, status, visibility,
        quarantine_key, content_type, declared_size_bytes, put_expires_at, upload_expires_at)
     VALUES (:'asset_id', :'foreign_merchant_id', :'actor_user_id',
       'product', 'pending_upload', 'public',
       'pending/' || :'foreign_merchant_id' || '/' || :'asset_id' || '/upload.jpg',
       'image/jpeg', 100, now() + interval '180 seconds', now() + interval '15 minutes') $$,
  '42501'
);
```

Also assert the owner/editor can create and select their row, a viewer cannot create one, the foreign tenant cannot select it, anonymous cannot select it, and every direct authenticated UPDATE fails. Prove the creation RPC rejects a merchant with no enabled rollout row, serializes concurrent init attempts with a merchant-scoped transaction advisory lock, enforces 10 live pending rows and 500 MiB declared per UTC day inside that same transaction, derives only the quarantine key internally, and never accepts caller-supplied keys. With a local-only fixture secret, prove a missing, malformed, expired, future-dated, wrong-actor, wrong-tenant, wrong-asset, wrong-action, wrong-payload-hash, or incorrectly signed route proof cannot transition a row. Prove a valid `ready` proof recomputes the exact HMAC delivery token, rejects a caller-selected token or URL, and atomically performs `pending_upload → ready`; prove a valid `failed` proof binds the stable failure code and performs only `pending_upload → failed`. Prove `ready → deleted` remains service-role rollback-only, all other transitions fail, and ready verification metadata is retained. Prove anon, authenticated owners, staff, and authenticated platform-admin/merchant-overlap accounts cannot SELECT or mutate rollout rows directly; only the owner-operated service-role script path may do so.

- [ ] **Step 2: Run RED against a disposable local Supabase database**

```bash
pnpm exec supabase test db supabase/tests/merchant_media_assets_rls.sql
```

Expected: FAIL because `public.merchant_media_assets` does not exist. Never point this command at a linked remote project.

- [ ] **Step 3: Create the append-only migration**

Create a table with these exact columns and checks:

```sql
CREATE TABLE public.merchant_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('product','product-variant','logo','favicon','builder','blog')),
  status text NOT NULL DEFAULT 'pending_upload' CHECK (status IN ('pending_upload','ready','failed','deleted')),
  visibility text NOT NULL CHECK (visibility = 'public'),
  quarantine_key text NOT NULL UNIQUE,
  object_key text UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  declared_size_bytes bigint NOT NULL CHECK (declared_size_bytes BETWEEN 1 AND 10485760),
  verified_size_bytes bigint CHECK (verified_size_bytes IS NULL OR verified_size_bytes BETWEEN 1 AND 10485760),
  etag text,
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  public_url text,
  failure_code text,
  put_expires_at timestamptz NOT NULL,
  upload_expires_at timestamptz NOT NULL,
  quarantine_deleted_at timestamptz,
  ready_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quarantine_key = 'pending/' || merchant_id::text || '/' || id::text || '/upload.' || CASE content_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END),
  CHECK (object_key IS NULL OR object_key ~ ('^merchants/' || merchant_id::text || '/' || purpose || '/' || id::text || '/[0-9a-f]{64}/original\.' || CASE content_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END || '$')),
  CHECK (public_url IS NULL OR public_url = 'https://media.usebaci.com/' || object_key),
  CHECK (
    (status IN ('pending_upload', 'failed') AND object_key IS NULL AND public_url IS NULL AND verified_size_bytes IS NULL AND etag IS NULL AND sha256 IS NULL AND ready_at IS NULL AND deleted_at IS NULL)
    OR (status = 'ready' AND object_key IS NOT NULL AND public_url IS NOT NULL AND verified_size_bytes IS NOT NULL AND etag IS NOT NULL AND sha256 IS NOT NULL AND ready_at IS NOT NULL AND deleted_at IS NULL)
    OR (status = 'deleted' AND object_key IS NOT NULL AND public_url IS NOT NULL AND verified_size_bytes IS NOT NULL AND etag IS NOT NULL AND sha256 IS NOT NULL AND ready_at IS NOT NULL AND deleted_at IS NOT NULL)
  ),
  CHECK ((status = 'failed') = (failure_code IS NOT NULL))
);
```

Create `private.merchant_media_server_secrets` following the existing quiz RPC private-config pattern: `secret_name text PRIMARY KEY CHECK (secret_name = 'current')`, `secret text NOT NULL CHECK (secret ~ '^[0-9a-f]{64}$')`, and `updated_at timestamptz NOT NULL DEFAULT now()`. Enable RLS and revoke its schema/table from PUBLIC, anon, and authenticated; no secret appears in migration text. The proof functions are `SECURITY DEFINER SET search_path = ''`, read only the `current` row, decode its hex key, compare signatures in constant time, and fail closed when absent.

Create `public.merchant_media_rollout_flags` with `merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE`, `enabled boolean NOT NULL`, `change_reason text NOT NULL CHECK (char_length(btrim(change_reason)) BETWEEN 1 AND 500)`, and `updated_at timestamptz NOT NULL DEFAULT now()` maintained by a dedicated trigger. Enable RLS but create no anon/authenticated policies; revoke all from PUBLIC, anon, and authenticated and grant service_role only `SELECT (merchant_id, enabled, change_reason, updated_at)`, `INSERT (merchant_id, enabled, change_reason)`, and `UPDATE (enabled, change_reason)` for the owner-operated rollout script. Row absence means disabled. Add lifecycle indexes on `(merchant_id, status, created_at DESC)`, `(merchant_id, created_at DESC)` for daily quota calculation, partial `(status, upload_expires_at)` for expired pending rows, and partial `(put_expires_at, status)` where `quarantine_deleted_at IS NULL` for replay-safe reclamation. Enable lifecycle RLS. Use a SELECT policy plus `check_staff_permission`; purpose maps to `products` for `product|product-variant`, `builder` for `builder`, `settings` for `logo|favicon`, and `marketing` for `blog`. Do not grant direct INSERT, UPDATE, or DELETE to `authenticated`.

Create `public.create_merchant_media_upload(p_asset_id uuid, p_merchant_id uuid, p_purpose text, p_content_type text, p_declared_size_bytes bigint)` as `SECURITY DEFINER SET search_path = ''`; schema-qualify every relation, function, and type reference. It requires `auth.role() = 'authenticated'`, captures `auth.uid()` into a non-null local actor, rejects any actor without the mapped create/edit permission, takes `pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_merchant_id::text, 41721))`, then rechecks the platform rollout row, live-pending count, and current-UTC-day declared-byte sum before inserting. It derives `created_by`, the quarantine key, visibility, status, `put_expires_at = statement_timestamp() + interval '180 seconds'`, and `upload_expires_at = statement_timestamp() + interval '15 minutes'` inside SQL; it inserts `object_key = NULL` and returns the new row without any final delivery token. For rollout and quota rejection use `ERRCODE = 'P0001'`, the fixed message `Merchant media upload rejected`, and one exact `DETAIL` value from `media_pipeline_disabled`, `pending_upload_limit`, or `daily_upload_bytes_limit`; Task 4 maps only the first detail to legacy fallback. Revoke execute from PUBLIC, anon, and service_role; grant only to authenticated.

Create proof-gated `public.finalize_merchant_media_upload(p_asset_id uuid, p_merchant_id uuid, p_object_key text, p_content_type text, p_verified_size_bytes bigint, p_etag text, p_sha256 text, p_public_url text, p_route_proof jsonb)` and `public.fail_merchant_media_upload(p_asset_id uuid, p_merchant_id uuid, p_failure_code text, p_route_proof jsonb)`. Both require authenticated `auth.uid()`, tenant ownership/permission, a valid five-minute proof bound to every transition argument, and `SELECT ... FOR UPDATE` on the pending row. Finalize recomputes the HMAC token over `${merchantId}\n${purpose}\n${assetId}\n${contentType}`, requires `p_object_key` and `p_public_url` to equal the exact derived neutral values, then writes all ready fields atomically. Fail accepts only `signing_failed`, `declared_size_mismatch`, `content_type_mismatch`, `quarantine_metadata_mismatch`, `invalid_image`, `decoded_dimensions_exceeded`, `sanitized_size_invalid`, or `upload_expired`, and writes no ready fields. Revoke both from PUBLIC, anon, and service_role; grant only authenticated execution. A `BEFORE UPDATE` trigger still rejects immutable changes and transitions outside `pending_upload → ready|failed` or service-role `ready → deleted`. Revoke all lifecycle table access from anon; grant authenticated only explicit SELECT columns and no UPDATE columns.

- [ ] **Step 4: Run GREEN and regenerate types from local state**

```bash
pnpm exec supabase test db supabase/tests/merchant_media_assets_rls.sql
pnpm exec supabase gen types typescript --local > apps/web/src/types/supabase.ts
shasum -a 256 supabase/migrations/20260729180000_create_merchant_media_assets.sql
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts
pnpm --filter @baci/web typecheck
```

Register the exact migration SHA in both replay registries before running the replay-source test. Expected: pgTAP, replay registration, and typecheck pass; generated types include `merchant_media_assets` and `merchant_media_rollout_flags`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260729180000_create_merchant_media_assets.sql supabase/tests/merchant_media_assets_rls.sql apps/web/src/types/supabase.ts
git add apps/web/tools/db/supabase-history-replay-sources.ts apps/web/tools/db/expected-pending-sources.test-support.ts apps/web/tools/db/supabase-history-replay-sources.test.ts
git commit -m "feat(db): add tenant-owned merchant media lifecycle"
```

### Task 3: Build the Server-Only R2 Adapter

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/src/env.ts`
- Modify: `apps/web/src/env.test.ts`
- Create: `apps/web/src/lib/merchant-media/r2-config.ts`
- Create: `apps/web/src/lib/merchant-media/r2-config.test.ts`
- Create: `apps/web/src/lib/merchant-media/object-key.ts`
- Create: `apps/web/src/lib/merchant-media/object-key.test.ts`
- Create: `apps/web/src/lib/merchant-media/route-proof.ts`
- Create: `apps/web/src/lib/merchant-media/route-proof.test.ts`
- Create: `apps/web/src/lib/merchant-media/sanitize-image.ts`
- Create: `apps/web/src/lib/merchant-media/sanitize-image.test.ts`
- Create: `apps/web/src/lib/merchant-media/r2-client.ts`
- Create: `apps/web/src/lib/merchant-media/r2-client.test.ts`

**Interfaces:**
- Consumes: server environment and an already-authorized `{ merchantId, assetId, purpose, contentType, sizeBytes }`.
- Produces: `buildMerchantMediaQuarantineKey(input): string`, `deriveMerchantMediaPublicKey(input, hmacKey): string`, `createMerchantMediaRouteProof(input): MerchantMediaRouteProof`, `presignQuarantinePut(input): Promise<{uploadUrl; expiresAt; headers}>`, `readQuarantineObject(key): Promise<QuarantineObject>`, `sanitizeMerchantImage(input): Promise<SanitizedImage>`, `putPublicMediaObject(input): Promise<VerifiedObject>`, and bucket-specific delete primitives.

- [ ] **Step 1: Add AWS SDK dependencies**

```bash
pnpm --filter @baci/web add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Reuse the repository's existing `sharp@0.35.3`; do not add a second image decoder.

- [ ] **Step 2: Write failing tests**

```ts
it('builds a tenant-bound quarantine key without using the filename', () => {
  expect(buildMerchantMediaQuarantineKey({
    assetId: '22222222-2222-4222-8222-222222222222',
    contentType: 'image/jpeg',
    merchantId: '11111111-1111-4111-8111-111111111111',
  })).toBe('pending/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/upload.jpg');
});

it('adds an undiscoverable server-secret segment to the final public key', () => {
  const publicKey = deriveMerchantMediaPublicKey({
    assetId: '22222222-2222-4222-8222-222222222222',
    contentType: 'image/jpeg',
    merchantId: '11111111-1111-4111-8111-111111111111',
    purpose: 'product',
  }, Buffer.from('11'.repeat(32), 'hex'));
  expect(publicKey).toMatch(/^merchants\/11111111-1111-4111-8111-111111111111\/product\/22222222-2222-4222-8222-222222222222\/[0-9a-f]{64}\/original\.jpg$/);
  expect(publicKey).not.toContain('/22222222-2222-4222-8222-222222222222/original.jpg');
});

it('signs one non-overwriting PUT for 180 seconds', async () => {
  await presignQuarantinePut({ contentType: 'image/jpeg', key: quarantineKey, sizeBytes: 1024 });
  expect(mockPutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
    Bucket: 'baci-merchant-media-nonproduction-quarantine',
    ContentLength: 1024,
    ContentType: 'image/jpeg',
    IfNoneMatch: '*',
    Key: quarantineKey,
  }));
  expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 180 });
});
```

Add tests that reject missing or reused credentials, identical quarantine/public bucket names, a missing/malformed HMAC secret, non-HTTPS endpoints, public origin other than `https://media.usebaci.com` in production, unsafe IDs, and object responses with missing size/type/ETag. Prove the same HMAC key and inputs derive the same public key, while changing merchant, purpose, asset, content type, or secret changes it; no init response or log contains the token. Route-proof tests freeze the canonical newline-delimited field order, bind `ready` payload hashes to object key/type/size/ETag/SHA/public URL, bind `failed` hashes to the failure code, use lowercase hex SHA-256 and HMAC-SHA-256, and prove changing any actor/tenant/asset/action/payload/timestamp/proof ID changes the signature. Add sanitizer tests using real fixtures that reject text mislabeled as PNG, truncated images, unsupported formats, animated WebP, more than 40 megapixels, or decoded dimensions above 12,000 pixels; prove JPEG/PNG/WebP inputs are fully decoded and deterministically re-encoded to their declared format with metadata stripped.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @baci/web exec vitest run src/lib/merchant-media/r2-config.test.ts src/lib/merchant-media/object-key.test.ts src/lib/merchant-media/route-proof.test.ts src/lib/merchant-media/sanitize-image.test.ts src/lib/merchant-media/r2-client.test.ts src/env.test.ts
```

Expected: FAIL because the adapter and env keys do not exist.

- [ ] **Step 4: Implement validated server-only configuration**

Add optional server keys to `env.ts`, then make `getMerchantMediaR2Config()` fail closed when the feature is invoked without all of them:

```ts
interface MerchantMediaR2Config {
  accountId: string;
  endpoint: string;
  objectKeyHmacKey: Uint8Array;
  publicOrigin: string;
  public: { accessKeyId: string; bucket: string; secretAccessKey: string };
  quarantine: { accessKeyId: string; bucket: string; secretAccessKey: string };
  uploadTtlSeconds: 180;
}
```

Environment names are `BACI_MEDIA_R2_ACCOUNT_ID`, `BACI_MEDIA_R2_QUARANTINE_ACCESS_KEY_ID`, `BACI_MEDIA_R2_QUARANTINE_SECRET_ACCESS_KEY`, `BACI_MEDIA_R2_QUARANTINE_BUCKET`, `BACI_MEDIA_R2_PUBLIC_ACCESS_KEY_ID`, `BACI_MEDIA_R2_PUBLIC_SECRET_ACCESS_KEY`, `BACI_MEDIA_R2_PUBLIC_BUCKET`, `BACI_MEDIA_PUBLIC_ORIGIN`, and `BACI_MEDIA_OBJECT_KEY_HMAC_SECRET`. The HMAC secret is exactly 64 hexadecimal characters decoded to 32 bytes, never logged, never sent to either client, and must not rotate while pending rows or unreconciled failed rows exist; an approved rotation first drains pending work and runs cleanup until no failed row lacks `quarantine_deleted_at`, because ready rows retain their stored key. Construct the S3 endpoint internally as `https://{accountId}.r2.cloudflarestorage.com`; do not accept a caller-selected endpoint. Reject equal credentials or bucket names. Begin each adapter module with `import 'server-only';`.

- [ ] **Step 5: Implement quarantine, sanitizer, promotion, and delete primitives**

Create separate `S3Client` instances with region `auto`, the validated endpoint, bucket-specific credentials, and `forcePathStyle: false`. Presign quarantine `PutObjectCommand` with `ContentType`, `ContentLength`, and `IfNoneMatch: '*'`; return the caller-settable signed `Content-Type` and `If-None-Match: *` headers because Fetch synthesizes `Content-Length` from the `Blob`. Read quarantine with `GetObjectCommand`, rejecting absent length/type/ETag and buffering at most `MAX_MERCHANT_MEDIA_BYTES`. `deriveMerchantMediaPublicKey` computes HMAC-SHA-256 over the UTF-8 string `${merchantId}\n${purpose}\n${assetId}\n${contentType}` using only `objectKeyHmacKey`, encodes lowercase hex, and inserts the result between the asset UUID and filename; it does not accept a caller-provided token. `sanitizeMerchantImage` uses `sharp(input, { animated: false, failOn: 'warning', limitInputPixels: 40_000_000 })`, calls `metadata()` plus a full decode, rejects dimensions above 12,000, strips metadata, re-encodes to the declared JPEG/PNG/WebP format, rejects sanitized output outside 1–10 MiB, and returns the lowercase hex SHA-256 of the sanitized bytes. Write the sanitized bytes to the public bucket with `IfNoneMatch: '*'`, the sanitized `ContentLength`/`ContentType`, `Metadata: { sha256 }`, and `CacheControl: 'public, max-age=31536000, immutable'`, then HEAD-verify size/type/ETag and exact `sha256` metadata. Bucket-specific delete functions are server-only and accept a validated expected prefix.

`route-proof.ts` also begins with `import 'server-only'`. It canonicalizes the transition payload separately from the proof envelope, creates `payloadHash`, supplies `issuedAt = new Date().toISOString()` and `proofId = crypto.randomUUID()`, signs the exact Target Interfaces field order with `objectKeyHmacKey`, and returns proof JSON only to the Supabase RPC call. It never logs or serializes the proof into an HTTP response.

- [ ] **Step 6: Run GREEN and package gates**

```bash
pnpm --filter @baci/web exec vitest run src/lib/merchant-media/r2-config.test.ts src/lib/merchant-media/object-key.test.ts src/lib/merchant-media/route-proof.test.ts src/lib/merchant-media/sanitize-image.test.ts src/lib/merchant-media/r2-client.test.ts src/env.test.ts
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/env.ts apps/web/src/env.test.ts apps/web/src/lib/merchant-media
git commit -m "feat(web): add server-only merchant media r2 adapter"
```

### Task 4: Add Authenticated Init and Verify/Complete APIs

**Files:**
- Create: `apps/web/src/lib/merchant-media/authorize.ts`
- Create: `apps/web/src/lib/merchant-media/authorize.test.ts`
- Create: `apps/web/src/app/api/media/uploads/init/route.ts`
- Create: `apps/web/src/app/api/media/uploads/init/route.test.ts`
- Create: `apps/web/src/app/api/media/uploads/complete/route.ts`
- Create: `apps/web/src/app/api/media/uploads/complete/route.test.ts`
- Create: `apps/web/src/app/api/media/assets/route.ts`
- Create: `apps/web/src/app/api/media/assets/route.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 table, Task 3 R2 adapter, `authenticateApiRequest`, `getMerchantForApiRequest`, `toUserAccess`, and `hasPermission`.
- Produces: `POST /api/media/uploads/init`, `POST /api/media/uploads/complete`, and `GET /api/media/assets?purpose=<purpose>` for cookie or bearer clients.

- [ ] **Step 1: Write route tests that fail against absent endpoints**

Init tests must prove: auth occurs before `request.json()`, missing/invalid auth returns 401, unknown tenant returns 404, wrong permission returns 403, cookie POST without valid CSRF returns 403 while valid bearer auth follows the existing bearer-CSRF contract, rollout flag false returns `409 { code: 'media_pipeline_disabled' }` before creating a row, unknown fields return 400, private visibility/SVG/HEIC/oversize return 400, body `merchantId` is rejected, 10 live pending rows return 429, more than 500 MiB declared in the UTC day returns 429, the quarantine key contains only the server-derived merchant, `object_key` remains NULL, and neither the init response nor logs expose a final delivery token.

```ts
it('never signs a client-selected tenant', async () => {
  const response = await POST(new Request('http://localhost/api/media/uploads/init', {
    method: 'POST',
    body: JSON.stringify({
      contentType: 'image/jpeg', filename: 'phone.jpg',
      merchantId: 'foreign-merchant', purpose: 'product',
      sizeBytes: 100, visibility: 'public',
    }),
  }));
  expect(response.status).toBe(400);
  expect(mockPresign).not.toHaveBeenCalled();
});
```

Completion tests must prove cross-tenant IDs return 404, expired/failed/deleted assets cannot complete, size/type/key mismatch calls the proof-gated failure RPC with a stable code and returns 422, a missing quarantine object returns 409, spoofed/truncated/oversized-pixel images remain private until replay-safe cleanup and are marked failed without writing public bytes, and a valid image is sanitized and promoted to an HMAC-derived key before a proof-gated finalize call makes it ready. Assert the proof binds the authenticated actor and every RPC argument and never enters the response or logs. Prove completion does not delete quarantine, a second PUT with the still-live presigned URL receives `412`, and repeated or concurrent completion returns the identical ready asset. Add failure-injection tests for public PUT, public HEAD, finalize RPC, and compensating public delete. A failed finalize never returns or stores the undiscoverable public URL; successful exact-key compensation removes the object immediately, while delete failure leaves the row pending for the bounded expired-row reconciler in Task 8.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media/authorize.test.ts \
  src/app/api/media/uploads/init/route.test.ts \
  src/app/api/media/uploads/complete/route.test.ts \
  src/app/api/media/assets/route.test.ts
```

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement authorization before parsing input**

Expose two functions so the route cannot need an untrusted purpose before authentication: `authenticateMerchantMediaRequest(request): Promise<AuthenticatedMerchantMediaContext | Response>` calls `authenticateApiRequest()` and resolves the merchant; `assertMerchantMediaPermission(context, purpose, action): Response | null` runs only after strict input parsing. Every route authenticates first, applies the existing `checkCsrfProtection()` contract to POST, and only then reads JSON or search parameters. Product and product-variant uploads allow `products.create` or `products.edit`; builder uses `builder.edit`; logo/favicon use `settings.edit`; blog uses the repository-standard `marketing.edit`. Ready listing uses the matching `view` action (`products.view`, `builder.view`, `settings.view`, or `marketing.view`). Return no raw token and accept no requested merchant ID.

- [ ] **Step 4: Implement init with fail-closed lifecycle writes**

Generate `assetId` with `crypto.randomUUID()` and call `create_merchant_media_upload` with the server-derived merchant and validated purpose/type/size; the RPC owns both the 180-second PUT expiry and 15-minute pending expiry. It atomically rechecks permission, the platform rollout row, live-pending limit, daily-byte limit, and derives only the quarantine key; map its stable disabled code to `409 media_pipeline_disabled` and its two quota codes to distinct 429 responses. No other database or signing error authorizes fallback. Presign only the returned quarantine key and return the row's `put_expires_at` as `expiresAt`. If signing fails, create a server-only `failed` route proof bound to `signing_failed`, invoke `fail_merchant_media_upload`, and return `{ error: 'Upload is temporarily unavailable', code: 'upload_unavailable' }` with 503; if that RPC also fails, return the same fail-closed response and leave the pending row for cleanup. Return no bucket, account ID, credential metadata, public key, public URL, route proof, HMAC material, or caller-set `Content-Length`; return exactly the signed `Content-Type` and `If-None-Match` headers.

- [ ] **Step 5: Implement verify/complete and ready listing**

Completion selects the lifecycle row by both `id` and derived `merchant_id`. For `ready`, return the stored projection idempotently; for `pending_upload`, reject lifecycle expiry, read quarantine, verify declared metadata, sanitize/re-encode, and derive the public key with `deriveMerchantMediaPublicKey` and the server-only HMAC key. Conditionally write and HEAD that undiscoverable key, construct the canonical URL, create a `ready` route proof bound to object key/type/size/ETag/SHA/public URL, and call `finalize_merchant_media_upload`; the RPC locks the pending row, independently validates the proof and exact HMAC key, and persists every ready field atomically. Do not delete quarantine in the request: retaining it until `put_expires_at + 60 seconds` is what makes reuse of the still-live presigned URL fail. If the conditional public PUT reports that the key already exists, HEAD it and continue only when its size/type/SHA-256 exactly match this sanitized output; otherwise fail closed without deleting an object this attempt did not create. If finalize reports a state race, reload the tenant-scoped lifecycle row and return it only if it is now `ready` and its stored key plus public HEAD metadata match. On other failures, attempt exact-key deletion only when this request created the public object; if that compensation fails, return no URL and leave the pending row for Task 8's expiry-gated reconciliation. The canonical URL is `${publicOrigin}/${objectKey.split('/').map(encodeURIComponent).join('/')}` and therefore cannot be constructed from init data. GET authenticates first, validates `purpose`, applies the mapped view permission, and lists only ready assets for that merchant and purpose using explicit columns and cursor pagination; it never lists either R2 bucket directly.

- [ ] **Step 6: Run GREEN and package gates**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media/authorize.test.ts \
  src/app/api/media/uploads/init/route.test.ts \
  src/app/api/media/uploads/complete/route.test.ts \
  src/app/api/media/assets/route.test.ts
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/merchant-media/authorize.ts apps/web/src/lib/merchant-media/authorize.test.ts apps/web/src/app/api/media/uploads
git add apps/web/src/app/api/media/assets
git commit -m "feat(api): add tenant-derived merchant media uploads"
```

### Task 5: Move Mobile Product Images to the Canonical Contract

**Files:**
- Create: `apps/mobile-admin/lib/merchant-media-upload.ts`
- Create: `apps/mobile-admin/lib/merchant-media-upload.test.ts`
- Modify: `apps/mobile-admin/hooks/createProductEditImageActions.ts`
- Modify: `apps/mobile-admin/hooks/createProductEditImageActions.test.ts`

**Interfaces:**
- Consumes: `apiClient`, the Task 4 init/complete routes, a local Expo image URI, and a server-derived active session.
- Produces: `uploadMerchantMediaFromUri(input: { contentType; filename; purpose; uri }): Promise<{ assetId: string; url: string }>`; the helper derives byte size and the product form continues storing the returned URL projection.

- [ ] **Step 1: Replace the current regression expectation with canonical RED tests**

```ts
it('uploads local bytes to the presigned URL and completes the lifecycle', async () => {
  const result = await uploadMerchantMediaFromUri({
    contentType: 'image/jpeg', filename: 'phone.jpg',
    purpose: 'product', uri: 'file:///phone.jpg',
  });
  expect(mockApiClient).toHaveBeenNthCalledWith(1, '/api/media/uploads/init', expect.anything());
  expect(mockFetch).toHaveBeenCalledWith('https://signed.r2.example', expect.objectContaining({
    body: imageBytes, method: 'PUT',
  }));
  expect(mockApiClient).toHaveBeenNthCalledWith(2, '/api/media/uploads/complete', expect.anything());
  expect(result).toEqual({ assetId: 'asset-1', url: 'https://media.usebaci.com/merchants/11111111-1111-4111-8111-111111111111/product/22222222-2222-4222-8222-222222222222/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.jpg' });
});
```

Add regression tests that `supabase.storage.from('media').upload` is called only after the canonical init returns the exact `media_pipeline_disabled` code; 401/403/429/5xx, malformed responses, failed PUT, and failed completion never fall back. Prove failed PUT skips completion, completion failure never appends a URL, the canonical PUT sends returned `Content-Type` and `If-None-Match` but does not attempt to set `Content-Length`, and `setIsUploading(false)` runs for all terminal paths.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter baci-mobile-admin exec vitest run lib/merchant-media-upload.test.ts hooks/createProductEditImageActions.test.ts
```

Expected: FAIL because mobile still uploads directly to Supabase Storage.

- [ ] **Step 3: Implement the three-stage native upload**

Use `fetch(uri).arrayBuffer()` for local bytes. Obtain byte length from that buffer rather than trusting picker metadata. Call init with bearer-authenticated `apiClient`, PUT directly to `uploadUrl` using only returned caller-settable headers, require a 2xx response, then call complete. Do not send the Supabase bearer token to R2 and do not set `Content-Length`; the native fetch implementation derives it from the byte body. Normalize HEIC picker results to JPEG before init or reject them with the existing user-facing alert; the server contract must never label HEIC bytes as JPEG.

- [ ] **Step 4: Remove merchant-controlled storage paths from the hook**

`createProductEditImageActions` never sends `merchantId` to canonical APIs and appends only a verified canonical URL. During the canary window it retains the current tenant-prefixed Supabase uploader as a separately named `uploadLegacyProductImage` fallback, invoked only for the typed disabled result. The hook may retain its current merchant ID solely to construct that pre-existing legacy path; canonical authorization never consumes it. Product persistence remains URL-compatible while the lifecycle row supplies server-side ownership and auditability.

- [ ] **Step 5: Run GREEN and package gates**

```bash
pnpm --filter baci-mobile-admin exec vitest run lib/merchant-media-upload.test.ts hooks/createProductEditImageActions.test.ts
pnpm --filter baci-mobile-admin lint
pnpm --filter baci-mobile-admin typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile-admin/lib/merchant-media-upload.ts apps/mobile-admin/lib/merchant-media-upload.test.ts apps/mobile-admin/hooks/createProductEditImageActions.ts apps/mobile-admin/hooks/createProductEditImageActions.test.ts
git commit -m "feat(mobile): upload product media through tenant-safe r2 contract"
```

### Task 6: Move Web Merchant Media to the Same Contract

**Files:**
- Create: `apps/web/src/lib/merchant-media/upload-client.ts`
- Create: `apps/web/src/lib/merchant-media/upload-client.test.ts`
- Modify: `apps/web/src/components/builder/media-library.tsx`
- Modify: `apps/web/src/components/builder/media-library.test.tsx`
- Modify: `apps/web/src/app/dashboard/products/add/add-product-form.tsx`
- Modify: `apps/web/src/app/dashboard/products/add/add-product-form.test.tsx`
- Modify: `apps/web/src/lib/storage.ts`
- Modify: `apps/web/src/lib/storage.test.ts`
- Modify: `apps/web/src/components/onboarding/steps/step2-branding.tsx`
- Modify: `apps/web/src/components/onboarding/steps/step2-branding.test.tsx`
- Modify: `apps/web/src/app/dashboard/orders/[orderId]/confirm-insurance-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/orders/[orderId]/confirm-insurance-dialog.test.tsx`
- Modify: `apps/web/src/app/dashboard/settings/components/hero-carousel-card.tsx`
- Modify: `apps/web/src/app/dashboard/settings/components/hero-carousel-card.test.tsx`
- Modify: `apps/web/src/app/dashboard/settings/components/settings-form.tsx`

**Interfaces:**
- Consumes: browser `File|Blob`, `fetchWithCsrf`, and Task 4 routes.
- Produces: `uploadMerchantMediaBlob({ blob, filename, purpose }): Promise<{assetId; url}>` used by product and builder image workflows.

- [ ] **Step 1: Write failing browser orchestration tests**

Test init JSON, direct quarantine PUT with returned `Content-Type` and `If-None-Match` but no caller-set `Content-Length`, complete JSON, PUT failure, complete failure, and typed disabled fallback. Prove only `media_pipeline_disabled` invokes `uploadLegacySupabaseImage`; auth, quota, server, network, and malformed-response failures remain fail closed. Add a product-form regression proving a newly selected gallery image becomes a neutral verified URL before product save when enabled and retains its current Supabase URL behavior when disabled.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media/upload-client.test.ts \
  src/components/builder/media-library.test.tsx \
  src/app/dashboard/products/add/add-product-form.test.tsx \
  src/lib/storage.test.ts
```

Expected: FAIL because the browser still calls Supabase Storage or multipart `/api/media`.

- [ ] **Step 3: Implement the browser upload client**

Call init and complete through `fetchWithCsrf`; call the presigned URL through plain `fetch`. Use `blob.size` and `blob.type`, preserve only an inert display filename, copy exactly the returned caller-settable `Content-Type` and `If-None-Match` headers, never add `Content-Length`, and return only a verified asset. Reject a missing, additional, or altered signed-header contract before PUT. Represent the exact disabled response as a typed `MerchantMediaPipelineDisabledError`; do not convert any other response into that type. Revoke every temporary blob URL in `finally`.

- [ ] **Step 4: Adapt product and media-library callers**

Product gallery and enhanced image uploads use purpose `product`; builder media uses purpose `builder`. Keep `FileUploader` responsible only for local selection/previews. Try `uploadMerchantMediaBlob()` first and call the renamed legacy helper only when it throws `MerchantMediaPipelineDisabledError`. Keep GET `/api/media` and its legacy Supabase results temporarily so the library is dual-read; merge it with GET `/api/media/assets`, dedupe by URL, and mark neutral assets with their lifecycle ID.

- [ ] **Step 5: Narrow the legacy storage helper**

Rename `uploadImage` to `uploadLegacySupabaseImage` so no new generic caller mistakes it for the canonical path. Product/builder callers retain it only for the exact default-off rollout response; onboarding logo, insurance evidence, hero carousel, and settings form remain explicit legacy callers until independently migrated. Update each exact caller and listed test in the same commit without changing unrelated behavior. Add a removal receipt item: after 100% rollout stability is approved, a follow-up change deletes product/builder fallback branches; do not remove them in this plan before canary completion.

- [ ] **Step 6: Run GREEN and package gates**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media/upload-client.test.ts \
  src/components/builder/media-library.test.tsx \
  src/app/dashboard/products/add/add-product-form.test.tsx \
  src/lib/storage.test.ts \
  src/components/onboarding/steps/step2-branding.test.tsx \
  'src/app/dashboard/orders/[orderId]/confirm-insurance-dialog.test.tsx' \
  src/app/dashboard/settings/components/hero-carousel-card.test.tsx
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/merchant-media/upload-client.ts apps/web/src/lib/merchant-media/upload-client.test.ts apps/web/src/components/builder/media-library.tsx apps/web/src/components/builder/media-library.test.tsx
git add apps/web/src/app/dashboard/products/add/add-product-form.tsx apps/web/src/app/dashboard/products/add/add-product-form.test.tsx apps/web/src/lib/storage.ts apps/web/src/lib/storage.test.ts
git add apps/web/src/components/onboarding/steps/step2-branding.tsx apps/web/src/components/onboarding/steps/step2-branding.test.tsx 'apps/web/src/app/dashboard/orders/[orderId]/confirm-insurance-dialog.tsx' 'apps/web/src/app/dashboard/orders/[orderId]/confirm-insurance-dialog.test.tsx'
git add apps/web/src/app/dashboard/settings/components/hero-carousel-card.tsx apps/web/src/app/dashboard/settings/components/hero-carousel-card.test.tsx apps/web/src/app/dashboard/settings/components/settings-form.tsx
git commit -m "feat(web): adopt canonical merchant media uploads"
```

### Task 7: Add Neutral URL Recognition Without Touching Ogabassey

**Files:**
- Create: `apps/web/src/config/merchant-media.ts`
- Create: `apps/web/src/lib/merchant-media-url.ts`
- Create: `apps/web/src/lib/merchant-media-url.test.ts`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/src/lib/storefront-media-cdn-url.test.ts`
- Modify: `apps/web/src/lib/ogabassey-cdn-image-url.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-media-gallery.test.tsx`

**Interfaces:**
- Consumes: current URL strings from products, variants, merchant logos, Supabase Storage, neutral R2, and Ogabassey.
- Produces: `classifyMerchantMediaUrl(value): 'baci-r2'|'supabase-legacy'|'ogabassey-legacy'|'external'|'invalid'` and `isBaciMerchantMediaUrl(value): boolean`.

- [ ] **Step 1: Write failing dual-read and no-regression tests**

```ts
it('recognizes neutral tenant media without rewriting legacy URLs', () => {
  expect(classifyMerchantMediaUrl('https://media.usebaci.com/merchants/11111111-1111-4111-8111-111111111111/product/22222222-2222-4222-8222-222222222222/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.webp')).toBe('baci-r2');
  expect(preserveMerchantMediaUrl('https://cdn.ogabassey.com/core-assets/products/phone.avif')).toBe('https://cdn.ogabassey.com/core-assets/products/phone.avif');
  expect(preserveMerchantMediaUrl('https://project.supabase.co/storage/v1/object/public/media/m/phone.jpg')).toBe('https://project.supabase.co/storage/v1/object/public/media/m/phone.jpg');
});
```

Add Ogabassey gallery tests for original and transformed core-assets URLs and assert the rendered `src/srcSet` remain byte-identical to the preflight fixtures.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media-url.test.ts \
  src/lib/storefront-media-cdn-url.test.ts \
  src/lib/ogabassey-cdn-image-url.test.ts \
  src/components/storefront/ogabassey/pages/product-details-page/product-media-gallery.test.tsx
```

Expected: the new classifier test fails; all pre-existing Ogabassey tests establish the baseline.

- [ ] **Step 3: Implement a separate neutral namespace**

Set `DEFAULT_MERCHANT_MEDIA_ORIGIN = 'https://media.usebaci.com'` in the new config. Do not change `DEFAULT_MEDIA_CDN_ORIGIN` in `apps/web/src/config/cdn.ts`; it remains the Ogabassey legacy transform origin. The classifier accepts the exact neutral hostname and safe `/merchants/{merchantUuid}/{purpose}/{assetUuid}/{64-lowercase-hex-delivery-token}/original.{jpg|png|webp}` shape. Add rejection cases for `m`/`a` placeholders, missing or uppercase tokens, path traversal, unsupported purposes, query-selected origins, and extra path segments. It never converts one origin to another.

- [ ] **Step 4: Permit neutral images in Next configuration**

Add `media.usebaci.com` as an HTTPS remote pattern. Preserve every existing remote pattern and custom Ogabassey loader branch.

- [ ] **Step 5: Run GREEN, broad Ogabassey image gates, and package gates**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media-url.test.ts \
  src/lib/storefront-media-cdn-url.test.ts \
  src/lib/ogabassey-cdn-image-url.test.ts \
  src/lib/gmc-feed-images.test.ts \
  src/components/storefront/ogabassey/pages/product-details-page/product-media-gallery.test.tsx
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
```

Then rerun the rollout-precondition Ogabassey HTTP controls. Expected: status, type, ETag, and body SHA-256 remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/config/merchant-media.ts apps/web/src/lib/merchant-media-url.ts apps/web/src/lib/merchant-media-url.test.ts apps/web/next.config.ts
git add apps/web/src/lib/storefront-media-cdn-url.test.ts apps/web/src/lib/ogabassey-cdn-image-url.test.ts apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-media-gallery.test.tsx
git commit -m "feat(storefront): support neutral merchant media without legacy rewrites"
```

### Task 8: Add Dry-Run-First Legacy Migration and Audit

**Files:**
- Create: `apps/web/src/scripts/backfill-merchant-media.ts`
- Create: `apps/web/src/scripts/backfill-merchant-media.test.ts`
- Create: `apps/web/src/scripts/audit-merchant-media.ts`
- Create: `apps/web/src/scripts/audit-merchant-media.test.ts`
- Create: `apps/web/src/scripts/cleanup-expired-merchant-media.ts`
- Create: `apps/web/src/scripts/cleanup-expired-merchant-media.test.ts`
- Create: `apps/web/src/scripts/set-merchant-media-rollout.ts`
- Create: `apps/web/src/scripts/set-merchant-media-rollout.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: explicit merchant ID, source Supabase public-media URL, lifecycle rows, the server-only HMAC key, and R2 server adapter.
- Produces: resumable copy receipts, an audit summary, bounded replay-safe quarantine and orphan-public cleanup, and a dry-run-first tenant rollout command; it does not update product/merchant URL columns.

- [ ] **Step 1: Write failing migration safety tests**

Test that dry-run is the default; apply requires both `--apply` and `--merchant-id`; `cdn.ogabassey.com/core-assets/` and `/image/.../core-assets/` inputs are classified `skip_ogabassey_immutable`; external URLs are skipped; a pre-existing ready checksum is idempotently skipped; source bytes pass the same bounded sanitizer as live uploads before HMAC-keyed public promotion; and any mismatch deletes only objects created by that attempt and marks only its pending lifecycle row failed. Cleanup tests prove dry-run default, a maximum batch of 100, and these exact candidate rules: pending rows are untouched until `upload_expires_at`, while ready/failed/deleted quarantine objects are untouched until `put_expires_at + 60 seconds`; rows with `quarantine_deleted_at` are skipped. Prove a ready row keeps its quarantine object during the signed replay window, then receives `quarantine_deleted_at` only after an idempotent exact-key delete; prove expired pending rows delete quarantine, derive and delete only their undiscoverable exact public key, and conditionally transition to `failed/upload_expired`; prove failed rows reconcile the same possible public remnant. Cover retry-safe duplicate/missing-object handling, a completion/cleanup race, and refusal to address any caller-selected public, quarantine, Supabase, or Ogabassey key. Rollout-command tests require `--merchant-id`, `--enabled=true|false`, `--reason`, and `--apply`; prove dry-run default, explicit before/after output, one-merchant scope, enabling an absent row creates it, disabling an absent row is an auditable no-op, and an existing matching state is not rewritten.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @baci/web exec vitest run src/scripts/backfill-merchant-media.test.ts src/scripts/audit-merchant-media.test.ts src/scripts/cleanup-expired-merchant-media.test.ts src/scripts/set-merchant-media-rollout.test.ts
```

Expected: FAIL because scripts do not exist.

- [ ] **Step 3: Implement bounded copy, not URL rewrite**

The script selects explicit columns in pages of 100, requires one merchant scope, processes at most four objects concurrently, calculates SHA-256 while streaming, and uses a dedicated server-only service-role operations writer because no end-user JWT exists during backfill. That writer inserts the same pending row shape directly without consulting rollout flags or live-upload quotas, uses the same sanitizer and HMAC-derived public-key function, conditionally promotes, HEAD-verifies, and transitions only its own receipt-bound row to ready under the same database constraints. It never calls the authenticated transition RPCs, and its tests prove it cannot accept a caller-selected lifecycle ID, key, tenant outside `--merchant-id`, or pre-existing row. Emit JSONL containing asset ID, merchant ID, source classification, source checksum, destination key, destination ETag, byte count, and terminal outcome. Never print query credentials, signed URLs, the HMAC secret, or a delivery token before its row is ready. Do not mutate products, variants, feeds, logos, or page configs.

- [ ] **Step 4: Implement audit and rollback inputs**

The audit checks that every stored ready/deleted key embeds the row merchant, purpose, asset UUID, and a 64-hex token; HEAD matches verified metadata; ready URLs use the neutral origin; and a public GET returns the same checksum. For pending/failed rows it independently derives the undiscoverable public key and reports any existing object as an orphan requiring cleanup; it never prints that key in normal output. It separately reports ready/failed/deleted rows whose quarantine retention is overdue and every skipped Ogabassey URL. The rollback command accepts only asset IDs created by one receipt, deletes those exact neutral public keys, and transitions ready rows to `deleted` with `deleted_at` while preserving verification metadata. It deletes quarantine only when `put_expires_at + 60 seconds` has passed; otherwise the normal cleanup command reclaims it after the replay window. It cannot address Supabase or Ogabassey objects.

The cleanup command selects at most 100 rows with `quarantine_deleted_at IS NULL` using two due predicates: `(status = 'pending_upload' AND upload_expires_at <= now())` or `(status IN ('ready','failed','deleted') AND put_expires_at + interval '60 seconds' <= now())`. It validates `pending/{merchantId}/{assetId}/`, idempotently deletes that exact private key, and sets `quarantine_deleted_at` only after delete success or `NoSuchKey`. For an expired pending row it also derives the sole possible HMAC public key, idempotently deletes it, then conditionally updates with both `.eq('id', id)` and `.eq('status', 'pending_upload')` to `failed/upload_expired`; if status changed concurrently, it reloads and applies only that status's due rule. For `failed`, it also deletes the derived possible public remnant before recording quarantine cleanup. For `ready`, it never deletes the stored public key. Concurrent duplicate selection is safe because exact-key deletion is idempotent and the conditional marker update converges. Dry-run remains the default. The rollout command uses its server-only operations client to read one explicit `merchant_media_rollout_flags` row, prints a sanitized before/after receipt, and upserts or disables only that merchant's row when every apply argument is present. It never uses the service credential in a user-facing route or client module.

- [ ] **Step 5: Add explicit scripts and run GREEN**

```json
{
  "scripts": {
    "media:backfill": "tsx src/scripts/backfill-merchant-media.ts",
    "media:audit": "tsx src/scripts/audit-merchant-media.ts",
    "media:cleanup-expired": "tsx src/scripts/cleanup-expired-merchant-media.ts",
    "media:set-rollout": "tsx src/scripts/set-merchant-media-rollout.ts"
  }
}
```

```bash
pnpm --filter @baci/web exec vitest run src/scripts/backfill-merchant-media.test.ts src/scripts/audit-merchant-media.test.ts src/scripts/cleanup-expired-merchant-media.test.ts src/scripts/set-merchant-media-rollout.test.ts
pnpm --filter @baci/web lint
pnpm --filter @baci/web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/scripts/backfill-merchant-media.ts apps/web/src/scripts/backfill-merchant-media.test.ts apps/web/src/scripts/audit-merchant-media.ts apps/web/src/scripts/audit-merchant-media.test.ts
git add apps/web/src/scripts/cleanup-expired-merchant-media.ts apps/web/src/scripts/cleanup-expired-merchant-media.test.ts apps/web/src/scripts/set-merchant-media-rollout.ts apps/web/src/scripts/set-merchant-media-rollout.test.ts apps/web/package.json
git commit -m "feat(ops): add audited merchant media backfill"
```

## Exact-Head Integration and Rollout Gate (owner-operated, not an implementation task)

**Files:**
- Modify: `docs/operations/merchant-media-rollout-receipt.md`
- Verify only: all files changed in Tasks 1–8

**Interfaces:**
- Consumes: exact integrated head, green tests, Cloudflare/Supabase owner approvals, and a physical iPhone on Wi-Fi.
- Produces: one exact-head release decision with explicit rollback evidence.

- [ ] **Step 1: Run combined focused tests**

```bash
pnpm --filter @baci/shared exec vitest run src/contracts/merchant-media.test.ts
pnpm --filter @baci/web exec vitest run \
  src/lib/merchant-media \
  src/app/api/media/uploads \
  src/app/api/media/assets \
  src/lib/merchant-media-url.test.ts \
  src/lib/ogabassey-cdn-image-url.test.ts \
  src/lib/gmc-feed-images.test.ts \
  src/scripts/backfill-merchant-media.test.ts \
  src/scripts/audit-merchant-media.test.ts \
  src/scripts/cleanup-expired-merchant-media.test.ts \
  src/scripts/set-merchant-media-rollout.test.ts
pnpm --filter baci-mobile-admin exec vitest run lib/merchant-media-upload.test.ts hooks/createProductEditImageActions.test.ts
```

- [ ] **Step 2: Run mandatory repository gates once**

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Retain command, start/end timestamp, exact head SHA, and exit code in the rollout receipt.

- [ ] **Step 3: Run fresh review at the exact head**

```bash
coderabbit review --agent -t committed
```

Fix all applicable critical/high findings with regression tests and rerun affected gates. Then obtain a fresh substantive Sol review against the new exact head. Record reviewer outcome and exact SHA; stale-head approval does not count.

- [ ] **Step 4: Apply infrastructure and database only with explicit approval**

Confirm separate private-quarantine and public R2 buckets, credentials, domain, and quarantine-only CORS; prove quarantine has no custom domain or `r2.dev`. Install the append-only migration through the approved database deployment path and verify both replay registrations. Generate one 32-byte random HMAC key outside source control, encode it as 64 lowercase hex, place the same value in server-only `BACI_MEDIA_OBJECT_KEY_HMAC_SECRET` and the single `private.merchant_media_server_secrets/current` database row through approved secret channels, and retain only matching SHA-256 fingerprints in the receipt. Prove neither anon nor authenticated roles can read that row; the pgTAP contract must already prove transition RPCs fail closed when the database copy is absent or mismatched. Record that HMAC rotation is prohibited until pending rows are drained and cleanup has marked every failed row reconciled, schedule bounded replay-safe cleanup through the approved VPS/cron path, and deploy with the repository's prebuilt VPS flow. Never run a cloud-building `vercel deploy --prod` command.

- [ ] **Step 5: Run physical iPhone Wi-Fi E2E**

Use the existing dev build and the one Metro instance already owned by the controller. With the flag false, prove product upload uses the legacy path. Enable only the test merchant, then create a product image and verify init → quarantine PUT → sanitize/promote → complete logs contain asset IDs but no signed URL, HMAC secret, or pre-ready delivery token. Before completion, prove the final URL cannot be constructed from the init response and the quarantine key is not publicly retrievable; afterward save the product, reload the app, open the public storefront, and verify the displayed source is `media.usebaci.com`. Before the 180-second signed expiry, replay the same PUT and require `412`; after expiry plus 60 seconds, run one cleanup batch, prove the quarantine object is absent and `quarantine_deleted_at` is set, and prove the expired URL cannot recreate it. Repeat edit/reload. Confirm a second tenant cannot list or complete the first tenant's asset, and upload spoofed non-image bytes to prove they never receive a public URL.

- [ ] **Step 6: Prove Ogabassey is unchanged**

Rerun the rollout-precondition HTTP controls and the Ogabassey product/gallery/feed tests. Query existing Ogabassey product, variant, feed, logo, and blog URL columns before and after rollout and assert zero rewrites. Do not run the backfill against Ogabassey.

- [ ] **Step 7: Canary and rollback decision**

Use `pnpm --filter @baci/web media:set-rollout -- --merchant-id=<uuid> --enabled=true --reason=<ticket> --apply` under owner approval: first one non-Ogabassey test merchant, then each member of a recorded small cohort. Monitor init/PUT/sanitize/promote/complete success, quota rejections, sanitizer rejection codes, cleanup lag, orphaned pending rows, CDN 4xx/5xx, and public image load failures. Roll back the same cohort with `--enabled=false`, retain the command receipts, and prove clients use the still-supported legacy path; do not change or delete legacy objects. Delete only neutral objects proven to originate from the failed rollout receipt.

- [ ] **Step 8: Commit the final receipt**

```bash
git add docs/operations/merchant-media-rollout-receipt.md
git commit -m "docs: record merchant media rollout verification"
```

## Self-Review Results

- **Spec coverage:** The rollout preconditions and Task 7 lock Ogabassey immutability; Tasks 1–4 implement authenticated tenant derivation, private quarantine, bounded decode/re-encode, undiscoverable HMAC public keys, proof-gated lifecycle transitions, quotas, and default-off rollout; Tasks 5–6 converge mobile/web with an exact-code legacy fallback; Task 2 separates public/private state and registers the migration in both replay registries; Tasks 3 and 7 enforce immutable neutral keys; Tasks 6–8 plus the exact-head gate provide dual-read, expiry-safe cleanup, orphan reconciliation, audit, rollback, and executable tenant canaries.
- **Placeholder scan:** The plan contains no deferred implementation placeholders. Every code-producing task names exact files, interfaces, RED command, GREEN behavior, gates, and commit.
- **Type consistency:** `assetId`, `contentType`, `purpose`, `sizeBytes`, `uploadUrl`, caller-settable `headers`, and verified `asset.url` use the same names in shared contracts, APIs, browser, and mobile. `Content-Length` is never client-set. The internal route proof is server-to-database only, and database snake_case remains confined to persistence adapters.
- **Scope control:** Private/KYC documents are explicitly excluded from this public pipeline; Ogabassey transformer refactoring and product-schema URL rewrites are explicitly prohibited. URL compatibility remains the read projection during migration while lifecycle IDs make new assets auditable.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-29-multitenant-merchant-media-pipeline.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review between tasks.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, in batches with checkpoints.
