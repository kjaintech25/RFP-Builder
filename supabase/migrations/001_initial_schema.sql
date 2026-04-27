-- ============================================================
-- RFP Studio — Initial Schema Migration
-- Run in Supabase SQL Editor (self-hosted instance)
-- Requires: pgvector extension enabled on the instance
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'compliance', 'sme', 'analyst', 'read_only');
CREATE TYPE approval_status AS ENUM ('draft', 'in_review', 'approved', 'rejected', 'stale');
CREATE TYPE project_status AS ENUM ('active', 'in_review', 'submitted', 'archived');
CREATE TYPE question_status AS ENUM ('unanswered', 'drafted', 'in_review', 'approved', 'rejected');

-- ============================================================
-- Tables (FK-dependency order)
-- ============================================================

-- 1. users — extends auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  role        user_role NOT NULL DEFAULT 'analyst',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. answers — approved content library
CREATE TABLE IF NOT EXISTS public.answers (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text       text NOT NULL,
  answer_text         text NOT NULL,
  topic_category      text,
  client_type         text,
  owner_id            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source_document     text,
  approval_status     approval_status NOT NULL DEFAULT 'draft',
  version             integer NOT NULL DEFAULT 1,
  review_interval_days integer,
  last_reviewed_at    timestamptz,
  expires_at          timestamptz,
  embedding           vector(1536),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 3. rfp_projects
CREATE TABLE IF NOT EXISTS public.rfp_projects (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  client_name  text,
  project_type text,
  due_date     date,
  status       project_status NOT NULL DEFAULT 'active',
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. rfp_questions
CREATE TABLE IF NOT EXISTS public.rfp_questions (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        uuid NOT NULL REFERENCES public.rfp_projects(id) ON DELETE CASCADE,
  question_text     text NOT NULL,
  section_context   text,
  status            question_status NOT NULL DEFAULT 'unanswered',
  assigned_to       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  matched_answer_id uuid REFERENCES public.answers(id) ON DELETE SET NULL,
  draft_text        text,
  confidence_score  float,
  due_date          date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 5. approval_events — immutable audit log
CREATE TABLE IF NOT EXISTS public.approval_events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  action      text NOT NULL,
  actor_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

-- Vector similarity search (HNSW — no training data required unlike ivfflat)
CREATE INDEX IF NOT EXISTS answers_embedding_hnsw_idx
  ON public.answers USING hnsw (embedding vector_cosine_ops);

-- Common filter patterns
CREATE INDEX IF NOT EXISTS answers_approval_status_idx  ON public.answers (approval_status);
CREATE INDEX IF NOT EXISTS answers_topic_category_idx   ON public.answers (topic_category);
CREATE INDEX IF NOT EXISTS answers_expires_at_idx       ON public.answers (expires_at);
CREATE INDEX IF NOT EXISTS answers_owner_id_idx         ON public.answers (owner_id);

CREATE INDEX IF NOT EXISTS rfp_projects_status_idx      ON public.rfp_projects (status);
CREATE INDEX IF NOT EXISTS rfp_projects_due_date_idx    ON public.rfp_projects (due_date);

CREATE INDEX IF NOT EXISTS rfp_questions_project_id_idx ON public.rfp_questions (project_id);
CREATE INDEX IF NOT EXISTS rfp_questions_status_idx     ON public.rfp_questions (status);
CREATE INDEX IF NOT EXISTS rfp_questions_due_date_idx   ON public.rfp_questions (due_date);

CREATE INDEX IF NOT EXISTS approval_events_entity_id_idx ON public.approval_events (entity_id);
CREATE INDEX IF NOT EXISTS approval_events_actor_id_idx  ON public.approval_events (actor_id);
CREATE INDEX IF NOT EXISTS approval_events_created_at_idx ON public.approval_events (created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events  ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all tables
CREATE POLICY "authenticated_read_users"
  ON public.users FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_answers"
  ON public.answers FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_rfp_projects"
  ON public.rfp_projects FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_rfp_questions"
  ON public.rfp_questions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_approval_events"
  ON public.approval_events FOR SELECT USING (auth.role() = 'authenticated');

-- answers: admin/compliance/sme can insert and update
CREATE POLICY "sme_insert_answers"
  ON public.answers FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'compliance', 'sme')
    )
  );

CREATE POLICY "sme_update_answers"
  ON public.answers FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'compliance', 'sme')
    )
  );

-- rfp_projects: admin/analyst can insert
CREATE POLICY "analyst_insert_rfp_projects"
  ON public.rfp_projects FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'analyst')
    )
  );

CREATE POLICY "analyst_update_rfp_projects"
  ON public.rfp_projects FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'analyst')
    )
  );

-- rfp_questions: any authenticated user
CREATE POLICY "authenticated_insert_rfp_questions"
  ON public.rfp_questions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_rfp_questions"
  ON public.rfp_questions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- approval_events: insert only (append-only audit log — no UPDATE or DELETE)
CREATE POLICY "authenticated_insert_approval_events"
  ON public.approval_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- Helper: Semantic similarity search (approved answers only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_answers(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  question_text   text,
  answer_text     text,
  topic_category  text,
  approval_status approval_status,
  similarity      float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    question_text,
    answer_text,
    topic_category,
    approval_status,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.answers
  WHERE approval_status = 'approved'
    AND (1 - (embedding <=> query_embedding)) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER answers_updated_at
  BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER rfp_projects_updated_at
  BEFORE UPDATE ON public.rfp_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER rfp_questions_updated_at
  BEFORE UPDATE ON public.rfp_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Auto-provision user row on first sign-in
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'analyst'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
