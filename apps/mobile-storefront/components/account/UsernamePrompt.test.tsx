import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UsernamePrompt } from './UsernamePrompt';

const mockSetUsername =
  jest.fn<
    (
      username: string
    ) => Promise<{ success: boolean; error?: string; username?: string }>
  >();

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: { setUsername: typeof mockSetUsername }) => unknown
  ) => selector({ setUsername: mockSetUsername }),
}));

describe('UsernamePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the username input and keeps submit disabled while empty', () => {
    render(<UsernamePrompt />);

    expect(screen.getByLabelText('Username')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Save username' })
    ).toHaveAccessibilityState({ disabled: true });
  });

  it('shows an inline error and keeps submit disabled for an invalid username', () => {
    render(<UsernamePrompt />);

    fireEvent.changeText(screen.getByLabelText('Username'), '.ab');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Start and end with a letter or number. Only letters, numbers, . and _ are allowed.'
    );
    expect(
      screen.getByRole('button', { name: 'Save username' })
    ).toHaveAccessibilityState({ disabled: true });
    expect(mockSetUsername).not.toHaveBeenCalled();
  });

  it('submits a trimmed, valid username and calls onSuccess', async () => {
    mockSetUsername.mockResolvedValue({ success: true, username: 'ogafan' });
    const onSuccess = jest.fn();
    render(<UsernamePrompt onSuccess={onSuccess} />);

    fireEvent.changeText(screen.getByLabelText('Username'), '  ogafan  ');
    fireEvent.press(screen.getByRole('button', { name: 'Save username' }));

    expect(await screen.findByRole('button', { name: 'Save username' })).toBeTruthy();
    expect(mockSetUsername).toHaveBeenCalledWith('ogafan');
    await Promise.resolve();
    expect(onSuccess).toHaveBeenCalledWith('ogafan');
  });

  it('normalizes full-width look-alike input before submitting', async () => {
    mockSetUsername.mockResolvedValue({ success: true, username: 'ogafan' });
    render(<UsernamePrompt />);

    // Full-width "ｏｇａｆａｎ" should NFKC-fold to ASCII "ogafan" client-side so the
    // RPC receives the same value the web route would send.
    fireEvent.changeText(screen.getByLabelText('Username'), 'ｏｇａｆａｎ');
    fireEvent.press(screen.getByRole('button', { name: 'Save username' }));

    expect(
      await screen.findByRole('button', { name: 'Save username' })
    ).toBeTruthy();
    expect(mockSetUsername).toHaveBeenCalledWith('ogafan');
  });

  it('renders the returned friendly error when the RPC rejects the username', async () => {
    mockSetUsername.mockResolvedValue({
      success: false,
      error: 'That username is already taken. Try another.',
    });
    render(<UsernamePrompt />);

    fireEvent.changeText(screen.getByLabelText('Username'), 'takenname');
    fireEvent.press(screen.getByRole('button', { name: 'Save username' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That username is already taken. Try another.'
    );
  });

  it('prefills the input from initialValue and honors a custom submitLabel', () => {
    render(<UsernamePrompt initialValue="ogafan" submitLabel="Continue" />);

    expect(screen.getByLabelText('Username').props.value).toBe('ogafan');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('syncs the input when initialValue changes after mount (late hydration)', () => {
    // Returning shopper: the prompt first renders while the customer row is
    // still hydrating (initialValue empty), then the real username arrives.
    const { rerender } = render(<UsernamePrompt initialValue="" />);
    expect(screen.getByLabelText('Username').props.value).toBe('');
    expect(
      screen.getByRole('button', { name: 'Save username' })
    ).toHaveAccessibilityState({ disabled: true });

    rerender(<UsernamePrompt initialValue="ogafan" />);

    expect(screen.getByLabelText('Username').props.value).toBe('ogafan');
    expect(
      screen.getByRole('button', { name: 'Save username' })
    ).toHaveAccessibilityState({ disabled: false });
  });

  it('keeps the user\'s typed value when initialValue is unchanged on re-render', () => {
    const { rerender } = render(<UsernamePrompt initialValue="" />);

    fireEvent.changeText(screen.getByLabelText('Username'), 'typed_name');
    expect(screen.getByLabelText('Username').props.value).toBe('typed_name');

    // A re-render that does not change initialValue must not clobber typing.
    rerender(<UsernamePrompt initialValue="" />);

    expect(screen.getByLabelText('Username').props.value).toBe('typed_name');
  });
});
