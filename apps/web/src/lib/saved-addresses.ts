export interface SavedAddressLike {
  id: string;
  is_default?: boolean;
}

export function normalizeSavedAddresses<T extends SavedAddressLike>(
  addresses: T[]
): T[] {
  if (addresses.length !== 1) {
    return addresses;
  }

  const [onlyAddress] = addresses;
  if (!onlyAddress || onlyAddress.is_default) {
    return addresses;
  }

  return [{ ...onlyAddress, is_default: true }];
}
