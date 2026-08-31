-- Keep mapping reads available to active staff while requiring integrations
-- management permission for every mapping mutation, including DELETE.

DROP POLICY IF EXISTS jumia_product_mappings_merchant_policy
  ON public.jumia_product_mappings;

CREATE POLICY jumia_product_mappings_select_policy
ON public.jumia_product_mappings
FOR SELECT
USING (
  merchant_id IN (
    SELECT merchant.id
    FROM public.merchants AS merchant
    WHERE merchant.user_id = (SELECT auth.uid())
    UNION
    SELECT staff_members.merchant_id
    FROM public.staff_members AS staff_members
    WHERE staff_members.user_id = (SELECT auth.uid())
      AND staff_members.status = 'active'
  )
);

CREATE POLICY jumia_product_mappings_insert_policy
ON public.jumia_product_mappings
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT merchant.id
    FROM public.merchants AS merchant
    WHERE merchant.user_id = (SELECT auth.uid())
  )
  OR public.check_staff_permission(
    (SELECT auth.uid()),
    merchant_id,
    'integrations',
    'manage'
  )
);

CREATE POLICY jumia_product_mappings_update_policy
ON public.jumia_product_mappings
FOR UPDATE
USING (
  merchant_id IN (
    SELECT merchant.id
    FROM public.merchants AS merchant
    WHERE merchant.user_id = (SELECT auth.uid())
  )
  OR public.check_staff_permission(
    (SELECT auth.uid()),
    merchant_id,
    'integrations',
    'manage'
  )
)
WITH CHECK (
  merchant_id IN (
    SELECT merchant.id
    FROM public.merchants AS merchant
    WHERE merchant.user_id = (SELECT auth.uid())
  )
  OR public.check_staff_permission(
    (SELECT auth.uid()),
    merchant_id,
    'integrations',
    'manage'
  )
);

CREATE POLICY jumia_product_mappings_delete_policy
ON public.jumia_product_mappings
FOR DELETE
USING (
  merchant_id IN (
    SELECT merchant.id
    FROM public.merchants AS merchant
    WHERE merchant.user_id = (SELECT auth.uid())
  )
  OR public.check_staff_permission(
    (SELECT auth.uid()),
    merchant_id,
    'integrations',
    'manage'
  )
);
