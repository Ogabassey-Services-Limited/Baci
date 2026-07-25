import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizDateOfBirthGateModal } from './QuizDateOfBirthGateModal';

const mockRenderDateOfBirthPrompt = jest.fn();

jest.mock('@/components/account/DateOfBirthPrompt', () => ({
  DateOfBirthPrompt: (props: unknown) => {
    mockRenderDateOfBirthPrompt(props);
    return null;
  },
}));

describe('QuizDateOfBirthGateModal', () => {
  it('renders the gate heading and helper copy when visible', () => {
    render(
      <QuizDateOfBirthGateModal
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible
      />
    );

    expect(
      screen.getByRole('header', { name: 'Confirm your date of birth' })
    ).toBeTruthy();
    expect(mockRenderDateOfBirthPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ submitLabel: 'Continue' })
    );
  });

  it('does not render its heading when hidden', () => {
    render(
      <QuizDateOfBirthGateModal
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible={false}
      />
    );

    expect(
      screen.queryByRole('header', { name: 'Confirm your date of birth' })
    ).toBeNull();
  });

  it('calls onCancel when the close button is pressed', () => {
    const onCancel = jest.fn();
    render(
      <QuizDateOfBirthGateModal
        onCancel={onCancel}
        onSuccess={jest.fn()}
        visible
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Cancel date of birth setup' })
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('passes onSuccess through to the date of birth prompt', () => {
    const onSuccess = jest.fn();
    render(
      <QuizDateOfBirthGateModal
        onCancel={jest.fn()}
        onSuccess={onSuccess}
        visible
      />
    );

    expect(mockRenderDateOfBirthPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ onSuccess })
    );
  });

  it('renders the age-rejection error message as an alert', () => {
    render(
      <QuizDateOfBirthGateModal
        errorMessage="Quiz participation requires an adult profile (18+)"
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible
      />
    );

    expect(
      screen.getByText('Quiz participation requires an adult profile (18+)')
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders no alert when there is no error message', () => {
    render(
      <QuizDateOfBirthGateModal
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible
      />
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pre-fills the prompt with initialValue when correcting a stored DOB', () => {
    render(
      <QuizDateOfBirthGateModal
        errorMessage="Quiz participation requires an adult profile (18+)"
        initialValue="2015-01-01"
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        visible
      />
    );

    expect(mockRenderDateOfBirthPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ initialValue: '2015-01-01' })
    );
  });
});
