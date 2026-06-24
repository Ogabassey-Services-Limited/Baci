import { importPKCS8, SignJWT } from 'jose';

/**
 * Minimal App Store Connect API client for reading the build that is actually
 * live on the App Store. Used by the `ios-live-build-sync` cron to keep the
 * in-app update gate honest — we only prompt users to update once Apple has
 * released the build, not when it lands on TestFlight.
 *
 * Auth uses the same ASC API key the iOS release workflow already relies on
 * (ASC_API_KEY_ID / ASC_API_ISSUER_ID / the `.p8` private key), here provided
 * to the web app as ASC_API_PRIVATE_KEY (PEM contents).
 */

const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com';
const ASC_AUDIENCE = 'appstoreconnect-v1';
// Apple rejects tokens with a lifetime over 20 minutes.
const TOKEN_TTL_SECONDS = 600;

export interface AscCredentials {
  keyId: string;
  issuerId: string;
  /** PKCS#8 PEM contents of the `.p8` key (may use literal "\n" escapes). */
  privateKey: string;
}

export interface LiveAppStoreBuild {
  /** CFBundleVersion of the live build, as an integer. */
  build: number;
  /** Marketing version string, e.g. "2.1.360". */
  versionString: string;
}

type FetchFn = typeof fetch;

interface AscVersionAttributes {
  versionString?: string;
  appStoreState?: string;
  state?: string;
}

interface AscResource {
  id: string;
  type: string;
  attributes?: AscVersionAttributes & { version?: string };
  relationships?: {
    build?: { data?: { id?: string; type?: string } | null };
  };
}

// A version is downloadable once it reaches these states. `appStoreState` is the
// classic v1 field; newer API responses use `state`. We accept either so the
// reconciler keeps working across API revisions.
const LIVE_STATES = new Set(['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION']);

function normalizePrivateKey(raw: string): string {
  // Env vars frequently store the PEM with literal "\n" rather than newlines.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export async function createAscToken(
  credentials: AscCredentials,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const key = await importPKCS8(
    normalizePrivateKey(credentials.privateKey),
    'ES256'
  );

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: credentials.keyId, typ: 'JWT' })
    .setIssuer(credentials.issuerId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + TOKEN_TTL_SECONDS)
    .setAudience(ASC_AUDIENCE)
    .sign(key);
}

async function ascGet(
  token: string,
  path: string,
  fetchFn: FetchFn
): Promise<unknown> {
  const response = await fetchFn(`${ASC_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `App Store Connect API ${response.status} for ${path}: ${detail.slice(0, 300)}`
    );
  }

  return response.json();
}

function isLiveVersion(resource: AscResource): boolean {
  const attrs = resource.attributes;
  if (!attrs) return false;
  const state = attrs.appStoreState ?? attrs.state;
  return typeof state === 'string' && LIVE_STATES.has(state);
}

/**
 * Resolve the build currently live on the App Store for a bundle id, or null if
 * none is in a released state. Returns null (rather than throwing) for the
 * "no live version found" case so the caller can no-op cleanly.
 */
export async function fetchLiveAppStoreBuild(
  bundleId: string,
  credentials: AscCredentials,
  fetchFn: FetchFn = fetch
): Promise<LiveAppStoreBuild | null> {
  const token = await createAscToken(credentials);

  const appsPayload = (await ascGet(
    token,
    `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`,
    fetchFn
  )) as { data?: AscResource[] };

  const appId = appsPayload.data?.[0]?.id;
  if (!appId) {
    throw new Error(`No App Store Connect app found for bundleId ${bundleId}`);
  }

  const versionsPayload = (await ascGet(
    token,
    `/v1/apps/${appId}/appStoreVersions?include=build&limit=20&sort=-versionString`,
    fetchFn
  )) as { data?: AscResource[]; included?: AscResource[] };

  const liveVersion = versionsPayload.data?.find(isLiveVersion);
  if (!liveVersion) {
    return null;
  }

  const buildId = liveVersion.relationships?.build?.data?.id;
  const includedBuild = versionsPayload.included?.find(
    (resource) => resource.type === 'builds' && resource.id === buildId
  );

  const rawBuild = includedBuild?.attributes?.version;
  const build = rawBuild ? Number(rawBuild) : Number.NaN;
  const versionString = liveVersion.attributes?.versionString;

  if (!Number.isInteger(build) || build < 0 || !versionString) {
    throw new Error(
      `Live App Store version ${versionString ?? '?'} is missing a usable CFBundleVersion (got "${rawBuild ?? ''}")`
    );
  }

  return { build, versionString };
}
