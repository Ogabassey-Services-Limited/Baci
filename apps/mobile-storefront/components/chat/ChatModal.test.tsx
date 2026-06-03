import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode, RefObject } from 'react';
import { Platform, StyleSheet, type TextInput } from 'react-native';
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
const mockUseSafeAreaInsets = jest.fn(() => ({
  bottom: 34,
  left: 0,
  right: 0,
  top: 0,
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

jest.mock('@/components/storefront/GadgetPattern', () => ({
  GadgetPattern: 'GadgetPattern',
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => mockUseKeyboard(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
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
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSafeAreaInsets.mockReturnValue({
      bottom: 34,
      left: 0,
      right: 0,
      top: 0,
    });
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
    mockUseKeyboard.mockReturnValue({
      dismissKeyboard: jest.fn(),
      isKeyboardVisible: false,
      keyboardHeight: 0,
      withKeyboardDismiss: <T extends (...args: never[]) => unknown>(
        handler: T
      ) => handler,
    });
  });

  it('renders a full-screen absolute positioned container for overlay routing', () => {
    renderChatModal();

    const modalContainer = screen.getByTestId('chat-modal-container', {
      includeHiddenElements: true,
    });
    expect(StyleSheet.flatten(modalContainer.props.style)).toMatchObject({
      pointerEvents: 'auto',
    });
    expect(modalContainer).toHaveProp('accessibilityElementsHidden', false);
    expect(modalContainer).toHaveProp('accessibilityViewIsModal', true);
    expect(modalContainer).toHaveProp('importantForAccessibility', 'auto');
  });

  it('removes the hidden modal from the accessibility tree', () => {
    render(
      <ChatModal
        visible={false}
        santaMode={false}
        messages={[]}
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

    const modalContainer = screen.getByTestId('chat-modal-container', {
      includeHiddenElements: true,
    });
    expect(modalContainer).toHaveProp('accessibilityElementsHidden', true);
    expect(modalContainer).toHaveProp('accessibilityViewIsModal', false);
    expect(modalContainer).toHaveProp(
      'importantForAccessibility',
      'no-hide-descendants'
    );
  });

  it('enables cross-platform keyboard avoiding protection on all platforms', () => {
    // Test iOS
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    const { rerender } = renderChatModal();
    expect(screen.getByTestId('keyboard-container')).toHaveProp(
      'enabled',
      true
    );

    // Test Android
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    rerender(
      <ChatModal
        visible={true}
        santaMode={false}
        messages={[]}
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
    expect(screen.getByTestId('keyboard-container')).toHaveProp(
      'enabled',
      true
    );
  });

  it('keeps input container spaced off the home safe area boundary when keyboard is closed', () => {
    renderChatModal();

    expect(
      StyleSheet.flatten(screen.getByTestId('chat-input-container').props.style)
    ).toMatchObject({
      paddingBottom: 34,
    });
    expect(screen.getByLabelText('Chat message input')).toBeOnTheScreen();
  });

  it('falls back to bottom padding when there is no bottom inset', () => {
    mockUseSafeAreaInsets.mockReturnValue({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    });
    renderChatModal();

    expect(
      StyleSheet.flatten(screen.getByTestId('chat-input-container').props.style)
    ).toMatchObject({
      paddingBottom: 12,
    });
  });
});
