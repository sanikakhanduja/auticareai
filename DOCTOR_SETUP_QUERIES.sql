-- ===================================================
-- DOCTOR SETUP & CAPACITY MANAGEMENT FOR AUTICARE AI
-- ===================================================

-- Step 1: Create 3 care doctors in profiles table
-- Each doctor can handle max 5 patients

INSERT INTO public.profiles (id, email, full_name, role, created_at)
VALUES 
  (gen_random_uuid(), 'doc1@auticare.com', 'Doc1', 'doctor', NOW()),
  (gen_random_uuid(), 'doc2@auticare.com', 'Doc2', 'doctor', NOW()),
  (gen_random_uuid(), 'doc3@auticare.com', 'Doc3', 'doctor', NOW())
ON CONFLICT (id) DO NOTHING;

-- ===================================================
-- Step 2: Create a table to track doctor-child assignments
-- This ensures we can track which doctor is assigned to which child
-- and enforce the 5-patient limit
-- ===================================================

CREATE TABLE IF NOT EXISTS public.child_doctor_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(child_id) -- Each child can only have one doctor assignment
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_child_doctor_assignments_child ON child_doctor_assignments(child_id);
CREATE INDEX IF NOT EXISTS idx_child_doctor_assignments_doctor ON child_doctor_assignments(doctor_id);

-- Enable RLS
ALTER TABLE public.child_doctor_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for child_doctor_assignments
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

-- ===================================================
-- Step 3: Create function to get doctors with their capacity
-- Returns: doctor_id, name, assigned_patients, max_patients, available
-- ===================================================

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_care_doctors_with_capacity() TO authenticated;

-- ===================================================
-- Step 4: Create function to assign doctor to child
-- Checks capacity before assignment
-- Returns success/error message
-- ===================================================

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
  -- Check if child belongs to current user
  SELECT parent_id INTO v_parent_id
  FROM public.children
  WHERE id = p_child_id;
  
  IF v_parent_id IS NULL OR v_parent_id != auth.uid() THEN
    RETURN QUERY SELECT FALSE, 'Child not found or access denied'::TEXT;
    RETURN;
  END IF;

  -- Check if doctor exists and is one of our care doctors
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_doctor_id 
    AND role = 'doctor'
    AND full_name IN ('Doc1', 'Doc2', 'Doc3')
  ) THEN
    RETURN QUERY SELECT FALSE, 'Invalid doctor selection'::TEXT;
    RETURN;
  END IF;

  -- Check current assignment
  SELECT doctor_id INTO v_existing_doctor
  FROM public.child_doctor_assignments
  WHERE child_id = p_child_id;

  -- If already assigned to same doctor, return success
  IF v_existing_doctor = p_doctor_id THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT;
    RETURN;
  END IF;

  -- Check doctor capacity
  SELECT COUNT(*) INTO v_current_patients
  FROM public.child_doctor_assignments
  WHERE doctor_id = p_doctor_id;

  IF v_current_patients >= v_max_patients THEN
    RETURN QUERY SELECT FALSE, 'Doctor is at full capacity (5/5 patients)'::TEXT;
    RETURN;
  END IF;

  -- Remove existing assignment if any
  DELETE FROM public.child_doctor_assignments
  WHERE child_id = p_child_id;

  -- Create new assignment
  INSERT INTO public.child_doctor_assignments (child_id, doctor_id)
  VALUES (p_child_id, p_doctor_id);

  -- Update child's assigned_doctor_id for backward compatibility
  UPDATE public.children
  SET assigned_doctor_id = p_doctor_id
  WHERE id = p_child_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_care_doctor_to_child(UUID, UUID) TO authenticated;

-- ===================================================
-- Step 5: Verification Queries
-- ===================================================

-- View all care doctors with capacity
SELECT * FROM get_care_doctors_with_capacity();

-- View all current assignments
SELECT 
  c.name AS child_name,
  p.full_name AS doctor_name,
  cda.assigned_at
FROM public.child_doctor_assignments cda
JOIN public.children c ON c.id = cda.child_id
JOIN public.profiles p ON p.id = cda.doctor_id
ORDER BY cda.assigned_at DESC;

-- Check specific doctor's patient count
SELECT 
  p.full_name AS doctor_name,
  COUNT(cda.child_id) AS current_patients,
  5 AS max_patients,
  (5 - COUNT(cda.child_id)) AS slots_remaining
FROM public.profiles p
LEFT JOIN public.child_doctor_assignments cda ON cda.doctor_id = p.id
WHERE p.role = 'doctor' 
  AND p.full_name IN ('Doc1', 'Doc2', 'Doc3')
GROUP BY p.id, p.full_name
ORDER BY p.full_name;

-- ===================================================
-- IMPORTANT NOTES:
-- ===================================================
-- 1. Each doctor (Doc1, Doc2, Doc3) can have max 5 patients
-- 2. child_doctor_assignments table tracks which child is assigned to which doctor
-- 3. get_care_doctors_with_capacity() returns live availability
-- 4. assign_care_doctor_to_child() validates capacity before assigning
-- 5. Doctor selection persists in database and survives page refresh
-- 6. When a doctor reaches 5 patients, they show as "unavailable"
-- 7. Parents can only assign doctors to their own children (RLS enforced)
