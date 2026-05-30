import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseFormStatus = vi.hoisted(() =>
  vi.fn(() => ({
    action: null,
    data: null,
    method: null,
    pending: false,
  }))
);

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    useFormStatus: mockUseFormStatus,
  };
});

import { SubmitButton } from './submit-button';

describe('SubmitButton', () => {
  beforeEach(() => {
    mockUseFormStatus.mockReturnValue({
      action: null,
      data: null,
      method: null,
      pending: false,
    });
  });

  it('marks the button idle when the parent form is not pending', () => {
    render(<SubmitButton>Save</SubmitButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toBeDisabled();
  });

  it('marks the button busy while the parent form is pending', () => {
    mockUseFormStatus.mockReturnValue({
      action: null,
      data: null,
      method: null,
      pending: true,
    });

    render(<SubmitButton pendingText="Saving">Save</SubmitButton>);

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveClass(
      'aria-disabled:pointer-events-none',
      'aria-disabled:opacity-50'
    );
    expect(button).not.toBeDisabled();
  });

  it('uses native disabled state when explicitly disabled while idle', () => {
    render(<SubmitButton disabled>Save</SubmitButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeDisabled();
  });

  it('ignores clicks while pending without dropping native focusability', () => {
    mockUseFormStatus.mockReturnValue({
      action: null,
      data: null,
      method: null,
      pending: true,
    });
    const onClick = vi.fn();

    render(
      <SubmitButton pendingText="Saving" onClick={onClick}>
        Save
      </SubmitButton>
    );

    const button = screen.getByRole('button', { name: 'Saving' });
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
