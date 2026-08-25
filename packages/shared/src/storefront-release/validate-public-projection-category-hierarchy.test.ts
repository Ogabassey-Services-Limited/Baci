import { describe, expect, it, vi } from 'vitest';
import { validatePublicProjectionCategoryHierarchy } from './validate-public-projection-category-hierarchy';

describe('validatePublicProjectionCategoryHierarchy', () => {
  it('accepts an acyclic category hierarchy', () => {
    const addIssue = vi.fn();

    validatePublicProjectionCategoryHierarchy(
      [{ id: 'parent' }, { id: 'child', parentId: 'parent' }],
      { addIssue } as never
    );

    expect(addIssue).not.toHaveBeenCalled();
  });

  it('rejects categories nested beyond one parent level', () => {
    const addIssue = vi.fn();

    validatePublicProjectionCategoryHierarchy(
      [
        { id: 'root' },
        { id: 'child', parentId: 'root' },
        { id: 'grandchild', parentId: 'child' },
      ],
      { addIssue } as never
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

    validatePublicProjectionCategoryHierarchy(
      [
        { id: 'self', parentId: 'self' },
        { id: 'first', parentId: 'second' },
        { id: 'second', parentId: 'first' },
      ],
      { addIssue } as never
    );

    expect(addIssue).toHaveBeenCalledTimes(3);
    expect(addIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Category parent relationships must be acyclic',
      })
    );
  });
});
