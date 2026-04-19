import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Text, View } from 'react-native';
import { RootLayoutNav } from './RootLayoutNav';

const MockText = Text;
const MockView = View;
const mockUseAuthGuard = jest.fn();
const renderMockQueryProvider = ({
  children,
  persistenceEnabled,
}: {
  children?: React.ReactNode;
  persistenceEnabled?: boolean;
}) => (
  <View>
    <Text>{persistenceEnabled ? 'persist:on' : 'persist:off'}</Text>
    {children}
  </View>
);
const mockQueryProvider = jest.fn(renderMockQueryProvider);

jest.mock('@react-navigation/native', () => ({
  DarkTheme: { colors: {} },
  DefaultTheme: { colors: {} },
  ThemeProvider: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const Stack = ({ children }: { children?: React.ReactNode }) => (
    <MockView
      accessibilityLabel="root stack"
      accessibilityRole="summary"
      accessible
      testID="root-stack"
    >
      {children}
    </MockView>
  );

  Stack.Screen = ({ name }: { name: string }) => <MockText>{name}</MockText>;

  return { Stack };
});

jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) => {
    return <MockView>{children}</MockView>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('@/components/ConnectivityBanner', () => ({
  ConnectivityBanner: () => <MockText>connectivity-banner</MockText>,
}));

jest.mock('@/components/chat/ChatWidget', () => ({
  ChatWidget: ({ bottomOffset }: { bottomOffset: number }) => (
    <MockText>{`chat-widget:${bottomOffset}`}</MockText>
  ),
}));

jest.mock('@/components/ErrorBoundary', () => ({
  GlobalErrorBoundary: ({
    children,
  }: {
    children?: React.ReactNode;
    context: string;
  }) => children,
}));

jest.mock('@/components/modals/NegotiationModal', () => ({
  NegotiationModal: () => <MockText>negotiation-modal</MockText>,
}));

jest.mock('@/components/navigation/CompactStackHeader', () => ({
  CompactStackHeader: () => null,
}));

jest.mock('@/components/navigation/DrawerMenu', () => ({
  DrawerMenu: () => <MockText>drawer-menu</MockText>,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useAuthGuard: () => mockUseAuthGuard(),
}));

jest.mock('@/lib/QueryProvider', () => ({
  QueryProvider: (props: {
    children?: React.ReactNode;
    persistenceEnabled?: boolean;
  }) => mockQueryProvider(props),
}));

describe('RootLayoutNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryProvider.mockImplementation(renderMockQueryProvider);
  });

  it('renders the storefront navigator and startup overlays', () => {
    render(<RootLayoutNav />);

    expect(screen.getByRole('summary', { name: 'root stack' })).toBeTruthy();
    expect(screen.getByText('(tabs)')).toBeTruthy();
    expect(screen.getByText('checkout')).toBeTruthy();
    expect(screen.getByText('connectivity-banner')).toBeTruthy();
    expect(screen.getByText('chat-widget:140')).toBeTruthy();
    expect(screen.getByText('negotiation-modal')).toBeTruthy();
    expect(screen.getByText('drawer-menu')).toBeTruthy();
    expect(mockUseAuthGuard).toHaveBeenCalledTimes(1);
  });

  it('passes persistence settings through to the query provider', () => {
    render(<RootLayoutNav persistenceEnabled={false} />);

    expect(screen.getByText('persist:off')).toBeTruthy();
    expect(mockQueryProvider).toHaveBeenCalled();
  });

  it('surfaces provider failures deterministically', () => {
    mockQueryProvider.mockImplementation(() => {
      throw new Error('query provider failed');
    });

    expect(() => render(<RootLayoutNav />)).toThrow('query provider failed');
  });
});
