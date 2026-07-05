export interface StorefrontLinkModuleItem {
  href: string;
  label: string;
  description?: string;
  source?:
    | 'catalog-pagination'
    | 'category'
    | 'compare'
    | 'editorial'
    | 'related-compare';
}

export interface StorefrontLinkModule {
  id: string;
  title: string;
  description: string;
  items: StorefrontLinkModuleItem[];
}
