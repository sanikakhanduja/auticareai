import { supabase } from '@/lib/supabase';
import { Child, Report, ScreeningResult, TherapySession } from '@/lib/store';

export const childrenService = {
  async getChildren() {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getChildById(id: string) {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  async createChild(child: Omit<Child, 'id'>, parentId: string) {
    const { data, error } = await supabase
      .from('children')
      .insert([
        {
          parent_id: parentId,
          name: child.name,
          date_of_birth: child.dateOfBirth,
          gender: child.gender,
          screening_status: child.screeningStatus || 'not-started',
          risk_level: child.riskLevel,
          assigned_doctor_id: child.assignedDoctorId,
          assigned_therapist_id: child.assignedTherapistId,
          // Map other fields as needed, handling snake_case vs camelCase
        }
      ])
      .select()
      .single();
    return { data, error };
  },

  async updateChild(id: string, updates: Partial<Child>) {
    // Convert camelCase to snake_case for DB
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.dateOfBirth) dbUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.screeningStatus) dbUpdates.screening_status = updates.screeningStatus;
    if (updates.riskLevel) dbUpdates.risk_level = updates.riskLevel;
    if (Object.prototype.hasOwnProperty.call(updates, 'assignedDoctorId')) {
      dbUpdates.assigned_doctor_id = updates.assignedDoctorId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'assignedTherapistId')) {
      dbUpdates.assigned_therapist_id = updates.assignedTherapistId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'observationEndDate')) {
      dbUpdates.observation_end_date = updates.observationEndDate ?? null;
    }

    const { data, error } = await supabase
      .from('children')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },
};

export const reportsService = {
  async getReports(childId: string) {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        author:profiles(full_name, role)
      `)
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createReport(report: Omit<Report, 'id' | 'createdAt'>, authorId: string) {
    const reportAny = report as any;
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          child_id: report.childId,
          author_id: authorId,
          type: report.type,
          content: {
            doctorNotes: report.doctorNotes,
            screeningSummary: report.screeningSummary,
            diagnosisConfirmation: report.diagnosisConfirmation,
            developmentalGaps: report.developmentalGaps,
            therapyRecommendations: report.therapyRecommendations,
            monitoringPlan: report.monitoringPlan,
            followUpDate: report.followUpDate,
            cvRiskLevel: reportAny.cvRiskLevel,
            cvRiskConfidence: reportAny.cvRiskConfidence,
            cvRiskDescription: reportAny.cvRiskDescription,
            objectiveSignals: reportAny.objectiveSignals,
            objectiveSignalValues: reportAny.objectiveSignalValues,
            objectiveSignalBaselines: reportAny.objectiveSignalBaselines,
            signalSummary: reportAny.signalSummary,
          }
        }
      ])
      .select()
      .single();
    return { data, error };
  },
};

export const screeningService = {
  async saveResult(result: Omit<ScreeningResult, 'timestamp'> & { cvReport?: any }) {
    const { data, error } = await supabase
      .from('screening_results')
      .insert([
        {
          child_id: result.childId,
          risk_level: result.riskLevel,
          indicators: result.indicators,
          cv_report: result.cvReport ?? null,
          video_url: result.videoFileName, // Mapping videoFileName to video_url
          answers: result.questionnaireAnswers,
        }
      ])
      .select()
      .single();
    return { data, error };
  },
  async getResultsForChild(childId: string) {
    const { data, error } = await supabase
      .from('screening_results')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
    return { data, error };
  },
  async getLatestResult(childId: string) {
    const { data, error } = await supabase
      .from('screening_results')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  },
};

export const therapySessionsService = {
  async getSessionsForTherapist(therapistId: string) {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });
    return { data, error };
  },

  async getSessionsForChild(childId: string) {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('child_id', childId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });
    return { data, error };
  },

  async getSessionById(id: string) {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  async createSession(input: {
    childId: string;
    therapistId: string;
    type: 'speech' | 'motor' | 'social';
    scheduledDate: string;
    scheduledTime: string;
    goals: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .insert([
        {
          child_id: input.childId,
          therapist_id: input.therapistId,
          type: input.type,
          scheduled_date: input.scheduledDate,
          scheduled_time: input.scheduledTime,
          status: 'scheduled',
          goals: input.goals,
          notes: input.notes || null,
        }
      ])
      .select()
      .single();
    return { data, error };
  },

  async updateSession(id: string, updates: {
    status?: 'scheduled' | 'completed' | 'cancelled';
    goals?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from('therapy_sessions')
      .update({
        status: updates.status,
        goals: updates.goals,
        notes: updates.notes,
      })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },
};

export const careDoctorsService = {
  async getCareDoctorsWithCapacity() {
    const { data, error } = await supabase.rpc('get_care_doctors_with_capacity');
    return { data, error };
  },

  async getMyChildDoctorAssignments() {
    const { data, error } = await supabase
      .from('child_doctor_assignments')
      .select('child_id, doctor_id');
    return { data, error };
  },

  async assignDoctorToChild(childId: string, doctorId: string) {
    const { data, error } = await supabase.rpc('assign_care_doctor_to_child', {
      p_child_id: childId,
      p_doctor_id: doctorId,
    });
    return { data, error };
  },
};
