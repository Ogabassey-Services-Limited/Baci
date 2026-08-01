import { describe, expect, it, vi } from 'vitest';
import { createBlogStatusMutationCoordinator } from './blog-status-mutation-coordinator';

describe('createBlogStatusMutationCoordinator', () => {
  it('serializes writes for the same merchant post and marks only the newest latest', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const coordinator = createBlogStatusMutationCoordinator<string>();
    const firstOperation = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const secondOperation = vi.fn().mockResolvedValue('archived');

    const first = coordinator.enqueue(
      'merchant-1:post-1',
      'draft',
      firstOperation
    );
    const second = coordinator.enqueue(
      'merchant-1:post-1',
      'published',
      secondOperation
    );
    await vi.waitFor(() => expect(firstOperation).toHaveBeenCalledOnce());
    expect(secondOperation).not.toHaveBeenCalled();
    expect(first.isLatest()).toBe(false);
    expect(second.isLatest()).toBe(true);

    resolveFirst('published');
    await expect(first.result).resolves.toBe('published');
    first.confirm('published');
    expect(second.confirmed()).toBe('published');
    await expect(second.result).resolves.toBe('archived');
    expect(secondOperation).toHaveBeenCalledOnce();
  });

  it('continues the newest queued write after an older write fails', async () => {
    const coordinator = createBlogStatusMutationCoordinator<string>();
    const first = coordinator.enqueue(
      'merchant-1:post-1',
      'draft',
      async () => {
        throw new Error('offline');
      }
    );
    const second = coordinator.enqueue(
      'merchant-1:post-1',
      'published',
      async () => 'archived'
    );

    await expect(first.result).rejects.toThrow('offline');
    expect(second.confirmed()).toBe('draft');
    await expect(second.result).resolves.toBe('archived');
  });
});
