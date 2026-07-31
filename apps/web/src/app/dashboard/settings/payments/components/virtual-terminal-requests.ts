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

type VirtualTerminalResourceResult<T> =
  | { data: T[]; error: null }
  | { data: null; error: VirtualTerminalRequestError };

async function fetchVirtualTerminalResource<T>(options: {
  dataKey: string;
  errorMessage: string;
  request: () => Promise<Response>;
  resource: 'accounts' | 'branches';
}): Promise<T[]> {
  const response = await options.request();
  if (!response.ok) {
    throw new VirtualTerminalRequestError(
      options.errorMessage,
      options.resource
    );
  }

  const data = (await response.json()) as Record<string, T[] | undefined>;
  return data[options.dataKey] || [];
}

function toVirtualTerminalResourceResult<T>(
  result: PromiseSettledResult<T[]>,
  resource: 'accounts' | 'branches'
): VirtualTerminalResourceResult<T> {
  if (result.status === 'fulfilled') {
    return { data: result.value, error: null };
  }

  if (result.reason instanceof VirtualTerminalRequestError) {
    return { data: null, error: result.reason };
  }

  return {
    data: null,
    error: new VirtualTerminalRequestError(
      'Unable to connect to the server. Please check your connection.',
      resource
    ),
  };
}

export async function fetchVirtualTerminalData(merchantId: string): Promise<{
  accounts: VirtualTerminalResourceResult<StaffAccount>;
  branches: VirtualTerminalResourceResult<Branch>;
}> {
  const [accountsResult, branchesResult] = await Promise.allSettled([
    fetchVirtualTerminalResource<StaffAccount>({
      dataKey: 'terminals',
      errorMessage: 'Unable to fetch staff accounts. Please refresh the page.',
      request: () =>
        fetch(
          `/api/paystack/virtual-terminal?${new URLSearchParams({ merchantId })}`
        ),
      resource: 'accounts',
    }),
    fetchVirtualTerminalResource<Branch>({
      dataKey: 'branches',
      errorMessage: 'Unable to fetch branch data. Please refresh the page.',
      request: () =>
        fetch('/api/branches', {
          headers: { 'x-baci-merchant-id': merchantId },
        }),
      resource: 'branches',
    }),
  ]);

  return {
    accounts: toVirtualTerminalResourceResult(accountsResult, 'accounts'),
    branches: toVirtualTerminalResourceResult(branchesResult, 'branches'),
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
