/**
 * Shared authorization for category management (B1-lite).
 *
 * PERMISSION CONTRACT — owner-only, deliberately. The category mutation RLS
 * policies have no staff branch, so this is the one rule that cannot diverge
 * from the database without widening authority.
 */
export const CATEGORY_MANAGEMENT_RULE = 'owner-only' as const;
