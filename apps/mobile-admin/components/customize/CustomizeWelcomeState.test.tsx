import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { CustomizeWelcomeState } from './CustomizeWelcomeState';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', async () => {
  const { createCustomizeReactNativeMock } = await import(
    './customize-test-react-native.mock'
  );

  return createCustomizeReactNativeMock({ includePressable: true });
});

describe('CustomizeWelcomeState', () => {
  it('renders the intro copy and all suggestion buttons', () => {
    render(
      <CustomizeWelcomeState
        colors={LIGHT_COLORS}
        onSuggestionSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Hi! I'm your AI Copilot")).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use suggestion: Make it blue' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use suggestion: Add testimonials' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use suggestion: Make it festive' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use suggestion: Update hero text' })
    ).toBeInTheDocument();
  });

  it('forwards each suggestion prompt when clicked', async () => {
    const user = userEvent.setup();
    const onSuggestionSelect = vi.fn();

    render(
      <CustomizeWelcomeState
        colors={LIGHT_COLORS}
        onSuggestionSelect={onSuggestionSelect}
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'Use suggestion: Make it blue' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Use suggestion: Add testimonials' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Use suggestion: Make it festive' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Use suggestion: Update hero text' })
    );

    expect(onSuggestionSelect).toHaveBeenNthCalledWith(
      1,
      'Change the primary color to blue'
    );
    expect(onSuggestionSelect).toHaveBeenNthCalledWith(
      2,
      'Add a testimonials section with customer reviews'
    );
    expect(onSuggestionSelect).toHaveBeenNthCalledWith(
      3,
      'Add festive red and gold colors for the holiday season'
    );
    expect(onSuggestionSelect).toHaveBeenNthCalledWith(
      4,
      'Change the hero title to "Welcome to our store"'
    );
  });

  it('does not call onSuggestionSelect without interaction', () => {
    const onSuggestionSelect = vi.fn();

    render(
      <CustomizeWelcomeState
        colors={LIGHT_COLORS}
        onSuggestionSelect={onSuggestionSelect}
      />
    );

    expect(onSuggestionSelect).not.toHaveBeenCalled();
  });
});
