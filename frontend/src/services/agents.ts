const getApiBase = () => {
  const apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error("VITE_API_URL is not set. Configure the frontend API base URL.");
  }
  return apiBase;
};

type AgentRole = "parent" | "therapist" | "doctor";

interface AgentApiResponse<T> {
  data: T;
  meta?: {
    generatedBy: "deterministic" | "gemini";
    model?: string;
    cached?: boolean;
  };
  sourceScreeningId?: string;
}

export interface ClinicalSummaryResponse {
  overview: string;
  keyFindings: string[];
  riskLevel: string;
  reviewFlags: string[];
  recommendedNextSteps: string[];
  objectiveSignals?: Array<{
    name: string;
    value: string;
    baseline: string;
    status: string;
  }>;
  behavioralIndicators?: string[];
}

export interface TherapyPlanningResponse {
  overview: string;
  aiInsightsParagraph?: string;
  weeklyPlan: Array<{
    week: number;
    goals: string[];
    activities: string[];
  }>;
  homeStrategies: string[];
  therapistFocus: string[];
  escalationSignals: string[];
}

export interface MonitoringInferenceResponse {
  overview: string;
  metricInsights: string[];
  riskFlags: string[];
  nextActions: string[];
}

const parseError = async (res: Response) => {
  const payload = await res.json().catch(() => null);
  return payload?.error || `Request failed (${res.status})`;
};

export const agentsService = {
  async getClinicalSummary(input: {
    childName: string;
    role: AgentRole;
    screeningReport: Record<string, unknown>;
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/agents/clinical-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    return (await res.json()) as AgentApiResponse<ClinicalSummaryResponse>;
  },

  async getClinicalSummaryByChild(input: {
    childId: string;
    role: AgentRole;
    forceRefresh?: boolean;
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/agents/clinical-summary/by-child`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    return (await res.json()) as AgentApiResponse<ClinicalSummaryResponse>;
  },

  async getTherapyPlanning(input: {
    childName: string;
    diagnosis: string;
    severityLevel: "low" | "moderate" | "high";
    ageYears: number;
    primaryChallenges: string[];
    constraints?: string[];
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/agents/therapy-planning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    return (await res.json()) as AgentApiResponse<TherapyPlanningResponse>;
  },

  async getTherapyPlanningByChild(input: {
    childId: string;
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/agents/therapy-planning/by-child`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    return (await res.json()) as AgentApiResponse<TherapyPlanningResponse>;
  },

  async generateTherapyPlanningByChild(input: {
    childId: string;
    forceRefresh?: boolean;
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/agents/therapy-planning/by-child/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    return (await res.json()) as AgentApiResponse<TherapyPlanningResponse>;
  },

  async getMonitoringInference(input: {
    childName: string;
    role: AgentRole;
    metricSeries: Array<{
      metric: string;
      previous: number;
      current: number;
      higherIsBetter?: boolean;
    }>;
    therapistSessionFeedback?: Array<{
      sessionDate: string;
      strengths: string[];
      concerns: string[];
      notes?: string;
    }>;
  }) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/agents/monitoring-inference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(await parseError(res));
    }

    return (await res.json()) as AgentApiResponse<MonitoringInferenceResponse>;
  },
};
