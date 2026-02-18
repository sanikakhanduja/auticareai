-- ===================================================
-- SUPABASE SETUP QUERIES FOR AUTICARE AI
-- ===================================================

-- 1. Set specific diagnosis status for test children
-- (Change child screening_status from 'not-started' to 'diagnosed')

-- Update Rahul Jain to diagnosed status (allows therapist selection)
UPDATE public.children 
SET screening_status = 'diagnosed' 
WHERE name = 'Rahul Jain' 
AND parent_id = (SELECT id FROM public.profiles WHERE email = 'parent@example.com');

-- Update Test Child to pending-review status (keeps therapist locked)
UPDATE public.children 
SET screening_status = 'pending-review' 
WHERE name = 'Test Child' 
AND parent_id = (SELECT id FROM public.profiles WHERE email = 'parent@example.com');

-- ===================================================
-- 2. Set Risk Levels for screening results
-- ===================================================

-- Add risk level to Rahul Jain
UPDATE public.children 
SET risk_level = 'medium'
WHERE name = 'Rahul Jain';

-- Add risk level to Test Child
UPDATE public.children 
SET risk_level = 'high'
WHERE name = 'Test Child';

-- ===================================================
-- 3. Verify child data (debugging query)
-- ===================================================

SELECT 
  id,
  name,
  screening_status,
  risk_level,
  assigned_doctor_id,
  assigned_therapist_id
FROM public.children
ORDER BY created_at DESC;

-- ===================================================
-- 4. Create screening results for Rahul Jain (diagnosed)
-- ===================================================

INSERT INTO public.screening_results (
  child_id,
  risk_level,
  indicators,
  cv_report,
  video_url,
  answers,
  created_at
) 
SELECT 
  children.id,
  'medium',
  '["eye_contact_below_baseline", "social_engagement_reduced"]'::jsonb,
  '{
    "risk_assessment": {
      "level": "Medium Risk",
      "confidence": 0.65,
      "description": "Moderate developmental concerns detected"
    },
    "metrics": {
      "objective_signals": {
        "eye_contact_duration": {"value": "55%", "baseline": "75%", "status": "below_baseline"},
        "social_gaze": {"value": "50%", "baseline": "60%", "status": "below_baseline"}
      }
    }
  }'::jsonb,
  'rahul_jain_screening.mp4',
  '{
    "q1": "Sometimes",
    "q2": "Rarely",
    "q3": "Sometimes",
    "q4": "Rarely",
    "q5": "Always"
  }'::jsonb,
  NOW() - INTERVAL '30 days'
FROM public.children
WHERE name = 'Rahul Jain'
ON CONFLICT DO NOTHING;

-- ===================================================
-- 5. Create diagnostic report for Rahul Jain (diagnosed)
-- ===================================================

INSERT INTO public.reports (
  child_id,
  author_id,
  type,
  content,
  created_at
)
SELECT 
  c.id,
  p.id,
  'diagnostic',
  '{
    "doctorNotes": "Clinical assessment indicates moderate developmental delays in social engagement and communication.",
    "screeningSummary": "Screening results suggest developmental concerns requiring therapeutic intervention.",
    "diagnosisConfirmation": "Confirmed developmental delays - ASD-related patterns observed",
    "developmentalGaps": ["social_skills", "communication"],
    "therapyRecommendations": ["speech_therapy", "social_skills_training", "motor_development"]
  }'::jsonb,
  NOW() - INTERVAL '20 days'
FROM public.children c
CROSS JOIN public.profiles p
WHERE c.name = 'Rahul Jain'
AND p.role = 'doctor'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ===================================================
-- 6. Assign a doctor to Rahul Jain
-- ===================================================

UPDATE public.children
SET assigned_doctor_id = (
  SELECT id FROM public.profiles 
  WHERE role = 'doctor' 
  LIMIT 1
)
WHERE name = 'Rahul Jain';

-- ===================================================
-- 7. Get all children with their diagnosis status
-- ===================================================

SELECT 
  c.id,
  c.name,
  c.screening_status,
  c.risk_level,
  p.full_name as parent_name,
  d.full_name as doctor_name,
  t.full_name as therapist_name
FROM public.children c
LEFT JOIN public.profiles p ON c.parent_id = p.id
LEFT JOIN public.profiles d ON c.assigned_doctor_id = d.id
LEFT JOIN public.profiles t ON c.assigned_therapist_id = t.id
ORDER BY c.created_at DESC;

-- ===================================================
-- 8. Verify screening results exist
-- ===================================================

SELECT 
  sr.id,
  sr.child_id,
  c.name,
  sr.risk_level,
  sr.created_at
FROM public.screening_results sr
LEFT JOIN public.children c ON sr.child_id = c.id
ORDER BY sr.created_at DESC;

-- ===================================================
-- 9. Get reports for a specific child (by child ID)
-- ===================================================
-- TEMPLATE: Replace 'CHILD_ID_HERE' with actual child UUID before running
-- SELECT 
--   r.id,
--   r.type,
--   r.content,
--   r.created_at,
--   p.full_name as doctor_name
-- FROM public.reports r
-- LEFT JOIN public.profiles p ON r.author_id = p.id
-- WHERE r.child_id = 'CHILD_ID_HERE'
-- ORDER BY r.created_at DESC;

-- ===================================================
-- 10. Update child diagnosis status (manual update)
-- ===================================================
-- TEMPLATE: Replace 'CHILD_ID_HERE' with actual child UUID before running
-- UPDATE public.children
-- SET 
--   screening_status = 'diagnosed',
--   risk_level = 'medium'
-- WHERE id = 'CHILD_ID_HERE';

-- ===================================================
-- IMPORTANT NOTES:
-- ===================================================
-- 1. Replace 'CHILD_ID_HERE' with actual UUID from children table
-- 2. Make sure profiles exist with role='doctor' and role='therapist'
-- 3. The screening_status must be exactly: 'diagnosed' for therapists to be unlocked
-- 4. For first screening: show questionnaire
-- 5. For follow-up screening: skip questionnaire (hasPriorScreening check)
-- 6. Session persistence is handled by AuthProvider (frontend)
-- 7. Child selection is persisted in localStorage via setSelectedChildId
