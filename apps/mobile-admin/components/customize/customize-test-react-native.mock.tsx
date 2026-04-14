import type { ReactNode } from 'react';

interface CreateCustomizeReactNativeMockOptions {
  includeActivityIndicator?: boolean;
  includePressable?: boolean;
}

export function createCustomizeReactNativeMock(
  options: CreateCustomizeReactNativeMockOptions = {}
) {
  return {
    ...(options.includeActivityIndicator
      ? {
          ActivityIndicator: () => <span>loading</span>,
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
              data-role={accessibilityRole}
              disabled={accessibilityState?.disabled}
              onClick={() => onPress?.()}
              type="button"
            >
              {children}
            </button>
          ),
        }
      : {}),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
}
