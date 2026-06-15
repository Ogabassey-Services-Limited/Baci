-- Trigger to automatically create a merchant record when a new user signs up
-- This supports Google Sign-In and other OAuth providers where we want to capture the user immediately

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
