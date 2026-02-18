-- ============================================================
-- COPY & PASTE SQL FOR SUPABASE
-- Go to: Supabase Dashboard → SQL Editor → Paste these
-- ============================================================

-- TEST: Verify your current children
SELECT id, name, screening_status, risk_level FROM public.children ORDER BY created_at DESC;

-- ============================================================
-- UPDATE 1: Set Rahul Jain to DIAGNOSED (therapists unlocked)
-- ============================================================
UPDATE public.children 
SET screening_status = 'diagnosed' 
WHERE name = 'Rahul Jain';

-- ============================================================
-- UPDATE 2: Set Test Child to PENDING-REVIEW (therapists locked)
-- ============================================================
UPDATE public.children 
SET screening_status = 'pending-review' 
WHERE name = 'Test Child';

-- ============================================================
-- UPDATE 3: Set risk levels
-- ============================================================
UPDATE public.children SET risk_level = 'medium' WHERE name = 'Rahul Jain';
UPDATE public.children SET risk_level = 'high' WHERE name = 'Test Child';

-- ============================================================
-- VERIFY: Check that changes took effect
-- ============================================================
SELECT 
  id,
  name,
  screening_status,
  risk_level
FROM public.children
WHERE name IN ('Rahul Jain', 'Test Child')
ORDER BY created_at DESC;

-- ============================================================
-- OPTIONAL: Create screening result for Rahul Jain
-- (This creates progress chart data)
-- ============================================================
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
  c.id,
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
        "eye_contact_duration": {
          "value": "55%",
          "baseline": "75%",
          "status": "below_baseline"
        },
        "social_gaze": {
          "value": "50%",
          "baseline": "60%",
          "status": "below_baseline"
        },
        "gesture_frequency": {
          "value": "8/min",
          "baseline": "6/min",
          "status": "above_baseline"
        }
      },
      "behavioral_indicators": {
        "eye_gaze_patterns": true,
        "social_engagement": true,
        "environmental_response": false
      }
    }
  }'::jsonb,
  'rahul_jain_screening_' || to_char(NOW(), 'YYYYMMDD') || '.mp4',
  '{
    "q1": "Sometimes",
    "q2": "Rarely",
    "q3": "Sometimes",
    "q4": "Rarely",
    "q5": "Always"
  }'::jsonb,
  NOW() - INTERVAL '30 days'
FROM public.children c
WHERE c.name = 'Rahul Jain'
ON CONFLICT DO NOTHING;

-- ============================================================
-- OPTIONAL: Create diagnostic report for Rahul Jain
-- (This makes him appear as "diagnosed")
-- ============================================================
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
    "doctorNotes": "Clinical assessment indicates moderate developmental delays in social engagement and communication. Recommend therapeutic intervention.",
    "screeningSummary": "Screening results suggest significant developmental concerns requiring speech and occupational therapy.",
    "diagnosisConfirmation": "Confirmed developmental delays with ASD-related patterns observed",
    "developmentalGaps": ["social_skills", "communication", "motor_coordination"],
    "therapyRecommendations": ["speech_therapy", "social_skills_training", "occupational_therapy"]
  }'::jsonb,
  NOW() - INTERVAL '20 days'
FROM public.children c
CROSS JOIN public.profiles p
WHERE c.name = 'Rahul Jain'
AND p.role = 'doctor'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================
-- OPTIONAL: Assign a doctor to Rahul Jain
-- ============================================================
UPDATE public.children c
SET assigned_doctor_id = (
  SELECT id FROM public.profiles 
  WHERE role = 'doctor' 
  LIMIT 1
)
WHERE c.name = 'Rahul Jain'
AND c.assigned_doctor_id IS NULL;

-- ============================================================
-- FINAL VERIFICATION: See complete child data
-- ============================================================
SELECT 
  c.id,
  c.name,
  c.screening_status,
  c.risk_level,
  c.assigned_doctor_id,
  c.assigned_therapist_id,
  p.full_name as parent_name
FROM public.children c
LEFT JOIN public.profiles p ON c.parent_id = p.id
ORDER BY c.created_at DESC;

-- ============================================================
-- DEBUG: Check if screening results exist
-- ============================================================
SELECT 
  sr.id,
  c.name,
  sr.risk_level,
  sr.created_at
FROM public.screening_results sr
LEFT JOIN public.children c ON sr.child_id = c.id
ORDER BY sr.created_at DESC;

-- ============================================================
-- DEBUG: Check if reports exist
-- ============================================================
SELECT 
  r.id,
  c.name,
  r.type,
  r.created_at,
  dr.full_name as doctor_name
FROM public.reports r
LEFT JOIN public.children c ON r.child_id = c.id
LEFT JOIN public.profiles dr ON r.author_id = dr.id
ORDER BY r.created_at DESC;

-- ============================================================
-- RESET (if you need to undo): Set back to original
-- ============================================================
-- Uncomment below if needed to reset
-- UPDATE public.children SET screening_status = 'not-started' WHERE name = 'Rahul Jain';
-- UPDATE public.children SET screening_status = 'not-started' WHERE name = 'Test Child';
-- UPDATE public.children SET risk_level = NULL WHERE name IN ('Rahul Jain', 'Test Child');
-- DELETE FROM public.screening_results WHERE child_id IN (SELECT id FROM public.children WHERE name = 'Rahul Jain');
-- DELETE FROM public.reports WHERE child_id IN (SELECT id FROM public.children WHERE name = 'Rahul Jain');
