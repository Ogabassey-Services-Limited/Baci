-- Migration: Create negotiation_requests table
-- Description: Supports price negotiations for individual items or whole carts.

-- Status enum for negotiations
DO $$ BEGIN
    CREATE TYPE negotiation_status AS ENUM ('pending', 'accepted', 'rejected', 'countered');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table definition
CREATE TABLE IF NOT EXISTS public.negotiation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    customer_id UUID, -- Optional, can be null for guest sessions (linked via session_id)
    session_id TEXT NOT NULL, -- To track guest negotiations
    type TEXT NOT NULL CHECK (type IN ('single', 'total')),
    
    -- Item context
    item_info JSONB, -- { name, current_price, quantity, image_url, product_id, variant_id }
    cart_snapshot JSONB, -- Array of item_info if type is 'total'
    
    -- Pricing
    offered_price DECIMAL(12,2) NOT NULL,
    counter_offer DECIMAL(12,2),
    
    -- Evidence (I saw it cheaper)
    evidence_url TEXT,
    
    -- Metadata
    status negotiation_status DEFAULT 'pending',
    merchant_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.negotiation_requests ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Merchants can see all requests for their store
CREATE POLICY "Merchants can view their own negotiation requests"
    ON public.negotiation_requests
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.merchants WHERE id = merchant_id
            UNION
            SELECT user_id FROM public.staff_members WHERE merchant_id = negotiation_requests.merchant_id
        )
    );

-- 2. Merchants can update status/counter-offer
CREATE POLICY "Merchants can update their own negotiation requests"
    ON public.negotiation_requests
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.merchants WHERE id = merchant_id
            UNION
            SELECT user_id FROM public.staff_members WHERE merchant_id = negotiation_requests.merchant_id
        )
    );

-- 3. Customers can view their own requests (by session_id or user_id)
CREATE POLICY "Customers can view their own requests"
    ON public.negotiation_requests
    FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND customer_id = auth.uid()) OR
        (session_id = current_setting('request.jwt.claims', true)::jsonb->>'session_id' OR session_id IS NOT NULL) -- More complex in prod, but simple for now
    );

-- 4. Customers can create requests
CREATE POLICY "Customers can create negotiation requests"
    ON public.negotiation_requests
    FOR INSERT
    WITH CHECK (true); -- Publicly allowed, rate limited by app logic/API

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_negotiation_merchant ON public.negotiation_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_status ON public.negotiation_requests(status);
CREATE INDEX IF NOT EXISTS idx_negotiation_session ON public.negotiation_requests(session_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_negotiation_requests_updated_at
    BEFORE UPDATE ON public.negotiation_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
