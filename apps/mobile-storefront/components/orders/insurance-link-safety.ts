const ALLOWED_INSURANCE_FLOW_HOST = 'mycover.ai';

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
  if (
    hostname !== ALLOWED_INSURANCE_FLOW_HOST &&
    !hostname.endsWith(`.${ALLOWED_INSURANCE_FLOW_HOST}`)
  ) {
    return null;
  }

  return parsedUrl.toString();
}

export function normalizeInsuranceCertificateUrl(url: string): string | null {
  return parseHttpsUrl(url)?.toString() ?? null;
}
