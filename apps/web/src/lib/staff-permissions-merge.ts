/**
 * Per-resource DEEP merge of a staff role's default permissions with the staff
 * member's custom overrides. This is the single JS mirror of the database
 * function `public.get_staff_permissions` (and `public.get_user_access`), which
 * both overlay `COALESCE(default_resource, '{}') || custom_resource` per
 * top-level resource key.
 *
 * Deep merge (not a shallow top-level replace) matters: a partial custom object
 * such as `{ integrations: { manage: true } }` must PRESERVE the default
 * `integrations.view` rather than clobber the whole resource object. Keeping
 * this identical to the RPC keeps RLS (check_staff_permission) and the app
 * authorizers (permissionGrantsAccess) in lock-step, so a scoped client write
 * that passes app authorization does not silently no-op under RLS.
 *
 * An explicit custom action still wins over the default (last write into `||`),
 * so `{ orders: { edit: false } }` sets `orders.edit=false` while leaving the
 * other default `orders.*` actions intact — exactly matching the RPC.
 */
export function mergeStaffPermissions(
  defaults: Record<string, Record<string, boolean>> | null | undefined,
  custom: Record<string, Record<string, boolean>> | null | undefined
): Record<string, Record<string, boolean>> {
  const merged: Record<string, Record<string, boolean>> = {
    ...(defaults ?? {}),
  };

  for (const [resource, actions] of Object.entries(custom ?? {})) {
    merged[resource] = {
      ...merged[resource],
      ...actions,
    };
  }

  return merged;
}
