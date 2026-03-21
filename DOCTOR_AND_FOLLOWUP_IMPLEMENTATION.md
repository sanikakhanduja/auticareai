# Doctor Assignment & Follow-up Upload Implementation Guide

## Overview
This document explains the implementation of:
1. **Doctor Assignment System** - 3 care doctors (Doc1, Doc2, Doc3) with 5-patient capacity limit
2. **Follow-up Upload Restriction** - Disable follow-up video upload until advised date

---

## 1. Doctor Assignment System

### Features Implemented

✅ **3 Care Doctors Created**
- Doc1, Doc2, Doc3 are created in Supabase profiles table
- Each doctor can handle maximum 5 patients
- Doctors show as "unavailable" when at full capacity (5/5 patients)

✅ **Real-time Capacity Tracking**
- Live patient count displayed for each doctor (e.g., "Assigned: 3/5")
- Remaining slots shown (e.g., "2 slot(s) left")
- Automatic availability calculation

✅ **Persistent Doctor Selection**
- Doctor assignments stored in `child_doctor_assignments` table
- Survives page refresh and logout/login
- Each child can only have one doctor assigned
- Parent can change doctor assignment (if new doctor has capacity)

✅ **Capacity Enforcement**
- Cannot assign doctor if already at 5/5 patients
- Error message: "Doctor is at full capacity (5/5 patients)"
- Only available doctors show "Select Doctor" button
- Unavailable doctors show "Unavailable" badge

---

## 2. Database Setup

### SQL File: `DOCTOR_SETUP_QUERIES.sql`

Run this file in Supabase SQL Editor to set up everything:

```bash
# Location: /Users/joysajain/Documents/auticareai/DOCTOR_SETUP_QUERIES.sql
```

### What the SQL does:

1. **Creates 3 doctors** in profiles table
   - doc1@auticare.com → Doc1
   - doc2@auticare.com → Doc2
   - doc3@auticare.com → Doc3

2. **Creates `child_doctor_assignments` table**
   - Tracks which child is assigned to which doctor
   - Unique constraint: one child = one doctor
   - Includes RLS policies for security

3. **Creates `get_care_doctors_with_capacity()` function**
   - Returns: doctor_id, name, assigned_patients, max_patients, available
   - Used by frontend to display doctor list with capacity

4. **Creates `assign_care_doctor_to_child()` function**
   - Validates capacity before assignment
   - Checks if parent owns the child (security)
   - Removes old assignment and creates new one
   - Returns success/error message

---

## 3. Frontend Implementation

### Files Modified:

#### ✅ `/frontend/src/services/data.ts` (Already Implemented)
Added `careDoctorsService` with methods:
- `getCareDoctorsWithCapacity()` - Fetch doctors with live capacity
- `getMyChildDoctorAssignments()` - Get current assignments for all children
- `assignDoctorToChild(childId, doctorId)` - Assign doctor with validation

#### ✅ `/frontend/src/pages/parent/FindProfessionals.tsx` (Already Implemented)
- Fetches real doctors from Supabase (not mock data)
- Displays live capacity: "Assigned: 3/5"
- Shows availability status
- Persists selection across refresh
- Handles capacity errors gracefully

#### ✅ `/frontend/src/pages/parent/ChildProfile.tsx` (Newly Updated)
- Added date check for follow-up upload button
- Button disabled until `observationEndDate` is reached
- Shows countdown message: "Follow-up Available MMM d, yyyy"
- Helper text below button explains when upload will be available

---

## 4. How It Works

### Doctor Assignment Flow:

1. **User opens Find Care page**
   - Frontend calls `getCareDoctorsWithCapacity()`
   - Displays Doc1, Doc2, Doc3 with live patient counts

2. **User selects a child**
   - Frontend checks if child already has assigned doctor
   - If yes, shows "Selected" badge on that doctor
   - If no, shows "Select Doctor" button on available doctors

3. **User clicks "Select Doctor"**
   - Frontend calls `assignDoctorToChild(childId, doctorId)`
   - Backend validates:
     - Parent owns the child ✓
     - Doctor exists and is a care doctor ✓
     - Doctor has capacity (< 5 patients) ✓
   - If validation passes:
     - Old assignment removed (if any)
     - New assignment created
     - `children.assigned_doctor_id` updated
   - If validation fails:
     - Error message displayed
     - No assignment made

4. **User refreshes page**
   - Frontend loads assignments from database
   - Shows previously selected doctor as "Selected"

### Follow-up Upload Date Restriction Flow:

1. **Doctor submits observation report**
   - Sets `children.observation_end_date` to future date
   - Example: "Follow-up recommended by March 15, 2026"

2. **User views child profile**
   - Frontend checks if `observationEndDate` exists
   - Compares `observationEndDate` with current date

3. **Before advised date:**
   - Button shows: "🕐 Follow-up Available Mar 15, 2026"
   - Button is DISABLED
   - Helper text: "Follow-up upload will be available on March 15, 2026"

4. **After advised date:**
   - Button shows: "Upload Follow-up Video"
   - Button is ENABLED
   - User can click to start follow-up screening

---

## 5. Testing Procedures

### Test 1: Doctor Assignment

**Setup:**
```sql
-- Run DOCTOR_SETUP_QUERIES.sql first
```

**Steps:**
1. Login as parent
2. Go to "Find Care" page
3. Select a child from dropdown
4. Verify you see 3 doctors: Doc1, Doc2, Doc3
5. Verify each shows "Assigned: 0/5" initially
6. Click "Select Doctor" on Doc1
7. Verify Doc1 now shows "Selected" badge
8. Refresh page
9. Verify Doc1 still shows as "Selected" ✓

**Expected Results:**
- Doctor selection persists after refresh
- Patient count increases when doctor assigned
- Only one doctor can be selected per child

### Test 2: Doctor Capacity Limit

**Setup:**
```sql
-- Assign 5 children to Doc1 manually
-- Use different parent accounts or create test children
```

**Steps:**
1. Login as 6th parent
2. Try to assign Doc1 to your child
3. Verify error: "Doctor is at full capacity (5/5 patients)"
4. Verify Doc1 shows "Unavailable" badge
5. Verify Doc1 shows "0 slot(s) left"
6. Verify Doc2 and Doc3 still show "Select Doctor" button

**Expected Results:**
- Cannot assign 6th patient to Doc1
- Doc1 becomes unavailable
- Other doctors remain available

### Test 3: Follow-up Upload Date Restriction

**Setup:**
```sql
-- Set observation_end_date to future date
UPDATE public.children
SET 
  screening_status = 'under-observation',
  observation_end_date = '2026-03-15'
WHERE id = 'YOUR_CHILD_ID';
```

**Steps:**
1. Login as parent
2. Go to child profile
3. Verify button shows: "🕐 Follow-up Available Mar 15, 2026"
4. Verify button is DISABLED (grayed out)
5. Verify helper text below button
6. Change date to past date in database
7. Refresh page
8. Verify button now shows: "Upload Follow-up Video"
9. Verify button is ENABLED

**Expected Results:**
- Button disabled before advised date
- Button enabled after advised date
- Clear messaging about when upload will be available

---

## 6. Verification Queries

### Check Doctor Capacity:

```sql
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
```

### Check Assignments:

```sql
SELECT 
  c.name AS child_name,
  p.full_name AS doctor_name,
  cda.assigned_at
FROM public.child_doctor_assignments cda
JOIN public.children c ON c.id = cda.child_id
JOIN public.profiles p ON p.id = cda.doctor_id
ORDER BY cda.assigned_at DESC;
```

### Check Follow-up Dates:

```sql
SELECT 
  id,
  name,
  screening_status,
  observation_end_date,
  CASE 
    WHEN observation_end_date IS NULL THEN 'No follow-up date'
    WHEN observation_end_date > NOW() THEN 'Upload locked'
    ELSE 'Upload available'
  END AS upload_status
FROM public.children
WHERE screening_status = 'under-observation'
ORDER BY observation_end_date;
```

---

## 7. Build Verification

✅ **Build Status:** SUCCESS  
✅ **Build Time:** 5.90s  
✅ **TypeScript Errors:** 0  
✅ **Bundle Size:** 1,419 KB (gzipped: 395 KB)

```bash
cd frontend
npm run build
# ✓ built in 5.90s
```

---

## 8. Troubleshooting

### Issue: "Doctor not showing in list"

**Solution:**
```sql
-- Verify doctors exist
SELECT * FROM public.profiles WHERE role = 'doctor' AND full_name IN ('Doc1', 'Doc2', 'Doc3');

-- If empty, run DOCTOR_SETUP_QUERIES.sql
```

### Issue: "Cannot assign doctor"

**Possible Causes:**
1. Doctor at full capacity (5/5)
   - Solution: Choose different doctor
2. Child belongs to different parent
   - Solution: Login with correct parent account
3. RLS policies not set up
   - Solution: Re-run DOCTOR_SETUP_QUERIES.sql

### Issue: "Assignment doesn't persist"

**Solution:**
```sql
-- Check if child_doctor_assignments table exists
SELECT * FROM public.child_doctor_assignments;

-- If doesn't exist, run DOCTOR_SETUP_QUERIES.sql
```

### Issue: "Follow-up button not disabled"

**Possible Causes:**
1. `observation_end_date` is NULL
   - Solution: Set date in observation report
2. Date is in the past
   - Solution: Update to future date
3. Child status is not 'under-observation'
   - Solution: Update child status

---

## 9. Security Features

✅ **Row Level Security (RLS)**
- Parents can only assign doctors to their own children
- Parents can only view their own children's assignments
- Doctors can view all assignments

✅ **Capacity Validation**
- Backend enforces 5-patient limit
- Frontend cannot bypass capacity check
- Race conditions handled by database constraints

✅ **Input Validation**
- Doctor must be one of Doc1, Doc2, Doc3
- Child must exist and belong to parent
- Assignment must pass all validations

---

## 10. Summary

### What's Ready:
✅ 3 care doctors with 5-patient capacity  
✅ Real-time capacity tracking  
✅ Persistent doctor assignments  
✅ Capacity enforcement with error handling  
✅ Follow-up upload date restriction  
✅ Clear UI messaging for locked uploads  
✅ Build passes with 0 errors  
✅ Complete SQL setup script  
✅ Comprehensive testing procedures  

### Next Steps:
1. Run `DOCTOR_SETUP_QUERIES.sql` in Supabase SQL Editor
2. Test doctor assignment flow
3. Test capacity limit (assign 5 patients to one doctor)
4. Test follow-up date restriction
5. Verify all queries return expected results
6. Deploy to production

---

**Implementation Date:** February 18, 2026  
**Status:** ✅ READY FOR DEPLOYMENT  
**Build Status:** ✅ SUCCESS (5.90s, 0 errors)
