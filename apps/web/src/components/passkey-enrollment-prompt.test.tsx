import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockListPasskeys, mockRegisterPasskey, mockToast } = vi.hoisted(() => ({
  mockListPasskeys: vi.fn(),
  mockRegisterPasskey: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('@/lib/auth/passkey-client', () => ({
  listPasskeys: mockListPasskeys,
  registerPasskey: mockRegisterPasskey,
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { PasskeyEnrollmentPrompt } from './passkey-enrollment-prompt';

const FLAG = 'NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED';
const DISMISS_KEY = 'baci.passkey-enroll-prompt.dismissed';

describe('PasskeyEnrollmentPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubEnv(FLAG, 'true');
    mockListPasskeys.mockResolvedValue({ data: [], error: null });
    mockRegisterPasskey.mockResolvedValue({ data: { id: 'p1' }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prompts when the flag is on and the user has no passkeys', async () => {
    render(<PasskeyEnrollmentPrompt />);
    expect(
      await screen.findByRole('button', { name: /set up passkey/i })
    ).toBeInTheDocument();
  });

  it('floats over dashboard content to avoid async layout shift', async () => {
    render(<PasskeyEnrollmentPrompt />);

    const prompt = await screen.findByRole('region', {
      name: /set up a passkey/i,
    });

    expect(prompt).toHaveClass('fixed');
    expect(prompt).toHaveClass('z-50');
  });

  it('renders nothing when the passkey flag is off', async () => {
    vi.stubEnv(FLAG, 'false');
    const { container } = render(<PasskeyEnrollmentPrompt />);
    await waitFor(() => expect(mockListPasskeys).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user already has a passkey', async () => {
    mockListPasskeys.mockResolvedValue({
      data: [{ id: 'existing', created_at: '2026-01-01' }],
      error: null,
    });
    const { container } = render(<PasskeyEnrollmentPrompt />);
    await waitFor(() => expect(mockListPasskeys).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden when previously dismissed', async () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    const { container } = render(<PasskeyEnrollmentPrompt />);
    await waitFor(() => expect(mockListPasskeys).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden when the passkey lookup errors (fails quiet)', async () => {
    mockListPasskeys.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });
    const { container } = render(<PasskeyEnrollmentPrompt />);
    await waitFor(() => expect(mockListPasskeys).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('enrolls a passkey and hides the prompt on success', async () => {
    render(<PasskeyEnrollmentPrompt />);
    fireEvent.click(
      await screen.findByRole('button', { name: /set up passkey/i })
    );

    await waitFor(() => expect(mockRegisterPasskey).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /set up passkey/i })
      ).not.toBeInTheDocument()
    );
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Passkey ready' })
    );
  });

  it('surfaces a destructive toast and keeps the prompt on enrollment error', async () => {
    mockRegisterPasskey.mockResolvedValue({
      data: null,
      error: { message: 'user cancelled' },
    });
    render(<PasskeyEnrollmentPrompt />);
    fireEvent.click(
      await screen.findByRole('button', { name: /set up passkey/i })
    );

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      )
    );
    expect(
      screen.getByRole('button', { name: /set up passkey/i })
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it('ignores enrollment results after unmounting', async () => {
    let resolveRegistration: (value: {
      data: { created_at: string; id: string };
      error: null;
    }) => void = () => undefined;
    const registrationPromise = new Promise<{
      data: { created_at: string; id: string };
      error: null;
    }>((resolve) => {
      resolveRegistration = resolve;
    });
    mockRegisterPasskey.mockReturnValue(registrationPromise);
    const { unmount } = render(<PasskeyEnrollmentPrompt />);

    fireEvent.click(
      await screen.findByRole('button', { name: /set up passkey/i })
    );
    unmount();
    await act(async () => {
      resolveRegistration({
        data: { created_at: '2026-06-23T00:00:00Z', id: 'p1' },
        error: null,
      });
      await registrationPromise;
    });

    expect(window.localStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('dismisses and remembers the choice', async () => {
    render(<PasskeyEnrollmentPrompt />);
    await screen.findByRole('button', { name: /set up passkey/i });

    fireEvent.click(screen.getByRole('button', { name: /dismiss passkey/i }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /set up passkey/i })
      ).not.toBeInTheDocument()
    );
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
  });
});
