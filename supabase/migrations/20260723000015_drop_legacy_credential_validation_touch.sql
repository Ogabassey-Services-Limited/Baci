-- Credential replacement now writes both encrypted roles and their validation
-- timestamp in one pair-locked transaction. A later touch can race with another
-- replacement and stamp the wrong generation, so no standalone touch signature
-- remains callable after this migration.

DROP FUNCTION IF EXISTS public.touch_merchant_payment_credential_validated(uuid, text);
DROP FUNCTION IF EXISTS public.touch_merchant_payment_credential_validated(uuid, text, text);
