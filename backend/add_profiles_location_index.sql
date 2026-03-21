-- Speeds up provider lookup by role and location in parent search.
CREATE INDEX IF NOT EXISTS idx_profiles_role_state_district
ON public.profiles (role, state, district);
