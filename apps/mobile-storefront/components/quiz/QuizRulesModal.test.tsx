import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuizRulesModal } from './QuizRulesModal';

jest.mock('@react-native-vector-icons/ionicons', () => 'Ionicons');

describe('QuizRulesModal', () => {
  it('requires one explicit rules and terms acknowledgment before play', () => {
    const onConfirm = jest.fn();
    render(
      <QuizRulesModal
        eventTitle="Tonight quiz"
        onClose={jest.fn()}
        onConfirm={onConfirm}
        requiresAcceptance
        timePerQuestionSeconds={10}
        visible
      />
    );

    const play = screen.getByRole('button', { name: 'Accept and play quiz' });
    expect(play.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(play);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Accept quiz rules and terms' })
    );
    fireEvent.press(play);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows rules without an acknowledgment when opened for reference', () => {
    const onClose = jest.fn();
    render(
      <QuizRulesModal
        eventTitle="Tonight quiz"
        onClose={onClose}
        onConfirm={jest.fn()}
        requiresAcceptance={false}
        timePerQuestionSeconds={15}
        visible
      />
    );

    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Close rules' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
