import type { ReactNode } from 'react';

interface CreateCustomizeReactNativeMockOptions {
  includeActivityIndicator?: boolean;
  includePressable?: boolean;
}

// Local stand-in for React Native's Text. We cannot import the real Text here
// because this module is the `vi.mock('react-native')` factory itself.
const MockText = ({ children }: { children?: ReactNode }) => (
  <span>{children}</span>
);

export function createCustomizeReactNativeMock(
  options: CreateCustomizeReactNativeMockOptions = {}
) {
  return {
    ...(options.includeActivityIndicator
      ? {
          ActivityIndicator: () => <MockText>loading</MockText>,
        }
      : {}),
    ...(options.includePressable
      ? {
          Pressable: ({
            accessibilityLabel,
            accessibilityRole,
            accessibilityState,
            children,
            onPress,
          }: {
            accessibilityLabel?: string;
            accessibilityRole?: string;
            accessibilityState?: {
              disabled?: boolean;
              selected?: boolean;
            };
            children?: ReactNode;
            onPress?: () => void;
          }) => (
            <button
              aria-label={accessibilityLabel}
              aria-pressed={accessibilityState?.selected}
              disabled={accessibilityState?.disabled}
              onClick={() => onPress?.()}
              role={accessibilityRole}
              type="button"
            >
              {children}
            </button>
          ),
        }
      : {}),
    StatusBar: () => null,
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: MockText,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
}
