export type CacStep = 'search' | 'confirm' | 'upload' | 'result';

export interface CacCompany {
  approvedName: string;
  rcNumber: string;
  status: string;
}
