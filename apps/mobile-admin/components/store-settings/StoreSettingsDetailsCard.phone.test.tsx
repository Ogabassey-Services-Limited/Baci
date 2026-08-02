import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DARK_COLORS } from '@/constants/theme';
import {
  nativeFieldState,
  renderDetailsCard,
  resetDetailsCardMocks,
} from './StoreSettingsDetailsCard.test-helpers';

describe('StoreSettingsDetailsCard phone fields', () => {
  beforeEach(resetDetailsCardMocks);

  it('uses flag-aware phone fields tied to the merchant country', () => {
    renderDetailsCard();

    expect(nativeFieldState.phoneProps).toHaveLength(2);
    expect(nativeFieldState.phoneProps[0]).toMatchObject({
      defaultCode: 'NG',
      defaultValue: '8012345678',
    });
    expect(nativeFieldState.phoneProps[1]).toMatchObject({
      defaultCode: 'NG',
      defaultValue: '7000000000',
    });
    for (const phoneProps of nativeFieldState.phoneProps) {
      expect(phoneProps.containerStyle).toEqual(
        expect.arrayContaining([expect.objectContaining({ height: 58 })])
      );
      expect(phoneProps.textInputStyle).toEqual(
        expect.arrayContaining([expect.objectContaining({ height: 54 })])
      );
    }
  });

  it('renders the phone country selector for the active color scheme', () => {
    renderDetailsCard({ colors: DARK_COLORS, isDark: true });

    for (const phoneProps of nativeFieldState.phoneProps) {
      expect(phoneProps).toMatchObject({ withDarkTheme: true });
      expect(phoneProps.countryPickerButtonStyle).toEqual(
        expect.objectContaining({ minWidth: 72, width: 72 })
      );
    }
  });
});
