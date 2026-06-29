import { apiClient } from './api-client';

export interface EmailDomainDnsRecord {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
}

export interface EmailDomainConfig {
  domain: string;
  senderLocalPart: string;
  status: 'pending' | 'verified' | 'failed';
  enabled: boolean;
  records: EmailDomainDnsRecord[];
}

interface EmailDomainResponse {
  domain: EmailDomainConfig | null;
}

const ENDPOINT = '/api/merchant/email-domain';

/** Current custom sending-domain config for the signed-in merchant. */
export async function getEmailDomain(): Promise<EmailDomainConfig | null> {
  const { domain } = await apiClient<EmailDomainResponse>(ENDPOINT);
  return domain;
}

/** Register a domain with ZeptoMail; returns the DNS records to add. */
export async function registerEmailDomain(
  domain: string
): Promise<EmailDomainConfig | null> {
  const result = await apiClient<EmailDomainResponse>(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
  return result.domain;
}

/** Re-check DNS verification with ZeptoMail. */
export async function verifyEmailDomain(): Promise<EmailDomainConfig | null> {
  const result = await apiClient<EmailDomainResponse>(`${ENDPOINT}/verify`, {
    method: 'POST',
  });
  return result.domain;
}

/** Turn sending from the custom domain on/off (verified domains only). */
export async function setEmailDomainEnabled(
  enabled: boolean
): Promise<EmailDomainConfig | null> {
  const result = await apiClient<EmailDomainResponse>(ENDPOINT, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
  return result.domain;
}
