/**
 * Normalize a merchant business name: collapse internal whitespace runs to a
 * single space and trim the ends.
 *
 * This mirrors the DB-side `aa_normalize_merchant_business_name` BEFORE trigger
 * (`btrim(regexp_replace(name, '\s+', ' ', 'g'))`). Apply it at onboarding entry
 * so the name baked into `page_configs` (Header.storeName + "Welcome to <name>"
 * hero title) is byte-identical to what the trigger stores in
 * `merchants.business_name` — otherwise the two diverge on whitespace from day
 * one and a later rename can't exact-match the baked value to propagate it.
 */
export function normalizeBusinessName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, ' ').trim();
}
