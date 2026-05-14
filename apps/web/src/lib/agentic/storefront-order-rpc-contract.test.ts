import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(
  currentDirectory,
  '../../../../../supabase/migrations'
);
const migrationFilePattern = /^\d{14}.*\.sql$/;
const storefrontOrderRpcNamePattern = String.raw`(?:(?:"public"|public)\s*\.\s*(?:"create_storefront_order"|create_storefront_order)|(?:"create_storefront_order"|create_storefront_order))`;
const storefrontOrderRpcDefinitionPattern = new RegExp(
  String.raw`CREATE\s+OR\s+REPLACE\s+FUNCTION\s+${storefrontOrderRpcNamePattern}\s*\(`,
  'i'
);
const storefrontOrderRpcDynamicPatchPatterns = [
  /pg_get_functiondef\s*\([^;]*create_storefront_order/i,
  new RegExp(
    String.raw`EXECUTE\s+(?:format\s*\([^;]*create_storefront_order|['"][^;]*create_storefront_order|[^;]*CREATE\s+OR\s+REPLACE\s+FUNCTION\s+${storefrontOrderRpcNamePattern})`,
    'i'
  ),
];
const ambiguousCustomerConflictTargetPattern =
  /ON\s+CONFLICT\s*\(\s*merchant_id\s*,\s*email\s*\)/i;

function readLatestStorefrontOrderRpcMigrationSql() {
  for (const fileName of readdirSync(migrationsDirectory)
    .filter((file) => migrationFilePattern.test(file))
    .sort()
    .reverse()) {
    const sql = readFileSync(resolve(migrationsDirectory, fileName), 'utf8');
    if (
      storefrontOrderRpcDefinitionPattern.test(sql) ||
      storefrontOrderRpcDynamicPatchPatterns.some((pattern) =>
        pattern.test(sql)
      )
    ) {
      return sql;
    }
  }

  throw new Error('No create_storefront_order migration found');
}

describe('agentic storefront order RPC contract', () => {
  it('replaces the latest RPC explicitly instead of patching function text dynamically', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toMatch(storefrontOrderRpcDefinitionPattern);
    expect(sql).not.toContain('pg_get_functiondef');
    expect(sql).not.toContain('EXECUTE v_updated_definition');
  });

  it('keeps latest RPC agentic checkout buyers guest-scoped while preserving standard auth binding', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    const agenticGuardIndex = sql.indexOf(
      'IF public.is_agentic_checkout_context() THEN'
    );
    const nullUserIndex = sql.indexOf('p_user_id := NULL;', agenticGuardIndex);
    const standardAuthIndex = sql.indexOf(
      'ELSIF v_user_id IS NOT NULL THEN',
      nullUserIndex
    );

    expect(agenticGuardIndex).toBeGreaterThan(-1);
    expect(nullUserIndex).toBeGreaterThan(agenticGuardIndex);
    expect(standardAuthIndex).toBeGreaterThan(nullUserIndex);
    expect(sql).toContain('p_user_id := v_user_id;');
    expect(sql).toContain("RAISE EXCEPTION 'user_id_mismatch';");
    expect(sql).toContain("RAISE EXCEPTION 'cannot_set_user_id_anonymously';");
    expect(sql).toMatch(
      /INSERT INTO customers \([\s\S]*user_id[\s\S]*p_user_id/
    );
  });

  // B2 (Δ-9): the named `ON CONFLICT ON CONSTRAINT` approach was
  // replaced with a retry-on-unique_violation loop that catches ALL
  // four customer unique indexes (email, lower(email), user_id,
  // phone). The output-column-ambiguity concern that motivated the
  // named constraint is moot because B2 no longer uses an ON CONFLICT
  // clause at all — INSERT raises, the EXCEPTION block re-SELECTs,
  // and UPDATE writes to the winner's row.
  it('replaces the named ON CONFLICT with a retry-on-unique_violation loop and avoids output-column ambiguity', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toMatch(storefrontOrderRpcDefinitionPattern);
    expect(sql).not.toContain(
      'ON CONFLICT ON CONSTRAINT customers_merchant_id_email_key'
    );
    expect(sql).not.toMatch(ambiguousCustomerConflictTargetPattern);
    expect(sql).toContain('EXCEPTION WHEN unique_violation THEN');
    expect(sql).toContain("RAISE EXCEPTION 'customer_upsert_failed'");
  });

  it('resolves authenticated customers by user before unbound guest phone fallback', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    const userLookupIndex = sql.indexOf('AND c.user_id = p_user_id');
    const phoneLookupIndex = sql.indexOf(
      'AND c.phone = v_normalized_customer_phone'
    );
    // B2 wraps the INSERT in a retry loop, so the literal "INSERT
    // INTO customers" first appears inside that loop. Still must
    // come after the user_id + phone SELECTs.
    const customerInsertIndex = sql.indexOf('INSERT INTO customers');

    expect(userLookupIndex).toBeGreaterThan(-1);
    expect(phoneLookupIndex).toBeGreaterThan(-1);
    expect(customerInsertIndex).toBeGreaterThan(-1);
    expect(userLookupIndex).toBeLessThan(phoneLookupIndex);
    expect(phoneLookupIndex).toBeLessThan(customerInsertIndex);
    // Δ-97 / Codex P1: phone-only fallback is restricted to GUEST
    // checkouts (p_user_id IS NULL). Phone numbers are recycled by
    // telcos (NIST SP 800-63B AAL1); auto-claiming an existing
    // customer row from an authed checkout based on phone alone
    // would let one auth user inherit a stranger's order history.
    expect(sql).toContain(
      'IF v_customer_id IS NULL\n    AND v_normalized_customer_phone IS NOT NULL\n    AND p_user_id IS NULL'
    );
    expect(sql).toContain('AND c.user_id IS NULL');
    expect(sql).toContain(
      "v_normalized_customer_phone TEXT := NULLIF(trim(COALESCE(p_customer_phone, '')), '')"
    );
    expect(sql).toContain('v_customer_record_phone,');
    // B2 dropped the ON CONFLICT EXCLUDED path; the phone-conflict
    // skip preflight (NULL out phone if another customer owns it)
    // is what now keeps the retry loop from spinning on phone races.
    expect(sql).toContain(
      'AND existing_phone.phone = v_normalized_customer_phone'
    );
  });

  // Δ-97 / Codex P1 regression: prevents the phone-recycling
  // identity-merge from creeping back in. Phone numbers are recycled
  // by telcos every ~90 days (NIST SP 800-63B AAL1, OWASP ASVS L1
  // §6.5.4 "do not link accounts based on unverified attributes").
  it('does not auto-claim a customer row via phone fallback for an authenticated checkout (Δ-97)', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // Phone fallback IF must include `AND p_user_id IS NULL`.
    expect(sql).toContain(
      'AND v_normalized_customer_phone IS NOT NULL\n    AND p_user_id IS NULL'
    );

    // Pin the comment so a future cleanup doesn't quietly strip the
    // guard along with its justification.
    expect(sql).toContain('Codex P1');
    expect(sql).toContain('Phone numbers are recycled by');

    // The UPDATE branch still auto-claims a user_id when the matched
    // row has c.user_id IS NULL — that's correct for email-matched
    // and user-id-matched rows. The Δ-97 guard ensures phone never
    // feeds rows into that branch for authed users.
    expect(sql).toContain('WHEN c.user_id IS NULL THEN p_user_id');
  });

  // Δ-98 / Jules High regression: PL/pgSQL `NULL + 1 = NULL` and
  // `NULL > 3 = NULL` (falsy), so an uninitialized retry counter
  // would silently disable the > 3 exit condition and spin forever.
  // The inline `v_retry_attempt := 0;` before the LOOP is the
  // primary safety; the DECLARE-level `INT := 0` is belt-and-braces
  // against a future refactor accidentally bypassing the inline
  // assignment.
  it('initializes the retry counter to 0 in DECLARE to rule out NULL-math infinite loops (Δ-98)', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();
    expect(sql).toContain('v_retry_attempt INT := 0;');
  });

  it('does not write a conflicting phone to a new customer record', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toContain('v_customer_record_phone TEXT;');
    expect(sql).toContain(
      'v_customer_record_phone := v_normalized_customer_phone;'
    );
    expect(sql).toContain('IF v_normalized_customer_phone IS NOT NULL');
    expect(sql).toContain('v_customer_record_phone := NULL;');
    expect(sql).toContain('WHERE existing_phone.merchant_id = p_merchant_id');
    expect(sql).toContain(
      'AND existing_phone.phone = v_normalized_customer_phone'
    );
  });

  it('serializes same-phone customer resolution and applies stock updates in a deterministic order', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    expect(sql).toContain('PERFORM pg_advisory_xact_lock(');
    expect(sql).toContain('hashtext(p_merchant_id::text)');
    expect(sql).toContain('hashtext(v_normalized_customer_phone)');
    expect(sql).toContain('ORDER BY t.product_id, t.variant_id');
  });
});

// B2 (Δ-9): defense-in-depth checks on the new retry-on-unique_violation
// path. These guard against accidentally reverting the customer upsert
// hardening that closed the Efosa-style `idx_customers_merchant_user`
// race. Each assertion targets a specific layer:
//   - advisory locks on (merchant, user_id) and (merchant, email)
//     serialize same-identity concurrent inserts
//   - the retry loop has a bounded counter so a runaway race can't
//     spin forever
//   - the EXCEPTION block re-SELECTs by user_id OR email and UPDATEs
//     defensively, never re-throws on unique_violation until the
//     counter exhausts
describe('agentic storefront order RPC contract — B2 customer upsert hardening', () => {
  it('acquires advisory locks on (merchant, user_id) and (merchant, email) before the customer upsert', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // The user_id lock is conditional (only when p_user_id IS NOT NULL).
    expect(sql).toMatch(
      /IF p_user_id IS NOT NULL THEN\s+PERFORM pg_advisory_xact_lock\(\s+hashtextextended\(p_merchant_id::text \|\| ':' \|\| p_user_id::text, 0\)/
    );
    // The email lock is unconditional.
    expect(sql).toContain(
      "p_merchant_id::text || ':' || v_normalized_customer_email, 1"
    );
  });

  it('runs the INSERT inside a bounded retry loop with a re-SELECT fallback', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // Retry counter declared and incremented; cap at 3.
    expect(sql).toContain('v_retry_attempt INT');
    expect(sql).toContain('v_retry_attempt := v_retry_attempt + 1;');
    expect(sql).toContain('IF v_retry_attempt > 3 THEN');

    // EXCEPTION block sets v_customer_id := NULL then re-SELECTs.
    expect(sql).toContain('EXCEPTION WHEN unique_violation THEN');
    // Re-SELECT must check BOTH user_id and email so any of the four
    // unique indexes that tripped can be recovered.
    expect(sql).toMatch(
      /\(p_user_id IS NOT NULL AND c\.user_id = p_user_id\)\s+OR lower\(c\.email\) = v_normalized_customer_email/
    );
  });

  it('exits the loop after a defensive UPDATE on the winner row, not by re-throwing', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // The retry path UPDATEs the visible-winner row with COALESCE'd
    // identity fields (phone, user_id, first/last name, email) so a
    // peer's partial row gets backfilled by our request's data.
    expect(sql).toMatch(
      /UPDATE customers c\s+SET\s+phone = COALESCE\(c\.phone, v_customer_record_phone\),\s+user_id = COALESCE\(c\.user_id, p_user_id\)/
    );
    // EXIT after a successful winner-row UPDATE so we don't spin.
    expect(sql).toMatch(
      /UPDATE customers c[\s\S]*?WHERE c\.id = v_customer_id;\s+EXIT;\s+END IF;/
    );
  });

  it('preserves the phone-conflict-skip preflight so the retry loop never spins on phone races', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // Before the retry loop, the insert-path NULLs out the phone if
    // another customer in the same merchant already owns it.
    expect(sql).toMatch(
      /v_customer_record_phone := v_normalized_customer_phone;[\s\S]*?IF v_normalized_customer_phone IS NOT NULL[\s\S]*?v_customer_record_phone := NULL;/
    );
  });
});

// B3 (plan §5 B3): fail-closed for missing shipping quote. The RPC must
// raise `shipping_quote_required` when a shipping provider is supplied
// without an accompanying quote id — closes the legacy `|| 'GIGL'`
// silent-default bug at apps/web/src/app/checkout/page.tsx:1217.
describe('agentic storefront order RPC contract — B3 shipping_quote_required', () => {
  it('raises shipping_quote_required when shipping_provider is set without a quote id', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // Predicate must be exactly the plan's contract: provider non-null
    // AND quote id null. Refusing a stricter predicate (e.g. checking
    // shipping_fee > 0) keeps the rule simple and aligns with the
    // client's invariant that pickup/airport send `shipping_provider:
    // null`.
    expect(sql).toMatch(
      /IF p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL THEN\s+RAISE EXCEPTION 'shipping_quote_required';/
    );
  });

  it('runs the shipping_quote_required check after param validation but before merchant lookup', () => {
    const sql = readLatestStorefrontOrderRpcMigrationSql();

    // Param validation (payment_status check) → shipping guard →
    // merchant existence check. Fail fast without touching merchants.
    const paymentStatusIndex = sql.indexOf(
      "RAISE EXCEPTION 'invalid_payment_status';"
    );
    const shippingGuardIndex = sql.indexOf(
      "RAISE EXCEPTION 'shipping_quote_required';"
    );
    const merchantLookupIndex = sql.indexOf(
      'PERFORM 1 FROM merchants m WHERE m.id = p_merchant_id'
    );

    expect(paymentStatusIndex).toBeGreaterThan(-1);
    expect(shippingGuardIndex).toBeGreaterThan(paymentStatusIndex);
    expect(merchantLookupIndex).toBeGreaterThan(shippingGuardIndex);
  });
});
