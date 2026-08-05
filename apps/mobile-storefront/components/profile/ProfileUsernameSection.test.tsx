import { describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { useAuthStore } from '@/stores/auth-store';
import { ProfileUsernameSection } from './ProfileUsernameSection';

// Stub UsernamePrompt so this suite exercises the section's own display/label
// wiring, not the prompt's auth-store/setUsername internals (covered elsewhere).
jest.mock('@/components/account/UsernamePrompt', () => ({
  UsernamePrompt: ({
    initialValue,
    submitLabel,
  }: {
    initialValue?: string;
    onSuccess?: (username: string) => void;
    submitLabel?: string;
  }) => {
    const { Text: RNText } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <RNText>{`prompt:${submitLabel}:${initialValue}`}</RNText>;
  },
}));

describe('ProfileUsernameSection', () => {
  it('shows the current username and an update label when one is set', () => {
    render(
      <ProfileUsernameSection
        colors={Colors.light}
        onSaved={jest.fn()}
        username="ogafan"
      />
    );

    expect(screen.getByText('@ogafan')).toBeTruthy();
    expect(screen.getByText('prompt:Update username:ogafan')).toBeTruthy();
  });

  it('shows a not-set placeholder and a save label when no username exists', () => {
    render(
      <ProfileUsernameSection
        colors={Colors.light}
        onSaved={jest.fn()}
        username={null}
      />
    );

    expect(screen.getByText('Not set yet')).toBeTruthy();
    expect(screen.getByText('prompt:Save username:')).toBeTruthy();
    expect(screen.queryByText('@null')).toBeNull();
  });

  it('shows the next eligible date and hides rename controls during cooldown', () => {
    render(
      <ProfileUsernameSection
        colors={Colors.light}
        onSaved={jest.fn()}
        username="ogafan"
        nextEligibleAt="2099-01-01T00:00:00.000Z"
      />
    );

    expect(
      screen.getByText(/You can change this username again on/)
    ).toBeTruthy();
    expect(screen.queryByText(/prompt:Update username/)).toBeNull();
  });

  it('shows rename controls after the cooldown has elapsed', () => {
    render(
      <ProfileUsernameSection
        colors={Colors.light}
        onSaved={jest.fn()}
        username="ogafan"
        nextEligibleAt="2020-01-01T00:00:00.000Z"
      />
    );

    expect(screen.getByText('prompt:Update username:ogafan')).toBeTruthy();
    expect(
      screen.queryByText(/You can change this username again on/)
    ).toBeNull();
  });

  it('uses the server cooldown stored on the hydrated customer when no prop is passed', () => {
    act(() => {
      useAuthStore.setState({
        customer: {
          email: 'player@example.test',
          id: 'customer-1',
          username: 'ogafan',
          username_next_eligible_at: '2099-01-01T00:00:00.000Z',
        },
      });
    });

    render(
      <ProfileUsernameSection
        colors={Colors.light}
        onSaved={jest.fn()}
        username="ogafan"
      />
    );

    expect(
      screen.getByText(/You can change this username again on/)
    ).toBeTruthy();
    act(() => useAuthStore.setState({ customer: null }));
  });
});
