const getApiBase = () => {
  const apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error('VITE_API_URL is not set. Configure the frontend API base URL.');
  }
  return apiBase;
};

type TherapyType = 'speech' | 'motor' | 'social' | 'behavioral';

export const progressAnalyticsService = {
  async getAnalytics(childId: string, therapyType?: string) {
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
