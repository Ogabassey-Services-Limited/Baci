import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizUsernameGateModal } from './QuizUsernameGateModal';

const mockRenderUsernamePrompt = jest.fn();

jest.mock('@/components/account/UsernamePrompt', () => ({
  UsernamePrompt: (props: unknown) => {
    mockRenderUsernamePrompt(props);
    return null;
  },
}));

describe('QuizUsernameGateModal', () => {
  it('renders the gate heading and helper copy when visible', () => {
    render(
      <QuizUsernameGateModal
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible
      />
    );

    expect(
      screen.getByRole('header', {
        name: 'Choose a username to appear on the leaderboard',
      })
    ).toBeTruthy();
    expect(mockRenderUsernamePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ submitLabel: 'Continue' })
    );
  });

  it('does not render its heading when hidden', () => {
    render(
      <QuizUsernameGateModal
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible={false}
      />
    );

    expect(
      screen.queryByRole('header', {
        name: 'Choose a username to appear on the leaderboard',
      })
    ).toBeNull();
  });

  it('calls onCancel when the close button is pressed', () => {
    const onCancel = jest.fn();
    render(
      <QuizUsernameGateModal
        onCancel={onCancel}
        onSuccess={jest.fn()}
        visible
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Cancel username setup' })
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('passes onSuccess through to the username prompt', () => {
    const onSuccess = jest.fn();
    render(
      <QuizUsernameGateModal
        onCancel={jest.fn()}
        onSuccess={onSuccess}
        visible
      />
    );

    expect(mockRenderUsernamePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ onSuccess })
    );
  });
});
