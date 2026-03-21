-- COMBINED FIX: Add RLS policies for therapy_sessions, notifications, and therapist_feedback

-- ===== ENABLE ROW LEVEL SECURITY =====
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_feedback ENABLE ROW LEVEL SECURITY;

-- ===== THERAPY SESSIONS POLICIES =====

-- Therapists can create sessions for children assigned to them
DROP POLICY IF EXISTS "Therapists can create sessions" ON public.therapy_sessions;
CREATE POLICY "Therapists can create sessions" ON public.therapy_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = therapist_id AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND EXISTS (
      SELECT 1 FROM public.children 
      WHERE children.id = child_id 
      AND children.assigned_therapist_id = auth.uid()
    )
  );

-- Therapists can view their own sessions
DROP POLICY IF EXISTS "Therapists can view own sessions" ON public.therapy_sessions;
CREATE POLICY "Therapists can view own sessions" ON public.therapy_sessions
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND therapist_id = auth.uid()
  );

-- Therapists can update their own sessions
DROP POLICY IF EXISTS "Therapists can update own sessions" ON public.therapy_sessions;
CREATE POLICY "Therapists can update own sessions" ON public.therapy_sessions
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND therapist_id = auth.uid()
  );

-- Parents can view sessions for their children
DROP POLICY IF EXISTS "Parents can view children sessions" ON public.therapy_sessions;
CREATE POLICY "Parents can view children sessions" ON public.therapy_sessions
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
    AND EXISTS (
      SELECT 1 FROM public.children 
      WHERE children.id = child_id 
      AND children.parent_id = auth.uid()
    )
  );

-- ===== NOTIFICATIONS POLICIES =====

-- Therapists and doctors can create notifications for parents
DROP POLICY IF EXISTS "Professionals can create notifications" ON public.notifications;
CREATE POLICY "Professionals can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('therapist', 'doctor')
    )
  );

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- ===== THERAPIST FEEDBACK POLICIES =====

-- Parents can submit feedback for their children's therapists
DROP POLICY IF EXISTS "Parents can submit feedback for their children" ON public.therapist_feedback;
CREATE POLICY "Parents can submit feedback for their children" ON public.therapist_feedback
  FOR INSERT WITH CHECK (
    auth.uid() = parent_id AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
    AND EXISTS (
      SELECT 1
      FROM public.children
      WHERE children.id = child_id
        AND children.parent_id = auth.uid()
        AND children.assigned_therapist_id = therapist_id
    )
  );

-- Parents can view their own feedback
DROP POLICY IF EXISTS "Parents can view own feedback" ON public.therapist_feedback;
CREATE POLICY "Parents can view own feedback" ON public.therapist_feedback
  FOR SELECT USING (
    auth.uid() = parent_id
  );

-- Therapists can view feedback for themselves
DROP POLICY IF EXISTS "Therapists can view own feedback" ON public.therapist_feedback;
CREATE POLICY "Therapists can view own feedback" ON public.therapist_feedback
  FOR SELECT USING (
    auth.uid() = therapist_id
  );

