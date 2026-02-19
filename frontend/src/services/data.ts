import { supabase } from '@/lib/supabase';
import { Child, Report, ScreeningResult, TherapySession } from '@/lib/store';
import { agentsService } from '@/services/agents';

export interface TherapistProfile {
  id: string;
  fullName: string | null;
  specialty: string | null;
  state: string | null;
  district: string | null;
}

export interface DoctorProfile {
  id: string;
  fullName: string | null;
  specialty: string | null;
  state: string | null;
  district: string | null;
}

export interface TherapistFeedbackInput {
  therapistId: string;
  parentId: string;
  childId: string;
  rating: number;
  comment?: string | null;
}

export interface DoctorFeedbackInput {
  doctorId: string;
  parentId: string;
  childId: string;
  rating: number;
  comment?: string | null;
}

export interface SecondOpinionRequestInput {
  childId: string;
  reportId: string;
  parentId: string;
  requestedDoctorId: string;
  notes?: string | null;
}

export interface ChildProgressFeedbackInput {
  sessionId: string;
  childId: string;
  therapistId: string;
  parentId: string;
  progressText: string;
}

export const childrenService = {
  async getChildren() {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getAssignedChildren() {
    const { data: sessionData } = await supabase.auth.getSession();
    const doctorId = sessionData.session?.user?.id;
    if (!doctorId) {
      return { data: [], error: { message: "User not authenticated" } };
    }

    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('is_active', true)
      .eq('assigned_doctor_id', doctorId)
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
          is_active: true,
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
    if (Object.prototype.hasOwnProperty.call(updates, 'isActive')) {
      dbUpdates.is_active = updates.isActive ?? true;
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

export const childProgressFeedbackService = {
  async createFeedback(input: ChildProgressFeedbackInput) {
    const { data, error } = await supabase
      .from('child_progress_feedback')
      .insert([
        {
          session_id: input.sessionId,
          child_id: input.childId,
          therapist_id: input.therapistId,
          parent_id: input.parentId,
          progress_text: input.progressText,
        }
      ])
      .select()
      .single();
    return { data, error };
  },

  async getFeedbackForParent(parentId: string) {
    const { data, error } = await supabase
      .from('child_progress_feedback')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });
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

    if (!error && report.type === 'diagnostic' && report.childId) {
      try {
        console.log('[Reports Service] Triggering therapy plan generation for child:', report.childId);
        await agentsService.generateTherapyPlanningByChild({ childId: report.childId });
        console.log('[Reports Service] Therapy plan generation completed for child:', report.childId);
      } catch (therapyError) {
        console.warn('[Reports Service] Therapy plan generation trigger failed:', therapyError);
      }
    }

    return { data, error };
  },
};

export const screeningService = {
  async saveResult(result: Omit<ScreeningResult, 'timestamp'> & { cvReport?: any }) {
    const apiBase = import.meta.env.VITE_API_URL;
    if (!apiBase) {
      return { data: null, error: { message: 'VITE_API_URL is not set. Configure frontend API base URL.' } as any };
    }

    try {
      const response = await fetch(`${apiBase}/api/screening/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: result.childId,
          report: result.cvReport ?? null,
          indicators: result.indicators,
          videoFileName: result.videoFileName,
          questionnaireAnswers: result.questionnaireAnswers,
          riskLevel: result.riskLevel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        return { data: null, error: { message: errorData?.error || `Failed to save screening result (${response.status})` } as any };
      }

      const payload = await response.json();
      return { data: payload.data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Failed to save screening result' } as any };
    }
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
    type?: 'speech' | 'motor' | 'social';
    scheduledDate?: string;
    scheduledTime?: string;
    goals?: string;
    notes?: string;
  }) {
    const dbUpdates: Record<string, any> = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.type) dbUpdates.type = updates.type;
    if (updates.scheduledDate) dbUpdates.scheduled_date = updates.scheduledDate;
    if (updates.scheduledTime) dbUpdates.scheduled_time = updates.scheduledTime;
    if (typeof updates.goals === "string") dbUpdates.goals = updates.goals;
    if (typeof updates.notes === "string") dbUpdates.notes = updates.notes;

    const { data, error } = await supabase
      .from('therapy_sessions')
      .update(dbUpdates)
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

export const profilesService = {
  async getDoctors() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, specialty, state, district')
      .eq('role', 'doctor')
      .order('full_name', { ascending: true });
    return { data, error };
  },

  async updateLocation(id: string, input: { state: string; district: string }) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        state: input.state,
        district: input.district,
      })
      .eq('id', id)
      .select('id, state, district')
      .single();
    return { data, error };
  },

  async updateProviderProfile(id: string, input: { state: string; district: string; specialty: string }) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        state: input.state,
        district: input.district,
        specialty: input.specialty,
      })
      .eq('id', id)
      .select('id, state, district, specialty')
      .single();
    return { data, error };
  },

  async getTherapists() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, specialty, state, district')
      .eq('role', 'therapist')
      .order('full_name', { ascending: true });
    return { data, error };
  },

  async getProfileById(id: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, specialty, role')
      .eq('id', id)
      .single();
    return { data, error };
  },

  async getDoctorInfo(doctorId: string) {
    const apiBase = import.meta.env.VITE_API_URL;
    if (!apiBase) {
      throw new Error("VITE_API_URL is not set");
    }

    try {
      const response = await fetch(`${apiBase}/api/doctors/${doctorId}/info`);
      if (!response.ok) {
        throw new Error(`Failed to fetch doctor info: ${response.status}`);
      }
      const result = await response.json();
      return { data: result.doctor, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch doctor info' };
    }
  },

  async getAllDoctorsWithStats() {
    const apiBase = import.meta.env.VITE_API_URL;
    if (!apiBase) {
      throw new Error("VITE_API_URL is not set");
    }

    try {
      const response = await fetch(`${apiBase}/api/doctors/stats/all`);
      if (!response.ok) {
        throw new Error(`Failed to fetch doctor stats: ${response.status}`);
      }
      const result = await response.json();
      return { data: result.doctors, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Failed to fetch doctor stats' };
    }
  },
};

export const therapistFeedbackService = {
  async getFeedbackForTherapists(therapistIds: string[]) {
    if (therapistIds.length === 0) return { data: [], error: null } as const;
    const { data, error } = await supabase
      .from('therapist_feedback')
      .select('therapist_id, rating')
      .in('therapist_id', therapistIds);
    return { data, error };
  },

  async createFeedback(input: TherapistFeedbackInput) {
    const { data, error } = await supabase
      .from('therapist_feedback')
      .insert([
        {
          therapist_id: input.therapistId,
          parent_id: input.parentId,
          child_id: input.childId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      ])
      .select()
      .single();
    return { data, error };
  },
};

export const doctorFeedbackService = {
  async getFeedbackForDoctors(doctorIds: string[]) {
    if (doctorIds.length === 0) return { data: [], error: null } as const;
    const { data, error } = await supabase
      .from('doctor_feedback')
      .select('doctor_id, rating')
      .in('doctor_id', doctorIds);
    return { data, error };
  },

  async hasFeedbackForDoctorAndChild(input: {
    doctorId: string;
    parentId: string;
    childId: string;
  }) {
    const { data, error } = await supabase
      .from('doctor_feedback')
      .select('id')
      .eq('doctor_id', input.doctorId)
      .eq('parent_id', input.parentId)
      .eq('child_id', input.childId)
      .limit(1)
      .maybeSingle();
    return { data: !!data, error };
  },

  async createFeedback(input: DoctorFeedbackInput) {
    const { data: existing, error: existingError } = await this.hasFeedbackForDoctorAndChild({
      doctorId: input.doctorId,
      parentId: input.parentId,
      childId: input.childId,
    });
    if (existingError) {
      return { data: null, error: existingError };
    }
    if (existing) {
      return { data: null, error: { message: "Feedback already submitted for this doctor and child." } };
    }

    const { data, error } = await supabase
      .from('doctor_feedback')
      .insert([
        {
          doctor_id: input.doctorId,
          parent_id: input.parentId,
          child_id: input.childId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      ])
      .select()
      .single();
    return { data, error };
  },
};

export const secondOpinionService = {
  async getRequestForReport(reportId: string, parentId: string) {
    const { data, error } = await supabase
      .from('second_opinion_requests')
      .select('*')
      .eq('report_id', reportId)
      .eq('parent_id', parentId)
      .maybeSingle();
    return { data, error };
  },

  async createRequest(input: SecondOpinionRequestInput) {
    try {
      const apiBase = import.meta.env.VITE_API_URL;
      if (!apiBase) {
        return { data: null, error: { message: 'API URL not configured' } };
      }

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      if (!userId) {
        return { data: null, error: { message: 'User not authenticated' } };
      }

      const response = await fetch(`${apiBase}/api/doctors/second-opinion/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          childId: input.childId,
          reportId: input.reportId,
          requestedDoctorId: input.requestedDoctorId,
          notes: input.notes ?? null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.error || 'Failed to create second opinion request' } };
      }

      const result = await response.json();
      return { data: result.data, error: null };
    } catch (err) {
      return { 
        data: null, 
        error: { message: err instanceof Error ? err.message : 'Failed to create second opinion request' } 
      };
    }
  },

  async getLatestRequestForChildForDoctor(childId: string, doctorId: string) {
    const { data, error } = await supabase
      .from('second_opinion_requests')
      .select('*')
      .eq('child_id', childId)
      .eq('requested_doctor_id', doctorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  },
};

export const notificationsService = {
  async getNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getUnreadNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();
    return { data, error };
  },

  async createNotification(input: {
    userId: string;
    type: 'session_scheduled' | 'report_ready' | 'second_opinion' | 'general';
    title: string;
    message: string;
    link?: string;
  }) {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link || null,
          read: false,
        },
      ])
      .select()
      .single();
    return { data, error };
  },
};
