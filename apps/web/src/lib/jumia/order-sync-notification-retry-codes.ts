export const POSTGREST_CODES: readonly string[] = Object.freeze([
  'PGRST000',
  'PGRST001',
  'PGRST002',
  'PGRST003',
]);

export const POSTGRES_PREFIXES: readonly string[] = Object.freeze([
  '08',
  '53',
  '57',
  '58',
]);

type JumiaNotificationMarkerRetryCodes = Readonly<{
  postgrestCodes: typeof POSTGREST_CODES;
  postgresPrefixes: typeof POSTGRES_PREFIXES;
}>;

/**
 * Transient notification-marker persistence failures worth retrying.
 * PostgREST PGRST000-PGRST003 cover connection/configuration failures, while
 * PostgreSQL SQLSTATE classes 08, 53, 57, and 58 cover connection, resource,
 * operator-intervention, and system-error failures.
 */
export const JUMIA_NOTIFICATION_MARKER_RETRY_CODES: JumiaNotificationMarkerRetryCodes =
  Object.freeze({
    postgrestCodes: POSTGREST_CODES,
    postgresPrefixes: POSTGRES_PREFIXES,
  });
