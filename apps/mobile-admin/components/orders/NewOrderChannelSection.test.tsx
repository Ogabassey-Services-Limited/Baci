import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderChannelSection } from './NewOrderChannelSection';
import { CHANNELS } from './new-order.shared';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-selected': accessibilityState?.selected,
          onClick: () => onPress?.(),
          role: accessibilityRole,
          type: 'button',
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('./new-order.styles', () => ({ styles: {} }));

type ControllerShape = {
  colors: {
    border: string;
    card: string;
    primary: string;
    text: string;
    textOnPrimary: string;
    textSecondary: string;
  };
  selectedChannel: (typeof CHANNELS)[number]['id'];
  setSelectedChannel: ReturnType<typeof vi.fn>;
};

const makeController = (
  overrides: Partial<ControllerShape> = {}
): ControllerShape => ({
  colors: {
    border: '#ccc',
    card: '#fff',
    primary: '#000',
    text: '#111',
    textOnPrimary: '#fff',
    textSecondary: '#888',
  },
  selectedChannel: 'physical',
  setSelectedChannel: vi.fn(),
  ...overrides,
});

describe('NewOrderChannelSection', () => {
  it('renders every configured sales channel', () => {
    const controller = makeController();

    render(
      <NewOrderChannelSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderChannelSection
          >['controller']
        }
      />
    );

    for (const channel of CHANNELS) {
      expect(
        screen.getByRole('button', { name: `${channel.label} channel` })
      ).toBeInTheDocument();
    }
  });

  it('marks the currently selected channel via accessibilityState', () => {
    const controller = makeController({ selectedChannel: 'whatsapp' });

    render(
      <NewOrderChannelSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderChannelSection
          >['controller']
        }
      />
    );

    const whatsappButton = screen.getByRole('button', {
      name: 'WhatsApp channel',
    });
    expect(whatsappButton).toHaveAttribute('aria-selected', 'true');

    const physicalButton = screen.getByRole('button', {
      name: 'Physical sales channel',
    });
    expect(physicalButton).toHaveAttribute('aria-selected', 'false');
  });

  it('calls setSelectedChannel with the channel id when pressed', () => {
    const controller = makeController();

    render(
      <NewOrderChannelSection
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderChannelSection
          >['controller']
        }
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Instagram channel' }));

    expect(controller.setSelectedChannel).toHaveBeenCalledTimes(1);
    expect(controller.setSelectedChannel).toHaveBeenCalledWith('instagram');
  });
});
