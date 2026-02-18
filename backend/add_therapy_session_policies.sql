-- Add RLS policies for therapy_sessions table

-- Therapists can create sessions for children assigned to them
DROP POLICY IF EXISTS "Therapists can create sessions" ON public.therapy_sessions;
CREATE POLICY "Therapists can create sessions" ON public.therapy_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = therapist_id AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND EXISTS (
      SELECT 1 FROM public.children 
      WHERE id = therapy_sessions.child_id 
      AND assigned_therapist_id = auth.uid()
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
      WHERE id = therapy_sessions.child_id 
      AND parent_id = auth.uid()
    )
  );
