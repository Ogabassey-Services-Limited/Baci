import type {
  PlatformSettingsResponse,
  PlatformSettingsSecretStatus,
} from '@/app/api/admin/settings/route';

export type PlatformSettingsSecretInputs = Record<
  keyof PlatformSettingsSecretStatus,
  string
>;

export type PlatformSettingsUpdatePayload = Omit<
  PlatformSettingsResponse,
  'id' | 'created_at' | 'updated_at' | 'secretStatus'
> &
  Partial<PlatformSettingsSecretInputs>;

export const EMPTY_PLATFORM_SETTINGS_SECRET_INPUTS: PlatformSettingsSecretInputs =
  {
    ga4_api_secret: '',
    facebook_capi_token: '',
    tiktok_access_token: '',
    snapchat_capi_token: '',
  };

export function buildPlatformSettingsUpdatePayload(
  settings: PlatformSettingsResponse,
  secretInputs: PlatformSettingsSecretInputs
): PlatformSettingsUpdatePayload {
  const {
    id: _id,
    created_at: _created_at,
    updated_at: _updated_at,
    secretStatus: _secretStatus,
    ...editableSettings
  } = settings;

  const payload: PlatformSettingsUpdatePayload = { ...editableSettings };

  for (const [field, value] of Object.entries(secretInputs) as [
    keyof PlatformSettingsSecretInputs,
    string,
  ][]) {
    const trimmedValue = value.trim();
    if (trimmedValue.length > 0) {
      payload[field] = trimmedValue;
    }
  }

  return payload;
}
