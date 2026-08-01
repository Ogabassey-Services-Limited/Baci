import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import type { AnalyticsState } from '@/lib/analytics-config-diff';

type CredentialField = {
  field: Exclude<keyof AnalyticsState, 'offline_conversions_enabled'>;
  icon: IoniconsIconName;
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
};

type PlatformConfig = {
  fields: readonly CredentialField[];
  helpLink: string;
  hint: string;
  icon: IoniconsIconName;
  iconColor: string | 'theme-text';
  id: 'facebook' | 'tiktok' | 'google' | 'snapchat';
  title: string;
};

export const analyticsPlatformConfigs = [
  {
    id: 'facebook',
    title: 'Meta (Facebook/Instagram)',
    icon: 'logo-facebook',
    iconColor: '#1877F2',
    helpLink: 'https://www.facebook.com/business/help/952192354843755',
    fields: [
      {
        label: 'Pixel ID',
        field: 'facebook_pixel_id',
        placeholder: '1234567890123456',
        icon: 'code-outline',
      },
      {
        label: 'Conversions API Token',
        field: 'facebook_capi_token',
        placeholder: 'EAAxxxxxxxx...',
        icon: 'key-outline',
        secureTextEntry: true,
      },
    ],
    hint: 'Get your token from Events Manager → Settings → Generate Access Token',
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    icon: 'logo-tiktok',
    iconColor: 'theme-text',
    helpLink: 'https://ads.tiktok.com/help/article/events-api',
    fields: [
      {
        label: 'Pixel ID',
        field: 'tiktok_pixel_id',
        placeholder: 'CXXXXXXXXXXXXXXXXX',
        icon: 'code-outline',
      },
      {
        label: 'Events API Access Token',
        field: 'tiktok_access_token',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx',
        icon: 'key-outline',
        secureTextEntry: true,
      },
    ],
    hint: 'Get your token from TikTok Ads Manager → Assets → Events → Web Events → Settings',
  },
  {
    id: 'google',
    title: 'Google Analytics 4 & Ads',
    icon: 'logo-google',
    iconColor: '#EA4335',
    helpLink: 'https://support.google.com/analytics/answer/9304153',
    fields: [
      {
        label: 'Measurement ID',
        field: 'google_analytics_id',
        placeholder: 'G-XXXXXXXXXX',
        icon: 'analytics-outline',
      },
      {
        label: 'API Secret',
        field: 'ga4_api_secret',
        placeholder: 'xXxXxXxXxXxX',
        icon: 'key-outline',
        secureTextEntry: true,
      },
    ],
    hint: 'Data sent here syncs to Google Ads if accounts are linked. Get API secret from GA4 → Admin → Data Streams.',
  },
  {
    id: 'snapchat',
    title: 'Snapchat',
    icon: 'logo-snapchat',
    iconColor: '#FFFC00',
    helpLink: 'https://businesshelp.snapchat.com/s/article/conversions-api',
    fields: [
      {
        label: 'Pixel ID',
        field: 'snapchat_pixel_id',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx',
        icon: 'code-outline',
      },
      {
        label: 'Conversions API Token',
        field: 'snapchat_capi_token',
        placeholder: 'eyJxxxxxxxxx...',
        icon: 'key-outline',
        secureTextEntry: true,
      },
    ],
    hint: 'Get your token from Snapchat Ads Manager → Events Manager → Conversions API',
  },
] as const satisfies readonly PlatformConfig[];
