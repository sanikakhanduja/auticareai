-- =====================================================
-- QUICK SETUP: COPY AND PASTE INTO SUPABASE SQL EDITOR
-- =====================================================
-- This file sets up the doctor assignment system
-- Run these commands in order
-- =====================================================

-- Step 1: Create 3 care doctors
INSERT INTO public.profiles (id, email, full_name, role, created_at)
VALUES 
  (gen_random_uuid(), 'doc1@auticare.com', 'Doc1', 'doctor', NOW()),
  (gen_random_uuid(), 'doc2@auticare.com', 'Doc2', 'doctor', NOW()),
  (gen_random_uuid(), 'doc3@auticare.com', 'Doc3', 'doctor', NOW())
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create doctor-child assignment table
CREATE TABLE IF NOT EXISTS public.child_doctor_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(child_id)
);

CREATE INDEX IF NOT EXISTS idx_child_doctor_assignments_child ON child_doctor_assignments(child_id);
CREATE INDEX IF NOT EXISTS idx_child_doctor_assignments_doctor ON child_doctor_assignments(doctor_id);

ALTER TABLE public.child_doctor_assignments ENABLE ROW LEVEL SECURITY;

-- Step 3: RLS Policies
CREATE POLICY "Parents can view their children's doctor assignments" ON public.child_doctor_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.children 
      WHERE children.id = child_doctor_assignments.child_id 
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can assign doctors to their children" ON public.child_doctor_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.children 
      WHERE children.id = child_doctor_assignments.child_id 
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can update their children's doctor assignments" ON public.child_doctor_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.children 
      WHERE children.id = child_doctor_assignments.child_id 
      AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Doctors can view all assignments" ON public.child_doctor_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'doctor'
    )
  );

-- Step 4: Function to get doctors with capacity
CREATE OR REPLACE FUNCTION get_care_doctors_with_capacity()
RETURNS TABLE (
  id UUID,
  name TEXT,
  assigned_patients BIGINT,
  max_patients INTEGER,
  available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name AS name,
    COALESCE(COUNT(cda.child_id), 0) AS assigned_patients,
    5 AS max_patients,
    (COALESCE(COUNT(cda.child_id), 0) < 5) AS available
  FROM public.profiles p
  LEFT JOIN public.child_doctor_assignments cda ON cda.doctor_id = p.id
  WHERE p.role = 'doctor'
    AND p.full_name IN ('Doc1', 'Doc2', 'Doc3')
  GROUP BY p.id, p.full_name
  ORDER BY assigned_patients ASC, p.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_care_doctors_with_capacity() TO authenticated;

-- Step 5: Function to assign doctor to child
CREATE OR REPLACE FUNCTION assign_care_doctor_to_child(
  p_child_id UUID,
  p_doctor_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
) AS $$
DECLARE
  v_current_patients BIGINT;
  v_max_patients INTEGER := 5;
  v_parent_id UUID;
  v_existing_doctor UUID;
BEGIN
  SELECT parent_id INTO v_parent_id
  FROM public.children
  WHERE id = p_child_id;
  
  IF v_parent_id IS NULL OR v_parent_id != auth.uid() THEN
    RETURN QUERY SELECT FALSE, 'Child not found or access denied'::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_doctor_id 
    AND role = 'doctor'
    AND full_name IN ('Doc1', 'Doc2', 'Doc3')
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid doctor selection'::TEXT;
    RETURN;
  END IF;

  SELECT doctor_id INTO v_existing_doctor
  FROM public.child_doctor_assignments
  WHERE child_id = p_child_id;

  IF v_existing_doctor = p_doctor_id THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_current_patients
  FROM public.child_doctor_assignments
  WHERE doctor_id = p_doctor_id;

  IF v_current_patients >= v_max_patients THEN
    RETURN QUERY SELECT FALSE, 'Doctor is at full capacity (5/5 patients)'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.child_doctor_assignments
  WHERE child_id = p_child_id;

  INSERT INTO public.child_doctor_assignments (child_id, doctor_id)
  VALUES (p_child_id, p_doctor_id);

  UPDATE public.children
  SET assigned_doctor_id = p_doctor_id
  WHERE id = p_child_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION assign_care_doctor_to_child(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION: Run these to check setup
-- =====================================================

-- Check doctors created
SELECT id, full_name, email, role FROM public.profiles WHERE full_name IN ('Doc1', 'Doc2', 'Doc3');

-- Check doctor capacity (should show 0/5 initially)
SELECT * FROM get_care_doctors_with_capacity();

-- =====================================================
-- TEST DATA: Optional - Set follow-up date for testing
-- =====================================================

-- Example: Set follow-up date to future (upload will be locked)
-- UPDATE public.children
-- SET 
--   screening_status = 'under-observation',
--   observation_end_date = '2026-03-15'
-- WHERE name = 'Test Child';

-- Example: Set follow-up date to past (upload will be available)
-- UPDATE public.children
-- SET 
--   screening_status = 'under-observation',
--   observation_end_date = '2026-01-01'
-- WHERE name = 'Test Child';

-- =====================================================
-- DONE! 
-- Your doctor assignment system is now ready.
-- Refresh your frontend application to see changes.
-- =====================================================
