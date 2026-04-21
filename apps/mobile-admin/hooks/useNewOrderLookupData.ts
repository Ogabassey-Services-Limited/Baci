import { useCustomers } from '@/hooks/useCustomers';
import { useDebounce } from '@/hooks/useDebounce';
import { useProductPicker } from '@/hooks/useProductPicker';
import { useProductPickerVariants } from '@/hooks/useProductPickerVariants';
import type { Product } from '@/hooks/useProducts';

export function useNewOrderLookupData({
  customerSearch,
  selectedParentProduct,
  productSearch,
}: {
  customerSearch: string;
  selectedParentProduct: Product | null;
  productSearch: string;
}) {
  const productPicker = useProductPicker(productSearch);
  const selectedParentProductVariantsQuery =
    useProductPickerVariants(selectedParentProduct);
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const customersQuery = useCustomers({
    search: debouncedCustomerSearch,
    sortBy: 'alpha',
  });

  return {
    customersData: customersQuery.data,
    customersQuery,
    debouncedCustomerSearch,
    productPicker,
    selectedParentProductVariantsQuery,
  };
}
