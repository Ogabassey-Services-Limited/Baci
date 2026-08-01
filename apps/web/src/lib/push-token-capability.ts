type PushTokenQuery = {
  gte: (column: string, value: number) => unknown;
};

export function filterPushTokensByShipmentUpdateCapability<
  T extends PushTokenQuery,
>(query: T, requiredCapability?: number): T {
  if (requiredCapability !== undefined) {
    return query.gte('shipment_update_capability', requiredCapability) as T;
  }
  return query;
}
