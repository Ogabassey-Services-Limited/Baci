import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';
import { MobileUpdateModal } from './MobileUpdateModal';

describe('MobileUpdateModal', () => {
  it('renders optional OTA update actions', () => {
    const onAccept = jest.fn();
    const onDismiss = jest.fn();

    render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'ota-available',
          message: 'A faster version is ready.',
        }}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(screen.getByRole('button', { name: 'Update now' }));

    expect(screen.getByText('A faster version is ready.')).toBeTruthy();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('renders recommended native update actions', () => {
    render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'native-recommended',
          message: 'A newer app version is available.',
          storeUrl: 'https://apps.apple.com/app/id6472735367',
        }}
        onAccept={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByText('A newer app version is available.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open store' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Later' })).toBeTruthy();
  });

  it('hides the dismiss action for required native updates', () => {
    render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'native-required',
          message: 'Install the latest app to continue.',
          storeUrl: 'https://apps.apple.com/app/id6472735367',
        }}
        onAccept={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(
      screen.getByText('Install the latest app to continue.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open store' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
  });

  it('keeps the Android request-close handler installed for required updates', () => {
    const onDismiss = jest.fn();
    const optionalRender = render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'ota-available',
          message: 'A faster version is ready.',
        }}
        onAccept={jest.fn()}
        onDismiss={onDismiss}
      />
    );

    optionalRender.UNSAFE_getByType(Modal).props.onRequestClose();

    expect(onDismiss).toHaveBeenCalledTimes(1);

    optionalRender.unmount();

    const requiredRender = render(
      <MobileUpdateModal
        visible
        prompt={{
          kind: 'native-required',
          message: 'Install the latest app to continue.',
          storeUrl: 'https://apps.apple.com/app/id6472735367',
        }}
        onAccept={jest.fn()}
        onDismiss={onDismiss}
      />
    );

    const requiredOnRequestClose =
      requiredRender.UNSAFE_getByType(Modal).props.onRequestClose;

    expect(requiredOnRequestClose).toEqual(expect.any(Function));

    requiredOnRequestClose();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
