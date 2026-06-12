-- Consolidate permissive RLS policies flagged by Supabase advisors.
--
-- This preserves the existing access semantics while reducing duplicate
-- permissive policies for the same role/action. In particular, platform-admin
-- and merchant/staff access remain OR-combined so a user who is both an admin
-- and a merchant keeps both access paths.

-- agentic_cart_sessions: the ALL policy already covers SELECT with the same
-- scoped-agentic condition.
DROP POLICY IF EXISTS "Agentic cart sessions are readable by scoped client"
  ON public.agentic_cart_sessions;

-- ai_jobs: combine owner access and staff storefront-generation access for
-- authenticated users into one SELECT policy.
DROP POLICY IF EXISTS "Merchants can view own jobs" ON public.ai_jobs;
DROP POLICY IF EXISTS "Staff can view storefront generation jobs" ON public.ai_jobs;

CREATE POLICY "ai_jobs_authenticated_select_combined"
  ON public.ai_jobs
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR (
      type = 'storefront_layout_generation'
      AND (
        EXISTS (
          SELECT 1
          FROM public.merchants AS m
          WHERE m.id = ai_jobs.merchant_id
            AND m.user_id = (SELECT auth.uid())
        )
        OR public.check_staff_permission(
          (SELECT auth.uid()),
          merchant_id,
          'builder',
          'view'
        )
        OR public.check_staff_permission(
          (SELECT auth.uid()),
          merchant_id,
          'builder',
          'edit'
        )
      )
    )
  );

-- blog_post_products: keep anonymous public reads separate, then combine
-- authenticated merchant management reads with published-link reads.
DROP POLICY IF EXISTS "Merchant staff can manage blog product links"
  ON public.blog_post_products;
DROP POLICY IF EXISTS "Public can read published blog product links"
  ON public.blog_post_products;

CREATE POLICY "Public can read published blog product links"
  ON public.blog_post_products
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_posts AS bp
      WHERE bp.id = blog_post_products.blog_post_id
        AND bp.merchant_id = blog_post_products.merchant_id
        AND bp.status = 'published'
        AND bp.published_at IS NOT NULL
    )
  );

CREATE POLICY "Authenticated can read blog product links"
  ON public.blog_post_products
  FOR SELECT
  TO authenticated
  USING (
    public.has_merchant_access(merchant_id)
    OR EXISTS (
      SELECT 1
      FROM public.blog_posts AS bp
      WHERE bp.id = blog_post_products.blog_post_id
        AND bp.merchant_id = blog_post_products.merchant_id
        AND bp.status = 'published'
        AND bp.published_at IS NOT NULL
    )
  );

CREATE POLICY "Merchant staff can insert blog product links"
  ON public.blog_post_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_merchant_access(merchant_id)
    AND EXISTS (
      SELECT 1
      FROM public.blog_posts AS bp
      WHERE bp.id = blog_post_products.blog_post_id
        AND bp.merchant_id = blog_post_products.merchant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = blog_post_products.product_id
        AND p.merchant_id = blog_post_products.merchant_id
    )
  );

CREATE POLICY "Merchant staff can update blog product links"
  ON public.blog_post_products
  FOR UPDATE
  TO authenticated
  USING (public.has_merchant_access(merchant_id))
  WITH CHECK (
    public.has_merchant_access(merchant_id)
    AND EXISTS (
      SELECT 1
      FROM public.blog_posts AS bp
      WHERE bp.id = blog_post_products.blog_post_id
        AND bp.merchant_id = blog_post_products.merchant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = blog_post_products.product_id
        AND p.merchant_id = blog_post_products.merchant_id
    )
  );

CREATE POLICY "Merchant staff can delete blog product links"
  ON public.blog_post_products
  FOR DELETE
  TO authenticated
  USING (public.has_merchant_access(merchant_id));

-- blog_posts: combine platform-admin and merchant/staff write paths. This is
-- intentionally an OR, not a precedence rule, for users who are both.
DROP POLICY IF EXISTS "Platform admins can delete platform blog posts"
  ON public.blog_posts;
DROP POLICY IF EXISTS "Staff can delete blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Platform admins can insert platform blog posts"
  ON public.blog_posts;
DROP POLICY IF EXISTS "Staff can insert blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Platform admins can update platform blog posts"
  ON public.blog_posts;
DROP POLICY IF EXISTS "Staff can update blog posts" ON public.blog_posts;

CREATE POLICY "Authenticated can delete blog posts"
  ON public.blog_posts
  FOR DELETE
  TO authenticated
  USING (
    (
      is_platform_post IS TRUE
      AND merchant_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.merchants AS m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.is_platform_admin IS TRUE
      )
    )
    OR merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'marketing',
      'delete'
    )
  );

CREATE POLICY "Authenticated can insert blog posts"
  ON public.blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      is_platform_post IS TRUE
      AND merchant_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.merchants AS m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.is_platform_admin IS TRUE
      )
    )
    OR merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'marketing',
      'create'
    )
  );

CREATE POLICY "Authenticated can update blog posts"
  ON public.blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    (
      is_platform_post IS TRUE
      AND merchant_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.merchants AS m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.is_platform_admin IS TRUE
      )
    )
    OR merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'marketing',
      'edit'
    )
  )
  WITH CHECK (
    (
      is_platform_post IS TRUE
      AND merchant_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.merchants AS m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.is_platform_admin IS TRUE
      )
    )
    OR merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'marketing',
      'edit'
    )
  );

-- categories: separate anonymous active-category reads from authenticated
-- owner reads/writes.
DROP POLICY IF EXISTS categories_merchant_policy ON public.categories;
DROP POLICY IF EXISTS categories_public_read ON public.categories;

CREATE POLICY categories_public_read
  ON public.categories
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY categories_authenticated_select
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY categories_merchant_insert
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY categories_merchant_update
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY categories_merchant_delete
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
  );

-- chat_orders: fold agentic checkout access into the existing combined
-- policies so authenticated users do not match two permissive policies.
DROP POLICY IF EXISTS "Agentic chat orders are insertable by scoped client"
  ON public.chat_orders;
DROP POLICY IF EXISTS "chat_orders_insert_combined" ON public.chat_orders;

CREATE POLICY "chat_orders_insert_combined"
  ON public.chat_orders
  FOR INSERT
  TO public
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR (
      public.is_agentic_checkout_context()
      AND merchant_id = public.current_agentic_merchant_id()
      AND session_id = public.current_agentic_session_id()
      AND status = 'pending_payment'
    )
  );

DROP POLICY IF EXISTS "Agentic chat orders are readable by scoped client"
  ON public.chat_orders;
DROP POLICY IF EXISTS "chat_orders_select_combined" ON public.chat_orders;

CREATE POLICY "chat_orders_select_combined"
  ON public.chat_orders
  FOR SELECT
  TO public
  USING (
    (SELECT auth.role()) = 'service_role'
    OR merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR (
      public.is_agentic_checkout_context()
      AND merchant_id = public.current_agentic_merchant_id()
      AND session_id = public.current_agentic_session_id()
    )
  );

-- checkout_sessions: public session-id reads plus the restrictive
-- agentic merchant-scope policy already cover scoped reads.
DROP POLICY IF EXISTS "Agentic checkout sessions are readable by scoped client"
  ON public.checkout_sessions;

-- crawler_logs: combine owner and analytics-staff reads.
DROP POLICY IF EXISTS "Analytics staff can view crawler agent observability logs"
  ON public.crawler_logs;
DROP POLICY IF EXISTS "Merchants can view their own crawler logs"
  ON public.crawler_logs;

CREATE POLICY "Crawler logs are readable by owners or analytics staff"
  ON public.crawler_logs
  FOR SELECT
  TO public
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'analytics',
      'view'
    )
  );

-- orders: fold agentic order access into the existing combined order policies.
DROP POLICY IF EXISTS "Agentic checkout orders are readable by scoped client"
  ON public.orders;
DROP POLICY IF EXISTS orders_select_policy ON public.orders;

CREATE POLICY orders_select_policy
  ON public.orders
  FOR SELECT
  TO public
  USING (
    public.can_access_order(merchant_id, customer_id)
    OR (
      public.is_agentic_checkout_context()
      AND merchant_id = public.current_agentic_merchant_id()
      AND source = 'agentic_ai'
    )
  );

DROP POLICY IF EXISTS "Agentic checkout orders are writable by scoped client"
  ON public.orders;
DROP POLICY IF EXISTS orders_update_policy ON public.orders;

CREATE POLICY orders_update_policy
  ON public.orders
  FOR UPDATE
  TO public
  USING (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'orders',
      'edit'
    )
    OR (
      public.is_agentic_checkout_context()
      AND merchant_id = public.current_agentic_merchant_id()
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT m.id
      FROM public.merchants AS m
      WHERE m.user_id = (SELECT auth.uid())
    )
    OR public.check_staff_permission(
      (SELECT auth.uid()),
      merchant_id,
      'orders',
      'edit'
    )
    OR (
      public.is_agentic_checkout_context()
      AND merchant_id = public.current_agentic_merchant_id()
    )
  );

-- quiz_events: split author writes from reads and combine customer/author
-- SELECT access into one authenticated policy.
DROP POLICY IF EXISTS quiz_events_merchant_author_write ON public.quiz_events;
DROP POLICY IF EXISTS quiz_events_client_read ON public.quiz_events;
DROP POLICY IF EXISTS quiz_events_merchant_author_read ON public.quiz_events;

CREATE POLICY quiz_events_authenticated_select
  ON public.quiz_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_merchant_access(merchant_id)
    OR (
      status = ANY (ARRAY['scheduled'::text, 'active'::text, 'completed'::text])
      AND EXISTS (
        SELECT 1
        FROM public.customers AS c
        WHERE c.merchant_id = quiz_events.merchant_id
          AND c.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY quiz_events_merchant_author_insert
  ON public.quiz_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_merchant_access(merchant_id));

CREATE POLICY quiz_events_merchant_author_update
  ON public.quiz_events
  FOR UPDATE
  TO authenticated
  USING (public.has_merchant_access(merchant_id))
  WITH CHECK (public.has_merchant_access(merchant_id));

CREATE POLICY quiz_events_merchant_author_delete
  ON public.quiz_events
  FOR DELETE
  TO authenticated
  USING (public.has_merchant_access(merchant_id));

-- quiz_question_slots: same split/combine pattern as quiz_events.
DROP POLICY IF EXISTS quiz_slots_merchant_author_write
  ON public.quiz_question_slots;
DROP POLICY IF EXISTS quiz_slots_client_read ON public.quiz_question_slots;
DROP POLICY IF EXISTS quiz_slots_merchant_author_read
  ON public.quiz_question_slots;

CREATE POLICY quiz_slots_authenticated_select
  ON public.quiz_question_slots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_events AS e
      WHERE e.id = quiz_question_slots.event_id
        AND public.has_merchant_access(e.merchant_id)
    )
    OR (
      active
      AND EXISTS (
        SELECT 1
        FROM public.quiz_events AS e
        JOIN public.customers AS c ON c.merchant_id = e.merchant_id
        WHERE e.id = quiz_question_slots.event_id
          AND e.status = ANY (
            ARRAY['scheduled'::text, 'active'::text, 'completed'::text]
          )
          AND c.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY quiz_slots_merchant_author_insert
  ON public.quiz_question_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quiz_events AS e
      WHERE e.id = quiz_question_slots.event_id
        AND public.has_merchant_access(e.merchant_id)
    )
  );

CREATE POLICY quiz_slots_merchant_author_update
  ON public.quiz_question_slots
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_events AS e
      WHERE e.id = quiz_question_slots.event_id
        AND public.has_merchant_access(e.merchant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quiz_events AS e
      WHERE e.id = quiz_question_slots.event_id
        AND public.has_merchant_access(e.merchant_id)
    )
  );

CREATE POLICY quiz_slots_merchant_author_delete
  ON public.quiz_question_slots
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_events AS e
      WHERE e.id = quiz_question_slots.event_id
        AND public.has_merchant_access(e.merchant_id)
    )
  );

-- quiz_question_variants: same split/combine pattern as quiz slots.
DROP POLICY IF EXISTS quiz_variants_merchant_author_write
  ON public.quiz_question_variants;
DROP POLICY IF EXISTS quiz_variants_client_read ON public.quiz_question_variants;
DROP POLICY IF EXISTS quiz_variants_merchant_author_read
  ON public.quiz_question_variants;

CREATE POLICY quiz_variants_authenticated_select
  ON public.quiz_question_variants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_question_slots AS qs
      JOIN public.quiz_events AS e ON e.id = qs.event_id
      WHERE qs.id = quiz_question_variants.slot_id
        AND public.has_merchant_access(e.merchant_id)
    )
    OR (
      active
      AND EXISTS (
        SELECT 1
        FROM public.quiz_attempt_questions AS aq
        JOIN public.quiz_attempts AS a ON a.id = aq.attempt_id
        JOIN public.customers AS c ON c.id = a.customer_id
        WHERE aq.variant_id = quiz_question_variants.id
          AND c.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY quiz_variants_merchant_author_insert
  ON public.quiz_question_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quiz_question_slots AS qs
      JOIN public.quiz_events AS e ON e.id = qs.event_id
      WHERE qs.id = quiz_question_variants.slot_id
        AND public.has_merchant_access(e.merchant_id)
    )
  );

CREATE POLICY quiz_variants_merchant_author_update
  ON public.quiz_question_variants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_question_slots AS qs
      JOIN public.quiz_events AS e ON e.id = qs.event_id
      WHERE qs.id = quiz_question_variants.slot_id
        AND public.has_merchant_access(e.merchant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quiz_question_slots AS qs
      JOIN public.quiz_events AS e ON e.id = qs.event_id
      WHERE qs.id = quiz_question_variants.slot_id
        AND public.has_merchant_access(e.merchant_id)
    )
  );

CREATE POLICY quiz_variants_merchant_author_delete
  ON public.quiz_question_variants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_question_slots AS qs
      JOIN public.quiz_events AS e ON e.id = qs.event_id
      WHERE qs.id = quiz_question_variants.slot_id
        AND public.has_merchant_access(e.merchant_id)
    )
  );
