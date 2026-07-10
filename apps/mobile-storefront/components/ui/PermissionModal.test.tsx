import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PermissionModal } from './PermissionModal';

jest.mock('@react-native-vector-icons/ionicons', () => () => null);

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');
  return { LinearGradient: View };
});

describe('PermissionModal', () => {
  it('renders no consent content while hidden', () => {
    render(
      <PermissionModal visible={false} onGrant={jest.fn()} onDeny={jest.fn()} />
    );

    expect(screen.queryByText('Stay Updated')).toBeNull();
  });

  it('shows only notification consent content', () => {
    render(
      <PermissionModal visible={true} onGrant={jest.fn()} onDeny={jest.fn()} />
    );

    expect(screen.getByText('Stay Updated')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Enable Notifications' })
    ).toBeTruthy();
    expect(screen.queryByText('Personalized For You')).toBeNull();
    expect(screen.queryByText('Allow Personalization')).toBeNull();
  });

  it('delegates notification consent choices', () => {
    const onGrant = jest.fn();
    const onDeny = jest.fn();
    render(
      <PermissionModal visible={true} onGrant={onGrant} onDeny={onDeny} />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Enable Notifications' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Maybe Later' }));

    expect(onGrant).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });
});
