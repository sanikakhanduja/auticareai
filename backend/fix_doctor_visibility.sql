-- COMPREHENSIVE FIX: Ensure doctors only see their assigned patients

-- ===== STEP 1: Drop ALL existing doctor policies =====

-- Children table
DROP POLICY IF EXISTS "Doctors can view all children" ON public.children;
DROP POLICY IF EXISTS "Doctors can view assigned children" ON public.children;
DROP POLICY IF EXISTS "Doctors can update assigned children" ON public.children;

-- Reports table
DROP POLICY IF EXISTS "Professionals can view reports" ON public.reports;
DROP POLICY IF EXISTS "Doctors can view assigned children reports" ON public.reports;

-- Screening Results table
DROP POLICY IF EXISTS "Doctors can view all screening results" ON public.screening_results;
DROP POLICY IF EXISTS "Doctors can view assigned children screening results" ON public.screening_results;

-- ===== STEP 2: Create NEW restrictive policies =====

-- CHILDREN TABLE - Doctors can ONLY see their assigned children
CREATE POLICY "Doctors can only view assigned children" ON public.children
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND assigned_doctor_id = auth.uid()
  );

CREATE POLICY "Doctors can only update assigned children" ON public.children
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND assigned_doctor_id = auth.uid()
  );

-- REPORTS TABLE - Doctors can ONLY see reports for their assigned children
CREATE POLICY "Doctors can only view assigned children reports" ON public.reports
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = reports.child_id
        AND assigned_doctor_id = auth.uid()
    )
  );

-- SCREENING RESULTS TABLE - Doctors can ONLY see screening results for their assigned children
CREATE POLICY "Doctors can only view assigned children screening results" ON public.screening_results
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = screening_results.child_id
        AND assigned_doctor_id = auth.uid()
    )
  );

-- ===== STEP 3: Keep parent and therapist policies =====

-- Therapists can view children assigned to them
DROP POLICY IF EXISTS "Therapists can view assigned children" ON public.children;
CREATE POLICY "Therapists can view assigned children" ON public.children
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND assigned_therapist_id = auth.uid()
  );

-- Therapists can view screening results for assigned children
DROP POLICY IF EXISTS "Therapists can view assigned children screening results" ON public.screening_results;
CREATE POLICY "Therapists can view assigned children screening results" ON public.screening_results
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = screening_results.child_id
        AND assigned_therapist_id = auth.uid()
    )
  );

-- Professionals (doctors and therapists) can create reports for assigned children
DROP POLICY IF EXISTS "Professionals can create reports" ON public.reports;
CREATE POLICY "Professionals can create reports" ON public.reports
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    (
      (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
        AND EXISTS (
          SELECT 1 FROM public.children 
          WHERE id = reports.child_id AND assigned_doctor_id = auth.uid()
        )
      )
      OR
      (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
        AND EXISTS (
          SELECT 1 FROM public.children 
          WHERE id = reports.child_id AND assigned_therapist_id = auth.uid()
        )
      )
    )
  );

-- Therapists can view reports for assigned children
CREATE POLICY "Therapists can view assigned children reports" ON public.reports
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND EXISTS (
      SELECT 1
      FROM public.children
      WHERE id = reports.child_id
        AND assigned_therapist_id = auth.uid()
    )
  );

-- ===== STEP 4: Enforce 5 patient limit =====

-- Function to validate doctor patient limit (5 max)
CREATE OR REPLACE FUNCTION check_doctor_patient_limit()
RETURNS TRIGGER AS $$
DECLARE
  patient_count INT;
BEGIN
  -- Only check if a doctor is being assigned
  IF NEW.assigned_doctor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count patients already assigned to this doctor
  SELECT COUNT(*) INTO patient_count
  FROM public.children
  WHERE assigned_doctor_id = NEW.assigned_doctor_id
    AND id != NEW.id; -- Exclude current row
  
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
  BEFORE INSERT OR UPDATE ON public.children
  FOR EACH ROW
  WHEN (NEW.assigned_doctor_id IS NOT NULL)
  EXECUTE FUNCTION check_doctor_patient_limit();

-- ===== VERIFICATION QUERY =====
-- Run this after to verify policies are correct:
-- 
-- SELECT schemaname, tablename, policyname, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('children', 'reports', 'screening_results')
-- ORDER BY tablename, policyname;
