import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode, RefObject } from 'react';
import { Modal, StyleSheet, type TextInput } from 'react-native';
import { ChatModal } from './ChatModal';
import type { ChatMessage } from './types';

type MockFlashListProps = {
  data: ChatMessage[];
  renderItem: (info: { item: ChatMessage }) => ReactNode;
  ListFooterComponent?: ReactNode;
};

const mockUseKeyboard = jest.fn(() => ({
  dismissKeyboard: jest.fn(),
  isKeyboardVisible: false,
  keyboardHeight: 0,
  withKeyboardDismiss: <T extends (...args: never[]) => unknown>(handler: T) =>
    handler,
}));

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    FlashList: ({
      data,
      renderItem,
      ListFooterComponent,
    }: MockFlashListProps) =>
      React.createElement(
        View,
        { testID: 'chat-message-list' },
        data.map((item) =>
          React.createElement(View, { key: item.id }, renderItem({ item }))
        ),
        ListFooterComponent
      ),
  };
});

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => mockUseKeyboard(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

function renderChatModal() {
  const message: ChatMessage = {
    id: 'message-1',
    role: 'model',
    text: 'How can I help?',
    timestamp: new Date('2026-05-01T00:00:00.000Z'),
  };

  return render(
    <ChatModal
      visible={true}
      santaMode={false}
      messages={[message]}
      input=""
      isLoading={false}
      flatListRef={{ current: null }}
      inputRef={{ current: null } as RefObject<TextInput | null>}
      onClose={jest.fn()}
      onSend={jest.fn()}
      onChangeInput={jest.fn()}
      onSuggestionPress={jest.fn()}
      onScrollToBottom={jest.fn()}
    />
  );
}

describe('ChatModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseKeyboard.mockReturnValue({
      dismissKeyboard: jest.fn(),
      isKeyboardVisible: false,
      keyboardHeight: 0,
      withKeyboardDismiss: <T extends (...args: never[]) => unknown>(
        handler: T
      ) => handler,
    });
  });

  it('uses a full-screen modal so keyboard avoidance has the full viewport', () => {
    const { UNSAFE_getByType } = renderChatModal();

    expect(UNSAFE_getByType(Modal).props.presentationStyle).toBe('fullScreen');
  });

  it('lifts the chat input above the iOS keyboard', () => {
    mockUseKeyboard.mockReturnValue({
      dismissKeyboard: jest.fn(),
      isKeyboardVisible: true,
      keyboardHeight: 300,
      withKeyboardDismiss: <T extends (...args: never[]) => unknown>(
        handler: T
      ) => handler,
    });

    renderChatModal();

    expect(
      StyleSheet.flatten(screen.getByTestId('chat-input-container').props.style)
    ).toMatchObject({
      paddingBottom: 274,
    });
    expect(screen.getByTestId('keyboard-container')).toHaveProp(
      'enabled',
      false
    );
    expect(screen.getByLabelText('Chat message input')).toBeOnTheScreen();
  });

  it('does not add keyboard padding when the keyboard is hidden', () => {
    renderChatModal();

    expect(
      StyleSheet.flatten(screen.getByTestId('chat-input-container').props.style)
        .paddingBottom
    ).toBeUndefined();
    expect(screen.getByLabelText('Chat message input')).toBeOnTheScreen();
  });
});
