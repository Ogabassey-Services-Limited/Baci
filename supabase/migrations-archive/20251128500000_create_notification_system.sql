-- Migration: Create Admin Notification System for Merchants
-- This implements a production-ready notification system with:
-- - Supabase Broadcast for real-time delivery
-- - In-app notifications and site banners
-- - Scheduled notifications support
-- - Usage monitoring for free tier limits

-- ============================================================================
-- NOTIFICATION TEMPLATES TABLE
-- Reusable notification templates for common alerts
-- ============================================================================
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'success', 'warning', 'error')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  channels JSONB NOT NULL DEFAULT '["in_app"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- Main table for storing notifications sent by admins
-- ============================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'info' CHECK (notification_type IN ('info', 'success', 'warning', 'error')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific', 'segment')),
  target_merchant_ids UUID[] DEFAULT '{}',
  target_segment TEXT, -- 'new', 'active', 'at_risk'
  channels JSONB NOT NULL DEFAULT '["in_app"]',
  action_url TEXT,
  action_label TEXT,
  scheduled_for TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  is_system BOOLEAN DEFAULT FALSE -- For internal system alerts (usage warnings)
);

-- ============================================================================
-- MERCHANT NOTIFICATIONS TABLE
-- Per-merchant notification delivery and read status
-- ============================================================================
CREATE TABLE merchant_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  banner_dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notification_id, merchant_id)
);

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- User preferences for notification delivery
-- ============================================================================
CREATE TABLE notification_preferences (
  merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  banner_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding scheduled notifications that need to be sent
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for)
  WHERE sent_at IS NULL AND scheduled_for IS NOT NULL;

-- Index for filtering notifications by creator
CREATE INDEX idx_notifications_created_by ON notifications(created_by);

-- Index for fetching merchant's notifications efficiently (cursor-based pagination)
CREATE INDEX idx_merchant_notifications_merchant ON merchant_notifications(merchant_id, created_at DESC);

-- Partial index for unread notifications (most common query)
CREATE INDEX idx_merchant_notifications_unread ON merchant_notifications(merchant_id, read_at)
  WHERE read_at IS NULL;

-- Index for notification type filtering
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- Index for system notifications
CREATE INDEX idx_notifications_system ON notifications(is_system) WHERE is_system = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all notifications
CREATE POLICY "admins_manage_notifications" ON notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM merchants WHERE user_id = auth.uid() AND is_platform_admin = TRUE)
  );

-- Merchants can read notifications (via merchant_notifications join)
-- This policy allows reading notification details when joined with merchant_notifications
CREATE POLICY "merchants_view_notifications" ON notifications
  FOR SELECT USING (
    id IN (
      SELECT notification_id FROM merchant_notifications
      WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    )
  );

-- Merchants can read their own merchant_notifications
CREATE POLICY "merchants_read_own_notifications" ON merchant_notifications
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Merchants can update their own merchant_notifications (mark read/dismissed)
CREATE POLICY "merchants_update_own_notifications" ON merchant_notifications
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- System can insert merchant_notifications (for delivery)
-- This uses service role, not user auth, so we allow based on notification existing
CREATE POLICY "system_insert_merchant_notifications" ON merchant_notifications
  FOR INSERT WITH CHECK (
    -- Allow if the notification exists (will be called by service role)
    notification_id IN (SELECT id FROM notifications)
  );

-- Merchants manage their own preferences
CREATE POLICY "merchants_manage_preferences" ON notification_preferences
  FOR ALL USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Admins can manage templates
CREATE POLICY "admins_manage_templates" ON notification_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM merchants WHERE user_id = auth.uid() AND is_platform_admin = TRUE)
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get unread notification count for a merchant
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_merchant_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM merchant_notifications
  WHERE merchant_id = p_merchant_id
    AND read_at IS NULL
    AND dismissed_at IS NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to get active banner notifications for a merchant
CREATE OR REPLACE FUNCTION get_active_banners(p_merchant_id UUID)
RETURNS TABLE (
  id UUID,
  notification_id UUID,
  title TEXT,
  message TEXT,
  notification_type TEXT,
  priority TEXT,
  action_url TEXT,
  action_label TEXT,
  created_at TIMESTAMPTZ
) AS $$
  SELECT
    mn.id,
    n.id as notification_id,
    n.title,
    n.message,
    n.notification_type,
    n.priority,
    n.action_url,
    n.action_label,
    mn.created_at
  FROM merchant_notifications mn
  JOIN notifications n ON n.id = mn.notification_id
  WHERE mn.merchant_id = p_merchant_id
    AND mn.banner_dismissed_at IS NULL
    AND mn.dismissed_at IS NULL
    AND n.channels ? 'banner'
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY
    CASE n.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    mn.created_at DESC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to clean up expired notifications (to be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
  -- Delete merchant_notifications for expired notifications older than 7 days
  DELETE FROM merchant_notifications
  WHERE notification_id IN (
    SELECT id FROM notifications
    WHERE expires_at < NOW() - INTERVAL '7 days'
  );

  -- Delete the expired notifications themselves
  DELETE FROM notifications
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send notification to all merchants
CREATE OR REPLACE FUNCTION send_notification_to_all_merchants(p_notification_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO merchant_notifications (notification_id, merchant_id)
  SELECT p_notification_id, id
  FROM merchants
  WHERE user_id IS NOT NULL -- Only merchants with accounts
  ON CONFLICT (notification_id, merchant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update sent_at on the notification
  UPDATE notifications SET sent_at = NOW() WHERE id = p_notification_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send notification to specific merchants
CREATE OR REPLACE FUNCTION send_notification_to_merchants(
  p_notification_id UUID,
  p_merchant_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO merchant_notifications (notification_id, merchant_id)
  SELECT p_notification_id, unnest(p_merchant_ids)
  ON CONFLICT (notification_id, merchant_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update sent_at on the notification
  UPDATE notifications SET sent_at = NOW() WHERE id = p_notification_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification delivery stats
CREATE OR REPLACE FUNCTION get_notification_stats(p_notification_id UUID)
RETURNS TABLE (
  total_sent BIGINT,
  total_read BIGINT,
  total_dismissed BIGINT,
  read_rate NUMERIC
) AS $$
  SELECT
    COUNT(*) as total_sent,
    COUNT(read_at) as total_read,
    COUNT(dismissed_at) as total_dismissed,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(read_at)::NUMERIC / COUNT(*)) * 100, 2)
      ELSE 0
    END as read_rate
  FROM merchant_notifications
  WHERE notification_id = p_notification_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to notification_templates
CREATE TRIGGER notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

-- Apply trigger to notification_preferences
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

-- ============================================================================
-- DEFAULT TEMPLATES (Optional - useful for system notifications)
-- ============================================================================

INSERT INTO notification_templates (name, message_template, notification_type, priority, channels) VALUES
  ('usage_warning_connections', 'Your platform is approaching the Supabase Realtime connection limit ({{current}}/{{limit}}). Consider upgrading to avoid service interruption.', 'warning', 'high', '["in_app", "banner"]'),
  ('usage_warning_messages', 'Your platform has used {{current}} of {{limit}} Realtime messages this month. Consider upgrading to avoid overage charges.', 'warning', 'high', '["in_app", "banner"]'),
  ('usage_critical', 'URGENT: Your platform has exceeded {{percent}}% of the free tier limit for {{resource}}. Immediate action required.', 'error', 'urgent', '["in_app", "banner"]'),
  ('maintenance_scheduled', 'Scheduled maintenance: {{description}}. Expected downtime: {{duration}}.', 'info', 'normal', '["in_app", "banner"]'),
  ('feature_announcement', 'New feature: {{feature_name}}! {{description}}', 'success', 'normal', '["in_app"]');

-- ============================================================================
-- GRANT PERMISSIONS FOR REALTIME
-- ============================================================================

-- Note: Supabase Broadcast doesn't require table-level Realtime permissions
-- Broadcast works through channels, not postgres_changes
-- The broadcast will be triggered from the API after notification creation

COMMENT ON TABLE notifications IS 'Admin notifications sent to merchants. Uses Supabase Broadcast for real-time delivery.';
COMMENT ON TABLE merchant_notifications IS 'Per-merchant notification delivery status with read/dismiss tracking.';
COMMENT ON TABLE notification_preferences IS 'Merchant preferences for notification channels and quiet hours.';
COMMENT ON TABLE notification_templates IS 'Reusable notification templates for common system alerts.';
