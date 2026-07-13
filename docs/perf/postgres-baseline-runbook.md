# PostgreSQL Post-Deploy Baseline Runbook

This runbook creates a reset-safe PostgreSQL 17 evidence window after a database
performance change. It does not reset production statistics, perform an engine
upgrade, or manufacture a baseline from cumulative data that spans releases.
The snapshot intentionally rejects PostgreSQL 18 and later: capture this
pre-upgrade PostgreSQL 17 window before the platform upgrade, then use a
separately reviewed PostgreSQL 18 export for post-upgrade evidence.

## Evidence lanes

Keep these evidence layers separate even when they cover the same wall-clock
interval:

| Lane | Source | What it proves |
| --- | --- | --- |
| Database aggregates | `postgres-performance-snapshot.sql` and the delta tool | Calls, total/mean execution time, rows, buffers, temporary blocks/bytes, WAL, table/index activity, I/O, connections, locks, and cron state |
| Client/application telemetry | Vercel and application request histograms/logs | p50, p95, p99, errors, timeouts, queue/pool time, and throughput |
| Platform manifest | Authenticated Supabase API/Dashboard export | Exact Supabase Postgres build, bundled service versions, pooler settings, extensions, maintenance state, and advisor output |

`pg_stat_statements` provides aggregate means and backend evidence. It does not
provide request percentiles or application error rates. Never copy Vercel p95/p99
or error fields into the database snapshot and never present database mean time as
client p95.

## Hard gates

Start only when all of the following are true:

1. The intended change is merged and deployed. For the first window, that means
   the mobile catalog/variant change from PR #3081.
2. The immutable 40-character Git SHA of the live Vercel deployment is known.
   A branch name, PR number, local `HEAD`, or mutable `main` is not sufficient.
3. The live migration ledger contains the expected migration versions and the
   deployed application is serving the exact SHA above.
4. Supabase reports the same PostgreSQL major/minor and exact platform build that
   will remain active throughout the interval.
5. No application deploy, migration, statistics reset, database restart,
   maintenance event, compute resize, or Supabase platform update is scheduled
   between captures.
6. No operator may call `pg_stat_reset_single_table_counters()` (or any
   per-relation statistics reset) between captures. PostgreSQL 17 exposes no
   per-relation reset timestamp, so discard the interval even if a busy
   relation's counters later exceed their first-capture values.

Do not overlap this window with the separately offered
`supabase-postgres-17.6.1.141` platform update. If either the authenticated
platform manifest or SQL `server_build` changes, discard the interval even when
`server_version_num` remains the same.

## Capture schedule

Use the exact deployed SHA as the baseline identifier.

- T+1h: capture after the deployment has been healthy for one hour.
- T+24h: capture approximately 24 hours after deployment, with no intervening
  release or platform event.
- T+7d: repeat when a longer traffic cycle is needed; compare only adjacent
  reset-safe snapshots that share the same deployment and platform build.

The first attributable summary is the T+1h to T+24h delta. Do not commit a
placeholder or extrapolate a partial interval into a production result.

## 1. Prepare private capture storage

Raw statement text, role names, application names, and advisor output can be
sensitive. Keep decrypted exports outside the repository on encrypted local
storage, use restrictive permissions, and delete plaintext after verification.

```bash
umask 077
CAPTURE_DIR="$(mktemp -d)"
DEPLOYED_SHA='<exact-40-character-live-deployment-sha>'
FINGERPRINT_KEY='/secure/evidence/postgres-baseline-fingerprint-hmac.key'
```

The fingerprint key is a private binary HMAC key of at least 32 bytes. Create
it once in approved encrypted storage if it does not already exist, restrict it
to the evidence operators, and reuse that same key only for summaries that must
remain correlatable. Never add it to the repository, an artifact manifest, or a
sanitized summary.

```bash
# Run only when initializing a new approved comparison key.
openssl rand -out "$FINGERPRINT_KEY" 32
chmod 600 "$FINGERPRINT_KEY"
```

For each capture, create a platform manifest in that private directory containing:

- capture label and UTC timestamp;
- exact deployed Git SHA and Vercel deployment identifier;
- Supabase project reference and region;
- exact Supabase Postgres build from the authenticated eligibility/platform API;
- PostgREST, Auth, Realtime, Storage, pooler, and extension versions;
- migration-ledger/schema-hash identifiers;
- maintenance/update status;
- hashes of separately exported Supabase performance/security advisor results.

Use authenticated Supabase MCP/API or Dashboard reads for this manifest. Do not
put access tokens, connection strings, or service-role keys in it.

## 2. Capture the database snapshot

Run the complete read-only script in one Supabase SQL editor session:

[`supabase/diagnostics/postgres-performance-snapshot.sql`](../../supabase/diagnostics/postgres-performance-snapshot.sql)

Export the single `snapshot` row as JSON without editing it. The delta tool accepts
either the object itself, `{ "snapshot": ... }`, or the SQL editor's one-row
`[{ "snapshot": ... }]` form.

Name the plaintext files by capture point inside the private directory, for
example:

```text
<private-dir>/t-plus-1h/postgres-snapshot.json
<private-dir>/t-plus-24h/postgres-snapshot.json
```

The SQL begins a read-only transaction and rolls it back. It intentionally does
not call any statistics-reset function. A snapshot still fails the evidence gate
if the interval later crosses a reset, restart, build change, or statement-entry
deallocation.

## 3. Capture client telemetry separately

Export Vercel/application request data for the identical UTC interval into a
separate encrypted artifact. At minimum include operation name, count, p50, p95,
p99, errors, timeouts, throughput, and pool/queue acquisition time where
available. Preserve raw samples or histogram buckets when a percentile is a
release gate.

Correlate the telemetry with the deployed SHA and snapshot timestamps, but do not
merge it into either SQL snapshot. The sanitized database summary deliberately
reports `client_telemetry.included: false` as a reminder that this second lane is
required.

## 4. Encrypt and hash raw capture bundles

Encrypt each capture point as its own bundle with the team's approved encryption
method. A typical `age` workflow is shown below; substitute the approved tooling
without weakening access control.

```bash
tar -C "$CAPTURE_DIR/t-plus-1h" -cf - . \
  | age -r "$AGE_RECIPIENT" \
      -o '/secure/evidence/t-plus-1h-postgres-baseline.tar.age'

tar -C "$CAPTURE_DIR/t-plus-24h" -cf - . \
  | age -r "$AGE_RECIPIENT" \
      -o '/secure/evidence/t-plus-24h-postgres-baseline.tar.age'
```

The encrypted bundle should contain the untouched SQL export, platform manifest,
and advisor-export hashes. Keep client telemetry as a separately named encrypted
artifact so its percentiles cannot be confused with database aggregates.

## 5. Generate the sanitized delta

Run from the repository root. Pass the decrypted snapshot JSON only for parsing;
pass each encrypted bundle separately so the persisted summary records hashes of
the encrypted evidence rather than hashes of transient plaintext.

```bash
node apps/web/tools/perf/postgres-baseline-delta.mjs \
  --before "$CAPTURE_DIR/t-plus-1h/postgres-snapshot.json" \
  --after "$CAPTURE_DIR/t-plus-24h/postgres-snapshot.json" \
  --before-artifact '/secure/evidence/t-plus-1h-postgres-baseline.tar.age' \
  --after-artifact '/secure/evidence/t-plus-24h-postgres-baseline.tar.age' \
  --deployed-sha "$DEPLOYED_SHA" \
  --fingerprint-key-file "$FINGERPRINT_KEY" \
  --out '/secure/evidence/postgres-baseline-t1h-t24h-summary.json'
```

The output path is created once and is never overwritten. Both encrypted bundles
are mandatory; the tool will not fall back to hashing a plaintext snapshot. The
artifact inputs are opaque, operator-attested ciphertext because approved
encryption formats may differ and the delta tool has no decryption keys. Their
hashes are audit pointers, not proof that a ciphertext contains a given snapshot;
verify each bundle's contents before deleting plaintext or publishing the summary.
The summary uses an allowlist and excludes raw query text, role/database names,
application names, platform secrets, and client telemetry. It retains normalized
statement-shape HMAC-SHA-256 fingerprints with plan-only work and
shared/local/temporary I/O timings; deterministic table/index HMAC-SHA-256
fingerprints with activity and before/after/delta gauges; deterministic I/O,
connection, lock, and cron HMAC-SHA-256 context fingerprints with allowlisted
deltas or comparisons; exact integer
deltas as strings; exact per-day integer rates as integer or rational strings;
approximate per-day timing rates; reset boundaries; server build; and
encrypted-artifact SHA-256 hashes. Each artifact hash is explicitly labelled
`source: encrypted_artifact`.

Each I/O context retains its stable `op_bytes` operation size alongside its
counter deltas, so byte-volume calculations remain auditable.

Cron run status counts are rolling 24-hour window gauges. They are published as
separate before/after values, never as an interval delta; only cumulative
database, WAL, statement, relation, and I/O counters support delta math.

Statement fingerprints are derived from normalized statement shape plus stable
role/database context using the private HMAC key; engine-generated statement IDs
are not read or used as comparison keys. A fingerprint is an interval correlation
key, not a permanent business-operation name. Map it to a reviewed operation label
using the encrypted raw export, especially for PostgreSQL 17-versus-18 replay.

## Automatic rejection conditions

The delta tool exits non-zero instead of producing a successful empty or partial
summary when any of these conditions is observed:

- end capture is not later than start capture;
- deployed identifier is not a full 40-character commit SHA;
- server restart, numeric version change, or server-build change;
- database, `pg_stat_statements`, `pg_stat_io`, or WAL statistics reset;
- `pg_stat_statements` deallocation count changes;
- a previously captured statement disappears;
- `pg_stat_reset_single_table_counters()` or another per-relation statistics
  reset occurs during the interval; this is an operator-enforced rejection
  because PostgreSQL 17 has no per-relation reset timestamp to compare;
- a statement entry has a new or missing `stats_since` boundary, including a
  targeted `pg_stat_statements_reset` that does not alter the global reset time;
- table or index identities change between snapshots, or their cumulative
  activity counters regress;
- any collection-affecting setting changes, including `track_io_timing`,
  `track_wal_io_timing`, or the captured `pg_stat_statements` settings
  (including utility tracking);
- any compared cumulative database, WAL, statement, or I/O counter regresses;
- the statements array, stable statement context, required boundary, or counter
  data is missing or malformed;
- either encrypted evidence artifact is missing or empty.
- the private fingerprint HMAC key is missing, not binary data, or shorter than
  32 bytes.

An unchanged `null` `pg_stat_database.stats_reset` is valid when the postmaster
start time is also unchanged. A transition from `null` to a timestamp is a reset
and is rejected.

## Review and publication

Before publishing a sanitized summary:

1. Confirm both platform manifests contain the same exact deployed SHA and
   Supabase build.
2. Confirm the tool reports `reset_safety.accepted: true`.
3. Review the summary for accidental sensitive fields despite the allowlist.
4. Validate the separately collected client telemetry for p95/p99, errors,
   timeouts, and throughput.
5. Attribute changes to normalized business operations and traffic volume; do not
   treat a cumulative mean or a single plan as an SLO verdict.
6. Record any incompatible interval as rejected evidence and schedule a new clean
   pair. Never edit counters to make a rejected interval pass.

Only after a real complete interval may the reviewed sanitized summary be added
under `docs/perf/postgres-baselines/`. This implementation intentionally contains
no fabricated production snapshot or performance claim.
