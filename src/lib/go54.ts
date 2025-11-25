/**
 * Go54 Domain Reseller API Integration
 * Documentation: https://api-docs.go54.com
 */

import whois from 'whois-json';

const GO54_BASE_URL =
  'https://whogohost.com/host/modules/addons/DomainsReseller/api/index.php';
const GO54_EMAIL = process.env.GO54_EMAIL || '';
const GO54_API_KEY = process.env.GO54_API_KEY || '';

export interface ContactInfo {
  firstname: string;
  lastname: string;
  fullname: string;
  companyname?: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string; // ISO 2-letter code (e.g., "NG")
  phonenumber: string;
}

export interface DomainAvailabilityResult {
  searchTerm: string;
  tld: string;
  available: boolean;
  price?: number;
  premium?: boolean;
}

export interface DomainRegistrationResult {
  success: boolean;
  domain: string;
  orderId?: string;
  message?: string;
  error?: string;
}

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV';
  name: string; // hostname or @ for root
  value: string; // IP address, hostname, or text value
  priority?: number; // For MX and SRV records
  ttl?: number; // Time to live in seconds
}

export interface EmailForward {
  prefix: string; // e.g., "info", "sales", "*" for catch-all
  forwardto: string; // destination email address
}

export interface IDProtectionStatus {
  enabled: boolean;
  domain: string;
}

export interface TldPricing {
  tld: string;
  currencyCode: string;
  years: number;
  registrationPrice: number;
  renewalPrice: number;
  transferPrice: number;
  graceDays: number;
  graceFee: number;
  redemptionDays: number;
  redemptionFee: number;
}

export interface DomainSuggestion {
  domain: string;
  status: string;
  currency?: string;
  price?: number;
}

export interface DomainInformation {
  domain: string;
  status: string;
  nameservers: { [key: string]: string };
  transferLock: boolean;
  expiryDate: string;
  registrationDate?: string;
  nextDueDate?: string;
  idProtectionStatus: boolean;
  dnsManagementStatus: boolean;
  emailForwardingStatus: boolean;
  registrantEmailAddress?: string;
}

/**
 * Generate Go54 authentication token
 *
 * IMPORTANT: Go54 uses an unusual HMAC pattern where:
 * - HMAC Key: "email:yy-mm-dd HH" (timestamp-based)
 * - HMAC Data: api_key (your secret API key)
 *
 * PHP equivalent: hash_hmac("sha256", "<api-key>", "<email>:<gmdate('y-m-d H')>")
 * Node.js: crypto.createHmac('sha256', message).update(GO54_API_KEY)
 *
 * @see https://www.whogohost.com/host/index.php?rp=/knowledgebase/514/Introduction.html
 */
function generateToken(): string {
  if (!GO54_EMAIL || !GO54_API_KEY) {
    throw new Error('GO54_EMAIL and GO54_API_KEY environment variables are required');
  }

  const now = new Date();
  const year = now.getUTCFullYear().toString().slice(2); // yy
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0'); // mm
  const day = now.getUTCDate().toString().padStart(2, '0'); // dd
  const hour = now.getUTCHours().toString().padStart(2, '0'); // HH

  const dateStr = `${year}-${month}-${day} ${hour}`;
  const message = `${GO54_EMAIL}:${dateStr}`;

  const hash = crypto.createHmac('sha256', message).update(GO54_API_KEY).digest('hex');

  return Buffer.from(hash).toString('base64');
}

/**
 * Make authenticated request to Go54 API
 */
async function go54Request<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  params?: Record<string, unknown>
): Promise<T> {
  const token = generateToken();
  const url = `${GO54_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      username: GO54_EMAIL,
      token,
    },
  };

  if (method === 'POST' && params) {
    // Convert params to URLSearchParams, stringify objects/arrays
    const formData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    options.body = formData;
  } else if (method === 'GET' && params) {
    const queryParams = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return acc;
      }, {} as Record<string, string>)
    );
    const urlWithParams = `${url}?${queryParams}`;
    return fetch(urlWithParams, options).then((r) => r.json());
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Go54 API Error: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Check domain availability using WHOIS
 * 
 * Note: The official API 'lookup' action is deprecated.
 * We use direct WHOIS lookup as a fallback.
 */
export async function checkDomainAvailability(
  domain: string,
  _tldsToInclude: string[] = [],
  _isWhmcs: number = 0
): Promise<boolean> {
  try {
    // Basic validation
    if (!domain) return false;

    // Perform WHOIS lookup
    const results = await whois(domain);
    console.log('WHOIS Results for', domain, ':', JSON.stringify(results, null, 2));

    // Analyze WHOIS response to determine availability
    // Common patterns for available domains:
    const responseString = JSON.stringify(results).toLowerCase();

    // Check for specific error object pattern from whois-json
    if (results && typeof results === 'object' && 'error' in results) {
      const errorMsg = (results as Record<string, unknown>).error as string;
      if (errorMsg.includes('no match for') || errorMsg.includes('not found')) {
        return true;
      }
    }

    const availabilityIndicators = [
      'no match for',
      'not found',
      'no data found',
      'is available for registration',
      'domain not found',
      'object does not exist',
      'no entries found'
    ];

    const isAvailable = availabilityIndicators.some(indicator =>
      responseString.includes(indicator)
    );

    return isAvailable;

  } catch (error) {
    console.error('Error checking domain availability:', error);
    // Fail safe: assume unavailable if check fails to prevent false positives
    return false;
  }
}

/**
 * Register a new domain
 */
export async function registerDomain(data: {
  domain: string;
  regperiod: number; // years
  contacts: {
    registrant: ContactInfo;
    tech: ContactInfo;
    billing: ContactInfo;
    admin: ContactInfo;
  };
  nameservers?: {
    ns1: string;
    ns2: string;
    ns3?: string;
    ns4?: string;
    ns5?: string;
  };
  addons?: {
    dnsmanagement?: 0 | 1;
    emailforwarding?: 0 | 1;
    idprotection?: 0 | 1; // WHOIS privacy
  };
}): Promise<DomainRegistrationResult> {
  try {
    // Default nameservers if not provided
    const nameservers = data.nameservers || {
      ns1: 'ns1.whogohost.com',
      ns2: 'ns2.whogohost.com',
    };

    const result = await go54Request<Record<string, unknown>>('/order/domains/register', 'POST', {
      domain: data.domain,
      regperiod: data.regperiod,
      nameservers,
      contacts: data.contacts,
      addons: data.addons || {},
      domainfields: '',
    });

    return result;
  } catch (error) {
    console.error('Error registering domain:', error);
    throw error;
  }
}

/**
 * Transfer a domain from another registrar
 */
export async function transferDomain(data: {
  domain: string;
  eppcode: string; // Authorization code
  regperiod: number;
  contacts: {
    registrant: ContactInfo;
    tech: ContactInfo;
    billing: ContactInfo;
    admin: ContactInfo;
  };
  nameservers?: {
    ns1: string;
    ns2: string;
    ns3?: string;
    ns4?: string;
    ns5?: string;
  };
}): Promise<Record<string, unknown>> {
  try {
    const nameservers = data.nameservers || {
      ns1: 'ns1.whogohost.com',
      ns2: 'ns2.whogohost.com',
    };

    const result = await go54Request('/order/domains/transfer', 'POST', {
      domain: data.domain,
      eppcode: data.eppcode,
      regperiod: data.regperiod,
      nameservers,
      contacts: data.contacts,
    });

    return result;
  } catch (error) {
    console.error('Error transferring domain:', error);
    throw error;
  }
}

/**
 * Renew a domain
 */
export async function renewDomain(domain: string, years: number = 1): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request('/order/domains/renew', 'POST', {
      domain,
      regperiod: years,
    });

    return result;
  } catch (error) {
    console.error('Error renewing domain:', error);
    throw error;
  }
}

/**
 * Get EPP code for domain transfer
 */
export async function getDomainEPPCode(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/eppcode`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting EPP code:', error);
    throw error;
  }
}

/**
 * Get domain contact details
 */
export async function getDomainContacts(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/contact`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting domain contacts:', error);
    throw error;
  }
}

/**
 * Update domain contact information
 */
export async function updateDomainContacts(
  domain: string,
  contacts: {
    registrant: ContactInfo;
    tech: ContactInfo;
    billing: ContactInfo;
    admin: ContactInfo;
  }
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/contact`, 'POST', {
      domain,
      contacts,
    });
    return result;
  } catch (error) {
    console.error('Error updating domain contacts:', error);
    throw error;
  }
}

/**
 * Get domain nameservers
 */
export async function getDomainNameservers(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/nameservers`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting nameservers:', error);
    throw error;
  }
}

/**
 * Update domain nameservers
 */
export async function updateDomainNameservers(
  domain: string,
  nameservers: {
    nameserver1: string;
    nameserver2: string;
    nameserver3?: string;
    nameserver4?: string;
    nameserver5?: string;
  }
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/nameservers`, 'POST', {
      domain,
      nameservers,
    });
    return result;
  } catch (error) {
    console.error('Error updating nameservers:', error);
    throw error;
  }
}

/**
 * Get domain registrar lock status
 */
export async function getDomainLock(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/lock`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting domain lock:', error);
    throw error;
  }
}

/**
 * Update domain registrar lock
 */
export async function updateDomainLock(domain: string, lock: boolean): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/lock`, 'POST', {
      domain,
      lockstatus: lock ? 'true' : 'false', // API expects string, not boolean
    });
    return result;
  } catch (error) {
    console.error('Error updating domain lock:', error);
    throw error;
  }
}

/**
 * Sync domain details (status, expiry, etc.)
 */
export async function syncDomainDetails(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/sync`, 'POST', { domain });
    return result;
  } catch (error) {
    console.error('Error syncing domain:', error);
    throw error;
  }
}

/**
 * Sync transfer status for pending transfers
 */
export async function syncDomainTransfer(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/transfersync`, 'POST', { domain });
    return result;
  } catch (error) {
    console.error('Error syncing transfer:', error);
    throw error;
  }
}

/**
 * Get DNS records for a domain
 */
export async function getDomainDNSRecords(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/dns`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting DNS records:', error);
    throw error;
  }
}

/**
 * Update DNS records for a domain
 */
export async function updateDomainDNSRecords(
  domain: string,
  records: DNSRecord[]
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/dns`, 'POST', {
      domain,
      records,
    });
    return result;
  } catch (error) {
    console.error('Error updating DNS records:', error);
    throw error;
  }
}

/**
 * Get email forwarding configuration
 */
export async function getDomainEmailForwarding(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/emailforwarding`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting email forwarding:', error);
    throw error;
  }
}

/**
 * Update email forwarding configuration
 */
export async function updateDomainEmailForwarding(
  domain: string,
  forwards: EmailForward[]
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/emailforwarding`, 'POST', {
      domain,
      forwards,
    });
    return result;
  } catch (error) {
    console.error('Error updating email forwarding:', error);
    throw error;
  }
}

/**
 * Get ID protection status
 */
export async function getDomainIDProtection(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/idprotection`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting ID protection status:', error);
    throw error;
  }
}

/**
 * Enable/disable ID protection (WHOIS privacy)
 */
export async function updateDomainIDProtection(
  domain: string,
  enabled: boolean
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/idprotection`, 'POST', {
      domain,
      status: enabled ? 'enable' : 'disable',
    });
    return result;
  } catch (error) {
    console.error('Error updating ID protection:', error);
    throw error;
  }
}

/**
 * Get TLD Pricing
 */
export async function getTldPricing(): Promise<TldPricing[]> {
  try {
    const result = await go54Request<Record<string, unknown>>('/tlds/pricing', 'GET');
    // The API returns an object/array of pricing, we might need to transform it
    // based on the PHP module: foreach ($result as $extension) ...
    return result;
  } catch (error) {
    console.error('Error getting TLD pricing:', error);
    throw error;
  }
}

/**
 * Register a child nameserver (Glue Record)
 */
export async function registerChildNameserver(
  domain: string,
  nameserver: string,
  ip: string
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/nameservers/register`, 'POST', {
      domain,
      nameserver,
      ipaddress: ip,
    });
    return result;
  } catch (error) {
    console.error('Error registering child nameserver:', error);
    throw error;
  }
}

/**
 * Modify a child nameserver (Glue Record)
 */
export async function modifyChildNameserver(
  domain: string,
  nameserver: string,
  currentIp: string,
  newIp: string
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/nameservers/modify`, 'POST', {
      domain,
      nameserver,
      currentipaddress: currentIp,
      newipaddress: newIp,
    });
    return result;
  } catch (error) {
    console.error('Error modifying child nameserver:', error);
    throw error;
  }
}

/**
 * Delete a child nameserver (Glue Record)
 */
export async function deleteChildNameserver(
  domain: string,
  nameserver: string
): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/nameservers/delete`, 'POST', {
      domain,
      nameserver,
    });
    return result;
  } catch (error) {
    console.error('Error deleting child nameserver:', error);
    throw error;
  }
}

/**
 * Get Domain Suggestions
 */
export async function getDomainSuggestions(
  searchTerm: string,
  tlds: string[] = []
): Promise<DomainSuggestion[]> {
  try {
    const result = await go54Request<Record<string, unknown>>('/domains/lookup/suggestions', 'POST', {
      searchTerm,
      punyCodeSearchTerm: searchTerm,
      tldsToInclude: tlds,
      isIdnDomain: false,
      premiumEnabled: false,
      suggestionSettings: [],
    });
    return result;
  } catch (error) {
    console.error('Error getting domain suggestions:', error);
    throw error;
  }
}

/**
 * Request Domain Deletion
 */
export async function requestDomainDelete(domain: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/delete`, 'POST', { domain });
    return result;
  } catch (error) {
    console.error('Error requesting domain delete:', error);
    throw error;
  }
}

/**
 * Release Domain (IPS Tag)
 */
export async function releaseDomain(domain: string, transferTag: string): Promise<Record<string, unknown>> {
  try {
    const result = await go54Request(`/domains/${domain}/release`, 'POST', {
      domain,
      transfertag: transferTag,
    });
    return result;
  } catch (error) {
    console.error('Error releasing domain:', error);
    throw error;
  }
}

/**
 * Get Detailed Domain Information
 */
export async function getDomainInformation(domain: string): Promise<DomainInformation> {
  try {
    const result = await go54Request<Record<string, unknown>>(`/domains/${domain}/information`, 'GET', { domain });
    return result;
  } catch (error) {
    console.error('Error getting domain information:', error);
    throw error;
  }
}
