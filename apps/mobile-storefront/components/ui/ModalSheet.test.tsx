import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Text } from 'react-native';
import { ModalSheet } from './ModalSheet';

describe('ModalSheet', () => {
  it('renders modal sheet content when visible', () => {
    render(
      <ModalSheet backdropStyle={{}} cardStyle={{}} visible>
        <Text>Sheet content</Text>
      </ModalSheet>
    );

    expect(screen.getByText('Sheet content')).toBeOnTheScreen();
  });

  it('uses default backdrop and card styles when style props are omitted', () => {
    render(
      <ModalSheet visible>
        <Text>Default styled content</Text>
      </ModalSheet>
    );

    expect(screen.getByText('Default styled content')).toBeOnTheScreen();
  });

  it('does not render modal sheet content when hidden', () => {
    render(
      <ModalSheet backdropStyle={{}} cardStyle={{}} visible={false}>
        <Text>Hidden content</Text>
      </ModalSheet>
    );

    expect(screen.queryByText('Hidden content')).not.toBeOnTheScreen();
  });

  it('calls backdrop and request-close handlers when the dismiss backdrop is pressed', () => {
    const onRequestClose = jest.fn();
    const onBackdropPress = jest.fn();
    render(
      <ModalSheet
        backdropStyle={{}}
        cardStyle={{}}
        onBackdropPress={onBackdropPress}
        onRequestClose={onRequestClose}
        visible
      >
        <Text>Dismissable content</Text>
      </ModalSheet>
    );

    fireEvent.press(screen.getByLabelText('Dismiss modal'));

    expect(onBackdropPress).toHaveBeenCalledTimes(1);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when pressing content inside the sheet', () => {
    const onRequestClose = jest.fn();
    const onBackdropPress = jest.fn();
    const onSheetAction = jest.fn();
    render(
      <ModalSheet
        backdropStyle={{}}
        cardStyle={{}}
        onBackdropPress={onBackdropPress}
        onRequestClose={onRequestClose}
        visible
      >
        <Button title="Sheet action" onPress={onSheetAction} />
      </ModalSheet>
    );

    fireEvent.press(screen.getByRole('button', { name: 'Sheet action' }));

    expect(onSheetAction).toHaveBeenCalled();
    expect(onBackdropPress).not.toHaveBeenCalled();
    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
