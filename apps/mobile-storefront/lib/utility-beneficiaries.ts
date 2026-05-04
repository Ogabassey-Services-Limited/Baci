import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'utility-beneficiaries';
const MAX_BENEFICIARIES = 10;

export interface UtilityBeneficiary {
  id: string;
  customerId: string;
  customerName: string;
  billerId: string;
  billerName: string;
  billItemIdentifier: string;
  lastUsed: number;
}

function isValidBeneficiary(item: unknown): item is UtilityBeneficiary {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    typeof (item as Record<string, unknown>).customerId === 'string' &&
    typeof (item as Record<string, unknown>).customerName === 'string' &&
    typeof (item as Record<string, unknown>).billerId === 'string' &&
    typeof (item as Record<string, unknown>).billItemIdentifier === 'string' &&
    typeof (item as Record<string, unknown>).lastUsed === 'number'
  );
}

// Scope storage to the authenticated customer so beneficiaries do not leak
// across users on the same device. Returns null when no customer is
// signed in, signalling callers to skip read/write operations.
function getStorageKey(
  authenticatedCustomerId: string | null | undefined
): string | null {
  if (!authenticatedCustomerId) return null;
  return `${STORAGE_KEY_PREFIX}:${authenticatedCustomerId}`;
}

export async function getBeneficiaries(
  authenticatedCustomerId: string | null | undefined
): Promise<UtilityBeneficiary[]> {
  const key = getStorageKey(authenticatedCustomerId);
  if (!key) return [];
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).filter(isValidBeneficiary);
  } catch (err) {
    console.error('utility-beneficiaries.getBeneficiaries failed', err);
    return [];
  }
}

let saveLock: Promise<void> = Promise.resolve();

export async function saveBeneficiary(
  authenticatedCustomerId: string | null | undefined,
  input: Omit<UtilityBeneficiary, 'id' | 'lastUsed'>
): Promise<void> {
  const key = getStorageKey(authenticatedCustomerId);
  if (!key) return;
  saveLock = saveLock
    .then(async () => {
      const id = [input.billerId, input.billItemIdentifier, input.customerId]
        .map(encodeURIComponent)
        .join(':');
      const existing = await getBeneficiaries(authenticatedCustomerId);
      const updated = [
        { ...input, id, lastUsed: Date.now() },
        ...existing.filter((b) => b.id !== id),
      ].slice(0, MAX_BENEFICIARIES);
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    })
    .catch((err) => {
      // Surface failures so storage-quota / serialization issues are
      // diagnosable. Swallow rather than rethrow so a single failure
      // doesn't poison the subsequent save chain.
      console.error('utility-beneficiaries.saveBeneficiary failed', err);
    });
  return saveLock;
}

export function filterBeneficiaries(
  beneficiaries: UtilityBeneficiary[],
  billerId: string,
  billItemIdentifier: string
): UtilityBeneficiary[] {
  return beneficiaries.filter(
    (b) =>
      b.billerId === billerId && b.billItemIdentifier === billItemIdentifier
  );
}
