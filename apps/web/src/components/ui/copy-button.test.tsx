import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './copy-button';

describe('CopyButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with label', () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<CopyButton value="test-value" label="Copy Text" />);
    const button = screen.getByRole('button', { name: /Copy Text/i });
    expect(button).toBeInTheDocument();
  });

  it('copies value to clipboard when clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<CopyButton value="test-value" label="Copy" />);

    const button = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('test-value');
    });
  });

  it('changes icon and label on success', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(
      <CopyButton value="test-value" label="Copy" successLabel="Copied!" />
    );

    const button = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(button);

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('does not show success state when clipboard write fails', async () => {
    const mockWriteText = vi
      .fn()
      .mockRejectedValue(new Error('Clipboard permission denied'));
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(
      <CopyButton value="test-value" label="Copy" successLabel="Copied!" />
    );

    const button = screen.getByRole('button', { name: /Copy/i });
    fireEvent.click(button);

    // Wait for the async handler to settle
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('test-value');
    });

    // Success label should NOT appear
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    // Original label should still be present
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
  });
});
