export type UserRole = 'admin' | 'compliance' | 'sme' | 'analyst' | 'read_only'
export type ApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'stale'
export type ProjectStatus = 'active' | 'in_review' | 'submitted' | 'archived'
export type QuestionStatus = 'unanswered' | 'drafted' | 'in_review' | 'approved' | 'rejected'

export interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export interface AnswerRow {
  id: string
  question_text: string
  answer_text: string
  topic_category: string | null
  client_type: string | null
  owner_id: string | null
  source_document: string | null
  approval_status: ApprovalStatus
  version: number
  review_interval_days: number | null
  last_reviewed_at: string | null
  expires_at: string | null
  embedding: string | null
  created_at: string
  updated_at: string
}

export interface RfpProjectRow {
  id: string
  name: string
  client_name: string | null
  project_type: string | null
  due_date: string | null
  status: ProjectStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RfpQuestionRow {
  id: string
  project_id: string
  question_text: string
  section_context: string | null
  status: QuestionStatus
  assigned_to: string | null
  matched_answer_id: string | null
  draft_text: string | null
  confidence_score: number | null
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalEventRow {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string | null
  note: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: Omit<UserRow, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<UserRow, 'id'>>
      }
      answers: {
        Row: AnswerRow
        Insert: Omit<AnswerRow, 'id' | 'created_at' | 'updated_at' | 'version'> & {
          id?: string
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: Partial<Omit<AnswerRow, 'id'>>
      }
      rfp_projects: {
        Row: RfpProjectRow
        Insert: Omit<RfpProjectRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<RfpProjectRow, 'id'>>
      }
      rfp_questions: {
        Row: RfpQuestionRow
        Insert: Omit<RfpQuestionRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<RfpQuestionRow, 'id'>>
      }
      approval_events: {
        Row: ApprovalEventRow
        Insert: Omit<ApprovalEventRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: never
      }
    }
    Enums: {
      user_role: UserRole
      approval_status: ApprovalStatus
      project_status: ProjectStatus
      question_status: QuestionStatus
    }
  }
}
