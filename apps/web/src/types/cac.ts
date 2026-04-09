export interface CACCompany {
  approvedName: string;
  rcNumber: string;
  companyRegistrationDate: string | null;
  companyId: number;
  classificationName: 'COMPANY' | 'BUSINESS_NAME';
  natureOfBusiness: string;
  status: 'ACTIVE' | 'INACTIVE' | 'STRUCK OFF';
}
