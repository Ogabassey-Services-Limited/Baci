import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ChatSuggestionsRow } from './ChatSuggestionsRow';

jest.mock('@react-native-vector-icons/ionicons', () => 'Ionicons');

describe('ChatSuggestionsRow', () => {
  const colors = {
    border: '#D1D5DB',
    text: '#111827',
  };

  it('renders quick suggestions when the conversation is short', () => {
    const onSuggestionPress = jest.fn();
    render(
      <ChatSuggestionsRow
        colors={colors}
        isLoading={false}
        messagesCount={1}
        onSuggestionPress={onSuggestionPress}
      />
    );

    fireEvent.press(screen.getByLabelText('Suggestion: Track my order'));

    expect(onSuggestionPress).toHaveBeenCalledWith('Track my order');
  });

  it('hides suggestions when chat is loading or already active', () => {
    const { rerender } = render(
      <ChatSuggestionsRow
        colors={colors}
        isLoading={true}
        messagesCount={1}
        onSuggestionPress={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('Suggestion: Track my order')).toBeNull();

    rerender(
      <ChatSuggestionsRow
        colors={colors}
        isLoading={false}
        messagesCount={3}
        onSuggestionPress={jest.fn()}
      />
    );

    expect(screen.queryByLabelText('Suggestion: Track my order')).toBeNull();
  });
});
