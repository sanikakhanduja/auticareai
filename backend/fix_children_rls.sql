-- Fix RLS policies for children table to ensure proper data isolation

-- Enable RLS on children table
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies for children table
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;
DROP POLICY IF EXISTS "Parents can insert own children" ON public.children;
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;
DROP POLICY IF EXISTS "Doctors can view all children" ON public.children;
DROP POLICY IF EXISTS "Doctors can update assigned children" ON public.children;
DROP POLICY IF EXISTS "Therapists can view assigned children" ON public.children;
DROP POLICY IF EXISTS "Therapists can view diagnosed children" ON public.children;
DROP POLICY IF EXISTS "Therapists can update assigned children" ON public.children;
DROP POLICY IF EXISTS "Doctors can only update assigned children" ON public.children;
DROP POLICY IF EXISTS "Therapists can only view assigned children" ON public.children;

-- Parents can ONLY view their own children
CREATE POLICY "Parents can view own children" ON public.children
  FOR SELECT USING (
    auth.uid() = parent_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
  );

-- Parents can insert their own children
CREATE POLICY "Parents can insert own children" ON public.children
  FOR INSERT WITH CHECK (
    auth.uid() = parent_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
  );

-- Parents can update their own children only
CREATE POLICY "Parents can update own children" ON public.children
  FOR UPDATE USING (
    auth.uid() = parent_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'parent'
  );

-- Doctors can view all children (for diagnosis and patient management)
CREATE POLICY "Doctors can view all children" ON public.children
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
  );

-- Doctors can update children assigned to them
CREATE POLICY "Doctors can update assigned children" ON public.children
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'doctor'
    AND auth.uid() = assigned_doctor_id
  );

-- Therapists can view children assigned to them
CREATE POLICY "Therapists can view assigned children" ON public.children
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND auth.uid() = assigned_therapist_id
  );

-- Therapists can update children assigned to them (e.g., session notes)
CREATE POLICY "Therapists can update assigned children" ON public.children
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'therapist'
    AND auth.uid() = assigned_therapist_id
  );
