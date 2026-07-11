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

const LEGACY_PAYPAL_CREDENTIAL_KEYS = [
  'paypal_client_id',
  'paypal_client_secret',
  'paypal_secret',
  'paypal_secret_key',
  'paypalClientId',
  'paypalClientSecret',
  'paypalSecret',
  'paypalSecretKey',
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

export function scrubLegacyPaypalCredentialFields(settings: JsonRecord): {
  settings: JsonRecord;
  didScrub: boolean;
} {
  const scrubbed = { ...settings };
  let didScrub = false;
  for (const key of LEGACY_PAYPAL_CREDENTIAL_KEYS) {
    if (key in scrubbed) {
      delete scrubbed[key];
      didScrub = true;
    }
  }
  return { settings: scrubbed, didScrub };
}

export function redactMerchantFeatureSettingsResponse<T>(settings: T): T {
  if (!isRecord(settings) || !isRecord(settings.custom_settings)) {
    return settings;
  }

  let redactedCustomSettings = { ...settings.custom_settings };
  let didRedact = false;

  for (const key of ZOHO_CAMPAIGNS_CUSTOM_SETTING_KEYS) {
    const zohoSettings = redactedCustomSettings[key];
    if (!isRecord(zohoSettings)) continue;

    redactedCustomSettings[key] =
      redactZohoCampaignSettingsRecord(zohoSettings);
    didRedact = true;
  }

  const paypalScrub = scrubLegacyPaypalCredentialFields(redactedCustomSettings);
  redactedCustomSettings = paypalScrub.settings;
  didRedact ||= paypalScrub.didScrub;

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
  if (!isRecord(existingCustomSettings)) {
    return scrubLegacyPaypalCredentialFields(incoming).settings;
  }

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

  return scrubLegacyPaypalCredentialFields(incoming).settings;
}
