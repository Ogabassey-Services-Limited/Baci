alter table public.merchants
  add column if not exists trust_profile jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'merchants_trust_profile_is_object'
  ) then
    alter table public.merchants
      add constraint merchants_trust_profile_is_object
      check (jsonb_typeof(trust_profile) = 'object');
  end if;
end $$;
