/**
 * Single source of truth for how a staff permission map grants a (resource,
 * action). Used by the API authorizer (hasPermission), the server page gate
 * (ensurePermission), and the client nav gate (MerchantProvider.hasPermission)
 * so all three stay in lock-step. Does NOT special-case owners — callers handle
 * `isOwner` (owners bypass permission checks entirely).
 *
 * Accepted grant shapes:
 *   { full_access: { all: true } }    -> everything
 *   { '*': { '*': true } }            -> everything
 *   { '*': { <action>: true } }       -> that action on every resource
 *   { <resource>: { '*': true } }     -> every action on that resource
 *   { <resource>: { all: true } }     -> (legacy) every action on that resource
 *   { <resource>: { <action>: true } }-> the specific grant
 */
export function permissionGrantsAccess(
  permissions: Record<string, Record<string, boolean>> | null | undefined,
  resource: string,
  action: string
): boolean {
  if (!permissions) return false;
  return (
    permissions.full_access?.all === true ||
    permissions['*']?.['*'] === true ||
    permissions['*']?.[action] === true ||
    permissions[resource]?.['*'] === true ||
    permissions[resource]?.all === true ||
    permissions[resource]?.[action] === true
  );
}
