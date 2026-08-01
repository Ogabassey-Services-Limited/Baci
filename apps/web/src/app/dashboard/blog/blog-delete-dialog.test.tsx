import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BlogDeleteDialog } from './blog-delete-dialog';

describe('BlogDeleteDialog', () => {
  it('confirms deletion from an open dialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BlogDeleteDialog onConfirm={onConfirm} onOpenChange={vi.fn()} open />
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
