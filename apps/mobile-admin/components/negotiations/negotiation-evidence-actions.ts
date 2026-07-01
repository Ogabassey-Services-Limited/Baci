import { Alert, Linking } from 'react-native';
import { supabase } from '@/lib/supabase';

const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';
const EVIDENCE_SIGNED_URL_TTL_SECONDS = 60 * 60;

// Uploaded evidence is stored as `<merchantId>/<timestamp>-<rand>.<ext>` (see
// uploadNegotiationEvidence). Match that exact shape so a scheme-less
// competitor URL is not mistaken for a private Storage object.
const STORAGE_OBJECT_PATH =
  /^[^/\s:.]+\/[^/\s]+\.(?:png|jpe?g|webp|heic|heif)$/i;
const SAFE_SCHEME_URL = /^(tel|mailto|geo):/i;

export function isNegotiationRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isNegotiationStorageObjectPath(value: string): boolean {
  return value.length <= 1024 && STORAGE_OBJECT_PATH.test(value);
}

// Open a link in the OS handler (browser, dialer, WhatsApp). Best-effort: an
// unsupported or malformed URL surfaces a friendly alert instead of throwing.
export async function openNegotiationExternalUrl(url: string): Promise<void> {
  try {
    if (SAFE_SCHEME_URL.test(url)) {
      await Linking.openURL(url);
      return;
    }

    if (isNegotiationRemoteUrl(url)) {
      await Linking.openURL(url);
      return;
    }

    Alert.alert('Cannot open link', url);
  } catch {
    Alert.alert('Cannot open link', url);
  }
}

// Customers attach evidence as a URL (competitor link), a durable Supabase
// Storage object path, or legacy placeholder text. Storage paths are private, so
// mint a fresh signed URL at view time; placeholders stay readable as text.
export async function openNegotiationEvidence(
  evidenceUrl: string
): Promise<void> {
  if (isNegotiationRemoteUrl(evidenceUrl)) {
    await openNegotiationExternalUrl(evidenceUrl);
    return;
  }

  if (isNegotiationStorageObjectPath(evidenceUrl)) {
    try {
      const { data, error } = await supabase.storage
        .from(NEGOTIATION_EVIDENCE_BUCKET)
        .createSignedUrl(evidenceUrl, EVIDENCE_SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        throw error ?? new Error('Missing signed URL');
      }
      await openNegotiationExternalUrl(data.signedUrl);
    } catch {
      // Signing failed (expired bucket policy, deleted object, ...). Don't
      // dead-end the merchant; show the raw value so they can read what was sent.
      Alert.alert('Customer evidence', evidenceUrl);
    }
    return;
  }

  Alert.alert('Customer evidence', evidenceUrl);
}
