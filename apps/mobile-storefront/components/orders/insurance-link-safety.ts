const ALLOWED_INSURANCE_PROVIDER_HOST = 'mycover.ai';
const ALLOWED_MY_COVER_S3_CERTIFICATE_HOST = 's3.eu-west-2.amazonaws.com';
const ALLOWED_MY_COVER_S3_CERTIFICATE_BUCKET_PREFIXES = [
  'mycover',
  'staging.mycover',
] as const;

function isMyCoverHost(hostname: string): boolean {
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

function parseHttpsUrl(url: string): URL | null {
  const candidate = url.trim();
  if (!candidate) return null;

  try {
    const parsedUrl = new URL(candidate);
    return parsedUrl.protocol === 'https:' ? parsedUrl : null;
  } catch {
    return null;
  }
}

export function normalizeInsuranceFlowUrl(url: string): string | null {
  const parsedUrl = parseHttpsUrl(url);
  if (!parsedUrl) return null;

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!isMyCoverHost(hostname)) {
    return null;
  }

  return parsedUrl.toString();
}

export function normalizeInsuranceCertificateUrl(url: string): string | null {
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
