-- ELove Migration: Add new columns and tables for Phase 2-5
-- Run this on Supabase SQL Editor before deploying new code
-- Date: 2026-03-05

-- ============ TEMPLATES: add new columns ============

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'wedding',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heart_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN templates.category IS 'wedding | birthday | graduation | event | anniversary | greeting | other';

-- ============ GIFTS: new table ============

CREATE TABLE IF NOT EXISTS gifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  guest_name text NOT NULL,
  amount integer NOT NULL, -- VND
  message text,
  method text NOT NULL DEFAULT 'bank_transfer', -- bank_transfer | momo | cash
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS gifts_project_idx ON gifts(project_id);

-- ============ RLS Policies ============

-- Templates: public read, admin write
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "templates_public_read"
  ON templates FOR SELECT
  USING (status = 'published');

-- Gifts: project owner read, public insert
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "gifts_insert"
  ON gifts FOR INSERT
  WITH CHECK (true);

-- ============ Verify ============
-- Run after migration to verify:
-- SELECT count(*) FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'category';
-- SELECT count(*) FROM information_schema.tables WHERE table_name = 'gifts';
