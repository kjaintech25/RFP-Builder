-- Allow admin/analyst to delete RFP projects
CREATE POLICY "analyst_delete_rfp_projects"
  ON public.rfp_projects FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'analyst')
    )
  );

-- Store question order (already computed in parser output, not yet persisted)
ALTER TABLE public.rfp_questions
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS rfp_questions_order_idx
  ON public.rfp_questions (project_id, order_index);
