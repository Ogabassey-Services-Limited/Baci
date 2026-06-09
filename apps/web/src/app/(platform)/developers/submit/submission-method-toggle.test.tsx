import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubmissionMethodToggle } from './submission-method-toggle';

describe('SubmissionMethodToggle', () => {
  it('marks the active submission method and reports changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<SubmissionMethodToggle value="github" onChange={onChange} />);

    expect(
      screen.getByRole('button', { name: 'GitHub Repository' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Upload Zip Archive' })
    ).toHaveAttribute('aria-pressed', 'false');

    await user.click(
      screen.getByRole('button', { name: 'Upload Zip Archive' })
    );

    expect(onChange).toHaveBeenCalledWith('zip');
  });
});
