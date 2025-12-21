CREATE INDEX IF NOT EXISTS idx_reward_redemptions_merchant_id ON public.reward_redemptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_id ON public.reward_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_variant_id ON public.reorder_suggestions(variant_id);
