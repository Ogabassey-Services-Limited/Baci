import { fetchWithCsrf } from '@/lib/api-client';
import type { Branch, StaffAccount } from './virtual-terminal-types';

export class VirtualTerminalRequestError extends Error {
  constructor(
    message: string,
    readonly resource: 'accounts' | 'branches' | 'connection'
  ) {
    super(message);
  }
}

export async function fetchVirtualTerminalData(
  merchantId: string
): Promise<{ accounts: StaffAccount[]; branches: Branch[] }> {
  let accountsResponse: Response;
  let branchesResponse: Response;
  try {
    [accountsResponse, branchesResponse] = await Promise.all([
      fetch(
        `/api/paystack/virtual-terminal?${new URLSearchParams({ merchantId })}`
      ),
      fetch('/api/branches', {
        headers: { 'x-baci-merchant-id': merchantId },
      }),
    ]);
  } catch {
    throw new VirtualTerminalRequestError(
      'Unable to connect to the server. Please check your connection.',
      'connection'
    );
  }

  if (!accountsResponse.ok) {
    throw new VirtualTerminalRequestError(
      'Unable to fetch staff accounts. Please refresh the page.',
      'accounts'
    );
  }
  if (!branchesResponse.ok) {
    throw new VirtualTerminalRequestError(
      'Unable to fetch branch data. Please refresh the page.',
      'branches'
    );
  }

  const [accountsData, branchesData] = await Promise.all([
    accountsResponse.json(),
    branchesResponse.json(),
  ]);
  return {
    accounts: accountsData.terminals || [],
    branches: branchesData.branches || [],
  };
}

async function assertMutationSucceeded(
  response: Response,
  fallback: string
): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  throw new Error(typeof body.error === 'string' ? body.error : fallback);
}

export async function createVirtualTerminalAccount(
  merchantId: string,
  body: {
    name: string;
    staffId?: string;
    branchId?: string;
    destinations: never[];
  }
): Promise<void> {
  const response = await fetchWithCsrf('/api/paystack/virtual-terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId, ...body }),
  });
  await assertMutationSucceeded(response, 'Failed to create account');
}

export async function createVirtualTerminalBranch(
  merchantId: string,
  body: {
    name: string;
    address?: string;
    city?: string;
    isDefault: boolean;
  }
): Promise<void> {
  const response = await fetchWithCsrf('/api/branches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-baci-merchant-id': merchantId,
    },
    body: JSON.stringify(body),
  });
  await assertMutationSucceeded(response, 'Failed to create branch');
}
