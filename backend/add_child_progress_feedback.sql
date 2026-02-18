-- Add child progress feedback table and soft-delete support for children

-- Soft-delete flag for children
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Progress feedback from therapist after a session
CREATE TABLE IF NOT EXISTS public.child_progress_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  progress_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS child_progress_feedback_child_idx ON public.child_progress_feedback(child_id);
CREATE INDEX IF NOT EXISTS child_progress_feedback_parent_idx ON public.child_progress_feedback(parent_id);
CREATE INDEX IF NOT EXISTS child_progress_feedback_therapist_idx ON public.child_progress_feedback(therapist_id);

ALTER TABLE public.child_progress_feedback ENABLE ROW LEVEL SECURITY;

-- Therapists can insert feedback for assigned children
DROP POLICY IF EXISTS "Therapists can insert child progress feedback" ON public.child_progress_feedback;
CREATE POLICY "Therapists can insert child progress feedback" ON public.child_progress_feedback
  FOR INSERT WITH CHECK (
    auth.uid() = therapist_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = child_id
        AND children.assigned_therapist_id = auth.uid()
    )
  );

-- Therapists can view feedback they wrote
DROP POLICY IF EXISTS "Therapists can view own child feedback" ON public.child_progress_feedback;
CREATE POLICY "Therapists can view own child feedback" ON public.child_progress_feedback
  FOR SELECT USING (
    auth.uid() = therapist_id
  );

-- Parents can view feedback for their children
DROP POLICY IF EXISTS "Parents can view child progress feedback" ON public.child_progress_feedback;
CREATE POLICY "Parents can view child progress feedback" ON public.child_progress_feedback
  FOR SELECT USING (
    auth.uid() = parent_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
  );
