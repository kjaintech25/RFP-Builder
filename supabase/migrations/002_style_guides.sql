-- Style guides: brand voice, format rules, compliance language, firm context
-- These are injected into every AI draft generation call (approved + active only)

CREATE TABLE style_guides (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('voice', 'format', 'compliance', 'firm_context')),
  description   text,
  content       text NOT NULL,
  is_active     boolean NOT NULL DEFAULT false,
  version       int NOT NULL DEFAULT 1,
  approval_status approval_status NOT NULL DEFAULT 'draft',
  created_by    uuid NOT NULL REFERENCES users(id),
  approved_by   uuid REFERENCES users(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only approved + active guides enter the AI prompt
CREATE INDEX idx_style_guides_active ON style_guides (is_active, approval_status);
CREATE INDEX idx_style_guides_type   ON style_guides (type);

ALTER TABLE style_guides ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read style guides
CREATE POLICY "style_guides_read" ON style_guides
  FOR SELECT TO authenticated USING (true);

-- Only admin and compliance can insert / update
CREATE POLICY "style_guides_write" ON style_guides
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'compliance')
    )
  );

CREATE POLICY "style_guides_update" ON style_guides
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'compliance')
    )
  );

-- Trigger: bump version + updated_at whenever content changes
CREATE OR REPLACE FUNCTION bump_style_guide_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.version := OLD.version + 1;
    -- When content changes, revert to draft so it must be re-approved
    NEW.approval_status := 'draft';
    NEW.is_active := false;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER style_guide_version_bump
  BEFORE UPDATE ON style_guides
  FOR EACH ROW EXECUTE FUNCTION bump_style_guide_version();
