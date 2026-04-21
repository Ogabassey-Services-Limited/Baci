import { useCustomers } from '@/hooks/useCustomers';
import { useDebounce } from '@/hooks/useDebounce';
import type { SelectedParentProduct } from '@/components/orders/new-order.types';
import { useProductPicker } from '@/hooks/useProductPicker';
import { useProductPickerVariants } from '@/hooks/useProductPickerVariants';

export function useNewOrderLookupData({
  customerSearch,
  selectedParentProduct,
  productSearch,
}: {
  customerSearch: string;
  selectedParentProduct: SelectedParentProduct;
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
