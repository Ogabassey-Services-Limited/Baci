-- Regression test for 20260713211500_split_platform_blog_anon_read_policy.sql.
BEGIN READ ONLY;

DO $$
DECLARE
  authenticated_roles text;
  anonymous_roles text;
  anonymous_policy text;
  anonymous_is_restrictive boolean;
BEGIN
  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    pg_get_expr(polqual, polrelid)
  INTO authenticated_roles, anonymous_policy
  FROM pg_policy
  WHERE polrelid = 'public.blog_posts'::regclass
    AND polname = 'Platform blog posts require published status or admin read';

  IF authenticated_roles IS NULL
     OR authenticated_roles NOT LIKE '%authenticated%'
     OR authenticated_roles LIKE '%anon%' THEN
    RAISE EXCEPTION
      'authenticated platform-blog read policy must target only authenticated, found %',
      authenticated_roles;
  END IF;

  IF anonymous_policy NOT ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION
      'authenticated platform-blog read policy must retain its admin path';
  END IF;

  SELECT
    array_to_string(polroles::regrole[]::text[], ','),
    pg_get_expr(polqual, polrelid),
    NOT polpermissive
  INTO anonymous_roles, anonymous_policy, anonymous_is_restrictive
  FROM pg_policy
  WHERE polrelid = 'public.blog_posts'::regclass
    AND polname = 'Anon platform blog posts require published status';

  IF anonymous_roles IS NULL
     OR anonymous_roles NOT LIKE '%anon%'
     OR anonymous_roles LIKE '%authenticated%'
     OR anonymous_is_restrictive IS NOT TRUE THEN
    RAISE EXCEPTION
      'anonymous platform-blog read policy must be restrictive and target only anon';
  END IF;

  IF anonymous_policy NOT ILIKE '%status = ''published''%'
     OR anonymous_policy NOT ILIKE '%published_at IS NOT NULL%'
     OR anonymous_policy ILIKE '%is_platform_admin%' THEN
    RAISE EXCEPTION
      'anonymous platform-blog read policy must be published-only without an admin lookup';
  END IF;
END;
$$;

ROLLBACK;
