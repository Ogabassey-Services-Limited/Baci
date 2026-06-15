import type { DNSRecord } from './go54';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateDNSRecord(record: DNSRecord): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate record name
  if (!record.name || record.name.length > 253) {
    errors.push('Invalid record name: must be 1-253 characters');
  }

  // Validate TTL
  if (record.ttl && (record.ttl < 60 || record.ttl > 86400)) {
    warnings.push(
      'TTL should be between 60 seconds and 24 hours for optimal performance'
    );
  }

  switch (record.type) {
    case 'A':
      if (!isValidIPv4(record.value)) {
        errors.push(`Invalid IPv4 address: ${record.value}`);
      }
      break;

    case 'AAAA':
      if (!isValidIPv6(record.value)) {
        errors.push(`Invalid IPv6 address: ${record.value}`);
      }
      break;

    case 'CNAME':
      if (!isValidHostname(record.value)) {
        errors.push(`Invalid hostname for CNAME: ${record.value}`);
      }
      if (record.name === '@') {
        errors.push('CNAME records cannot be created at the root domain (@)');
      }
      break;

    case 'MX':
      if (
        record.priority === undefined ||
        record.priority < 0 ||
        record.priority > 65535
      ) {
        errors.push('MX records must have a priority between 0 and 65535');
      }
      if (!isValidHostname(record.value)) {
        errors.push(`Invalid mail server hostname: ${record.value}`);
      }
      break;

    case 'TXT':
      if (record.value.length > 255) {
        // TXT records can be longer but often split. Warning for now.
        warnings.push(
          'TXT record value exceeds 255 characters; ensure it is properly split if required by nameserver'
        );
      }
      // Validate SPF records
      if (record.value.startsWith('v=spf1')) {
        const spfValidation = validateSPF(record.value);
        errors.push(...spfValidation.errors);
        warnings.push(...spfValidation.warnings);
      }
      // Validate DKIM records
      if (record.name.includes('_domainkey')) {
        const dkimValidation = validateDKIM(record.value);
        errors.push(...dkimValidation.errors);
      }
      break;

    case 'SRV':
      // SRV format: priority weight port target
      // But Go54 API might handle this differently. Assuming 'value' contains the full string or parts.
      // For now, basic check.
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateDNSRecordBatch(records: DNSRecord[]): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate individual records
  records.forEach((record, index) => {
    const result = validateDNSRecord(record);
    allErrors.push(...result.errors.map((e) => `Record ${index + 1}: ${e}`));
    allWarnings.push(
      ...result.warnings.map((w) => `Record ${index + 1}: ${w}`)
    );
  });

  // Check for conflicts
  const cnameRecords = records.filter((r) => r.type === 'CNAME');
  cnameRecords.forEach((cname) => {
    const conflicting = records.filter(
      (r) => r.name === cname.name && r.type !== 'CNAME'
    );
    if (conflicting.length > 0) {
      allErrors.push(
        `CNAME record at "${cname.name}" conflicts with other records. CNAME must be alone.`
      );
    }
  });

  // Check for duplicate records
  const seen = new Set<string>();
  records.forEach((record) => {
    const key = `${record.type}:${record.name}:${record.value}`;
    if (seen.has(key)) {
      allWarnings.push(
        `Duplicate record detected: ${record.type} ${record.name}`
      );
    }
    seen.add(key);
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

function isValidIPv4(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

function isValidIPv6(ip: string): boolean {
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv6Regex.test(ip);
}

function isValidHostname(hostname: string): boolean {
  const hostnameRegex =
    /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]*\.[a-zA-Z]{2,11}$/;
  return hostnameRegex.test(hostname) || hostname === '@';
}

function validateSPF(spf: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spf.startsWith('v=spf1 ')) {
    errors.push('SPF record must start with "v=spf1 "');
  }

  const lookupCount = (spf.match(/include:|a:|mx:|ptr:|exists:/g) || []).length;
  if (lookupCount > 10) {
    errors.push(
      `SPF record exceeds 10 DNS lookups (${lookupCount} found). This will cause SPF validation failures.`
    );
  }

  if (!spf.match(/[~\-?+]all$/)) {
    warnings.push(
      'SPF record should end with an "all" mechanism (~all, -all, ?all, or +all)'
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateDKIM(dkim: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dkim.includes('p=')) {
    errors.push('DKIM record must contain public key (p=)');
  }

  if (!dkim.includes('v=DKIM1')) {
    errors.push('DKIM record should specify version (v=DKIM1)');
  }

  return { valid: errors.length === 0, errors, warnings };
}
