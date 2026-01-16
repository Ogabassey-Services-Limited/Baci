import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  CreateDiscountDTO,
  DiscountCode,
  UpdateDiscountDTO,
} from '@/lib/types/discounts';
import { useMerchant } from './useMerchant';

export function useDiscounts() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['discounts', merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) return [];

      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiscountCode[];
    },
    enabled: !!merchant?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (newDiscount: CreateDiscountDTO) => {
      if (!merchant?.id) throw new Error('No merchant found');

      const { data, error } = await supabase
        .from('discount_codes')
        .insert([{ ...newDiscount, merchant_id: merchant.id }])
        .select()
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
        .select()
        .single();

      if (error) throw error;
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

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts', merchant?.id] });
    },
  });

  return {
    discounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createDiscount: createMutation.mutateAsync,
    updateDiscount: updateMutation.mutateAsync,
    deleteDiscount: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
