import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import AppKeyboardAwareScrollView from './AppKeyboardAwareScrollView';

describe('AppKeyboardAwareScrollView', () => {
  it('renders children with keyboard-safe defaults', () => {
    render(
      <AppKeyboardAwareScrollView>
        <Text>Checkout form</Text>
      </AppKeyboardAwareScrollView>
    );

    expect(screen.getByText('Checkout form')).toBeTruthy();
    expect(screen.getByTestId('keyboard-aware-scroll-view')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled'
    );
    expect(screen.getByTestId('keyboard-aware-scroll-view')).toHaveProp('bottomOffset', 24);
  });

  it('forwards scroll props and content container styling', () => {
    render(
      <AppKeyboardAwareScrollView
        bottomOffset={88}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="always"
      >
        <Text>Profile form</Text>
      </AppKeyboardAwareScrollView>
    );

    const scrollView = screen.getByTestId('keyboard-aware-scroll-view');

    expect(scrollView).toHaveProp('bottomOffset', 88);
    expect(scrollView).toHaveProp('keyboardShouldPersistTaps', 'always');
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toMatchObject({
      paddingBottom: 32,
    });
  });

  it('forwards a custom testID to the underlying scroll primitive', () => {
    render(<AppKeyboardAwareScrollView testID="custom-scroll" />);

    expect(screen.getByTestId('custom-scroll')).toBeTruthy();
  });
});
