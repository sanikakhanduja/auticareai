const getApiBase = () => {
  const apiBase = import.meta.env.VITE_API_URL;
  if (!apiBase) {
    throw new Error('VITE_API_URL is not set. Configure the frontend API base URL.');
  }
  return apiBase;
};

interface GenerateExplanationRequest {
  childId: string;
  analytics?: any;
  role: 'parent' | 'therapist' | 'doctor';
  childName: string;
  therapyType: string;
  recentMilestones?: string[];
}

export const llmExplanationService = {
  async generateExplanation(request: GenerateExplanationRequest) {
    const apiBase = getApiBase();

    const res = await fetch(`${apiBase}/api/progress/explanation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      let message = `Failed to generate explanation (${res.status})`;
      try {
        const errorPayload = await res.json();
        if (errorPayload?.error) {
          message = errorPayload.error;
        }
      } catch {
        // ignore parse issues
      }
      throw new Error(message);
    }

    const payload = await res.json();
    return payload.data;
  },
};
