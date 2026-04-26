import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FAQAccordion } from '@/app/faq/FAQAccordion';

const faqItems = [
  {
    id: '1',
    question: 'How do I track my order?',
    answer: 'Open the orders screen to track progress.',
  },
  {
    id: '2',
    question: 'Can I return an item?',
    answer: 'Yes, within seven days.',
  },
] as const;

describe('FAQAccordion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the expanded answer and notifies when a question is pressed', () => {
    const onToggle = jest.fn();

    render(
      <FAQAccordion
        borderColor="#ddd"
        cardColor="#fff"
        expandedId="1"
        items={faqItems}
        onToggle={onToggle}
        secondaryTextColor="#666"
        textColor="#111"
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: /How do I track my order/ })
    );

    expect(onToggle).toHaveBeenCalledWith('1');
    expect(
      screen.getByText('Open the orders screen to track progress.')
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: /How do I track my order\?.*Open the orders screen to track progress\./,
      })
    ).toHaveAccessibilityState({ expanded: true });
    expect(
      screen.getByRole('button', {
        name: /How do I track my order\?.*Open the orders screen to track progress\./,
      }).props.accessibilityHint
    ).toBe('Tap to collapse');
  });

  it('keeps answers hidden when an item is collapsed', () => {
    render(
      <FAQAccordion
        borderColor="#ddd"
        cardColor="#fff"
        expandedId={null}
        items={faqItems}
        onToggle={jest.fn()}
        secondaryTextColor="#666"
        textColor="#111"
      />
    );

    expect(
      screen.getByRole('button', { name: 'How do I track my order?' })
    ).toHaveAccessibilityState({ expanded: false });
    expect(
      screen.getByRole('button', { name: 'How do I track my order?' }).props
        .accessibilityHint
    ).toBe('Tap to expand');
    expect(
      screen.queryByText('Open the orders screen to track progress.')
    ).toBeNull();
  });

  it('switches the rendered answer when a different item is expanded', () => {
    const { rerender } = render(
      <FAQAccordion
        borderColor="#ddd"
        cardColor="#fff"
        expandedId="1"
        items={faqItems}
        onToggle={jest.fn()}
        secondaryTextColor="#666"
        textColor="#111"
      />
    );

    rerender(
      <FAQAccordion
        borderColor="#ddd"
        cardColor="#fff"
        expandedId="2"
        items={faqItems}
        onToggle={jest.fn()}
        secondaryTextColor="#666"
        textColor="#111"
      />
    );

    expect(
      screen.queryByText('Open the orders screen to track progress.')
    ).toBeNull();
    expect(screen.getByText('Yes, within seven days.')).toBeOnTheScreen();
  });
});
