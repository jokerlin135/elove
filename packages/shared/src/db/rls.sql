-- packages/shared/src/db/rls.sql
-- Enable RLS on sensitive tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE guestbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_overrides ENABLE ROW LEVEL SECURITY;

-- Supabase Auth pattern: use auth.uid() to get tenant_id via users table
CREATE POLICY "tenant_isolation_projects" ON projects
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_media" ON media
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_subscriptions" ON subscriptions
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_quota_usage" ON quota_usage
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_rsvp_responses" ON rsvp_responses
  USING (project_id IN (
    SELECT id FROM projects WHERE tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "tenant_isolation_guestbook_entries" ON guestbook_entries
  USING (project_id IN (
    SELECT id FROM projects WHERE tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "tenant_isolation_billing_events" ON billing_events
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "tenant_isolation_entitlement_overrides" ON entitlement_overrides
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

-- webhook_events: service role only (no tenant_id column)
CREATE POLICY "service_role_only_webhook_events" ON webhook_events
  USING (auth.role() = 'service_role');

-- Service role bypass (for admin and build worker)
CREATE POLICY "service_role_bypass_projects" ON projects
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_media" ON media
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_subscriptions" ON subscriptions
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_quota_usage" ON quota_usage
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_rsvp_responses" ON rsvp_responses
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_guestbook_entries" ON guestbook_entries
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_billing_events" ON billing_events
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_entitlement_overrides" ON entitlement_overrides
  USING (auth.role() = 'service_role');
