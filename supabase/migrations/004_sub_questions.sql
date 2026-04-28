-- ============================================================
-- RFP Studio — Sub-Questions Support Migration
-- ============================================================

-- Add parent_id column for sub-question hierarchy
ALTER TABLE public.rfp_questions
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.rfp_questions(id) ON DELETE CASCADE;

-- Create index for faster parent-child queries
CREATE INDEX IF NOT EXISTS rfp_questions_parent_id_idx
  ON public.rfp_questions (parent_id);

-- Update RLS policy to allow parent_id updates
CREATE POLICY "authenticated_update_rfp_questions_parent"
  ON public.rfp_questions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Add audit logging for parent-child relationships
CREATE OR REPLACE FUNCTION public.log_question_hierarchy_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.approval_events (
    entity_type,
    entity_id,
    action,
    actor_id,
    note
  ) VALUES (
    'rfp_question',
    NEW.id,
    CASE
      WHEN NEW.parent_id IS NOT NULL AND OLD.parent_id IS NULL THEN 'assigned_parent'
      WHEN NEW.parent_id IS NULL AND OLD.parent_id IS NOT NULL THEN 'removed_parent'
      WHEN NEW.parent_id <> OLD.parent_id THEN 'changed_parent'
      ELSE 'updated'
    END,
    auth.uid(),
    JSONB_BUILD_OBJECT(
      'old_parent_id', COALESCE(OLD.parent_id, 'null'),
      'new_parent_id', COALESCE(NEW.parent_id, 'null')
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER question_hierarchy_changed
  AFTER UPDATE ON public.rfp_questions
  FOR EACH ROW
  WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
  EXECUTE FUNCTION public.log_question_hierarchy_change();