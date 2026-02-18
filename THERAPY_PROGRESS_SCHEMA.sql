-- =====================================================
-- THERAPY PROGRESS TRACKING SCHEMA - PRODUCTION GRADE
-- =====================================================
-- Architecture: Structured metrics + computed analytics + alerts
-- NO raw reports - ONLY numeric metrics with timestamps
-- =====================================================

-- =====================================================
-- 1. THERAPY SESSION METRICS TABLE
-- Stores structured numeric metrics from CV model
-- =====================================================

CREATE TABLE IF NOT EXISTS public.therapy_session_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Foreign Keys
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id) NOT NULL,
  session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  
  -- Session Metadata
  session_date TIMESTAMP WITH TIME ZONE NOT NULL,
  session_duration_minutes INTEGER NOT NULL,
  therapy_type TEXT CHECK (therapy_type IN ('speech', 'motor', 'social', 'behavioral')) NOT NULL,
  
  -- Structured Numeric Metrics (0.0 - 1.0 scale)
  eye_contact_score NUMERIC(4, 3) CHECK (eye_contact_score >= 0 AND eye_contact_score <= 1),
  social_engagement_score NUMERIC(4, 3) CHECK (social_engagement_score >= 0 AND social_engagement_score <= 1),
  emotional_regulation_score NUMERIC(4, 3) CHECK (emotional_regulation_score >= 0 AND emotional_regulation_score <= 1),
  attention_span_score NUMERIC(4, 3) CHECK (attention_span_score >= 0 AND attention_span_score <= 1),
  communication_score NUMERIC(4, 3) CHECK (communication_score >= 0 AND communication_score <= 1),
  motor_coordination_score NUMERIC(4, 3) CHECK (motor_coordination_score >= 0 AND motor_coordination_score <= 1),
  
  -- Raw Metrics (actual measurements)
  response_latency_seconds NUMERIC(6, 2), -- How long to respond to prompts
  gesture_frequency INTEGER, -- Number of gestures in session
  verbal_utterances INTEGER, -- Number of words/sounds
  attention_span_seconds INTEGER, -- Sustained attention duration
  meltdown_count INTEGER DEFAULT 0, -- Number of meltdowns
  positive_interactions INTEGER, -- Number of positive social interactions
  
  -- Session Engagement
  session_engagement_score NUMERIC(4, 3) CHECK (session_engagement_score >= 0 AND session_engagement_score <= 1),
  cooperation_level TEXT CHECK (cooperation_level IN ('low', 'medium', 'high')),
  
  -- CV Model Metadata
  cv_model_version TEXT,
  cv_confidence_score NUMERIC(4, 3), -- Confidence of CV analysis (0-1)
  video_quality_score NUMERIC(4, 3), -- Quality of input video (0-1)
  
  -- Additional Context (optional structured data)
  notes JSONB, -- Therapist notes in structured format
  environmental_factors JSONB, -- Distractions, noise level, etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Indexes for efficient queries
  CONSTRAINT valid_scores CHECK (
    eye_contact_score IS NOT NULL OR 
    social_engagement_score IS NOT NULL OR 
    session_engagement_score IS NOT NULL
  )
);

-- Indexes for performance
CREATE INDEX idx_therapy_metrics_child_date ON therapy_session_metrics(child_id, session_date DESC);
CREATE INDEX idx_therapy_metrics_therapist ON therapy_session_metrics(therapist_id);
CREATE INDEX idx_therapy_metrics_type ON therapy_session_metrics(therapy_type);
CREATE INDEX idx_therapy_metrics_created ON therapy_session_metrics(created_at DESC);

-- =====================================================
-- 2. PROGRESS ANALYTICS TABLE (Pre-computed)
-- Stores computed analytics to avoid recalculation
-- Updated whenever new session is added
-- =====================================================

CREATE TABLE IF NOT EXISTS public.progress_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapy_type TEXT CHECK (therapy_type IN ('speech', 'motor', 'social', 'behavioral')) NOT NULL,
  
  -- Computed Metrics (last 30 days)
  total_sessions INTEGER DEFAULT 0,
  average_eye_contact NUMERIC(4, 3),
  average_social_engagement NUMERIC(4, 3),
  average_emotional_regulation NUMERIC(4, 3),
  average_attention_span NUMERIC(4, 3),
  average_communication NUMERIC(4, 3),
  average_motor_coordination NUMERIC(4, 3),
  average_session_engagement NUMERIC(4, 3),
  
  -- Trend Analysis
  eye_contact_trend TEXT CHECK (eye_contact_trend IN ('improving', 'stable', 'regressing')),
  social_engagement_trend TEXT CHECK (social_engagement_trend IN ('improving', 'stable', 'regressing')),
  emotional_regulation_trend TEXT CHECK (emotional_regulation_trend IN ('improving', 'stable', 'regressing')),
  overall_trend TEXT CHECK (overall_trend IN ('improving', 'stable', 'regressing')),
  
  -- Change Metrics (compared to previous period)
  eye_contact_change_pct NUMERIC(6, 2), -- % change
  social_engagement_change_pct NUMERIC(6, 2),
  emotional_regulation_change_pct NUMERIC(6, 2),
  overall_improvement_pct NUMERIC(6, 2),
  
  -- Statistical Metrics
  consistency_score NUMERIC(4, 3), -- Standard deviation (lower = more consistent)
  best_performing_metric TEXT, -- Which metric is strongest
  needs_attention_metric TEXT, -- Which metric needs work
  
  -- Regression Flags
  has_regression BOOLEAN DEFAULT FALSE,
  regression_metrics TEXT[], -- Array of metrics showing regression
  stagnation_count INTEGER DEFAULT 0, -- Number of consecutive sessions with no improvement
  
  -- Time Windows
  last_session_date TIMESTAMP WITH TIME ZONE,
  analysis_period_start TIMESTAMP WITH TIME ZONE,
  analysis_period_end TIMESTAMP WITH TIME ZONE,
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure one analytics record per child per therapy type
  UNIQUE(child_id, therapy_type)
);

-- Indexes
CREATE INDEX idx_progress_analytics_child ON progress_analytics(child_id);
CREATE INDEX idx_progress_analytics_regression ON progress_analytics(has_regression) WHERE has_regression = TRUE;
CREATE INDEX idx_progress_analytics_stagnation ON progress_analytics(stagnation_count) WHERE stagnation_count >= 3;

-- =====================================================
-- 3. PROGRESS ALERTS TABLE
-- Stores alerts for regression, stagnation, milestones
-- =====================================================

CREATE TABLE IF NOT EXISTS public.progress_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id),
  doctor_id UUID REFERENCES public.profiles(id),
  
  alert_type TEXT CHECK (alert_type IN ('regression', 'stagnation', 'milestone', 'urgent')) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Affected Metrics
  affected_metrics TEXT[],
  metric_values JSONB, -- Current values of affected metrics
  
  -- Alert Status
  status TEXT CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')) DEFAULT 'active',
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Actions Taken
  action_taken TEXT,
  action_notes JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_progress_alerts_child ON progress_alerts(child_id);
CREATE INDEX idx_progress_alerts_status ON progress_alerts(status) WHERE status = 'active';
CREATE INDEX idx_progress_alerts_type ON progress_alerts(alert_type);
CREATE INDEX idx_progress_alerts_severity ON progress_alerts(severity) WHERE severity IN ('high', 'critical');
CREATE INDEX idx_progress_alerts_therapist ON progress_alerts(therapist_id) WHERE therapist_id IS NOT NULL;
CREATE INDEX idx_progress_alerts_doctor ON progress_alerts(doctor_id) WHERE doctor_id IS NOT NULL;

-- =====================================================
-- 4. MILESTONE TRACKING TABLE
-- Track when children hit important milestones
-- =====================================================

CREATE TABLE IF NOT EXISTS public.therapy_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id) NOT NULL,
  
  milestone_type TEXT NOT NULL, -- e.g., "first_eye_contact", "consistent_attention", etc.
  milestone_description TEXT NOT NULL,
  
  metric_name TEXT NOT NULL, -- Which metric achieved milestone
  threshold_value NUMERIC(4, 3), -- Value that triggered milestone
  achieved_value NUMERIC(4, 3), -- Actual value achieved
  
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  session_id UUID REFERENCES public.therapy_session_metrics(id),
  
  celebrated BOOLEAN DEFAULT FALSE, -- Whether parent was notified
  celebration_sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_milestones_child ON therapy_milestones(child_id, achieved_at DESC);
CREATE INDEX idx_milestones_uncelebrated ON therapy_milestones(celebrated) WHERE celebrated = FALSE;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE public.therapy_session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_milestones ENABLE ROW LEVEL SECURITY;

-- Therapy Session Metrics Policies
CREATE POLICY "Therapists can insert metrics for their sessions"
  ON public.therapy_session_metrics FOR INSERT
  WITH CHECK (auth.uid() = therapist_id);

CREATE POLICY "Therapists can view metrics for their assigned children"
  ON public.therapy_session_metrics FOR SELECT
  USING (
    therapist_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = therapy_session_metrics.child_id
      AND children.assigned_therapist_id = auth.uid()
    )
  );

CREATE POLICY "Parents can view metrics for their children"
  ON public.therapy_session_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = therapy_session_metrics.child_id
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view all metrics"
  ON public.therapy_session_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- Progress Analytics Policies
CREATE POLICY "All authenticated users can view analytics"
  ON public.progress_analytics FOR SELECT
  USING (
    -- Parent can view their children
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = progress_analytics.child_id
      AND children.parent_id = auth.uid()
    )
    OR
    -- Therapist can view assigned children
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = progress_analytics.child_id
      AND children.assigned_therapist_id = auth.uid()
    )
    OR
    -- Doctor can view all
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'doctor'
    )
  );

-- Progress Alerts Policies
CREATE POLICY "Users can view alerts for their role"
  ON public.progress_alerts FOR SELECT
  USING (
    -- Parent sees their children's alerts
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = progress_alerts.child_id
      AND children.parent_id = auth.uid()
    )
    OR
    -- Therapist sees alerts assigned to them
    therapist_id = auth.uid()
    OR
    -- Doctor sees alerts assigned to them
    doctor_id = auth.uid()
  );

CREATE POLICY "Therapists and doctors can acknowledge alerts"
  ON public.progress_alerts FOR UPDATE
  USING (
    therapist_id = auth.uid() OR doctor_id = auth.uid()
  );

-- Milestones Policies
CREATE POLICY "Everyone can view milestones"
  ON public.therapy_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = therapy_milestones.child_id
      AND (
        children.parent_id = auth.uid() OR
        children.assigned_therapist_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'doctor'
        )
      )
    )
  );

-- =====================================================
-- 6. HELPER VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Latest session metrics per child
CREATE OR REPLACE VIEW latest_session_metrics AS
SELECT DISTINCT ON (child_id, therapy_type)
  *
FROM therapy_session_metrics
ORDER BY child_id, therapy_type, session_date DESC;

-- View: Active alerts summary
CREATE OR REPLACE VIEW active_alerts_summary AS
SELECT 
  child_id,
  alert_type,
  severity,
  COUNT(*) as alert_count,
  MAX(created_at) as latest_alert
FROM progress_alerts
WHERE status = 'active'
GROUP BY child_id, alert_type, severity;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. All scores are 0.0 - 1.0 scale for consistency
-- 2. Metrics are extracted from CV model output (NO raw text)
-- 3. Analytics are pre-computed and cached
-- 4. Alerts are generated automatically by backend
-- 5. RLS ensures proper data isolation
-- 6. Indexes optimize for time-series queries
-- 7. JSONB fields allow flexibility without schema changes
-- 8. Milestones celebrate child progress automatically
