import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditBlogRecoveryDialog } from './edit-blog-recovery-dialog';

describe('EditBlogRecoveryDialog', () => {
  it('lets the merchant discard a discovered stale draft', async () => {
    const onDiscard = vi.fn();
    const user = userEvent.setup();

    render(
      <EditBlogRecoveryDialog
        onDiscard={onDiscard}
        onRecover={vi.fn()}
        open
        setOpen={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('restores the draft only after confirming recovery', async () => {
    const onRecover = vi.fn();
    const user = userEvent.setup();

    render(
      <EditBlogRecoveryDialog
        onDiscard={vi.fn()}
        onRecover={onRecover}
        open
        setOpen={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /recover changes/i }));

    expect(onRecover).toHaveBeenCalledTimes(1);
  });
});
