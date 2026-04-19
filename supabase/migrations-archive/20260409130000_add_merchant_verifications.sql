CREATE TABLE merchant_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  cac_verified BOOLEAN DEFAULT FALSE,
  cac_verified_at TIMESTAMPTZ,
  cac_certificate_path TEXT,
  cac_approved_name TEXT,
  bvn_verified BOOLEAN DEFAULT FALSE,
  bvn_verified_at TIMESTAMPTZ,
  nin_verified BOOLEAN DEFAULT FALSE,
  nin_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id)
);

ALTER TABLE merchant_verifications ENABLE ROW LEVEL SECURITY;
-- No direct RLS policies: all access goes through SECURITY DEFINER RPCs below.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "owner_upload_kyc_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owner_read_kyc_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owner_delete_kyc_docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.record_cac_verification(
  p_merchant_id UUID, p_cac_certificate_path TEXT,
  p_cac_approved_name TEXT, p_rc_number TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, cac_verified, cac_verified_at, cac_certificate_path, cac_approved_name)
  VALUES (p_merchant_id, TRUE, NOW(), p_cac_certificate_path, p_cac_approved_name)
  ON CONFLICT (merchant_id) DO UPDATE SET
    cac_verified = TRUE, cac_verified_at = NOW(),
    cac_certificate_path = p_cac_certificate_path,
    cac_approved_name = p_cac_approved_name, updated_at = NOW();

  UPDATE merchants
  SET legal_entity_name = p_cac_approved_name,
      cac_rc_number = p_rc_number,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_bvn_verification(
  p_merchant_id UUID, p_bvn TEXT,
  p_first_name TEXT, p_last_name TEXT, p_date_of_birth DATE
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, bvn_verified, bvn_verified_at, first_name, last_name, date_of_birth)
  VALUES (p_merchant_id, TRUE, NOW(), p_first_name, p_last_name, p_date_of_birth)
  ON CONFLICT (merchant_id) DO UPDATE SET
    bvn_verified = TRUE, bvn_verified_at = NOW(),
    first_name = COALESCE(p_first_name, merchant_verifications.first_name),
    last_name  = COALESCE(p_last_name,  merchant_verifications.last_name),
    date_of_birth = COALESCE(p_date_of_birth, merchant_verifications.date_of_birth),
    updated_at = NOW();

  UPDATE merchants
  SET bvn = p_bvn,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_nin_verification(
  p_merchant_id UUID, p_nin TEXT,
  p_first_name TEXT, p_last_name TEXT, p_date_of_birth DATE
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller_uid UUID;
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, nin_verified, nin_verified_at, first_name, last_name, date_of_birth)
  VALUES (p_merchant_id, TRUE, NOW(), p_first_name, p_last_name, p_date_of_birth)
  ON CONFLICT (merchant_id) DO UPDATE SET
    nin_verified = TRUE, nin_verified_at = NOW(),
    first_name = COALESCE(p_first_name, merchant_verifications.first_name),
    last_name  = COALESCE(p_last_name,  merchant_verifications.last_name),
    date_of_birth = COALESCE(p_date_of_birth, merchant_verifications.date_of_birth),
    updated_at = NOW();

  UPDATE merchants
  SET nin = p_nin,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.record_cac_verification(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_cac_verification(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_bvn_verification(UUID, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_bvn_verification(UUID, TEXT, TEXT, TEXT, DATE) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_nin_verification(UUID, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_nin_verification(UUID, TEXT, TEXT, TEXT, DATE) TO authenticated;
