import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { CustomizeViewModeToggle } from './CustomizeViewModeToggle';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const { createCustomizeReactNativeMock } = await import(
    './customize-test-react-native.mock'
  );

  return createCustomizeReactNativeMock({ includePressable: true });
});

describe('CustomizeViewModeToggle', () => {
  it('renders both modes, exposes selection state, and forwards both clicks', () => {
    const onChange = vi.fn();

    render(
      <CustomizeViewModeToggle
        colors={LIGHT_COLORS}
        onChange={onChange}
        value="chat"
      />
    );

    const chatButton = screen.getByRole('button', { name: 'Chat view mode' });
    const previewButton = screen.getByRole('button', {
      name: 'Preview view mode',
    });

    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(chatButton).toHaveAttribute('aria-pressed', 'true');
    expect(previewButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(previewButton);
    fireEvent.click(chatButton);

    expect(onChange).toHaveBeenNthCalledWith(1, 'preview');
    expect(onChange).toHaveBeenNthCalledWith(2, 'chat');
  });
});
