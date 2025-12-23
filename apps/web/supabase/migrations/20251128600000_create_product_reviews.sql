-- Product Reviews System
-- Enables customers to leave reviews on products they've purchased
-- Reviews require moderation before being displayed publicly

-- Create product_reviews table
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- For verified purchase badge
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    body TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    helpful_count INTEGER DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT FALSE,
    merchant_response TEXT, -- Merchant can respond to reviews
    merchant_response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_merchant ON public.product_reviews(merchant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON public.product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_email ON public.product_reviews(customer_email);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.product_reviews(created_at DESC);

-- Create review_helpful_votes table to track who voted
CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    voter_identifier VARCHAR(255) NOT NULL, -- email or session ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, voter_identifier)
);

CREATE INDEX IF NOT EXISTS idx_helpful_votes_review ON public.review_helpful_votes(review_id);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews

-- Public can read approved reviews
CREATE POLICY "Anyone can read approved reviews"
    ON public.product_reviews
    FOR SELECT
    USING (status = 'approved');

-- Merchants can read all reviews for their products
CREATE POLICY "Merchants can read all their reviews"
    ON public.product_reviews
    FOR SELECT
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Anyone can submit a review (insert)
CREATE POLICY "Anyone can submit reviews"
    ON public.product_reviews
    FOR INSERT
    WITH CHECK (true);

-- Merchants can update reviews for their products (moderate)
CREATE POLICY "Merchants can moderate their reviews"
    ON public.product_reviews
    FOR UPDATE
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- Merchants can delete reviews for their products
CREATE POLICY "Merchants can delete their reviews"
    ON public.product_reviews
    FOR DELETE
    TO authenticated
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for review_helpful_votes

-- Anyone can read helpful votes
CREATE POLICY "Anyone can read helpful votes"
    ON public.review_helpful_votes
    FOR SELECT
    USING (true);

-- Anyone can vote helpful
CREATE POLICY "Anyone can vote helpful"
    ON public.review_helpful_votes
    FOR INSERT
    WITH CHECK (true);

-- Function to update helpful_count when votes are added
CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.product_reviews
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.review_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.product_reviews
        SET helpful_count = GREATEST(0, helpful_count - 1)
        WHERE id = OLD.review_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Trigger for helpful count updates
DROP TRIGGER IF EXISTS trigger_update_helpful_count ON public.review_helpful_votes;
CREATE TRIGGER trigger_update_helpful_count
    AFTER INSERT OR DELETE ON public.review_helpful_votes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_review_helpful_count();

-- Function to check if customer has purchased the product
CREATE OR REPLACE FUNCTION public.check_verified_purchase(
    p_product_id UUID,
    p_customer_email VARCHAR
)
RETURNS TABLE(is_verified BOOLEAN, order_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE as is_verified,
        o.id as order_id
    FROM public.orders o
    WHERE o.customer_email = p_customer_email
    AND o.status IN ('paid', 'processing', 'shipped', 'delivered', 'completed')
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.items) AS item
        WHERE (item->>'product_id')::UUID = p_product_id
    )
    ORDER BY o.created_at DESC
    LIMIT 1;
END;
$$;

-- Function to calculate aggregate rating for a product
CREATE OR REPLACE FUNCTION public.get_product_rating_stats(p_product_id UUID)
RETURNS TABLE(
    average_rating NUMERIC,
    review_count BIGINT,
    rating_distribution JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(AVG(r.rating)::NUMERIC, 1) as average_rating,
        COUNT(*)::BIGINT as review_count,
        jsonb_build_object(
            '5', COUNT(*) FILTER (WHERE r.rating = 5),
            '4', COUNT(*) FILTER (WHERE r.rating = 4),
            '3', COUNT(*) FILTER (WHERE r.rating = 3),
            '2', COUNT(*) FILTER (WHERE r.rating = 2),
            '1', COUNT(*) FILTER (WHERE r.rating = 1)
        ) as rating_distribution
    FROM public.product_reviews r
    WHERE r.product_id = p_product_id
    AND r.status = 'approved';
END;
$$;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_review_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_review_updated_at ON public.product_reviews;
CREATE TRIGGER trigger_review_updated_at
    BEFORE UPDATE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_review_updated_at();

-- Grant permissions
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT ON public.product_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO service_role;

GRANT SELECT, INSERT ON public.review_helpful_votes TO anon;
GRANT SELECT, INSERT ON public.review_helpful_votes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.review_helpful_votes TO service_role;

GRANT EXECUTE ON FUNCTION public.check_verified_purchase TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_rating_stats TO anon, authenticated, service_role;
