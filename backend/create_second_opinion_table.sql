-- Create second_opinion_requests table with all columns and policies

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.second_opinion_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requested_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('requested', 'in-review', 'completed')) DEFAULT 'requested',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.second_opinion_requests ENABLE ROW LEVEL SECURITY;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_second_opinion_requested_doctor ON public.second_opinion_requests(requested_doctor_id);
CREATE INDEX IF NOT EXISTS idx_second_opinion_child ON public.second_opinion_requests(child_id);
CREATE INDEX IF NOT EXISTS idx_second_opinion_parent ON public.second_opinion_requests(parent_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Parents can view second opinion requests" ON public.second_opinion_requests;
DROP POLICY IF EXISTS "Parents can request second opinion" ON public.second_opinion_requests;
DROP POLICY IF EXISTS "Doctors can view second opinion requests" ON public.second_opinion_requests;
DROP POLICY IF EXISTS "Doctors can update second opinion requests" ON public.second_opinion_requests;

-- Parents can view their own second opinion requests
CREATE POLICY "Parents can view second opinion requests" ON public.second_opinion_requests
  FOR SELECT USING (
    auth.uid() = parent_id
  );

-- Parents can create second opinion requests for their children
CREATE POLICY "Parents can request second opinion" ON public.second_opinion_requests
  FOR INSERT WITH CHECK (
    auth.uid() = parent_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
    AND EXISTS (
      SELECT 1
      FROM public.children
      WHERE children.id = child_id
      AND children.parent_id = auth.uid()
    )
  );

-- Doctors can view second opinions for children assigned to them or requested of them
CREATE POLICY "Doctors can view second opinion requests" ON public.second_opinion_requests
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND (
      EXISTS (
        SELECT 1 FROM public.children
        WHERE children.id = second_opinion_requests.child_id
        AND children.assigned_doctor_id = auth.uid()
      )
      OR requested_doctor_id = auth.uid()
    )
  );

-- Doctors can update second opinion requests they're assigned to
CREATE POLICY "Doctors can update second opinion requests" ON public.second_opinion_requests
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND requested_doctor_id = auth.uid()
  );
