/**
 * Terminal MyCover claim states — once a claim reaches one of these, no further
 * customer action (inspection / file-claim) should be offered. Shared by web
 * and mobile storefronts so both surfaces agree on what "done" means.
 */
export const TERMINAL_CLAIM_STATUSES: ReadonlySet<string> = new Set([
  'declined',
  'disapproved',
  'offer_rejected',
  'paid',
  'rejected',
]);

/** True when a (case-insensitive) claim status token is terminal. */
export function isTerminalClaimStatusToken(
  status: string | null | undefined
): boolean {
  const token = status?.trim().toLowerCase();
  return token ? TERMINAL_CLAIM_STATUSES.has(token) : false;
}
