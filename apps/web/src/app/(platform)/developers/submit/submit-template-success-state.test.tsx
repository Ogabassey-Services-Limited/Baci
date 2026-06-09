import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubmitTemplateSuccessState } from './submit-template-success-state';

describe('SubmitTemplateSuccessState', () => {
  it('shows the submission confirmation and returns to the gallery', async () => {
    const onReturn = vi.fn();
    const user = userEvent.setup();

    render(<SubmitTemplateSuccessState onReturn={onReturn} />);

    expect(
      screen.getByRole('heading', { name: 'Submission Successful!' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Return to Gallery' }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
