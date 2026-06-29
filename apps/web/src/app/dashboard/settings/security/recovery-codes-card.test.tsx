import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerate, mockAcknowledge, mockToast } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockAcknowledge: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('./recovery-codes-actions', () => ({
  generateRecoveryCodesAction: mockGenerate,
  acknowledgeRecoveryCodesAction: mockAcknowledge,
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { RecoveryCodesCard } from './recovery-codes-card';

describe('RecoveryCodesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({
      ok: true,
      codes: ['AAAA-AAAA', 'BBBB-BBBB'],
      codeSetId: 'cs-1',
    });
    mockAcknowledge.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the remaining count and a regenerate action when codes exist', () => {
    render(<RecoveryCodesCard initialCount={5} />);
    expect(screen.getByText(/5 unused recovery codes/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /regenerate/i })
    ).toBeInTheDocument();
  });

  it('prompts to generate when there are none', () => {
    render(<RecoveryCodesCard initialCount={0} />);
    expect(
      screen.getByRole('button', { name: /generate recovery codes/i })
    ).toBeInTheDocument();
  });

  it('generates and displays the codes once', async () => {
    render(<RecoveryCodesCard initialCount={0} />);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );

    expect(await screen.findByText('AAAA-AAAA')).toBeInTheDocument();
    expect(screen.getByText('BBBB-BBBB')).toBeInTheDocument();
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('acknowledges the displayed code set and updates the count', async () => {
    render(<RecoveryCodesCard initialCount={0} />);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );
    await screen.findByText('AAAA-AAAA');

    fireEvent.click(screen.getByRole('button', { name: /saved these/i }));

    await waitFor(() => {
      expect(mockAcknowledge).toHaveBeenCalledWith('cs-1');
    });
    expect(
      await screen.findByText(/2 unused recovery codes/i)
    ).toBeInTheDocument();
  });

  it('defers revoking the object URL so Safari can start downloads', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:recovery-codes');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined
    );

    render(<RecoveryCodesCard initialCount={0} />);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );
    await screen.findByText('AAAA-AAAA');

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recovery-codes');
  });

  it('surfaces a generation error via toast', async () => {
    mockGenerate.mockResolvedValueOnce({ ok: false, error: 'nope' });
    render(<RecoveryCodesCard initialCount={0} />);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });

  it('copies the codes and confirms via toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<RecoveryCodesCard initialCount={0} />);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );
    await screen.findByText('AAAA-AAAA');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('AAAA-AAAA\nBBBB-BBBB');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Copied to clipboard' })
      );
    });
  });

  it('shows a destructive toast when copying to the clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<RecoveryCodesCard initialCount={0} />);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );
    await screen.findByText('AAAA-AAAA');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    // One-time codes must never report a false "Copied" success.
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });
});
