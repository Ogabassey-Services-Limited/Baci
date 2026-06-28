import { Buffer } from 'node:buffer';
import { CompactSign, importPKCS8 } from 'jose';

/**
 * Minimal Google Play Android Publisher client for the in-app update gate.
 *
 * The release workflow uploads AABs to Play, but Play can still review/process
 * them before users can download them. This client reads the production track's
 * published releases and returns only versionCodes that Google Play reports as
 * live, so the gate does not prompt users ahead of availability.
 */

const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ANDROID_PUBLISHER_BASE_URL =
  'https://androidpublisher.googleapis.com/androidpublisher/v3';
const TOKEN_TTL_SECONDS = 3600;

export interface GooglePlayServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  tokenUri?: string;
}

export interface LiveGooglePlayBuild {
  /** Android versionCode live on the selected Play track. */
  build: number;
  track: string;
}

type FetchFn = typeof fetch;

interface GoogleServiceAccountJson {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

interface GooglePlayRelease {
  activeArtifacts?: Array<{ versionCode?: number | string }>;
  versionCodes?: string[];
  status?: string;
  releaseLifecycleState?: string;
}

interface GooglePlayTrackReleasesPayload {
  releases?: GooglePlayRelease[];
}

const LIVE_RELEASE_LIFECYCLE_STATES = new Set([
  'RELEASE_LIFECYCLE_STATE_PUBLISHED',
]);
const LIVE_EDIT_RELEASE_STATUSES = new Set(['completed']);

function normalizePrivateKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export function parseGooglePlayServiceAccountJson(
  rawJson: string
): GooglePlayServiceAccountCredentials {
  let parsed: GoogleServiceAccountJson;
  try {
    parsed = JSON.parse(rawJson) as GoogleServiceAccountJson;
  } catch {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be valid JSON');
  }

  const clientEmail = parsed.client_email?.trim();
  const privateKey = parsed.private_key?.trim();
  const tokenUri = parsed.token_uri?.trim() || undefined;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must include client_email and private_key'
    );
  }

  return { clientEmail, privateKey, tokenUri };
}

export async function createGooglePlayJwtAssertion(
  credentials: GooglePlayServiceAccountCredentials,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const key = await importPKCS8(
    normalizePrivateKey(credentials.privateKey),
    'RS256'
  );

  const payload = {
    aud: credentials.tokenUri ?? GOOGLE_OAUTH_TOKEN_URL,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    iat: nowSeconds,
    iss: credentials.clientEmail,
    scope: ANDROID_PUBLISHER_SCOPE,
  };

  return new CompactSign(new Uint8Array(Buffer.from(JSON.stringify(payload))))
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(key);
}

async function fetchGooglePlayAccessToken(
  credentials: GooglePlayServiceAccountCredentials,
  fetchFn: FetchFn
): Promise<string> {
  const assertion = await createGooglePlayJwtAssertion(credentials);
  const tokenUri = credentials.tokenUri ?? GOOGLE_OAUTH_TOKEN_URL;
  const response = await fetchFn(tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Google OAuth token exchange failed with ${response.status}: ${detail.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Google OAuth token response did not include access_token');
  }

  return payload.access_token;
}

function isLiveGooglePlayRelease(release: GooglePlayRelease): boolean {
  const lifecycleState = release.releaseLifecycleState?.trim().toUpperCase();
  if (lifecycleState && LIVE_RELEASE_LIFECYCLE_STATES.has(lifecycleState)) {
    return true;
  }

  const status = release.status?.trim().toLowerCase();
  return Boolean(status && LIVE_EDIT_RELEASE_STATUSES.has(status));
}

function parseVersionCode(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function getReleaseVersionCodes(release: GooglePlayRelease): string[] {
  const activeArtifactVersionCodes = (release.activeArtifacts ?? [])
    .map((artifact) => artifact.versionCode)
    .filter((versionCode): versionCode is number | string =>
      ['number', 'string'].includes(typeof versionCode)
    )
    .map(String);

  if (activeArtifactVersionCodes.length > 0) {
    return activeArtifactVersionCodes;
  }

  return release.versionCodes ?? [];
}

/**
 * Resolve the highest Android versionCode currently live on a Google Play track,
 * or null when the track has no published/completed release.
 */
export async function fetchLiveGooglePlayBuild(
  packageName: string,
  credentials: GooglePlayServiceAccountCredentials,
  options: { fetchFn?: FetchFn; track?: string } = {}
): Promise<LiveGooglePlayBuild | null> {
  const track = options.track ?? 'production';
  const fetchFn = options.fetchFn ?? fetch;
  const accessToken = await fetchGooglePlayAccessToken(credentials, fetchFn);
  const url = `${ANDROID_PUBLISHER_BASE_URL}/applications/${encodeURIComponent(
    packageName
  )}/tracks/${encodeURIComponent(track)}/releases`;

  const response = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Google Play track releases ${response.status} for ${packageName}/${track}: ${detail.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as GooglePlayTrackReleasesPayload;
  const liveBuilds = (payload.releases ?? [])
    .filter(isLiveGooglePlayRelease)
    .flatMap(getReleaseVersionCodes)
    .map(parseVersionCode)
    .filter((value): value is number => value !== null);

  if (liveBuilds.length === 0) return null;
  return { build: Math.max(...liveBuilds), track };
}
