import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SettingsCardSection } from '@/app/settings/SettingsCardSection';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    __esModule: true,
    default: { View },
    FadeInDown: {
      delay: () => ({
        duration: () => ({}),
      }),
    },
  };
});

describe('SettingsCardSection', () => {
  it('renders the section title and children', () => {
    const { UNSAFE_getAllByType } = render(
      <SettingsCardSection
        cardBackgroundColor="#FFFFFF"
        cardBorderColor="#E5E7EB"
        delay={100}
        title="APPEARANCE"
        titleColor="#111827"
      >
        <Text>Section content</Text>
      </SettingsCardSection>
    );

    expect(screen.getByText('APPEARANCE')).toHaveStyle({ color: '#111827' });
    expect(screen.getByText('Section content')).toBeOnTheScreen();

    const card = UNSAFE_getAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.borderColor === '#E5E7EB'
    );

    expect(StyleSheet.flatten(card?.props.style)).toMatchObject({
      backgroundColor: '#FFFFFF',
      borderColor: '#E5E7EB',
    });
  });
});
