type JsonRecord = Record<string, unknown>;

const ZOHO_CAMPAIGNS_CUSTOM_SETTING_KEYS = [
  'zohoCampaigns',
  'zoho_campaigns',
] as const;

const ZOHO_CAMPAIGNS_SECRET_KEYS = [
  'accessToken',
  'access_token',
  'clientSecret',
  'client_secret',
  'refreshToken',
  'refresh_token',
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactZohoCampaignSettingsRecord(settings: JsonRecord): JsonRecord {
  const redacted = { ...settings };
  for (const key of ZOHO_CAMPAIGNS_SECRET_KEYS) {
    delete redacted[key];
  }
  return redacted;
}

export function redactMerchantFeatureSettingsResponse<T>(settings: T): T {
  if (!isRecord(settings) || !isRecord(settings.custom_settings)) {
    return settings;
  }

  const redactedCustomSettings = { ...settings.custom_settings };
  let didRedact = false;

  for (const key of ZOHO_CAMPAIGNS_CUSTOM_SETTING_KEYS) {
    const zohoSettings = redactedCustomSettings[key];
    if (!isRecord(zohoSettings)) continue;

    redactedCustomSettings[key] =
      redactZohoCampaignSettingsRecord(zohoSettings);
    didRedact = true;
  }

  if (!didRedact) return settings;

  return {
    ...settings,
    custom_settings: redactedCustomSettings,
  } as T;
}

function preserveZohoSettingsFields(
  incomingSettings: JsonRecord,
  existingSettings: JsonRecord
): JsonRecord {
  return {
    ...existingSettings,
    ...incomingSettings,
  };
}

export function preserveZohoCampaignSecretCustomSettings(
  incomingCustomSettings: unknown,
  existingCustomSettings: unknown
): JsonRecord {
  const incoming = isRecord(incomingCustomSettings)
    ? { ...incomingCustomSettings }
    : {};
  if (!isRecord(existingCustomSettings)) return incoming;

  for (const key of ZOHO_CAMPAIGNS_CUSTOM_SETTING_KEYS) {
    const existingZohoSettings = existingCustomSettings[key];
    if (!isRecord(existingZohoSettings)) continue;

    const incomingZohoSettings = incoming[key];
    if (!isRecord(incomingZohoSettings)) {
      if (!(key in incoming)) incoming[key] = existingZohoSettings;
      continue;
    }

    incoming[key] = preserveZohoSettingsFields(
      incomingZohoSettings,
      existingZohoSettings
    );
  }

  return incoming;
}
