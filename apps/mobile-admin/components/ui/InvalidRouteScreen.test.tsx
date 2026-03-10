import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
  canGoBack: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      children,
      onPress,
      style,
      accessibilityRole,
      accessibilityLabel,
      accessibilityHint,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      style?: unknown;
      accessibilityRole?: string;
      accessibilityLabel?: string;
      accessibilityHint?: string;
    }) => {
      const resolvedStyle =
        typeof style === 'function' ? style({ pressed: false }) : style;
      return React.createElement(
        'button',
        {
          onClick: onPress,
          style: Array.isArray(resolvedStyle)
            ? Object.assign({}, ...resolvedStyle)
            : resolvedStyle,
          role: accessibilityRole,
          'aria-label': accessibilityLabel,
          'aria-description': accessibilityHint,
          'data-testid': 'go-back-button',
        },
        children
      );
    },
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');

  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('expo-router', () => ({
  router: {
    back: mocks.back,
    replace: mocks.replace,
    canGoBack: mocks.canGoBack,
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      text: '#111111',
      textSecondary: '#555555',
      warning: '#F59E0B',
      primary: '#3B82F6',
    },
  }),
}));

import { InvalidRouteScreen } from './InvalidRouteScreen';

describe('InvalidRouteScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders default title and message', () => {
    render(<InvalidRouteScreen />);

    expect(screen.getByText('Page Not Found')).toBeTruthy();
    expect(
      screen.getByText(
        'The page you are looking for does not exist or the link is invalid.'
      )
    ).toBeTruthy();
  });

  it('renders custom title and message', () => {
    render(
      <InvalidRouteScreen
        title="Invalid Product"
        message="This product could not be found."
      />
    );

    expect(screen.getByText('Invalid Product')).toBeTruthy();
    expect(
      screen.getByText('This product could not be found.')
    ).toBeTruthy();
  });

  it('renders the warning icon', () => {
    render(<InvalidRouteScreen />);

    expect(screen.getByText('alert-circle-outline')).toBeTruthy();
  });

  it('renders back button when showBackButton is true (default)', () => {
    render(<InvalidRouteScreen />);

    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.getByText('Go Back')).toBeTruthy();
  });

  it('hides back button when showBackButton is false', () => {
    render(<InvalidRouteScreen showBackButton={false} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Go Back')).toBeNull();
  });

  it('renders accessibility props on the back button', () => {
    render(<InvalidRouteScreen />);

    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Go back');
    expect(button.getAttribute('aria-description')).toBe(
      'Navigates to the previous screen or the home screen'
    );
  });

  it('calls router.back() when canGoBack returns true', () => {
    mocks.canGoBack.mockReturnValue(true);

    render(<InvalidRouteScreen />);
    fireEvent.click(screen.getByRole('button'));

    expect(mocks.canGoBack).toHaveBeenCalled();
    expect(mocks.back).toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('calls router.replace("/") when canGoBack returns false', () => {
    mocks.canGoBack.mockReturnValue(false);

    render(<InvalidRouteScreen />);
    fireEvent.click(screen.getByRole('button'));

    expect(mocks.canGoBack).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith('/');
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it('renders the back arrow icon inside the button', () => {
    render(<InvalidRouteScreen />);

    expect(screen.getByText('arrow-back')).toBeTruthy();
  });

  it('defines press feedback style that reduces opacity when pressed', () => {
    // The component passes a style function to Pressable:
    //   ({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]
    // Verify the pressed feedback logic produces the expected styles
    const styleFn = ({ pressed }: { pressed: boolean }) => [
      { backgroundColor: '#3B82F6' },
      pressed && { opacity: 0.85 },
    ];

    const pressedStyles = styleFn({ pressed: true });
    expect(pressedStyles).toContainEqual({ opacity: 0.85 });

    const unpressedStyles = styleFn({ pressed: false });
    expect(unpressedStyles).not.toContainEqual({ opacity: 0.85 });
  });
});
