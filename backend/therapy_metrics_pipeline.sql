-- =====================================================
-- Structured Therapy Metrics Pipeline (Production)
-- =====================================================
-- 1) Stores numeric CV session metrics with timestamps
-- 2) Keeps fast query indexes for 1000+ sessions per child
-- 3) Seeds example data for testing
--
-- Run this after base schema.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.therapy_session_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id) NOT NULL,
  session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE SET NULL,
  session_date TIMESTAMPTZ NOT NULL,
  session_duration_minutes INTEGER NOT NULL CHECK (session_duration_minutes > 0),
  therapy_type TEXT NOT NULL CHECK (therapy_type IN ('speech', 'motor', 'social', 'behavioral')),

  -- Core normalized scores
  eye_contact_score NUMERIC(4,3) CHECK (eye_contact_score BETWEEN 0 AND 1),
  social_engagement_score NUMERIC(4,3) CHECK (social_engagement_score BETWEEN 0 AND 1),
  emotional_regulation_score NUMERIC(4,3) CHECK (emotional_regulation_score BETWEEN 0 AND 1),
  attention_span_score NUMERIC(4,3) CHECK (attention_span_score BETWEEN 0 AND 1),
  communication_score NUMERIC(4,3) CHECK (communication_score BETWEEN 0 AND 1),
  motor_coordination_score NUMERIC(4,3) CHECK (motor_coordination_score BETWEEN 0 AND 1),
  session_engagement_score NUMERIC(4,3) CHECK (session_engagement_score BETWEEN 0 AND 1),

  -- Raw structured metrics
  response_latency_seconds NUMERIC(8,3) CHECK (response_latency_seconds >= 0),
  gesture_frequency NUMERIC(8,3) CHECK (gesture_frequency >= 0),
  verbal_utterances INTEGER CHECK (verbal_utterances >= 0),
  attention_span_seconds INTEGER CHECK (attention_span_seconds >= 0),

  -- CV metadata
  cv_model_version TEXT,
  cv_confidence_score NUMERIC(4,3) CHECK (cv_confidence_score BETWEEN 0 AND 1),
  video_quality_score NUMERIC(4,3) CHECK (video_quality_score BETWEEN 0 AND 1),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_therapy_session_metrics_session_id
  ON public.therapy_session_metrics(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_therapy_session_metrics_child_type_date
  ON public.therapy_session_metrics(child_id, therapy_type, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_therapy_session_metrics_child_date
  ON public.therapy_session_metrics(child_id, session_date DESC);

CREATE TABLE IF NOT EXISTS public.progress_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapy_type TEXT NOT NULL CHECK (therapy_type IN ('speech', 'motor', 'social', 'behavioral')),
  total_sessions INTEGER DEFAULT 0,
  average_eye_contact NUMERIC(4,3),
  average_social_engagement NUMERIC(4,3),
  average_emotional_regulation NUMERIC(4,3),
  average_attention_span NUMERIC(4,3),
  average_communication NUMERIC(4,3),
  average_session_engagement NUMERIC(4,3),
  eye_contact_trend TEXT CHECK (eye_contact_trend IN ('improving', 'stable', 'regressing')),
  social_engagement_trend TEXT CHECK (social_engagement_trend IN ('improving', 'stable', 'regressing')),
  emotional_regulation_trend TEXT CHECK (emotional_regulation_trend IN ('improving', 'stable', 'regressing')),
  overall_trend TEXT CHECK (overall_trend IN ('improving', 'stable', 'regressing')),
  eye_contact_change_pct NUMERIC(7,2),
  social_engagement_change_pct NUMERIC(7,2),
  emotional_regulation_change_pct NUMERIC(7,2),
  overall_improvement_pct NUMERIC(7,2),
  has_regression BOOLEAN DEFAULT FALSE,
  regression_metrics TEXT[] DEFAULT '{}',
  stagnation_count INTEGER DEFAULT 0,
  consistency_score NUMERIC(4,3),
  best_performing_metric TEXT,
  needs_attention_metric TEXT,
  analysis_period_start TIMESTAMPTZ,
  analysis_period_end TIMESTAMPTZ,
  last_session_date TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(child_id, therapy_type)
);

CREATE TABLE IF NOT EXISTS public.progress_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id),
  doctor_id UUID REFERENCES public.profiles(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('regression', 'stagnation', 'milestone', 'urgent')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_metrics TEXT[] DEFAULT '{}',
  metric_values JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_alerts_child_status
  ON public.progress_alerts(child_id, status, created_at DESC);

-- =====================================================
-- Example test data (replace UUIDs with existing rows)
-- =====================================================
-- INSERT INTO public.therapy_session_metrics (
--   child_id, therapist_id, session_id, session_date, session_duration_minutes, therapy_type,
--   eye_contact_score, social_engagement_score, emotional_regulation_score,
--   attention_span_score, communication_score, session_engagement_score,
--   response_latency_seconds, gesture_frequency, attention_span_seconds,
--   cv_model_version, cv_confidence_score
-- ) VALUES
-- ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',NULL,NOW() - INTERVAL '14 day',45,'speech',0.42,0.38,0.46,0.35,0.31,0.40,2.80,3,220,'cv-v2.1',0.93),
-- ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',NULL,NOW() - INTERVAL '10 day',45,'speech',0.49,0.44,0.52,0.40,0.37,0.47,2.35,4,260,'cv-v2.1',0.94),
-- ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',NULL,NOW() - INTERVAL '6 day',45,'speech',0.56,0.51,0.58,0.47,0.45,0.55,2.01,5,295,'cv-v2.1',0.95),
-- ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',NULL,NOW() - INTERVAL '2 day',45,'speech',0.63,0.58,0.62,0.53,0.50,0.61,1.84,6,325,'cv-v2.1',0.95);
