import type Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import type { AppearanceMode } from '@/stores/settings-store';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export const PRIVACY_POLICY_URL = 'https://ogabassey.com/privacy';
export const TERMS_OF_SERVICE_URL = 'https://ogabassey.com/terms';

export const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
] as const satisfies ReadonlyArray<{
  icon: IoniconsName;
  label: string;
  value: AppearanceMode;
}>;

export const ABOUT_LINKS = [
  {
    label: 'Privacy Policy',
    icon: 'shield-checkmark-outline',
    accessibilityLabel: 'Open privacy policy',
    url: PRIVACY_POLICY_URL,
  },
  {
    label: 'Terms of Service',
    icon: 'document-text-outline',
    accessibilityLabel: 'Open terms of service',
    url: TERMS_OF_SERVICE_URL,
  },
] as const satisfies ReadonlyArray<{
  accessibilityLabel: string;
  icon: IoniconsName;
  label: string;
  url: string;
}>;
