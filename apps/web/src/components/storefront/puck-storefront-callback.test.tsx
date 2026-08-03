import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PuckStorefront } from './puck-storefront';

const mocks = vi.hoisted(() => ({ single: vi.fn() }));

vi.mock('@puckeditor/core', () => ({ Render: () => null }));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: mocks.single }) }) }),
    }),
  }),
}));

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  if (!resolve) throw new Error('Deferred resolver was not initialized');
  return { promise, resolve };
}

describe('PuckStorefront callback lifecycle', () => {
  it('does not reload for a callback identity change and calls the latest callback', async () => {
    const load = createDeferred<{ data: null; error: { code: string } }>();
    const initialCallback = vi.fn();
    const latestCallback = vi.fn();
    mocks.single.mockReturnValue(load.promise);

    const { rerender } = render(
      <PuckStorefront onNoConfig={initialCallback} />
    );

    await waitFor(() => expect(mocks.single).toHaveBeenCalledTimes(1));
    rerender(<PuckStorefront onNoConfig={latestCallback} />);

    expect(mocks.single).toHaveBeenCalledTimes(1);
    load.resolve({ data: null, error: { code: 'PGRST116' } });

    await waitFor(() => expect(latestCallback).toHaveBeenCalledTimes(1));
    expect(initialCallback).not.toHaveBeenCalled();
  });
});
