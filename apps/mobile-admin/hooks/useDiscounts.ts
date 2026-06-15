import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  CreateDiscountDTO,
  DiscountCode,
  UpdateDiscountDTO,
} from '@/lib/types/discounts';
import { useMerchant } from './useMerchant';

const DISCOUNT_COLUMNS =
  'id, merchant_id, code, discount_type, discount_value, minimum_purchase_amount, maximum_discount_amount, starts_at, expires_at, usage_limit, usage_count, usage_limit_per_customer, is_active, applies_to, product_ids, category_ids, customer_ids, customer_eligibility, description, created_at, updated_at' as const;

export function useDiscounts() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  const {
    data: discountsData,
    error: discountsError,
    isLoading: isDiscountsLoading,
  } = useQuery({
    queryKey: ['discounts', merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) return [];

      const { data, error } = await supabase
        .from('discount_codes')
        .select(DISCOUNT_COLUMNS)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiscountCode[];
    },
    enabled: !!merchant?.id,
    // ⚡ Bolt Performance Optimization: Added staleTime to prevent repeated Supabase queries when switching screens
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: async (newDiscount: CreateDiscountDTO) => {
      if (!merchant?.id) throw new Error('No merchant found');

      const { data, error } = await supabase
        .from('discount_codes')
        .insert([{ ...newDiscount, merchant_id: merchant.id }])
        .select(DISCOUNT_COLUMNS)
        .single();

      if (error) throw error;
      return data as DiscountCode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts', merchant?.id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateDiscountDTO) => {
      if (!merchant?.id) throw new Error('No merchant found');

      const { data, error } = await supabase
        .from('discount_codes')
        .update(updates)
        .eq('id', id)
        .eq('merchant_id', merchant.id)
        .select(DISCOUNT_COLUMNS)
        .single();

      if (error) {
        // A used code's identity is immutable (enforced by a DB trigger).
        if (error.message?.includes('discount_code_rename_not_allowed')) {
          throw new Error(
            'This code has already been used and cannot be renamed. Deactivate it and create a new code instead.'
          );
        }
        throw error;
      }
      return data as DiscountCode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts', merchant?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!merchant?.id) throw new Error('No merchant found');

      const { error } = await supabase
        .from('discount_codes')
        .delete()
        .eq('id', id)
        .eq('merchant_id', merchant.id);

      if (error) {
        // A USED code cannot be hard-deleted (DB trigger / usage FK RESTRICT).
        // Deactivate it instead so usage history + audit links survive.
        if (
          error.code === '23503' ||
          error.message?.includes('discount_code_delete_not_allowed')
        ) {
          const { error: deactivateError } = await supabase
            .from('discount_codes')
            .update({ is_active: false })
            .eq('id', id)
            .eq('merchant_id', merchant.id)
            .select('id')
            .single();

          if (deactivateError) throw deactivateError;
          return { deactivated: true };
        }
        throw error;
      }
      return { deactivated: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts', merchant?.id] });
    },
  });

  return {
    discounts: discountsData || [],
    isLoading: isDiscountsLoading,
    error: discountsError,
    createDiscount: createMutation.mutateAsync,
    updateDiscount: updateMutation.mutateAsync,
    deleteDiscount: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
