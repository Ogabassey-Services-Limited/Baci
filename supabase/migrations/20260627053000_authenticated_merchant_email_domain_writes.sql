-- Move user-facing merchant email-domain writes off the service-role client.
-- API routes now use the authenticated Supabase client and these owner-scoped
-- RLS policies. Provider calls and entitlement checks remain in application
-- code; the table boundary enforces that a merchant owner can only insert or
-- update their own row.

grant insert, update on public.merchant_email_domains to authenticated;

drop policy if exists "merchant_email_domains_owner_insert"
  on public.merchant_email_domains;
create policy "merchant_email_domains_owner_insert"
  on public.merchant_email_domains
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_email_domains.merchant_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "merchant_email_domains_owner_update"
  on public.merchant_email_domains;
create policy "merchant_email_domains_owner_update"
  on public.merchant_email_domains
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_email_domains.merchant_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.merchants m
      where m.id = merchant_email_domains.merchant_id
        and m.user_id = (select auth.uid())
    )
  );
