-- Create jobs table for background AI processing
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'price_list_processing', 'product_description', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  input JSONB NOT NULL, -- Input data for the job
  output JSONB, -- Result data
  error TEXT, -- Error message if failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_jobs_merchant_id ON ai_jobs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- Policies

-- Merchants can view their own jobs
CREATE POLICY "Merchants can view own jobs"
  ON ai_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = ai_jobs.merchant_id
      AND merchants.user_id = auth.uid()
    )
  );

-- Merchants can create jobs
CREATE POLICY "Merchants can create jobs"
  ON ai_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = ai_jobs.merchant_id
      AND merchants.user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE TRIGGER update_ai_jobs_updated_at
  BEFORE UPDATE ON ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
