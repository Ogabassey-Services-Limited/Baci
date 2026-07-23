import { resolveMcpPaystackDvaToolAvailability } from './mcp-paystack-dva-tool-availability';

interface StoredDva {
  accountName: string;
  accountNumber: string;
  bankName: string;
}

export function resolveMcpPaystackDvaAccess(
  env: NodeJS.ProcessEnv = process.env,
  reportError?: (message: string) => void
) {
  // One gate owns both new DVA tool registration and disclosure/redaction of
  // any DVA metadata already stored on an order.
  const toolEnabled = resolveMcpPaystackDvaToolAvailability(env, reportError);
  return {
    getDisclosableStoredDva(metadata: unknown): StoredDva | null {
      if (!toolEnabled || !metadata || typeof metadata !== 'object') return null;
      const value = metadata as Record<string, unknown>;
      if (
        typeof value.account_name !== 'string' ||
        typeof value.account_number !== 'string' ||
        typeof value.bank_name !== 'string'
      ) {
        return null;
      }
      return {
        accountName: value.account_name,
        accountNumber: value.account_number,
        bankName: value.bank_name,
      };
    },
    toolEnabled,
  } as const;
}
