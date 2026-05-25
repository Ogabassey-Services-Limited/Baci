import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import Colors from '@/constants/Colors';
import {
  type FAQItem,
  FAQView,
  type StoreInfo,
  type SupportOption,
} from './FAQView';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{children}</View>;
  },
}));

describe('FAQView', () => {
  const supportOptions: SupportOption[] = [
    {
      action: jest.fn(),
      icon: 'logo-whatsapp',
      iconBackgroundColor: '#25D366',
      iconColor: '#FFF',
      id: 'whatsapp',
      subtitle: 'Chat with us directly',
      title: 'WhatsApp Support',
    },
    {
      action: jest.fn(),
      icon: 'mail-outline',
      iconBackgroundColor: '#FEE2E2',
      iconColor: '#DC2626',
      id: 'email',
      subtitle: 'support@example.com',
      title: 'Email Support',
    },
  ];
  const faqItems: FAQItem[] = [
    {
      answer: 'You can track your order by going to "Orders" in the menu.',
      id: '1',
      question: 'How do I track my order?',
    },
    {
      answer: 'We accept card payments and bank transfers.',
      id: '2',
      question: 'What payment methods do you accept?',
    },
  ];
  const storeInfo: StoreInfo = {
    address: 'Computer Village, Ikeja, Lagos',
    hours: [
      'Monday - Saturday: 9:00 AM - 7:00 PM',
      'Sunday: 12:00 PM - 5:00 PM',
    ],
  };
  const props = {
    colors: Colors.light,
    expandedId: null,
    faqItems,
    onToggleExpand: jest.fn(),
    storeInfo,
    supportOptions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes support and FAQ interactions through accessible actions', () => {
    render(<FAQView {...props} />);

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Contact support using WhatsApp Support',
      })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'How do I track my order?' })
    );

    expect(supportOptions[0]?.action).toHaveBeenCalledTimes(1);
    expect(props.onToggleExpand).toHaveBeenCalledWith('1');
    expect(
      screen.getByRole('button', {
        name: 'Contact support using Email Support',
      })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'How do I track my order?' })
    ).toHaveAccessibilityState({ expanded: false });
    expect(screen.queryByText(/track your order by going/)).toBeNull();
  });

  it('switches the visible answer as the expanded question changes', () => {
    const { rerender } = render(<FAQView {...props} expandedId="1" />);

    expect(
      screen.getByText(/track your order by going to "Orders"/)
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'How do I track my order?' })
    ).toHaveAccessibilityState({ expanded: true });

    rerender(<FAQView {...props} expandedId="2" />);

    expect(screen.queryByText(/track your order by going to "Orders"/)).toBeNull();
    expect(screen.getByText(/card payments and bank transfers/)).toBeTruthy();
  });

  it('renders the supplied store information', () => {
    render(<FAQView {...props} />);

    expect(screen.getByText('Store Hours')).toBeTruthy();
    expect(screen.getByText(storeInfo.hours[0] ?? '')).toBeTruthy();
    expect(screen.getByText(storeInfo.hours[1] ?? '')).toBeTruthy();
    expect(screen.getByText(storeInfo.address)).toBeTruthy();
  });
});
