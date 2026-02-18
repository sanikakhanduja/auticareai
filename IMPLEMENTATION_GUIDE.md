# AutiCare AI - Implementation Guide

## Issues Fixed

### 1. Session Persistence on Page Reload ✅

**Problem:** User was being signed out on every page reload.

**Solution:** 
- Created `AuthProvider.tsx` component that runs on app mount
- Uses `authService.getCurrentUser()` to check if there's an active Supabase session
- Automatically restores user data to the Zustand store if logged in
- Added to App.tsx root level so it runs before any routes render

**Files Modified:**
- `/frontend/src/pages/AuthProvider.tsx` (NEW)
- `/frontend/src/App.tsx` (added AuthProvider)

**How it works:**
1. App mounts
2. AuthProvider useEffect runs
3. Calls `authService.getCurrentUser()` which checks Supabase auth state
4. If user exists, populates store with user data
5. User remains logged in even after page refresh

---

### 2. Child Selection Dropdown Not Working ✅

**Problem:** The Select component wasn't working properly in FindProfessionals - it wasn't loading children initially.

**Solution:**
- Changed from using Zustand store children (which are in-memory) to fetching live data from Supabase
- Implemented proper loading state for the dropdown
- Use `useEffect` with proper dependency management
- Integrated with persisted `selectedChildId` from store

**Files Modified:**
- `/frontend/src/pages/parent/FindProfessionals.tsx`

**Changes:**
- Removed: `const { children, updateChild } = useAppStore();`
- Added: Fetch children from Supabase via `childrenService.getChildren()`
- Added: Proper loading states and error handling
- Added: Integration with persisted child selection

---

### 3. Therapist Lock/Unlock Based on Diagnosis Status ✅

**Problem:** Therapist section wasn't respecting the child's actual diagnosis status from the database.

**Solution:**
- Fetch live child data from Supabase instead of relying on client-side state
- Check `child.screeningStatus === "diagnosed"` to determine if therapists should be unlocked
- Live updates: Changes to diagnosis status immediately reflect in the UI
- Added async update capability when selecting therapists

**Files Modified:**
- `/frontend/src/pages/parent/FindProfessionals.tsx`

**How it works:**
1. Loads all children from Supabase on component mount
2. For each child:
   - If `screeningStatus === "diagnosed"` → Therapists UNLOCKED ✅
   - Otherwise → Therapists LOCKED 🔒
3. When child is selected via dropdown:
   - `handleChildChange()` updates persisted selection
   - UI immediately reflects the diagnosis status
   - Therapist section shows locked/unlocked accordingly

---

## Database Setup Instructions

Run the SQL queries in this order:

### Step 1: Set Child Diagnosis Status

```sql
-- Set Rahul Jain to DIAGNOSED (therapists unlocked)
UPDATE public.children 
SET screening_status = 'diagnosed' 
WHERE name = 'Rahul Jain';

-- Set Test Child to PENDING-REVIEW (therapists locked)
UPDATE public.children 
SET screening_status = 'pending-review' 
WHERE name = 'Test Child';
```

### Step 2: Set Risk Levels

```sql
UPDATE public.children 
SET risk_level = 'medium'
WHERE name = 'Rahul Jain';

UPDATE public.children 
SET risk_level = 'high'
WHERE name = 'Test Child';
```

### Step 3: Verify Current Status

```sql
SELECT 
  id,
  name,
  screening_status,
  risk_level,
  assigned_doctor_id,
  assigned_therapist_id
FROM public.children
ORDER BY created_at DESC;
```

### Step 4: Create Screening Results (Optional - for progress tracking)

```sql
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
      "confidence": 0.65
    }
  }'::jsonb,
  'screening_video.mp4',
  '{
    "q1": "Sometimes",
    "q2": "Rarely"
  }'::jsonb,
  NOW() - INTERVAL '30 days'
FROM public.children
WHERE name = 'Rahul Jain'
ON CONFLICT DO NOTHING;
```

### Step 5: Create Diagnostic Reports (Optional - for diagnosed children)

```sql
INSERT INTO public.reports (
  child_id,
  author_id,
  type,
  content,
  created_at
)
SELECT 
  children.id,
  (SELECT id FROM public.profiles WHERE role = 'doctor' LIMIT 1),
  'diagnostic',
  '{
    "doctorNotes": "Clinical assessment shows moderate developmental delays.",
    "screeningSummary": "Screening indicates ASD-related patterns.",
    "diagnosisConfirmation": "Confirmed developmental delays",
    "developmentalGaps": ["social_skills", "communication"],
    "therapyRecommendations": ["speech_therapy", "social_skills_training"]
  }'::jsonb,
  NOW() - INTERVAL '20 days'
FROM public.children
WHERE name = 'Rahul Jain'
ON CONFLICT DO NOTHING;
```

---

## Child Selection Persistence

### How it works:

1. **First Load:** Child selection stored in localStorage via `setSelectedChildId()`
2. **Navigation:** When navigating between pages:
   - ParentDashboard → ChildProfile: Child ID stored and passed as URL param
   - ChildProfile → Screening: Child ID passed as query param
   - Any page → FindProfessionals: Child ID restored from localStorage

3. **URL Parameters Take Priority:**
   - If `?childId=xxx` in URL, use that
   - Otherwise, check localStorage
   - Otherwise, use first child in list

### Files Involved:
- `store.ts` - `selectedChildId` + `setSelectedChildId()`
- `ParentDashboard.tsx` - sets child on card click
- `ChildrenList.tsx` - sets child on card click
- `ChildProfile.tsx` - sets and persists child
- `Screening.tsx` - uses persisted child
- `FindProfessionals.tsx` - uses persisted child
- `Progress.tsx` - uses persisted child

---

## Authentication Flow

### Session Restoration on Reload:

1. User visits app
2. `AuthProvider` component runs useEffect
3. Calls `authService.getCurrentUser()`
4. Checks Supabase `auth.users` table
5. If session exists, fetches profile from `public.profiles`
6. Populates Zustand store with user data
7. Protected routes can now render
8. Logout clears session and store

### Files Involved:
- `AuthProvider.tsx` - Session restoration
- `App.tsx` - Mounts AuthProvider
- `authService.ts` - `getCurrentUser()` implementation
- `supabase.ts` - Client initialization

---

## Testing Checklist

### Session Persistence:
- [ ] Log in as parent
- [ ] Refresh page (Ctrl+R)
- [ ] Verify you're still logged in
- [ ] Navigate to different pages
- [ ] Refresh again - should still be logged in
- [ ] Logout should clear session

### Child Selection Dropdown:
- [ ] Open FindProfessionals page
- [ ] Dropdown loads and shows children
- [ ] Select different child
- [ ] Selection updates UI
- [ ] Reload page - selection persists
- [ ] Navigate to another page and back - selection persists

### Therapist Lock/Unlock:
- [ ] Open FindProfessionals
- [ ] Select "Rahul Jain" (diagnosed) - Therapists UNLOCKED ✅
- [ ] Select "Test Child" (pending) - Therapists LOCKED 🔒
- [ ] Toggle between them - Lock state updates immediately
- [ ] Try selecting therapist when locked - Button disabled
- [ ] Select therapist when unlocked - Button works

### Progress Page:
- [ ] Navigate to Progress
- [ ] Child selection dropdown works
- [ ] Selection persists on reload
- [ ] Charts update based on selected child
- [ ] Query params work: `/parent/progress?childId=xxx`

---

## Questionnaire Gating Logic

**Implemented in Screening.tsx:**

```typescript
// First screening: Show questionnaire
if (hasPriorScreening === false) {
  setStep("questionnaire");
} else {
  // Follow-up screening: Skip questionnaire
  startProcessing();
}
```

**How it works:**
1. On component mount, checks `screeningService.getLatestResult(selectedChildId)`
2. If result exists → `hasPriorScreening = true` → Skip questionnaire
3. If no result → `hasPriorScreening = false` → Show questionnaire
4. Button text changes: "Continue to Questionnaire" or "Start Screening"

---

## File Structure Summary

```
frontend/src/
├── pages/
│   ├── AuthProvider.tsx (NEW - Session restoration)
│   ├── Auth.tsx (Auth form)
│   ├── AuthCallback.tsx (OAuth callback)
│   ├── parent/
│   │   ├── Screening.tsx (Updated - Questionnaire gating + child selection)
│   │   ├── FindProfessionals.tsx (Updated - Live data + therapist lock)
│   │   ├── Progress.tsx (Updated - Live data + child selection)
│   │   ├── ChildProfile.tsx (Updated - Pass childId in navigation)
│   │   ├── ParentDashboard.tsx (Updated - Set child on click)
│   │   └── ChildrenList.tsx (Updated - Set child on click)
│   └── ...
├── services/
│   ├── auth.ts (authService.getCurrentUser)
│   ├── data.ts (childrenService, screeningService)
│   └── screening.ts (screenVideo)
├── lib/
│   ├── store.ts (selectedChildId + setSelectedChildId)
│   └── supabase.ts (Supabase client)
└── App.tsx (Updated - Added AuthProvider)
```

---

## Troubleshooting

### Session still logs out on reload:
- Check browser localStorage - it should have `selectedChildId`
- Check Supabase auth state - verify `getCurrentUser()` returns user
- Check browser console for errors in AuthProvider
- Try clearing browser cache and local storage

### Dropdown not showing children:
- Check if `childrenService.getChildren()` is returning data
- Look for errors in browser console
- Verify Supabase is connected (check env vars)
- Check database for children in correct parent's account

### Therapists not unlocking:
- Verify child's `screening_status` is exactly `"diagnosed"`
- Run verify query: `SELECT name, screening_status FROM children;`
- Check if child data is being fetched live (not from stale state)
- Look at browser dev tools to see what status is being read

### Child selection not persisting:
- Check localStorage: `localStorage.getItem('selectedChildId')`
- Verify `setSelectedChildId()` is being called on navigation
- Check URL params: should have `?childId=xxx`
- Look at browser console for store updates

---

## Next Steps

1. **Run the SQL queries** in Supabase dashboard to set up test data
2. **Test session persistence** - log in, reload, verify still logged in
3. **Test child dropdown** - select different children, verify data loads
4. **Test therapist lock** - select diagnosed vs pending children
5. **Verify questionnaire gating** - first screening vs follow-up
6. **Monitor console** for any errors during testing
