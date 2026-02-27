import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyButton } from './copy-button';

describe('CopyButton', () => {
  it('renders with label', () => {
    render(<CopyButton value="test-value" label="Copy Text" />);
    // Button is rendered with label in screen reader only span
    const button = screen.getByRole('button', { name: /Copy Text/i });
    expect(button).toBeInTheDocument();
  });

  it('copies value to clipboard when clicked', () => {
    // Mock navigator.clipboard
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<CopyButton value="test-value" label="Copy" />);

    const button = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(button);

    expect(mockWriteText).toHaveBeenCalledWith('test-value');
  });

  it('changes icon and label on success', async () => {
    // Mock navigator.clipboard
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<CopyButton value="test-value" label="Copy" successLabel="Copied!" />);

    const button = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(button);

    // Should now show success label
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });
});
