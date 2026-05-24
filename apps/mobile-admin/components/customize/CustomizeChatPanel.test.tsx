import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import {
  CustomizeChatPanel,
  type CustomizeMessage,
} from './CustomizeChatPanel';

const mocks = vi.hoisted(() => ({
  listProps: {
    initialNumToRender: 0,
    maxToRenderPerBatch: 0,
    removeClippedSubviews: false,
    windowSize: 0,
  },
  platform: { OS: 'ios' as 'ios' | 'android' },
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children?: ReactNode }) => (
    <section aria-label="customize-chat-keyboard-shell">{children}</section>
  ),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  FlatList: ({
    data,
    initialNumToRender,
    maxToRenderPerBatch,
    removeClippedSubviews,
    renderItem,
    windowSize,
  }: {
    data: CustomizeMessage[];
    initialNumToRender?: number;
    maxToRenderPerBatch?: number;
    removeClippedSubviews?: boolean;
    renderItem: ({
      item,
      index,
    }: {
      item: CustomizeMessage;
      index: number;
      separators?: unknown;
    }) => ReactNode;
    windowSize?: number;
  }) => {
    mocks.listProps.initialNumToRender = initialNumToRender ?? 0;
    mocks.listProps.maxToRenderPerBatch = maxToRenderPerBatch ?? 0;
    mocks.listProps.removeClippedSubviews = removeClippedSubviews ?? false;
    mocks.listProps.windowSize = windowSize ?? 0;
    return (
      <div>
        {data.map((item, index) => (
          <div key={item.id}>{renderItem({ item, index })}</div>
        ))}
      </div>
    );
  },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  Platform: mocks.platform,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    placeholder,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <textarea
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('CustomizeChatPanel', () => {
  afterEach(() => {
    mocks.platform.OS = 'ios';
  });

  it('renders the shared keyboard shell and forwards suggestion presses', async () => {
    const onSuggestionSelect = vi.fn();

    render(
      <CustomizeChatPanel
        colors={LIGHT_COLORS}
        flatListRef={createRef()}
        inputText=""
        isProcessingAI={false}
        messages={[]}
        onInputTextChange={vi.fn()}
        onSend={vi.fn()}
        onSuggestionSelect={onSuggestionSelect}
        shadowStyle={SHADOWS.md}
      />
    );

    expect(
      screen.getByRole('region', { name: 'customize-chat-keyboard-shell' })
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Use suggestion: Make it blue' })
    );

    expect(onSuggestionSelect).toHaveBeenCalledWith(
      'Change the primary color to blue'
    );
  });

  it('renders messages and forwards send/input actions', async () => {
    const onInputTextChange = vi.fn();
    const onSend = vi.fn();

    render(
      <CustomizeChatPanel
        colors={LIGHT_COLORS}
        flatListRef={createRef()}
        inputText="Make the hero brighter"
        isProcessingAI={false}
        messages={[
          {
            content: 'Update the hero title',
            id: '1',
            role: 'user',
            timestamp: new Date(),
          },
          {
            content: 'Done! I updated it.',
            id: '2',
            role: 'assistant',
            timestamp: new Date(),
          },
        ]}
        onInputTextChange={onInputTextChange}
        onSend={onSend}
        onSuggestionSelect={vi.fn()}
        shadowStyle={SHADOWS.md}
      />
    );

    expect(screen.getByText('Update the hero title')).toBeInTheDocument();
    expect(screen.getByText('Done! I updated it.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Customize message'), {
      target: { value: 'Add testimonials' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Send customize message' })
    );

    expect(onInputTextChange).toHaveBeenCalledWith('Add testimonials');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(mocks.listProps.initialNumToRender).toBe(15);
    expect(mocks.listProps.maxToRenderPerBatch).toBe(10);
    expect(mocks.listProps.windowSize).toBe(5);
    expect(mocks.listProps.removeClippedSubviews).toBe(false);
  });

  it('applies Android-specific virtualization optimizations', () => {
    mocks.platform.OS = 'android';

    render(
      <CustomizeChatPanel
        colors={LIGHT_COLORS}
        flatListRef={createRef()}
        inputText="Trigger list render"
        isProcessingAI={false}
        messages={[
          {
            content: 'Android test message',
            id: 'android-1',
            role: 'assistant',
            timestamp: new Date(),
          },
        ]}
        onInputTextChange={vi.fn()}
        onSend={vi.fn()}
        onSuggestionSelect={vi.fn()}
        shadowStyle={SHADOWS.md}
      />
    );

    expect(mocks.listProps.removeClippedSubviews).toBe(true);
  });
});
