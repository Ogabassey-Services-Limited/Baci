import type { ProductsTab } from './ProductsSubTabs';

export type ProductsEmptyAction = 'add_product' | 'clear_search' | null;

export interface ProductsEmptyState {
  action: ProductsEmptyAction;
  buttonLabel: string | null;
  description: string;
  icon:
    | 'calculator-outline'
    | 'checkmark-circle-outline'
    | 'globe-outline'
    | 'search-outline'
    | 'shield-checkmark-outline';
  title: string;
}

/**
 * Empty-state copy for a products page, based on which page it is, the active
 * sub-tab, and whether the user is mid-search.
 */
export function getProductsEmptyState(params: {
  activeTab: ProductsTab;
  searchQuery: string;
  variant: 'in_stock' | 'on_website';
}): ProductsEmptyState {
  const { activeTab, searchQuery, variant } = params;

  if (searchQuery.trim().length > 0) {
    return {
      action: 'clear_search',
      buttonLabel: 'Clear Search',
      description: `We couldn't find any products matching "${searchQuery}". Check the spelling or try a different term.`,
      icon: 'search-outline',
      title: 'No search results',
    };
  }

  if (variant === 'in_stock') {
    if (activeTab === 'low_stock') {
      return {
        action: null,
        buttonLabel: null,
        description:
          'Great job! None of your tracked items are running low on stock right now.',
        icon: 'shield-checkmark-outline',
        title: 'Stock levels healthy',
      };
    }
    if (activeTab === 'out_of_stock') {
      return {
        action: null,
        buttonLabel: null,
        description:
          'All managed inventory items have stock available right now.',
        icon: 'checkmark-circle-outline',
        title: 'Nothing depleted',
      };
    }
    return {
      action: 'add_product',
      buttonLabel: 'Add Stocked Item',
      description:
        'Track inventory quantities, monitor low stock items, and watch your total stock value grow in real-time.',
      icon: 'calculator-outline',
      title: 'Start managing stock',
    };
  }

  return {
    action: 'add_product',
    buttonLabel: 'Add Product',
    description:
      'Create and list products in your online catalog so customers can view and purchase them.',
    icon: 'globe-outline',
    title: 'No items on website',
  };
}
