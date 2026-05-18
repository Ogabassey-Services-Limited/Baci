import { normalizeCacSearchTerm } from '@baci/shared';
import { getCacApiUrl, getCacTinApiBaseUrl } from '@/env';
import { normalizeTaxIdentificationNumber } from '@/lib/tax-identification';

export interface CacPublicCompany {
  approvedName: string;
  rcNumber: string;
  companyId?: number | string;
  classificationId?: number | string;
  classificationName?: string;
  status?: string;
}

interface CacFetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface CacCompanyMatchInput {
  legalEntityName?: string | null;
  rcNumber?: string | null;
}

export class CacPublicRecordsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'CacPublicRecordsError';
    this.code = code;
    this.status = status;
  }
}

const CAC_SEARCH_CLASSIFICATION = 'ALL';
const CAC_REQUEST_TIMEOUT_MS = 10_000;
const CAC_BROWSER_BASE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Origin: 'https://icrp.cac.gov.ng',
  Pragma: 'no-cache',
  Referer: 'https://icrp.cac.gov.ng/public-search/homeIn',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
const CAC_SEARCH_HEADERS = {
  ...CAC_BROWSER_BASE_HEADERS,
  'Sec-Fetch-Site': 'same-site',
};
const CAC_TIN_HEADERS = {
  ...CAC_BROWSER_BASE_HEADERS,
  'Sec-Fetch-Site': 'same-origin',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function toStringOrNumberValue(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return null;
}

function parseCacCompany(value: unknown): CacPublicCompany | null {
  if (!isRecord(value)) return null;

  const approvedName = toStringValue(value.approvedName);
  const rcNumber = toStringValue(value.rcNumber);

  if (!approvedName || !rcNumber) {
    return null;
  }

  const company: CacPublicCompany = {
    approvedName,
    rcNumber,
  };

  const companyId = toStringOrNumberValue(value.companyId);
  if (companyId !== null) company.companyId = companyId;

  const classificationId = toStringOrNumberValue(value.classificationId);
  if (classificationId !== null) company.classificationId = classificationId;

  const classificationName = toStringValue(value.classificationName);
  if (classificationName) company.classificationName = classificationName;

  const status = toStringValue(value.status);
  if (status) company.status = status;

  return company;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  unavailableMessage: string
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new CacPublicRecordsError(
        unavailableMessage,
        'cac_service_unavailable',
        502
      );
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCacCompanies(
  searchTerm: string,
  options: CacFetchOptions = {}
): Promise<CacPublicCompany[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const data = await fetchJsonWithTimeout(
    getCacApiUrl(),
    {
      method: 'POST',
      headers: {
        ...CAC_SEARCH_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchTerm: normalizeCacSearchTerm(searchTerm),
        classification: CAC_SEARCH_CLASSIFICATION,
      }),
    },
    fetchImpl,
    options.timeoutMs ?? CAC_REQUEST_TIMEOUT_MS,
    'CAC search service unavailable'
  );

  if (!isRecord(data) || !Array.isArray(data.data)) {
    return [];
  }

  return data.data
    .map((company) => parseCacCompany(company))
    .filter((company): company is CacPublicCompany => company !== null);
}

export async function fetchCacTaxId(
  company: CacPublicCompany,
  options: CacFetchOptions = {}
): Promise<string | null> {
  if (
    company.companyId === undefined ||
    company.classificationId === undefined
  ) {
    throw new CacPublicRecordsError(
      'CAC record is missing Tax ID lookup identifiers',
      'cac_tax_id_lookup_identifiers_missing',
      502
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = getCacTinApiBaseUrl().replace(/\/+$/, '');
  const url = new URL(
    `${baseUrl}/generate-tax-id/${encodeURIComponent(String(company.companyId))}`
  );
  url.searchParams.set(
    'rc',
    company.rcNumber.replace(/\D/g, '') || company.rcNumber
  );
  url.searchParams.set('type', String(company.classificationId));

  const data = await fetchJsonWithTimeout(
    url.toString(),
    {
      method: 'GET',
      headers: CAC_TIN_HEADERS,
    },
    fetchImpl,
    options.timeoutMs ?? CAC_REQUEST_TIMEOUT_MS,
    'CAC Tax ID service unavailable'
  );

  if (!isRecord(data)) {
    return null;
  }

  const envelopeData = isRecord(data.data) ? data.data : data;
  const taxId = toStringValue(envelopeData.tax_id);
  const normalizedTaxId = normalizeTaxIdentificationNumber(taxId);

  return normalizedTaxId || null;
}

function normalizeBusinessName(value?: string | null): string {
  return (
    value
      ?.toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ') ?? ''
  );
}

function normalizeRegistrationDigits(value?: string | null): string {
  return value?.replace(/\D/g, '') ?? '';
}

export function findMatchingCacCompany(
  companies: CacPublicCompany[],
  input: CacCompanyMatchInput
): CacPublicCompany | null {
  const rcDigits = normalizeRegistrationDigits(input.rcNumber);
  if (rcDigits) {
    const rcMatch = companies.find(
      (company) => normalizeRegistrationDigits(company.rcNumber) === rcDigits
    );
    if (rcMatch) return rcMatch;
  }

  const legalName = normalizeBusinessName(input.legalEntityName);
  if (!legalName) return null;

  const exactMatches = companies.filter(
    (company) => normalizeBusinessName(company.approvedName) === legalName
  );

  return (
    exactMatches.find(
      (company) => company.status?.trim().toUpperCase() === 'ACTIVE'
    ) ??
    exactMatches[0] ??
    null
  );
}
