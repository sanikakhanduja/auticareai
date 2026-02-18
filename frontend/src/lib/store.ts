import { create } from 'zustand';

export type UserRole = 'parent' | 'doctor' | 'therapist';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  dateOfBirth: string;
  gender?: 'male' | 'female' | 'other';
  screeningStatus: 'not-started' | 'in-progress' | 'pending-review' | 'under-observation' | 'diagnosed';
  riskLevel?: 'low' | 'medium' | 'high';
  assignedDoctorId?: string;
  assignedTherapistId?: string;
  observationEndDate?: string;
}

export interface ScreeningResult {
  childId: string;
  riskLevel: 'low' | 'medium' | 'high';
  indicators: string[];
  timestamp: Date;
  videoFileName: string;
  questionnaireAnswers: Record<string, string>;
  cvReport?: any;
}

export type ReportType = 'observation' | 'diagnostic';

export interface Report {
  id: string;
  childId: string;
  type: ReportType;
  createdAt: Date;
  doctorNotes: string;
  screeningSummary: string;
  // Observation report fields
  monitoringPlan?: string;
  followUpDate?: string;
  // Diagnostic report fields
  diagnosisConfirmation?: string;
  developmentalGaps?: string[];
  therapyRecommendations?: string[];
  // CV-enriched fields saved with doctor report
  cvRiskLevel?: string;
  cvRiskConfidence?: number;
  cvRiskDescription?: string;
  objectiveSignals?: Record<string, { value: number | null; baseline: number | null; status: string }>;
  objectiveSignalValues?: Record<string, number>;
  objectiveSignalBaselines?: Record<string, number>;
  signalSummary?: string[];
}

export interface TherapySession {
  id: string;
  childId: string;
  type: 'speech' | 'motor' | 'social';
  scheduledDate: string;
  scheduledTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  goals: string;
  notes?: string;
  createdAt: Date;
}

interface AppState {
  currentUser: User | null;
  authInitialized: boolean;
  children: Child[];
  screeningResults: ScreeningResult[];
  reports: Report[];
  therapySessions: TherapySession[];
  selectedChildId: string;
  setCurrentUser: (user: User | null) => void;
  setAuthInitialized: (initialized: boolean) => void;
  addChild: (child: Child) => void;
  updateChild: (id: string, updates: Partial<Child>) => void;
  addScreeningResult: (result: ScreeningResult) => void;
  addReport: (report: Report) => void;
  getReportsForChild: (childId: string) => Report[];
  addTherapySession: (session: TherapySession) => void;
  updateTherapySession: (id: string, updates: Partial<TherapySession>) => void;
  getSessionsForChild: (childId: string) => TherapySession[];
  setSelectedChildId: (childId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  authInitialized: false,
  children: [],
  screeningResults: [],
  reports: [],
  therapySessions: [],
  selectedChildId:
    typeof window !== 'undefined' ? localStorage.getItem('selectedChildId') || '' : '',
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthInitialized: (initialized) => set({ authInitialized: initialized }),
  addChild: (child) => set((state) => ({ children: [...state.children, child] })),
  updateChild: (id, updates) =>
    set((state) => ({
      children: state.children.map((child) =>
        child.id === id ? { ...child, ...updates } : child
      ),
    })),
  addScreeningResult: (result) =>
    set((state) => ({ screeningResults: [...state.screeningResults, result] })),
  addReport: (report) =>
    set((state) => ({ reports: [...state.reports, report] })),
  getReportsForChild: (childId) => {
    return get().reports.filter((r) => r.childId === childId);
  },
  addTherapySession: (session) =>
    set((state) => ({ therapySessions: [...state.therapySessions, session] })),
  updateTherapySession: (id, updates) =>
    set((state) => ({
      therapySessions: state.therapySessions.map((session) =>
        session.id === id ? { ...session, ...updates } : session
      ),
    })),
  getSessionsForChild: (childId) => {
    return get().therapySessions.filter((s) => s.childId === childId);
  },
  setSelectedChildId: (childId) => {
    if (typeof window !== 'undefined') {
      if (childId) {
        localStorage.setItem('selectedChildId', childId);
      } else {
        localStorage.removeItem('selectedChildId');
      }
    }
    set({ selectedChildId: childId });
  },
}));
