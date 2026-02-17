import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import * as useReducedMotionHook from '@/hooks/use-reduced-motion';
import { TypingPlaceholderInput } from './typing-placeholder-input';

// Mock the hook
vi.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: vi.fn(),
}));

describe('TypingPlaceholderInput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default to false (motion enabled)
    vi.mocked(useReducedMotionHook.useReducedMotion).mockReturnValue(false);
  });

  it('should render the input element', () => {
    render(<TypingPlaceholderInput placeholders={['Search...']} />);
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toBeInTheDocument();
  });

  it('should accept additional props', () => {
    render(
      <TypingPlaceholderInput
        placeholders={['Search...']}
        data-testid="test-input"
        className="custom-class"
      />
    );
    const inputElement = screen.getByTestId('test-input');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveClass('custom-class');
  });

  it('should display the static prefix initially', () => {
    render(
      <TypingPlaceholderInput
        placeholders={['world']}
        staticPrefix="Hello "
        typingSpeed={0} // fast for test
      />
    );
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toHaveAttribute('placeholder');
  });

  it('should use static placeholder when prefers-reduced-motion is true', () => {
    // Mock reduced motion to true
    vi.mocked(useReducedMotionHook.useReducedMotion).mockReturnValue(true);

    render(
      <TypingPlaceholderInput placeholders={['World']} staticPrefix="Hello " />
    );

    const inputElement = screen.getByRole('textbox');
    // Should immediately show full text "Hello World"
    expect(inputElement).toHaveAttribute('placeholder', 'Hello World');
  });

  it('should use the first placeholder when multiple are provided and reduced motion is on', () => {
    vi.mocked(useReducedMotionHook.useReducedMotion).mockReturnValue(true);

    render(
      <TypingPlaceholderInput
        placeholders={['First', 'Second']}
        staticPrefix="Type: "
      />
    );

    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toHaveAttribute('placeholder', 'Type: First');
  });

  it('should NOT clear placeholder on focus and keep visible opacity', () => {
    render(<TypingPlaceholderInput placeholders={['Search...']} />);
    const inputElement = screen.getByRole('textbox');

    // Simulate focus
    fireEvent.focus(inputElement);

    // New behavior: placeholder snaps to full text "Search..."
    expect(inputElement.getAttribute('placeholder')).toBe('Search...');
    // Should have full opacity on focus
    expect(inputElement.className).toContain('focus:placeholder:opacity-100');
  });
});
