import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewBlogPostRecoveryDialog } from './new-blog-post-recovery-dialog';

describe('NewBlogPostRecoveryDialog', () => {
  it('lets the merchant restore the recovered draft', async () => {
    const user = userEvent.setup();
    const onRecover = vi.fn();
    render(
      <NewBlogPostRecoveryDialog
        onDiscard={vi.fn()}
        onRecover={onRecover}
        open={true}
        setOpen={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /recover draft/i }));

    expect(onRecover).toHaveBeenCalledOnce();
  });

  it('discards a stale recovered draft instead', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(
      <NewBlogPostRecoveryDialog
        onDiscard={onDiscard}
        onRecover={vi.fn()}
        open={true}
        setOpen={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /discard/i }));

    expect(onDiscard).toHaveBeenCalledOnce();
  });
});
