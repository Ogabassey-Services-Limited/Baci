import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import AppKeyboardContainer from './AppKeyboardContainer';

describe('AppKeyboardContainer', () => {
  it('renders children in a controller-backed full-height container', () => {
    render(
      <AppKeyboardContainer>
        <Text>Login form</Text>
      </AppKeyboardContainer>
    );

    const container = screen.getByTestId('keyboard-container');

    expect(screen.getByText('Login form')).toBeTruthy();
    expect(container).toHaveProp('automaticOffset', true);
    expect(container).toHaveProp('behavior', 'padding');
    expect(StyleSheet.flatten(container.props.style)).toMatchObject({ flex: 1 });
  });

  it('forwards keyboard props and merges container styling', () => {
    render(
      <AppKeyboardContainer
        behavior="translate-with-padding"
        keyboardVerticalOffset={72}
        style={{ paddingTop: 16 }}
      >
        <Text>Single input</Text>
      </AppKeyboardContainer>
    );

    const container = screen.getByTestId('keyboard-container');

    expect(container).toHaveProp('behavior', 'translate-with-padding');
    expect(container).toHaveProp('keyboardVerticalOffset', 72);
    expect(StyleSheet.flatten(container.props.style)).toMatchObject({
      flex: 1,
      paddingTop: 16,
    });
  });

  it('keeps base layout when optional style is omitted', () => {
    render(<AppKeyboardContainer />);

    expect(StyleSheet.flatten(screen.getByTestId('keyboard-container').props.style)).toMatchObject(
      {
        flex: 1,
      }
    );
  });
});
