import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OgabasseyV2Security } from './security';

describe('OgabasseyV2Security', () => {
  it('uses field-specific stable names and aria-pressed state for password toggles', () => {
    render(<OgabasseyV2Security />);

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    const currentPasswordInput = screen.getByLabelText('Current Password');
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const currentToggle = screen.getByRole('button', {
      name: 'Show current password',
    });
    const newToggle = screen.getByRole('button', {
      name: 'Show new password',
    });
    const confirmToggle = screen.getByRole('button', {
      name: 'Show confirm password',
    });

    expect(currentPasswordInput).toHaveAttribute('type', 'password');
    expect(newPasswordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    expect(currentToggle).toHaveAttribute('aria-pressed', 'false');
    expect(newToggle).toHaveAttribute('aria-pressed', 'false');
    expect(confirmToggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(currentToggle);

    const pressedCurrentToggle = screen.getByRole('button', {
      name: 'Show current password',
    });
    expect(currentPasswordInput).toHaveAttribute('type', 'text');
    expect(pressedCurrentToggle).toHaveAccessibleName(
      'Show current password'
    );
    expect(pressedCurrentToggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(newToggle);

    const pressedNewToggle = screen.getByRole('button', {
      name: 'Show new password',
    });
    expect(newPasswordInput).toHaveAttribute('type', 'text');
    expect(pressedNewToggle).toHaveAccessibleName('Show new password');
    expect(pressedNewToggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(confirmToggle);

    const pressedConfirmToggle = screen.getByRole('button', {
      name: 'Show confirm password',
    });
    expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    expect(pressedConfirmToggle).toHaveAccessibleName('Show confirm password');
    expect(pressedConfirmToggle).toHaveAttribute('aria-pressed', 'true');
  });
});
