export type CvReport = {
  risk_assessment: {
    level: string;
    confidence: number;
    description: string;
  };
  metrics: {
    objective_signals: Record<string, { value: string; baseline: string; status: string }>;
    behavioral_indicators: Record<string, boolean>;
  };
};

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const cvApiUrl = import.meta.env.VITE_CV_API_URL || 'http://localhost:8000';

export const cvService = {
  async runScreening(video: File): Promise<CvReport> {
    const formData = new FormData();
    formData.append('video', video);

    const response = await fetch(`${cvApiUrl}/api/screen`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to process video');
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to process video') {
          throw e;
        }
        const message = await response.text();
        throw new Error(message || 'Failed to process video');
      }
    }

    return response.json();
  },

  async saveReport(params: {
    childId: string;
    report: CvReport;
    videoFileName?: string;
    questionnaireAnswers?: Record<string, string>;
  }) {
    const response = await fetch(`${backendUrl}/api/screening/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to save screening report');
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to save screening report') {
          throw e;
        }
        throw new Error('Failed to save screening report');
      }
    }

    return response.json();
  },

  async getLatestReport(childId: string) {
    const response = await fetch(`${backendUrl}/api/screening/results/${childId}`);
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to fetch screening report');
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to fetch screening report') {
          throw e;
        }
        throw new Error('Failed to fetch screening report');
      }
    }
    return response.json();
  },
};
