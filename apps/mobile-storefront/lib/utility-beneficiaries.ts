import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'utility-beneficiaries';
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

export async function getBeneficiaries(): Promise<UtilityBeneficiary[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).filter(isValidBeneficiary);
  } catch {
    return [];
  }
}

let saveLock: Promise<void> = Promise.resolve();

export async function saveBeneficiary(
  input: Omit<UtilityBeneficiary, 'id' | 'lastUsed'>
): Promise<void> {
  saveLock = saveLock
    .then(async () => {
      const id = [input.billerId, input.billItemIdentifier, input.customerId]
        .map(encodeURIComponent)
        .join(':');
      const existing = await getBeneficiaries();
      const updated = [
        { ...input, id, lastUsed: Date.now() },
        ...existing.filter((b) => b.id !== id),
      ].slice(0, MAX_BENEFICIARIES);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    })
    .catch(() => {});
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
