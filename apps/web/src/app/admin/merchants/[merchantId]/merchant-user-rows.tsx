import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ADMIN_ACTIVE_INSTALLS_LABEL,
  ADMIN_NO_EMAIL_LABEL,
  ADMIN_UNKNOWN_USER_ID_LABEL,
  ADMIN_UNKNOWN_USER_LABEL,
} from '@/config/admin-merchants';
import {
  ADMIN_MERCHANT_SURFACE_LABELS,
  formatAdminMerchantDate,
  formatAdminMerchantEnumLabel,
  getAdminMerchantSurfaceVariant,
} from '@/lib/admin-merchant-utils';
import type { AdminMerchantUserRecord } from '@/types/admin-merchant-users';

export function MerchantUserRows({
  emptyLabel,
  users,
}: {
  emptyLabel: string;
  users: AdminMerchantUserRecord[];
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <caption className="sr-only">Merchant users and access</caption>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Surfaces</TableHead>
            <TableHead>Apps</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const primaryDisplay =
              user.name ??
              user.email ??
              user.userId ??
              ADMIN_UNKNOWN_USER_LABEL;
            // When email is the primary label, show user ID as the secondary identifier.
            const secondaryDisplay =
              user.name || !user.email
                ? (user.email ?? ADMIN_NO_EMAIL_LABEL)
                : (user.userId ?? ADMIN_UNKNOWN_USER_ID_LABEL);

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{primaryDisplay}</p>
                    <p className="text-sm text-muted-foreground">
                      {secondaryDisplay}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant="outline" className="capitalize">
                      {formatAdminMerchantEnumLabel(user.role)}
                    </Badge>
                    {user.staffRole ? (
                      <p className="text-xs text-muted-foreground capitalize">
                        {formatAdminMerchantEnumLabel(user.staffRole)}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.surfaces.map((surface) => (
                      <Badge
                        key={surface}
                        variant={getAdminMerchantSurfaceVariant(surface)}
                      >
                        {ADMIN_MERCHANT_SURFACE_LABELS[surface]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>
                      {user.activeAppInstallations}{' '}
                      {ADMIN_ACTIVE_INSTALLS_LABEL}
                    </p>
                    {(user.appPlatforms ?? []).length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {(user.appPlatforms ?? []).join(', ')}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatAdminMerchantDate(user.lastSeenAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
