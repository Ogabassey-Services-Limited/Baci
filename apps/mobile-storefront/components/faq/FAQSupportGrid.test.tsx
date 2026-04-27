import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FAQSupportGrid, type FAQSupportOption } from './FAQSupportGrid';

describe('FAQSupportGrid', () => {
  it('renders accessible support actions and invokes the pressed option', () => {
    const onPress = jest.fn();
    const options: FAQSupportOption[] = [
      {
        id: 'call',
        title: 'Call Us',
        subtitle: '08123456789',
        icon: 'call-outline',
        accessibilityHint: 'Calls support at 08123456789',
        onPress,
      },
    ];

    render(
      <FAQSupportGrid
        cardColor="#fff"
        defaultIconBackgroundColor="rgba(239, 68, 68, 0.12)"
        options={options}
        secondaryTextColor="#666"
        textColor="#111"
      />
    );

    const callButton = screen.getByRole('button', {
      name: 'Call Us, 08123456789',
    });

    fireEvent.press(callButton);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(callButton.props.accessibilityHint).toBe(
      'Calls support at 08123456789'
    );
  });
});
