-- Loyalty Program Migration
-- Implements points system, rewards, and store credit management

-- =============================================================================
-- LOYALTY SETTINGS (per merchant)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.loyalty_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

    -- Program config
    enabled BOOLEAN DEFAULT FALSE,
    program_name VARCHAR(100) DEFAULT 'Rewards Program',

    -- Points earning rules
    points_per_currency DECIMAL(10,2) DEFAULT 1.0,  -- Points earned per NGN spent (e.g., 1 point per ₦100)
    points_currency_unit DECIMAL(10,2) DEFAULT 100, -- Currency unit (₦100)
    signup_bonus_points INTEGER DEFAULT 0,          -- Points for new customers
    birthday_bonus_points INTEGER DEFAULT 0,        -- Annual birthday bonus
    review_bonus_points INTEGER DEFAULT 50,         -- Points for leaving a review
    referral_bonus_points INTEGER DEFAULT 100,      -- Points for successful referral

    -- Redemption rules
    points_to_currency_ratio DECIMAL(10,4) DEFAULT 0.01, -- 1 point = ₦0.01 (100 points = ₦1)
    minimum_redemption_points INTEGER DEFAULT 500,       -- Minimum points to redeem
    maximum_redemption_percentage DECIMAL(5,2) DEFAULT 50.00, -- Max % of order payable with points

    -- Tiers (JSON array of tier configs)
    tiers JSONB DEFAULT '[
        {"name": "Bronze", "minPoints": 0, "multiplier": 1.0, "perks": []},
        {"name": "Silver", "minPoints": 1000, "multiplier": 1.25, "perks": ["free_shipping"]},
        {"name": "Gold", "minPoints": 5000, "multiplier": 1.5, "perks": ["free_shipping", "early_access"]},
        {"name": "Platinum", "minPoints": 10000, "multiplier": 2.0, "perks": ["free_shipping", "early_access", "exclusive_discounts"]}
    ]'::JSONB,

    -- Expiry
    points_expiry_days INTEGER DEFAULT 365, -- Points expire after X days (0 = never)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(merchant_id)
);

-- =============================================================================
-- CUSTOMER LOYALTY ACCOUNTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_loyalty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

    -- Points balance
    points_balance INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,

    -- Tier
    current_tier VARCHAR(50) DEFAULT 'Bronze',
    tier_updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Referral tracking
    referral_code VARCHAR(20),
    referred_by_customer_id UUID REFERENCES public.customers(id),
    referral_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, merchant_id)
);

-- =============================================================================
-- POINTS TRANSACTIONS LEDGER
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.points_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

    -- Transaction details
    type VARCHAR(50) NOT NULL, -- 'earn', 'redeem', 'expire', 'adjust', 'refund'
    points INTEGER NOT NULL,   -- Positive for earn, negative for redeem/expire
    balance_after INTEGER NOT NULL,

    -- Source/reason
    source VARCHAR(50) NOT NULL, -- 'purchase', 'signup', 'referral', 'review', 'birthday', 'admin_adjust', 'redemption', 'expiry'
    source_id VARCHAR(100),      -- Order ID, review ID, etc.
    description TEXT,

    -- For expiry tracking
    expires_at TIMESTAMPTZ,
    expired BOOLEAN DEFAULT FALSE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- REWARDS CATALOG (optional rewards beyond points-to-credit)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,

    -- Cost
    points_cost INTEGER NOT NULL,

    -- Type
    reward_type VARCHAR(50) NOT NULL, -- 'discount_percentage', 'discount_fixed', 'free_shipping', 'free_product', 'store_credit'
    reward_value DECIMAL(10,2),       -- Percentage or fixed amount
    reward_product_id UUID,           -- For free product rewards

    -- Availability
    enabled BOOLEAN DEFAULT TRUE,
    stock_quantity INTEGER,           -- NULL = unlimited
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,

    -- Restrictions
    minimum_order_amount DECIMAL(10,2),
    usage_limit_per_customer INTEGER, -- NULL = unlimited

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- REWARD REDEMPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,

    -- Redemption details
    points_spent INTEGER NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    reward_value DECIMAL(10,2),

    -- Usage
    discount_code VARCHAR(50),        -- Generated code if applicable
    used BOOLEAN DEFAULT FALSE,
    used_on_order_id UUID,
    used_at TIMESTAMPTZ,

    -- Expiry
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_loyalty_settings_merchant ON public.loyalty_settings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_customer ON public.customer_loyalty(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_merchant ON public.customer_loyalty(merchant_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_referral ON public.customer_loyalty(referral_code);
CREATE INDEX IF NOT EXISTS idx_points_transactions_customer ON public.points_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_merchant ON public.points_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_expiry ON public.points_transactions(expires_at) WHERE NOT expired;
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_merchant ON public.loyalty_rewards(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_customer ON public.reward_redemptions(customer_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Loyalty settings: merchants can manage their own
CREATE POLICY "Merchants can manage loyalty settings"
    ON public.loyalty_settings FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Customer loyalty: merchants can view/manage, customers can view their own
CREATE POLICY "Merchants can manage customer loyalty"
    ON public.customer_loyalty FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Points transactions: merchants can view/insert, customers can view their own
CREATE POLICY "Merchants can manage points transactions"
    ON public.points_transactions FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Loyalty rewards: merchants can manage their own
CREATE POLICY "Merchants can manage loyalty rewards"
    ON public.loyalty_rewards FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Reward redemptions: merchants can view/manage
CREATE POLICY "Merchants can manage reward redemptions"
    ON public.reward_redemptions FOR ALL
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to calculate tier based on lifetime points
CREATE OR REPLACE FUNCTION public.calculate_loyalty_tier(
    p_lifetime_points INTEGER,
    p_merchant_id UUID
)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
AS $$
DECLARE
    v_tiers JSONB;
    v_tier JSONB;
    v_result VARCHAR(50) := 'Bronze';
BEGIN
    -- Get merchant's tier configuration
    SELECT tiers INTO v_tiers
    FROM public.loyalty_settings
    WHERE merchant_id = p_merchant_id;

    IF v_tiers IS NULL THEN
        RETURN 'Bronze';
    END IF;

    -- Find highest tier customer qualifies for
    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_tiers)
    LOOP
        IF p_lifetime_points >= (v_tier->>'minPoints')::INTEGER THEN
            v_result := v_tier->>'name';
        END IF;
    END LOOP;

    RETURN v_result;
END;
$$;

-- Function to award points for a purchase
CREATE OR REPLACE FUNCTION public.award_purchase_points(
    p_customer_id UUID,
    p_merchant_id UUID,
    p_order_id UUID,
    p_order_total DECIMAL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_settings RECORD;
    v_loyalty RECORD;
    v_points_earned INTEGER;
    v_multiplier DECIMAL := 1.0;
    v_new_balance INTEGER;
    v_new_lifetime INTEGER;
    v_new_tier VARCHAR(50);
    v_expiry_date TIMESTAMPTZ;
BEGIN
    -- Get loyalty settings
    SELECT * INTO v_settings
    FROM public.loyalty_settings
    WHERE merchant_id = p_merchant_id AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN 0; -- Loyalty program not enabled
    END IF;

    -- Get or create customer loyalty account
    SELECT * INTO v_loyalty
    FROM public.customer_loyalty
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id;

    IF NOT FOUND THEN
        INSERT INTO public.customer_loyalty (customer_id, merchant_id, referral_code)
        VALUES (
            p_customer_id,
            p_merchant_id,
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
        )
        RETURNING * INTO v_loyalty;
    END IF;

    -- Get tier multiplier
    SELECT (tier->>'multiplier')::DECIMAL INTO v_multiplier
    FROM (
        SELECT jsonb_array_elements(v_settings.tiers) as tier
    ) t
    WHERE tier->>'name' = v_loyalty.current_tier;

    v_multiplier := COALESCE(v_multiplier, 1.0);

    -- Calculate points
    v_points_earned := FLOOR(
        (p_order_total / v_settings.points_currency_unit) *
        v_settings.points_per_currency *
        v_multiplier
    );

    IF v_points_earned <= 0 THEN
        RETURN 0;
    END IF;

    -- Calculate new balances
    v_new_balance := v_loyalty.points_balance + v_points_earned;
    v_new_lifetime := v_loyalty.lifetime_points + v_points_earned;
    v_new_tier := public.calculate_loyalty_tier(v_new_lifetime, p_merchant_id);

    -- Calculate expiry date
    IF v_settings.points_expiry_days > 0 THEN
        v_expiry_date := NOW() + (v_settings.points_expiry_days || ' days')::INTERVAL;
    END IF;

    -- Update customer loyalty
    UPDATE public.customer_loyalty
    SET
        points_balance = v_new_balance,
        lifetime_points = v_new_lifetime,
        current_tier = v_new_tier,
        tier_updated_at = CASE WHEN v_new_tier != current_tier THEN NOW() ELSE tier_updated_at END,
        updated_at = NOW()
    WHERE id = v_loyalty.id;

    -- Record transaction
    INSERT INTO public.points_transactions (
        customer_id, merchant_id, type, points, balance_after,
        source, source_id, description, expires_at
    ) VALUES (
        p_customer_id, p_merchant_id, 'earn', v_points_earned, v_new_balance,
        'purchase', p_order_id::TEXT, 'Points earned from purchase', v_expiry_date
    );

    RETURN v_points_earned;
END;
$$;

-- Function to redeem points
CREATE OR REPLACE FUNCTION public.redeem_points(
    p_customer_id UUID,
    p_merchant_id UUID,
    p_points INTEGER,
    p_order_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, credit_amount DECIMAL, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_settings RECORD;
    v_loyalty RECORD;
    v_credit DECIMAL;
    v_new_balance INTEGER;
BEGIN
    -- Get loyalty settings
    SELECT * INTO v_settings
    FROM public.loyalty_settings
    WHERE merchant_id = p_merchant_id AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 'Loyalty program not enabled'::TEXT;
        RETURN;
    END IF;

    -- Check minimum redemption
    IF p_points < v_settings.minimum_redemption_points THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL,
            FORMAT('Minimum %s points required for redemption', v_settings.minimum_redemption_points)::TEXT;
        RETURN;
    END IF;

    -- Get customer loyalty
    SELECT * INTO v_loyalty
    FROM public.customer_loyalty
    WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id;

    IF NOT FOUND OR v_loyalty.points_balance < p_points THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 'Insufficient points balance'::TEXT;
        RETURN;
    END IF;

    -- Calculate credit amount
    v_credit := p_points * v_settings.points_to_currency_ratio;
    v_new_balance := v_loyalty.points_balance - p_points;

    -- Update balance
    UPDATE public.customer_loyalty
    SET
        points_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_loyalty.id;

    -- Record transaction
    INSERT INTO public.points_transactions (
        customer_id, merchant_id, type, points, balance_after,
        source, source_id, description
    ) VALUES (
        p_customer_id, p_merchant_id, 'redeem', -p_points, v_new_balance,
        'redemption', COALESCE(p_order_id::TEXT, 'manual'),
        FORMAT('Redeemed %s points for %s credit', p_points, v_credit)
    );

    -- Update customer store credit
    UPDATE public.customers
    SET store_credit = COALESCE(store_credit, 0) + v_credit
    WHERE id = p_customer_id;

    RETURN QUERY SELECT TRUE, v_credit, FORMAT('Successfully redeemed %s points for ₦%s credit', p_points, v_credit)::TEXT;
END;
$$;

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_loyalty_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_loyalty_settings_updated ON public.loyalty_settings;
CREATE TRIGGER trigger_loyalty_settings_updated
    BEFORE UPDATE ON public.loyalty_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_loyalty_timestamp();

DROP TRIGGER IF EXISTS trigger_customer_loyalty_updated ON public.customer_loyalty;
CREATE TRIGGER trigger_customer_loyalty_updated
    BEFORE UPDATE ON public.customer_loyalty
    FOR EACH ROW
    EXECUTE FUNCTION public.update_loyalty_timestamp();

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_loyalty TO authenticated;
GRANT SELECT, INSERT ON public.points_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reward_redemptions TO authenticated;

COMMENT ON TABLE public.loyalty_settings IS 'Merchant loyalty program configuration';
COMMENT ON TABLE public.customer_loyalty IS 'Customer loyalty accounts with points and tier';
COMMENT ON TABLE public.points_transactions IS 'Ledger of all points earned/redeemed/expired';
COMMENT ON TABLE public.loyalty_rewards IS 'Catalog of rewards customers can redeem';
COMMENT ON TABLE public.reward_redemptions IS 'Record of reward redemptions by customers';
