import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('traps Tab focus within the dialog (last→first and first→last)', () => {
    setup();
    const input = screen.getByLabelText('Date of birth');
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    // Tab from the last focusable wraps back to the first.
    continueButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(input).toHaveFocus();

    // Shift+Tab from the first focusable wraps to the last.
    input.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(continueButton).toHaveFocus();
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

  it('disables Continue (no spinner) when disableSubmit is set, keeping Cancel usable', () => {
    // Regression (is6TyY8S): a prior save is still settling after a reopen, so
    // Continue is disabled — but without the "Saving…" label — and the shopper
    // can still cancel.
    const { onCancel } = setup({ disableSubmit: true });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).not.toBeDisabled();
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels on Escape when not submitting', () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while submitting so a pending save is not abandoned', () => {
    const { onCancel } = setup({ submitting: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('ignores a backdrop click while submitting', () => {
    const { onCancel } = setup({ submitting: true });
    // The backdrop is the dialog's overlay parent.
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.mouseDown(backdrop);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not offer today or a future date in the picker (max is yesterday)', () => {
    vi.useFakeTimers({ now: new Date('2026-07-31T12:00:00.000Z') });
    setup();
    const input = screen.getByLabelText('Date of birth') as HTMLInputElement;
    expect(input.max).toBe('2026-07-30');
  });
});
