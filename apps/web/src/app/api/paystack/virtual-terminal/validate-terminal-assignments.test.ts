import { describe, expect, it, vi } from 'vitest';
import { validateTerminalAssignments } from './validate-terminal-assignments';

function createScopedClient(
  results: Array<{ data: { id: string } | null; error: unknown }>
) {
  const maybeSingle = vi.fn();
  for (const result of results) maybeSingle.mockResolvedValueOnce(result);

  const chain: Record<string, unknown> = { maybeSingle };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);

  return { client: { from }, from };
}

describe('validateTerminalAssignments', () => {
  it('accepts staff and branch IDs scoped to the merchant', async () => {
    const { client, from } = createScopedClient([
      { data: { id: 'staff-1' }, error: null },
      { data: { id: 'branch-1' }, error: null },
    ]);

    await expect(
      validateTerminalAssignments(client as never, 'merchant-1', {
        branchId: 'branch-1',
        staffId: 'staff-1',
      })
    ).resolves.toEqual({ error: null });
    expect(from).toHaveBeenNthCalledWith(1, 'staff_members');
    expect(from).toHaveBeenNthCalledWith(2, 'branches');
  });

  it('rejects a staff ID that is not scoped to the merchant', async () => {
    const { client } = createScopedClient([{ data: null, error: null }]);

    await expect(
      validateTerminalAssignments(client as never, 'merchant-1', {
        staffId: 'staff-from-another-merchant',
      })
    ).resolves.toEqual({
      error: 'Staff member does not belong to this merchant',
      status: 400,
    });
  });

  it('rejects a branch ID that is not scoped to the merchant', async () => {
    const { client } = createScopedClient([{ data: null, error: null }]);

    await expect(
      validateTerminalAssignments(client as never, 'merchant-1', {
        branchId: 'branch-from-another-merchant',
      })
    ).resolves.toEqual({
      error: 'Branch does not belong to this merchant',
      status: 400,
    });
  });

  it('fails closed when assignment validation cannot query the database', async () => {
    const { client } = createScopedClient([
      { data: null, error: { message: 'database unavailable' } },
    ]);

    await expect(
      validateTerminalAssignments(client as never, 'merchant-1', {
        branchId: 'branch-1',
      })
    ).resolves.toEqual({
      error: 'Failed to validate branch assignment',
      status: 500,
    });
  });
});
