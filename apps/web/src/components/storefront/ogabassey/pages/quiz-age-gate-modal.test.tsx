import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizAgeGateModal } from './quiz-age-gate-modal';

function setup(overrides: Partial<Parameters<typeof QuizAgeGateModal>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <QuizAgeGateModal
      onCancel={onCancel}
      onSubmit={onSubmit}
      open
      serverError={null}
      submitting={false}
      {...overrides}
    />
  );
  return { onCancel, onSubmit };
}

describe('QuizAgeGateModal', () => {
  it('renders nothing when closed', () => {
    render(
      <QuizAgeGateModal
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        open={false}
        serverError={null}
        submitting={false}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits a well-formed date of birth', () => {
    const { onSubmit } = setup();

    fireEvent.change(screen.getByLabelText('Date of birth'), {
      target: { value: '1990-06-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onSubmit).toHaveBeenCalledWith('1990-06-15');
  });

  it('blocks submission and shows an error for an invalid date', () => {
    const { onSubmit } = setup();

    // Feb 30 is not a real date — must not reach onSubmit.
    fireEvent.change(screen.getByLabelText('Date of birth'), {
      target: { value: '1990-02-30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('surfaces a server error (e.g. under-18 rejection)', () => {
    setup({
      serverError: 'Quiz participation requires an adult profile (18+)',
    });
    expect(
      screen.getByText('Quiz participation requires an adult profile (18+)')
    ).toBeInTheDocument();
  });

  it('calls onCancel from the Cancel button', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables the actions while submitting', () => {
    setup({ submitting: true });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
