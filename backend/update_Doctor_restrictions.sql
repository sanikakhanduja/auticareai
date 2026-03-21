-- Update RLS Policies for Doctor Restrictions

-- Drop existing policies that allow doctors to see all children/reports
DROP POLICY IF EXISTS "Doctors can view all children" ON public.children;
DROP POLICY IF EXISTS "Doctors can view all screening results" ON public.screening_results;

-- Doctors can only view their assigned children
CREATE POLICY "Doctors can view assigned children" ON public.children
  FOR SELECT USING (
    assigned_doctor_id = auth.uid()
  );

-- Doctors can update their assigned children
CREATE POLICY "Doctors can update assigned children" ON public.children
  FOR UPDATE USING (
    assigned_doctor_id = auth.uid()
  );

-- Doctors can only view reports for their assigned children
CREATE POLICY "Doctors can view assigned children reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = child_id
        AND assigned_doctor_id = auth.uid()
    )
  );

-- Doctors can only view screening results for their assigned children
CREATE POLICY "Doctors can view assigned children screening results" ON public.screening_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = child_id
        AND assigned_doctor_id = auth.uid()
    )
  );

-- Add function to validate doctor patient limit (5 max)
CREATE OR REPLACE FUNCTION check_doctor_patient_limit()
RETURNS TRIGGER AS $$
DECLARE
  patient_count INT;
BEGIN
  -- Count patients already assigned to this doctor
  SELECT COUNT(*) INTO patient_count
  FROM public.children
  WHERE assigned_doctor_id = NEW.assigned_doctor_id;
  
  -- Raise error if doctor already has 5 patients
  IF patient_count >= 5 THEN
    RAISE EXCEPTION 'Doctor has reached maximum patient limit of 5';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce doctor patient limit
DROP TRIGGER IF EXISTS enforce_doctor_patient_limit ON public.children;
CREATE TRIGGER enforce_doctor_patient_limit
  BEFORE UPDATE ON public.children
  FOR EACH ROW
  WHEN (NEW.assigned_doctor_id IS DISTINCT FROM OLD.assigned_doctor_id AND NEW.assigned_doctor_id IS NOT NULL)
  EXECUTE FUNCTION check_doctor_patient_limit();
