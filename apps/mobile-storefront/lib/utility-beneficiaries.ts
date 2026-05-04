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

export async function getBeneficiaries(): Promise<UtilityBeneficiary[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UtilityBeneficiary[]) : [];
  } catch {
    return [];
  }
}

export async function saveBeneficiary(
  input: Omit<UtilityBeneficiary, 'id' | 'lastUsed'>
): Promise<void> {
  const id = `${encodeURIComponent(input.billerId)}:${encodeURIComponent(input.billItemIdentifier)}:${encodeURIComponent(input.customerId)}`;
  const existing = await getBeneficiaries();
  const updated = [
    { ...input, id, lastUsed: Date.now() },
    ...existing.filter((b) => b.id !== id),
  ].slice(0, MAX_BENEFICIARIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
