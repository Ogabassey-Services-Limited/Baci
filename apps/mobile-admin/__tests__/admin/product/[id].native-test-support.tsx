import type { ReactNode } from 'react';
import { vi } from 'vitest';

export function TestText({ children }: { children?: ReactNode }) {
  return <span>{children}</span>;
}

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    default: ({ children }: { children?: ReactNode }) => (
      <section aria-label="Product category drawer">{children}</section>
    ),
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement('input', props),
  };
});

vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <output aria-label="loading" />,
  Alert: { alert: vi.fn() },
  FlatList: ({
    ListEmptyComponent,
    data,
    renderItem,
  }: {
    ListEmptyComponent?: ReactNode;
    data?: unknown[];
    renderItem?: (args: { item: unknown; index: number }) => ReactNode;
  }) => (
    <div>
      {Array.isArray(data) && data.length > 0
        ? data.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: This FlatList mock preserves row identity by position.
            <div key={index}>{renderItem?.({ item, index })}</div>
          ))
        : ListEmptyComponent}
    </div>
  ),
  KeyboardAvoidingView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Modal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible?: boolean;
  }) => (visible ? <div>{children}</div> : null),
  Platform: { OS: 'ios' },
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
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Switch: ({
    onValueChange,
    value,
  }: {
    onValueChange?: (value: boolean) => void;
    value?: boolean;
  }) => (
    <input
      aria-label="switch"
      checked={Boolean(value)}
      onChange={(event) => onValueChange?.(event.target.checked)}
      type="checkbox"
    />
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (value: string) => void;
    value?: string | number;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value ?? ''}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
