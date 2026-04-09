/**
 * Represents company information from the Corporate Affairs Commission (CAC).
 */
export interface CACCompany {
  /** Official approved company name */
  approvedName: string;
  /** Registration Certificate (RC) or Business Name (BN) number */
  rcNumber: string;
  /** Company registration date in ISO 8601 format (YYYY-MM-DD), or null if not available */
  companyRegistrationDate: string | null;
  /** Unique company identifier */
  companyId: number;
  /** Company classification type */
  classificationName: 'COMPANY' | 'BUSINESS_NAME';
  /** Description of the company's business activities */
  natureOfBusiness: string;
  /** Current operational status of the company */
  status: 'ACTIVE' | 'INACTIVE' | 'STRUCK OFF';
}
