-- Preserve application-computed display-name fallbacks when individual
-- customers have no first/last names.

create or replace function public.update_customer_full_name()
  returns trigger
  language plpgsql
  set search_path to 'pg_catalog', 'public'
  as $$
begin
  if new.customer_type = 'company' then
    new.first_name := null;
    new.last_name := null;
    new.full_name := nullif(btrim(coalesce(new.company_name, '')), '');
  else
    new.company_name := null;
    new.full_name := nullif(
      btrim(
        coalesce(
          nullif(
            btrim(
              concat(coalesce(new.first_name, ''), ' ', coalesce(new.last_name, ''))
            ),
            ''
          ),
          nullif(btrim(coalesce(new.full_name, '')), ''),
          nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '')
        )
      ),
      ''
    );
  end if;
  return new;
end;
$$;
