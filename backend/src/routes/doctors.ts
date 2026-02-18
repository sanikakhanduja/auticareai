import express, { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = express.Router();

// Get doctor by ID with patient count
router.get('/:doctorId/info', async (req: Request, res: Response) => {
  const { doctorId } = req.params;

  try {
    // Get doctor profile
    const { data: doctor, error: doctorError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', doctorId)
      .eq('role', 'doctor')
      .single();

    if (doctorError || !doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Count patients assigned to this doctor
    const { count, error: countError } = await supabase
      .from('children')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_doctor_id', doctorId);

    if (countError) {
      return res.status(500).json({ error: countError.message });
    }

    return res.json({
      doctor: {
        ...doctor,
        patientCount: count || 0,
        canAcceptPatients: (count || 0) < 5
      }
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Failed to fetch doctor info';
    return res.status(500).json({ error: message });
  }
});

// Get all doctors with patient counts
router.get('/stats/all', async (req: Request, res: Response) => {
  try {
    const { data: doctors, error: doctorsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'doctor')
      .order('full_name', { ascending: true });

    if (doctorsError) {
      return res.status(500).json({ error: doctorsError.message });
    }

    // Get patient counts for all doctors
    const doctorStatsPromises = (doctors || []).map(async (doctor) => {
      const { count } = await supabase
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_doctor_id', doctor.id);

      return {
        ...doctor,
        patientCount: count || 0,
        canAcceptPatients: (count || 0) < 5
      };
    });

    const doctorsWithStats = await Promise.all(doctorStatsPromises);

    return res.json({ doctors: doctorsWithStats });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Failed to fetch doctor stats';
    return res.status(500).json({ error: message });
  }
});

// Request second opinion from another doctor
router.post('/second-opinion/request', async (req: Request, res: Response) => {
  const { childId, reportId, requestedDoctorId, notes } = req.body;
  const parentId = req.headers['x-user-id'] as string; // Should come from auth middleware

  if (!childId || !reportId || !parentId || !requestedDoctorId) {
    return res.status(400).json({ error: 'childId, reportId, parentId, and requestedDoctorId are required' });
  }

  try {
    // Update child to assign the new doctor
    const { error: updateError } = await supabase
      .from('children')
      .update({ assigned_doctor_id: requestedDoctorId })
      .eq('id', childId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to assign doctor: ' + updateError.message });
    }

    // Insert second opinion request
    const { data, error } = await supabase
      .from('second_opinion_requests')
      .insert({
        child_id: childId,
        report_id: reportId,
        parent_id: parentId,
        requested_doctor_id: requestedDoctorId,
        status: 'requested',
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data, message: 'Doctor assigned and second opinion request submitted' });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Failed to request second opinion';
    return res.status(500).json({ error: message });
  }
});

// Get available doctors for second opinion (excluding the current assigned doctor)
router.get('/available/second-opinion/:childId', async (req: Request, res: Response) => {
  const { childId } = req.params;

  try {
    // Get the child with assigned doctor
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('assigned_doctor_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    // Get all doctors except the assigned one
    const { data: doctors, error: doctorsError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'doctor')
      .neq('id', child.assigned_doctor_id || 'null')
      .order('full_name', { ascending: true });

    if (doctorsError) {
      return res.status(500).json({ error: doctorsError.message });
    }

    // Get patient counts for available doctors
    const doctorStatsPromises = (doctors || []).map(async (doctor) => {
      const { count } = await supabase
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_doctor_id', doctor.id);

      return {
        ...doctor,
        patientCount: count || 0,
        canAcceptPatients: (count || 0) < 5
      };
    });

    const availableDoctors = await Promise.all(doctorStatsPromises);

    return res.json({ doctors: availableDoctors });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Failed to fetch available doctors';
    return res.status(500).json({ error: message });
  }
});

export default router;
