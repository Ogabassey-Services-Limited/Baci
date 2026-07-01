import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('renders with default password type', () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toHaveAttribute('type', 'password');
    const toggleButton = screen.getByLabelText('Show password');
    expect(toggleButton).toBeInTheDocument();
  });

  it('toggles password visibility on click', () => {
    render(<PasswordInput placeholder="Enter password" />);
    const input = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByLabelText('Show password');

    // Click to show password
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password');

    // Click to hide password
    fireEvent.click(toggleButton);
    expect(input).toHaveAttribute('type', 'password');
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
  });

  it('is accessible via keyboard (tabIndex is not -1)', () => {
    render(<PasswordInput placeholder="Enter password" />);
    const toggleButton = screen.getByLabelText('Show password');
    // This is expected to fail before the fix
    expect(toggleButton).not.toHaveAttribute('tabIndex', '-1');
  });
});
