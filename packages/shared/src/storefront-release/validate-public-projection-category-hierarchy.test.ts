import { describe, expect, it, vi } from 'vitest';
import type { RefinementCtx } from 'zod';
import { validatePublicProjectionCategoryHierarchy } from './validate-public-projection-category-hierarchy';

describe('validatePublicProjectionCategoryHierarchy', () => {
  it('accepts an acyclic category hierarchy', () => {
    const addIssue = vi.fn();
    const context = { addIssue } as unknown as RefinementCtx;

    validatePublicProjectionCategoryHierarchy(
      [{ id: 'parent' }, { id: 'child', parentId: 'parent' }],
      context
    );

    expect(addIssue).not.toHaveBeenCalled();
  });

  it('rejects categories nested beyond one parent level', () => {
    const addIssue = vi.fn();
    const context = { addIssue } as unknown as RefinementCtx;

    validatePublicProjectionCategoryHierarchy(
      [
        { id: 'root' },
        { id: 'child', parentId: 'root' },
        { id: 'grandchild', parentId: 'child' },
      ],
      context
    );

    expect(addIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Category hierarchies support at most two levels',
        path: ['categories', 2, 'parentId'],
      })
    );
  });

  it('reports self-parent and multi-category cycles', () => {
    const addIssue = vi.fn();
    const context = { addIssue } as unknown as RefinementCtx;

    validatePublicProjectionCategoryHierarchy(
      [
        { id: 'self', parentId: 'self' },
        { id: 'first', parentId: 'second' },
        { id: 'second', parentId: 'first' },
      ],
      context
    );

    expect(addIssue).toHaveBeenCalledTimes(3);
    expect(addIssue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: 'Category parent relationships must be acyclic',
        path: ['categories', 0, 'parentId'],
      })
    );
    expect(addIssue).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        message: 'Category parent relationships must be acyclic',
        path: ['categories', 2, 'parentId'],
      })
    );
  });
});
