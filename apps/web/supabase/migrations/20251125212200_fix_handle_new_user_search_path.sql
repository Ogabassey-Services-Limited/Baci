-- Fix security warning: Set explicit search_path for handle_new_user function
-- This prevents search_path hijacking attacks on SECURITY DEFINER functions

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if a merchant record already exists (shouldn't happen on insert, but good for safety)
  IF NOT EXISTS (SELECT 1 FROM public.merchants WHERE user_id = NEW.id) THEN
    INSERT INTO public.merchants (
      user_id,
      email,
      business_name, -- Will be null initially, indicating incomplete profile
      business_type, -- Will be null initially
      slug -- Will be null initially
    )
    VALUES (
      NEW.id,
      NEW.email,
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp;
