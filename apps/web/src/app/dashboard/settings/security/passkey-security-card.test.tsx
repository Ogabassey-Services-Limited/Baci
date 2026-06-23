import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuth,
  mockDeletePasskey,
  mockListPasskeys,
  mockRegisterPasskey,
  mockToast,
} = vi.hoisted(() => ({
  mockAuth: {
    passkey: {
      delete: vi.fn(),
      list: vi.fn(),
    } as {
      delete?: ReturnType<typeof vi.fn>;
      list?: ReturnType<typeof vi.fn>;
    },
    registerPasskey: vi.fn() as ReturnType<typeof vi.fn> | undefined,
  },
  mockDeletePasskey: vi.fn(),
  mockListPasskeys: vi.fn(),
  mockRegisterPasskey: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: mockAuth,
  }),
}));

import { PasskeySecurityCard } from './passkey-security-card';

describe('PasskeySecurityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.passkey = {
      delete: mockDeletePasskey,
      list: mockListPasskeys,
    };
    mockAuth.registerPasskey = mockRegisterPasskey;
    mockListPasskeys.mockResolvedValue({
      data: [
        {
          id: 'passkey-1',
          friendly_name: 'iCloud Keychain',
          created_at: '2026-06-22T00:00:00.000Z',
        },
      ],
      error: null,
    });
    mockRegisterPasskey.mockResolvedValue({
      data: {
        id: 'passkey-2',
        friendly_name: 'Security Key',
        created_at: '2026-06-22T00:00:00.000Z',
      },
      error: null,
    });
    mockDeletePasskey.mockResolvedValue({ data: null, error: null });
    window.confirm = vi.fn(() => true);
  });

  it('skips passkey deletion when the confirmation is dismissed', async () => {
    window.confirm = vi.fn(() => false);
    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /remove passkey/i })
    );

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    expect(mockDeletePasskey).not.toHaveBeenCalled();
  });

  it('loads existing passkeys and warns until two authenticators are registered', async () => {
    render(<PasskeySecurityCard />);

    expect(await screen.findByText('iCloud Keychain')).toBeInTheDocument();
    expect(
      screen.getByText(/Register a second passkey or hardware key/i)
    ).toBeInTheDocument();
  });

  it('runs the Supabase passkey registration ceremony', async () => {
    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /add passkey/i })
    );

    await waitFor(() => {
      expect(mockRegisterPasskey).toHaveBeenCalledTimes(1);
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Passkey Added' })
    );
  });

  it('shows a destructive toast when passkey listing fails', async () => {
    mockListPasskeys.mockResolvedValueOnce({
      data: null,
      error: { message: 'List failed' },
    });

    render(<PasskeySecurityCard />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'List failed',
          title: 'Could Not Load Passkeys',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows a destructive toast when passkey listing is unavailable', async () => {
    mockAuth.passkey = {};

    render(<PasskeySecurityCard />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Passkeys Unavailable',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows a destructive toast when passkey registration fails', async () => {
    mockRegisterPasskey.mockResolvedValueOnce({
      data: null,
      error: { message: 'Registration failed' },
    });

    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /add passkey/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Registration failed',
          title: 'Could Not Add Passkey',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows a destructive toast when passkey registration is unavailable', async () => {
    mockAuth.registerPasskey = undefined;

    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /add passkey/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Could Not Add Passkey',
          variant: 'destructive',
        })
      );
    });
  });

  it('removes passkeys and shows a success toast', async () => {
    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /remove passkey/i })
    );

    await waitFor(() => {
      expect(mockDeletePasskey).toHaveBeenCalledWith({
        passkeyId: 'passkey-1',
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Passkey Removed' })
    );
  });

  it('shows a destructive toast when passkey deletion fails', async () => {
    mockDeletePasskey.mockResolvedValueOnce({
      data: null,
      error: { message: 'Delete failed' },
    });

    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /remove passkey/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Delete failed',
          title: 'Could Not Remove Passkey',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows a destructive toast when passkey deletion is unavailable', async () => {
    mockAuth.passkey = { list: mockListPasskeys };

    render(<PasskeySecurityCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /remove passkey/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Could Not Remove Passkey',
          variant: 'destructive',
        })
      );
    });
  });
});
