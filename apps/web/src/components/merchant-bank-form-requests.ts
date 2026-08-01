import { apiPost } from '@/lib/api-client';
import type { Bank } from '@/lib/paystack';
import type { SaveBankPayload } from './merchant-bank-form-types';

export type AccountVerificationResult =
  | { status: 'verified'; accountName: string }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export async function resolvePaystackAccount(
  accountNumber: string,
  bankCode: string
): Promise<AccountVerificationResult> {
  try {
    const data = await apiPost<{
      account_name: string;
      account_number: string;
      bank_id: number | null;
    }>('/api/paystack/resolve', { accountNumber, bankCode });

    return data.account_name
      ? { status: 'verified', accountName: data.account_name }
      : { status: 'empty' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to verify account. Please try again.',
    };
  }
}

export type LoadBanksResult =
  | { status: 'ok'; banks: Bank[] }
  | { status: 'error'; error: unknown };

export async function loadPaystackBanks(): Promise<LoadBanksResult> {
  try {
    const response = await fetch('/api/paystack/banks');
    const data = await response.json();
    if (!data.banks) return { status: 'ok', banks: [] };

    const seenCodes = new Set<string>();
    const banks = (data.banks as Bank[]).filter((bank) => {
      if (seenCodes.has(bank.code)) return false;
      seenCodes.add(bank.code);
      return true;
    });
    return { status: 'ok', banks };
  } catch (error) {
    return { status: 'error', error };
  }
}

export type SaveBankResult =
  | { status: 'ok'; accountName: string }
  | { status: 'noop' }
  | { status: 'error'; message: string };

export async function saveBankSubaccount(
  payload: SaveBankPayload
): Promise<SaveBankResult> {
  try {
    const result = await apiPost<{
      success: boolean;
      accountName: string;
      subaccountCode: string | null;
    }>('/api/paystack/subaccount', payload);
    return result.success
      ? { status: 'ok', accountName: result.accountName }
      : { status: 'noop' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Could not save bank details.',
    };
  }
}
