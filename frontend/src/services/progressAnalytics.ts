const getApiBase = () => {
  const apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error('VITE_API_URL is not set. Configure the frontend API base URL.');
  }
  return apiBase;
};

export type TherapyType = 'speech' | 'motor' | 'social' | 'behavioral';

export interface SaveSessionMetricsPayload {
  childId: string;
  therapistId: string;
  sessionId?: string;
  sessionDate?: string;
  sessionDurationMinutes?: number;
  therapyType: TherapyType;
  eyeContactScore?: number;
  socialEngagementScore?: number;
  emotionalRegulationScore?: number;
  attentionSpanScore?: number;
  communicationScore?: number;
  motorCoordinationScore?: number;
  sessionEngagementScore?: number;
  responseLatencySeconds?: number;
  gestureFrequency?: number;
  verbalUtterances?: number;
  attentionSpanSeconds?: number;
  cvModelVersion?: string;
  cvConfidenceScore?: number;
  videoQualityScore?: number;
}

export const progressAnalyticsService = {
  async getAnalytics(childId: string, therapyType?: TherapyType) {
    const apiBase = getApiBase();
    const params = new URLSearchParams({ childId });
    if (therapyType) {
      params.set('therapyType', therapyType);
    }

    const res = await fetch(`${apiBase}/api/progress/analytics?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch analytics (${res.status})`);
    }

    const payload = await res.json();
    return payload.data || [];
  },

  async computeProgress(childId: string, therapyType: TherapyType) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/progress/analytics/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, therapyType }),
    });

    if (!res.ok) {
      throw new Error(`Failed to compute analytics (${res.status})`);
    }

    const payload = await res.json();
    return payload.data;
  },

  async saveSessionMetrics(payload: SaveSessionMetricsPayload) {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/progress/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => null);
      throw new Error(errorPayload?.error || `Failed to save metrics (${res.status})`);
    }

    const body = await res.json();
    return body.data;
  },

  async getSessionSeries(childId: string, therapyType: TherapyType, limit = 15) {
    const apiBase = getApiBase();
    const params = new URLSearchParams({
      childId,
      therapyType,
      limit: String(limit),
    });

    const res = await fetch(`${apiBase}/api/progress/sessions?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch session series (${res.status})`);
    }

    const payload = await res.json();
    return payload.data || [];
  },

  async getAlerts(childId: string) {
    const apiBase = getApiBase();
    const params = new URLSearchParams({ childId });

    const res = await fetch(`${apiBase}/api/progress/alerts?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch alerts (${res.status})`);
    }

    const payload = await res.json();
    return payload.data || [];
  },
};
