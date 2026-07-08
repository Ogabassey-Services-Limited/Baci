import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
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
});
