import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import type { MerchantSocialMedia } from '@/hooks/useMerchant';

export type SocialMediaFieldConfig = {
  platform: keyof MerchantSocialMedia;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  badge?: string;
};

export const EMPTY_SOCIAL_MEDIA: MerchantSocialMedia = {
  instagram: '',
  twitter: '',
  facebook: '',
  tiktok: '',
  youtube: '',
  pinterest: '',
  linkedin: '',
  snapchat: '',
};

export const SOCIAL_MEDIA_FIELDS: readonly SocialMediaFieldConfig[] = [
  {
    platform: 'instagram',
    label: 'Instagram Handle',
    icon: 'logo-instagram',
    placeholder: '@username',
  },
  {
    platform: 'twitter',
    label: 'Twitter/X Handle',
    icon: 'logo-twitter',
    placeholder: '@username',
  },
  {
    platform: 'snapchat',
    label: 'Snapchat Handle',
    icon: 'logo-snapchat',
    placeholder: '@username',
    badge: 'NEW',
  },
  {
    platform: 'facebook',
    label: 'Facebook URL',
    icon: 'logo-facebook',
    placeholder: 'https://facebook.com/page',
  },
  {
    platform: 'youtube',
    label: 'YouTube URL',
    icon: 'logo-youtube',
    placeholder: 'https://youtube.com/@channel',
  },
  {
    platform: 'pinterest',
    label: 'Pinterest URL',
    icon: 'logo-pinterest',
    placeholder: 'https://pinterest.com/profile',
  },
  {
    platform: 'tiktok',
    label: 'TikTok Handle',
    icon: 'logo-tiktok',
    placeholder: '@username',
  },
  {
    platform: 'linkedin',
    label: 'LinkedIn URL',
    icon: 'logo-linkedin',
    placeholder: 'https://linkedin.com/company/...',
  },
] as const;
