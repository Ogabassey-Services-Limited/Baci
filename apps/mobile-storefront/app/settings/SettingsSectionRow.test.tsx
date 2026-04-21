import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import SettingsSectionRow from './SettingsSectionRow';

describe('SettingsSectionRow', () => {
  it('renders the row copy and triggers onPress', () => {
    const onPress = jest.fn();

    render(
      <SettingsSectionRow
        accessibilityLabel="Open privacy policy"
        accessibilityRole="link"
        icon="shield-outline"
        iconBackgroundColor="#E5E7EB"
        iconColor="#111827"
        label="Privacy Policy"
        labelColor="#111827"
        onPress={onPress}
        right={<Text>Open</Text>}
        subtitle="Review how your data is handled"
        subtitleColor="#6B7280"
      />
    );

    fireEvent.press(screen.getByRole('link', { name: 'Open privacy policy' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Privacy Policy')).toBeOnTheScreen();
    expect(
      screen.getByText('Review how your data is handled')
    ).toBeOnTheScreen();
  });
});
