import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import SettingsCardSection from './SettingsCardSection';

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
    render(
      <SettingsCardSection delay={100} title="APPEARANCE" titleColor="#111827">
        <Text>Section content</Text>
      </SettingsCardSection>
    );

    expect(screen.getByText('APPEARANCE')).toHaveStyle({ color: '#111827' });
    expect(screen.getByText('Section content')).toBeOnTheScreen();
  });
});
