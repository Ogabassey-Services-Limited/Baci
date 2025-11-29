-- Migration: Add enhanced about page schema to merchants table
-- This adds structured fields for a rich "About Us" page with JSON-LD support

-- Add new columns for structured about page content
-- These enable rich SEO with schema.org AboutPage markup

COMMENT ON COLUMN merchants.pages IS 'Legacy simple text pages (about, contact, privacy, terms, faq, legal)';

-- Add a new column for structured about page data
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS about_page JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN merchants.about_page IS 'Structured about page data for rich SEO. Schema: {
  story: string,           -- The brand story/history
  mission: string,         -- Mission statement
  vision: string,          -- Vision statement
  values: string[],        -- Core values
  founded_year: number,    -- Year business was founded
  founder_name: string,    -- Founder name
  founder_bio: string,     -- Founder biography
  founder_image: string,   -- Founder image URL
  team: [{                 -- Team members
    name: string,
    role: string,
    bio: string,
    image: string,
    social_links: { linkedin?: string, twitter?: string }
  }],
  milestones: [{           -- Company milestones/timeline
    year: number,
    title: string,
    description: string
  }],
  awards: [{               -- Awards and recognition
    title: string,
    year: number,
    issuer: string
  }],
  certifications: string[], -- Certifications/badges
  media_features: [{       -- Press/media features
    publication: string,
    title: string,
    url: string,
    date: string
  }],
  social_proof: {          -- Social proof stats
    customers_served: number,
    years_in_business: number,
    products_sold: number,
    rating: number,
    review_count: number
  },
  gallery: string[],       -- Image gallery URLs
  video_url: string        -- Brand video URL (YouTube/Vimeo)
}';

-- Create index for faster queries on about_page
CREATE INDEX IF NOT EXISTS idx_merchants_about_page ON merchants USING GIN (about_page);
