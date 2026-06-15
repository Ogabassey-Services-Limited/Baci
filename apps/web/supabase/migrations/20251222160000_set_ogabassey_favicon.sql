-- Migration: Set ogabassey favicon URLs
-- The favicon SVG is hosted in the public directory and served via Vercel

UPDATE merchants
SET
  favicon_svg_url = 'https://usebaci.com/uploads/favicons/ogabassey.svg'
WHERE slug = 'ogabassey';
