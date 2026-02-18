-- Add requested_doctor_id column to second_opinion_requests table
-- This tracks which doctor is being requested for the second opinion

ALTER TABLE public.second_opinion_requests
ADD COLUMN requested_doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_second_opinion_requested_doctor ON public.second_opinion_requests(requested_doctor_id);

-- Update RLS policy for doctors to see second opinions requested of them
DROP POLICY IF EXISTS "Doctors can view second opinion requests" ON public.second_opinion_requests;

CREATE POLICY "Doctors can view second opinion requests" ON public.second_opinion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.children
      WHERE children.id = second_opinion_requests.child_id
      AND children.assigned_doctor_id = auth.uid()
    )
    OR requested_doctor_id = auth.uid()
  );

-- Update policy for doctors to update second opinion requests they're assigned to
DROP POLICY IF EXISTS "Doctors can update second opinion requests" ON public.second_opinion_requests;

CREATE POLICY "Doctors can update second opinion requests" ON public.second_opinion_requests
  FOR UPDATE USING (
    requested_doctor_id = auth.uid()
  );
