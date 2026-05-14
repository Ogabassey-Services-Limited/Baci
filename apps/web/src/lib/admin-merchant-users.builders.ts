import type {
  AdminMerchantCustomerRow,
  AdminMerchantPushTokenRow,
  AdminMerchantRow,
  AdminMerchantStaffRow,
} from '@/lib/admin-merchant-users.types';
import type {
  AdminMerchantSurface,
  AdminMerchantUserRecord,
} from '@/types/admin-merchant-users';

function getCustomerName(customer: AdminMerchantCustomerRow): string | null {
  if (customer.full_name) {
    return customer.full_name;
  }

  const joined = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return joined || null;
}

function getLatestTimestamp(values: Array<string | null>): string | null {
  const timestamps = values
    .flatMap((value) => {
      if (!value) {
        return [];
      }

      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? [] : [{ timestamp, value }];
    })
    .sort((left, right) => right.timestamp - left.timestamp);

  return timestamps[0]?.value ?? null;
}

function getDeviceAccess(
  userId: string | null,
  baseSurfaces: AdminMerchantSurface[],
  pushTokens: AdminMerchantPushTokenRow[]
) {
  const surfaces = new Set<AdminMerchantSurface>(baseSurfaces);
  const activeTokens = userId
    ? pushTokens.filter((token) => token.user_id === userId && token.is_active)
    : [];

  for (const token of activeTokens) {
    if (token.app_type === 'admin') {
      surfaces.add('admin_app');
    }
    if (token.app_type === 'storefront') {
      surfaces.add('storefront_app');
    }
  }

  return {
    activeAppInstallations: activeTokens.length,
    appPlatforms: Array.from(
      new Set(
        activeTokens
          .map((token) => token.platform)
          .filter((platform): platform is string => Boolean(platform))
      )
    ).sort(),
    lastSeenAt: getLatestTimestamp([
      ...activeTokens.map((token) => token.last_used_at),
      ...activeTokens.map((token) => token.updated_at),
    ]),
    surfaces: Array.from(surfaces),
  };
}

export function buildOwnerRecord(
  merchant: AdminMerchantRow,
  pushTokens: AdminMerchantPushTokenRow[]
): AdminMerchantUserRecord {
  const access = getDeviceAccess(merchant.user_id, ['web'], pushTokens);

  return {
    activeAppInstallations: access.activeAppInstallations,
    appPlatforms: access.appPlatforms,
    createdAt: merchant.created_at,
    email: merchant.email,
    id: merchant.user_id ?? merchant.id,
    lastSeenAt: access.lastSeenAt,
    name: merchant.business_name,
    role: 'owner',
    staffRole: null,
    status: 'active',
    surfaces: access.surfaces,
    userId: merchant.user_id,
  };
}

export function buildStaffRecord(
  staff: AdminMerchantStaffRow,
  pushTokens: AdminMerchantPushTokenRow[]
): AdminMerchantUserRecord {
  const access = getDeviceAccess(staff.user_id, ['web'], pushTokens);

  return {
    activeAppInstallations: access.activeAppInstallations,
    appPlatforms: access.appPlatforms,
    createdAt: staff.created_at,
    email: staff.email,
    id: staff.id,
    lastSeenAt: getLatestTimestamp([staff.last_login_at, access.lastSeenAt]),
    name: staff.name,
    role: 'staff',
    staffRole: staff.role,
    status: staff.status ?? 'unknown',
    surfaces: access.surfaces,
    userId: staff.user_id,
  };
}

export function buildCustomerRecord(
  customer: AdminMerchantCustomerRow,
  pushTokens: AdminMerchantPushTokenRow[]
): AdminMerchantUserRecord {
  const access = getDeviceAccess(customer.user_id, ['web'], pushTokens);

  return {
    activeAppInstallations: access.activeAppInstallations,
    appPlatforms: access.appPlatforms,
    createdAt: customer.created_at,
    email: customer.email,
    id: customer.id,
    lastSeenAt: getLatestTimestamp([customer.last_login_at, access.lastSeenAt]),
    name: getCustomerName(customer),
    role: 'customer',
    staffRole: null,
    status: customer.deleted_at ? 'deleted' : 'active',
    surfaces: access.surfaces,
    userId: customer.user_id,
  };
}

export function buildUnmatchedAppUsers(
  pushTokens: AdminMerchantPushTokenRow[],
  knownUserIds: Set<string>
): AdminMerchantUserRecord[] {
  const grouped = new Map<string, AdminMerchantPushTokenRow[]>();

  for (const token of pushTokens) {
    if (!token.user_id || knownUserIds.has(token.user_id)) {
      continue;
    }

    const existingTokens = grouped.get(token.user_id);
    if (existingTokens) {
      existingTokens.push(token);
      continue;
    }

    grouped.set(token.user_id, [token]);
  }

  return Array.from(grouped.entries()).map(([userId, tokens]) => {
    const access = getDeviceAccess(userId, [], tokens);
    return {
      activeAppInstallations: access.activeAppInstallations,
      appPlatforms: access.appPlatforms,
      createdAt: getLatestTimestamp(tokens.map((token) => token.created_at)),
      email: null,
      id: userId,
      lastSeenAt: access.lastSeenAt,
      name: null,
      role: 'app_user',
      staffRole: null,
      status: 'app_registered',
      surfaces: access.surfaces,
      userId,
    };
  });
}
