-- Stores generated progress inference history per child.
-- Run this once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.progress_inference_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  therapy_type TEXT CHECK (therapy_type IN ('speech', 'motor', 'social', 'behavioral')) NOT NULL,
  role TEXT CHECK (role IN ('parent', 'therapist', 'doctor')) NOT NULL,
  summary TEXT NOT NULL,
  source_report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  previous_inference_id UUID REFERENCES public.progress_inference_history(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_inference_child_type_role_created
  ON public.progress_inference_history(child_id, therapy_type, role, created_at DESC);

-- Prevent duplicate inferences for the same child/therapy/role/report.
CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_inference_per_report
  ON public.progress_inference_history(child_id, therapy_type, role, source_report_id)
  WHERE source_report_id IS NOT NULL;

ALTER TABLE public.progress_inference_history ENABLE ROW LEVEL SECURITY;

-- Parent can view inferences for their children
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'progress_inference_history'
      AND policyname = 'Parents can view own child inferences'
  ) THEN
    CREATE POLICY "Parents can view own child inferences"
      ON public.progress_inference_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.children
          WHERE children.id = progress_inference_history.child_id
            AND children.parent_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Professionals can view inferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'progress_inference_history'
      AND policyname = 'Professionals can view inferences'
  ) THEN
    CREATE POLICY "Professionals can view inferences"
      ON public.progress_inference_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('doctor', 'therapist')
        )
      );
  END IF;
END $$;

-- Professionals can insert inferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'progress_inference_history'
      AND policyname = 'Professionals can insert inferences'
  ) THEN
    CREATE POLICY "Professionals can insert inferences"
      ON public.progress_inference_history
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role IN ('doctor', 'therapist')
        )
      );
  END IF;
END $$;
