export interface Domain {
  id: string;
  domain: string;
  is_primary: boolean;
  status: 'active' | 'pending' | 'failed' | 'verifying';
  created_at: string;
  domain_type: 'subdomain' | 'custom' | 'purchased';
}

export type DomainAction = 'visit' | 'verify' | 'set_primary' | 'delete';
