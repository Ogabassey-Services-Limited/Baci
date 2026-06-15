-- Update ogabassey favicon
-- Created: 2025-12-23

UPDATE public.merchants
SET
  favicon_svg_url = '/uploads/favicons/ogabassey.svg'
WHERE slug = 'ogabassey';
