/**
 * MyCover hosted-flow URL validation, shared by web and mobile storefronts.
 *
 * MyCover claim/inspection links and certificate URLs are opened directly in a
 * browser/WebView, so we only ever hand off HTTPS URLs on an allow-listed host
 * (MyCover, or their S3 certificate bucket). Everything else — non-HTTPS,
 * unknown hosts, malformed input — is rejected.
 */

const ALLOWED_INSURANCE_PROVIDER_HOST = 'mycover.ai';
const ALLOWED_MY_COVER_S3_CERTIFICATE_HOST = 's3.eu-west-2.amazonaws.com';
const ALLOWED_MY_COVER_S3_CERTIFICATE_BUCKET_PREFIXES = [
  'mycover',
  'staging.mycover',
] as const;

export function isMyCoverHost(hostname: string): boolean {
  return (
    hostname === ALLOWED_INSURANCE_PROVIDER_HOST ||
    hostname.endsWith(`.${ALLOWED_INSURANCE_PROVIDER_HOST}`)
  );
}

function hasAllowedMyCoverS3CertificateBucket(pathname: string): boolean {
  const [bucketName] = pathname.split('/').filter(Boolean);
  if (!bucketName) return false;

  return ALLOWED_MY_COVER_S3_CERTIFICATE_BUCKET_PREFIXES.some(
    (prefix) => bucketName === prefix || bucketName.startsWith(`${prefix}.`)
  );
}

function parseHttpsUrl(url: string | null | undefined): URL | null {
  if (typeof url !== 'string') return null;
  const candidate = url.trim();
  if (!candidate) return null;

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === 'https:' ? parsedUrl : null;
  } catch {
    return null;
  }
}

/** Hosted claim/inspection flow URL (HTTPS on a MyCover host), or null. */
export function normalizeInsuranceFlowUrl(
  url: string | null | undefined
): string | null {
  const parsedUrl = parseHttpsUrl(url);
  if (!parsedUrl) return null;

  return isMyCoverHost(parsedUrl.hostname.toLowerCase())
    ? parsedUrl.toString()
    : null;
}

/** Certificate URL (MyCover host or their S3 certificate bucket), or null. */
export function normalizeInsuranceCertificateUrl(
  url: string | null | undefined
): string | null {
  const parsedUrl = parseHttpsUrl(url);
  if (!parsedUrl) return null;

  const hostname = parsedUrl.hostname.toLowerCase();
  if (isMyCoverHost(hostname)) {
    return parsedUrl.toString();
  }

  if (
    hostname === ALLOWED_MY_COVER_S3_CERTIFICATE_HOST &&
    hasAllowedMyCoverS3CertificateBucket(parsedUrl.pathname)
  ) {
    return parsedUrl.toString();
  }

  return null;
}
