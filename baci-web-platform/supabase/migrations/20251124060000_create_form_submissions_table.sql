-- Migration: Create form submissions table
-- Description: Stores form submissions from merchant storefronts
-- Created: 2024-11-24

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    form_name TEXT NOT NULL,
    form_data JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_form_submissions_merchant_id ON form_submissions(merchant_id);
CREATE INDEX idx_form_submissions_form_name ON form_submissions(form_name);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);

-- Enable RLS
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own form submissions
CREATE POLICY "Merchants can view their own form submissions"
ON form_submissions
FOR SELECT
TO authenticated
USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Policy: Merchants can update status of their own submissions
CREATE POLICY "Merchants can update their own form submissions"
ON form_submissions
FOR UPDATE
TO authenticated
USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
));

-- Policy: Allow public to insert form submissions (for storefront forms)
CREATE POLICY "Public can submit forms"
ON form_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_form_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_form_submissions_updated_at
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_form_submissions_updated_at();

-- Add comments for documentation
COMMENT ON TABLE form_submissions IS 'Stores form submissions from merchant storefronts';
COMMENT ON COLUMN form_submissions.form_name IS 'Name/identifier of the form (e.g., "Contact Form", "Newsletter Signup")';
COMMENT ON COLUMN form_submissions.form_data IS 'JSON object containing all form field values';
COMMENT ON COLUMN form_submissions.status IS 'Submission status: unread, read, or archived';
