import { supabase } from '../config/supabase';

type AgentRole = 'parent' | 'therapist' | 'doctor';

interface ClinicalSummaryInput {
  childName: string;
  role: AgentRole;
  screeningReport: Record<string, unknown>;
}

interface TherapyPlanningInput {
  childName: string;
  diagnosis: string;
  severityLevel: 'low' | 'moderate' | 'high';
  ageYears: number;
  primaryChallenges: string[];
  constraints?: string[];
}

interface MonitoringInferenceInput {
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
}

interface AgentResultMeta {
  generatedBy: 'deterministic' | 'gemini';
  model?: string;
}

interface ScreeningResultRow {
  id: string;
  child_id: string;
  risk_level: string | null;
  cv_report: Record<string, unknown> | null;
  created_at: string;
}

interface ClinicalSummaryCacheRow {
  id: string;
  child_id: string;
  source_screening_id: string;
  role: AgentRole;
  summary_json: any;
  generated_by: 'deterministic' | 'gemini';
  model: string | null;
  created_at: string;
}

interface DiagnosticReportRow {
  id: string;
  child_id: string;
  content: any;
  created_at: string;
}

interface TherapyPlanCacheRow {
  id: string;
  child_id: string;
  source_report_id: string;
  plan_json: any;
  generated_by: 'deterministic' | 'gemini';
  model: string | null;
  created_at: string;
}

interface GeminiJsonRequest {
  instruction: string;
  payload: unknown;
}

interface GeminiTextRequest {
  instruction: string;
  payload: unknown;
}

const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = (
  process.env.GEMINI_MODELS?.split(',').map((m) => m.trim()).filter(Boolean) || [
    'gemini-2.5-flash',
  ]
);

export const agentOrchestrationService = {
  async getLatestClinicalSummaryForChild(childId: string): Promise<ClinicalSummaryCacheRow | null> {
    const { data, error } = await supabase
      .from('clinical_summaries')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to load latest clinical summary: ${error.message}`);
    }

    return (data as ClinicalSummaryCacheRow) || null;
  },

  async getLatestDiagnosticReportForChild(childId: string): Promise<DiagnosticReportRow | null> {
    const { data, error } = await supabase
      .from('reports')
      .select('id, child_id, content, created_at')
      .eq('child_id', childId)
      .eq('type', 'diagnostic')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load diagnostic report: ${error.message}`);
    }

    return (data as DiagnosticReportRow) || null;
  },

  async getChildAgeYears(childId: string): Promise<number> {
    const { data, error } = await supabase
      .from('children')
      .select('date_of_birth')
      .eq('id', childId)
      .maybeSingle();

    if (error || !data?.date_of_birth) {
      return 3;
    }

    const dob = new Date(data.date_of_birth);
    if (Number.isNaN(dob.getTime())) return 3;
    return Math.max(1, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
  },

  async getLatestTherapyPlanForChild(childId: string): Promise<TherapyPlanCacheRow | null> {
    const { data, error } = await supabase
      .from('therapy_plans')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to load therapy plan cache: ${error.message}`);
    }

    return (data as TherapyPlanCacheRow) || null;
  },

  async getTherapyPlanForSourceReport(childId: string, sourceReportId: string): Promise<TherapyPlanCacheRow | null> {
    const { data, error } = await supabase
      .from('therapy_plans')
      .select('*')
      .eq('child_id', childId)
      .eq('source_report_id', sourceReportId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to load therapy plan for source report: ${error.message}`);
    }

    return (data as TherapyPlanCacheRow) || null;
  },

  async persistTherapyPlan(input: {
    childId: string;
    sourceReportId: string;
    planJson: any;
    generatedBy: 'deterministic' | 'gemini';
    model?: string;
  }): Promise<void> {
    const { childId, sourceReportId, planJson, generatedBy, model } = input;
    const { error } = await supabase.from('therapy_plans').insert({
      child_id: childId,
      source_report_id: sourceReportId,
      plan_json: planJson,
      generated_by: generatedBy,
      model: model || null,
    });

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('[Agents Service] therapy_plans table missing; skipping cache persist.');
        return;
      }
      console.warn('[Agents Service] Failed to persist therapy plan cache:', error.message);
    }
  },

  async getLatestScreeningForChild(childId: string): Promise<ScreeningResultRow | null> {
    const { data, error } = await supabase
      .from('screening_results')
      .select('id, child_id, risk_level, cv_report, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load screening report: ${error.message}`);
    }

    return (data as ScreeningResultRow) || null;
  },

  async getChildName(childId: string): Promise<string> {
    const { data, error } = await supabase
      .from('children')
      .select('name')
      .eq('id', childId)
      .maybeSingle();

    if (error) {
      console.warn('[Agents Service] Failed to fetch child name, using fallback id.', error.message);
      return childId;
    }

    return data?.name || childId;
  },

  async getCachedClinicalSummary(
    childId: string,
    sourceScreeningId: string,
    role: AgentRole
  ): Promise<ClinicalSummaryCacheRow | null> {
    const { data, error } = await supabase
      .from('clinical_summaries')
      .select('*')
      .eq('child_id', childId)
      .eq('source_screening_id', sourceScreeningId)
      .eq('role', role)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to load cached clinical summary: ${error.message}`);
    }

    return (data as ClinicalSummaryCacheRow) || null;
  },

  async persistClinicalSummary(input: {
    childId: string;
    sourceScreeningId: string;
    role: AgentRole;
    summaryJson: any;
    generatedBy: 'deterministic' | 'gemini';
    model?: string;
  }): Promise<void> {
    const { childId, sourceScreeningId, role, summaryJson, generatedBy, model } = input;
    const { error } = await supabase.from('clinical_summaries').insert({
      child_id: childId,
      source_screening_id: sourceScreeningId,
      role,
      summary_json: summaryJson,
      generated_by: generatedBy,
      model: model || null,
    });

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('[Agents Service] clinical_summaries table missing; skipping cache persist.');
        return;
      }
      console.warn('[Agents Service] Failed to persist clinical summary cache:', error.message);
    }
  },

  async generateClinicalSummary(input: ClinicalSummaryInput) {
    console.log('[Agents Service] generateClinicalSummary start', {
      childName: input.childName,
      role: input.role,
    });
    const deterministic = this.buildClinicalSummaryDeterministic(input);
    let normalized = this.normalizeClinicalSummary(deterministic);
    let meta: AgentResultMeta = { generatedBy: 'deterministic' };

    const textInference = await this.tryGeminiText({
      instruction: [
        'You are a clinical assistant for doctors reviewing autism screening outputs.',
        'Write exactly one paragraph in English for doctor-facing UI, around 55-75 words. You may add on possible diagnosis to increase the content and show it real',
        'Use only evidence present in INPUT_JSON. Do not invent facts or diagnoses.',
        'Start with reported risk level (and confidence if available).',
        'Then describe 2-3 most important value-based observations from objective signals by comparing value vs baseline (for example eye contact, social gaze, response latency, attention shifts).',
        'Mention relevant behavioral indicators if present.',
        'End with one practical clinical next step (evaluation, follow-up, or referral).',
        'No markdown, no bullets, no headings, and no prefixes like "Sure", "Here is", or "Summary:".',
      ].join(' '),
      payload: input,
    });

    if (textInference?.text) {
      const cleaned = this.cleanClinicalText(textInference.text);
      normalized = {
        ...normalized,
        overview: cleaned,
        keyFindings: this.extractSentenceLines(cleaned).slice(0, 4),
        reviewFlags: [],
      };
      meta = {
        generatedBy: 'gemini',
        model: textInference.model,
      };
    }

    return {
      data: normalized,
      meta,
    };
  },

  async generateTherapyPlan(input: TherapyPlanningInput) {
    console.log('[Agents Service] generateTherapyPlan start', {
      childName: input.childName,
      severityLevel: input.severityLevel,
      ageYears: input.ageYears,
    });
    const deterministic = this.buildTherapyPlanDeterministic(input);
    let data: any = { ...deterministic };
    let meta: AgentResultMeta = { generatedBy: 'deterministic' };

    const textInference = await this.tryGeminiText({
      instruction: [
        'You are a pediatric therapy planning assistant.',
        'Write exactly one concise paragraph in English (45-70 words).',
        'Use INPUT_JSON only. Do not invent diagnosis details.',
        'Focus on top priorities, immediate therapist actions, and one home carryover suggestion.',
        'No markdown, no bullets, no headings.',
      ].join(' '),
      payload: input,
    });
    if (textInference?.text) {
      data = {
        ...data,
        aiInsightsParagraph: this.cleanClinicalText(textInference.text),
      };
      meta = {
        generatedBy: 'gemini',
        model: textInference.model,
      };
    }
    console.log('[Agents Service] generateTherapyPlan result source:', meta.generatedBy, {
      model: meta.model || null,
    });

    return {
      data,
      meta,
    };
  },

  async generateMonitoringInference(input: MonitoringInferenceInput) {
    console.log('[Agents Service] generateMonitoringInference start', {
      childName: input.childName,
      role: input.role,
      metricSeriesCount: input.metricSeries.length,
    });
    const deterministic = this.buildMonitoringDeterministic(input);
    const llm = await this.tryGeminiJson({
      instruction:
        'Given metric deltas and therapist feedback, produce monitoring inference JSON with keys: overview, metricInsights[], riskFlags[], nextActions[]. Return strict JSON only.',
      payload: input,
    });

    return {
      data: llm?.data || deterministic,
      meta: llm?.meta || ({ generatedBy: 'deterministic' } as AgentResultMeta),
    };
  },

  buildClinicalSummaryDeterministic(input: ClinicalSummaryInput) {
    const report = input.screeningReport || {};
    const level = String((report as any)?.risk_assessment?.level || (report as any)?.riskLevel || 'unknown');
    const confidence = (report as any)?.risk_assessment?.confidence;
    const findingLines = this.flattenStringSignals(report, 6);
    const objectiveSignals = this.extractObjectiveSignals(report);
    const behavioralIndicators = this.extractBehavioralIndicators(report);

    return {
      overview: `${input.childName} screening summary prepared for ${input.role}.`,
      keyFindings: findingLines.length > 0 ? findingLines : ['No structured findings were present in the report.'],
      riskLevel: level,
      reviewFlags: [
        confidence !== undefined ? `Risk confidence: ${confidence}` : 'Risk confidence not provided',
        level === 'high' ? 'Prioritize specialist review' : 'Continue clinical review workflow',
      ],
      recommendedNextSteps: [
        'Review screening evidence with clinician oversight.',
        'Correlate with developmental history and questionnaire signals.',
        'Decide observation vs diagnostic pathway.',
      ],
      objectiveSignals,
      behavioralIndicators,
    };
  },

  normalizeClinicalSummary(data: any) {
    const normalized = data || {};
    return {
      overview: typeof normalized.overview === 'string' ? normalized.overview : 'Clinical summary generated.',
      riskLevel: typeof normalized.riskLevel === 'string' ? normalized.riskLevel : 'unknown',
      keyFindings: Array.isArray(normalized.keyFindings) ? normalized.keyFindings.map(String) : [],
      reviewFlags: Array.isArray(normalized.reviewFlags) ? normalized.reviewFlags.map(String) : [],
      recommendedNextSteps: Array.isArray(normalized.recommendedNextSteps)
        ? normalized.recommendedNextSteps.map(String)
        : [],
      objectiveSignals: Array.isArray(normalized.objectiveSignals)
        ? normalized.objectiveSignals
            .map((entry: any) => ({
              name: String(entry?.name || ''),
              value: String(entry?.value || 'NA'),
              baseline: String(entry?.baseline || 'NA'),
              status: String(entry?.status || 'unknown'),
            }))
            .filter((entry: any) => entry.name)
        : [],
      behavioralIndicators: Array.isArray(normalized.behavioralIndicators)
        ? normalized.behavioralIndicators.map(String)
        : [],
    };
  },

  extractObjectiveSignals(report: Record<string, unknown>) {
    const raw = (report as any)?.metrics?.objective_signals || {};
    const signals: Array<{ name: string; value: string; baseline: string; status: string }> = [];

    for (const [name, signal] of Object.entries(raw)) {
      signals.push({
        name: String(name).replace(/_/g, ' '),
        value: String((signal as any)?.value ?? 'NA'),
        baseline: String((signal as any)?.baseline ?? 'NA'),
        status: String((signal as any)?.status ?? 'unknown').replace(/_/g, ' '),
      });
    }

    return signals;
  },

  extractBehavioralIndicators(report: Record<string, unknown>) {
    const indicators = (report as any)?.behavioral_indicators || (report as any)?.behavioralIndicators;
    if (Array.isArray(indicators)) {
      return indicators.map((value: unknown) => String(value));
    }

    return this
      .flattenStringSignals(report, 30)
      .filter((line) => /behavior|social|communication|gaze|repetitive|engagement/i.test(line))
      .slice(0, 6);
  },

  extractBulletLines(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-*•]\s*/, ''))
      .filter((line) => line.length > 0);
  },

  extractSentenceLines(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
  },

  cleanClinicalText(text: string): string {
    return text
      .replace(/^\s*(sure|certainly|here(?:'s| is)|clinical summary|summary)\s*[:,.-]?\s*/i, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  buildTherapyPlanDeterministic(input: TherapyPlanningInput) {
    const baseIntensity =
      input.severityLevel === 'high' ? 'high' : input.severityLevel === 'moderate' ? 'moderate' : 'light';

    return {
      overview: `Starter therapy plan for ${input.childName} (${input.diagnosis}, ${input.severityLevel} severity).`,
      weeklyPlan: [
        {
          week: 1,
          goals: [`Baseline establishment (${baseIntensity} intensity)`, ...input.primaryChallenges.slice(0, 1)],
          activities: ['Structured play routine', 'Guided eye-contact prompts', 'Simple turn-taking exercises'],
        },
        {
          week: 2,
          goals: ['Stabilize engagement during sessions', ...input.primaryChallenges.slice(1, 2)],
          activities: ['Joint attention games', 'Reinforcement-based response shaping'],
        },
        {
          week: 3,
          goals: ['Generalize gains to home setting'],
          activities: ['Parent-assisted drills', 'Short home carryover plan'],
        },
        {
          week: 4,
          goals: ['Review progress and tune interventions'],
          activities: ['KPI review', 'Therapist reassessment and next-cycle planning'],
        },
      ],
      homeStrategies: ['Daily 10-15 minute guided interaction block', 'Use consistent reinforcement cues'],
      therapistFocus: ['Track session KPIs weekly', 'Adjust task complexity by engagement tolerance'],
      escalationSignals: ['Sustained regression across 2+ sessions', 'Marked reduction in communication attempts'],
    };
  },

  buildMonitoringDeterministic(input: MonitoringInferenceInput) {
    const metricInsights = input.metricSeries.map((entry) => {
      const delta = entry.current - entry.previous;
      const improved = entry.higherIsBetter === false ? delta < 0 : delta > 0;
      return `${entry.metric}: ${improved ? 'improved' : delta === 0 ? 'stable' : 'declined'} (${delta.toFixed(3)} delta)`;
    });

    const riskFlags = metricInsights.filter((line) => line.includes('declined')).slice(0, 4);
    const feedbackConcerns = (input.therapistSessionFeedback || [])
      .flatMap((f) => f.concerns || [])
      .slice(0, 5);

    return {
      overview: `Monitoring inference for ${input.childName} generated for ${input.role}.`,
      metricInsights,
      riskFlags: [...riskFlags, ...feedbackConcerns.map((c) => `Therapist concern: ${c}`)].slice(0, 6),
      nextActions: [
        'Continue deterministic metric tracking in backend.',
        'Review declining metrics with therapist notes before plan updates.',
        'Escalate to clinical review if decline persists for 2+ cycles.',
      ],
    };
  },

  flattenStringSignals(input: unknown, max: number): string[] {
    const lines: string[] = [];
    const walk = (value: unknown, keyPath: string) => {
      if (lines.length >= max) return;
      if (typeof value === 'string' && value.trim()) {
        const normalized = value.trim();
        if (normalized.length >= 6 && normalized.length <= 180) {
          lines.push(`${keyPath || 'signal'}: ${normalized}`);
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${keyPath}[${index}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          walk(v, keyPath ? `${keyPath}.${k}` : k);
          if (lines.length >= max) break;
        }
      }
    };
    walk(input, '');
    return lines;
  },

  async tryGeminiJson(request: GeminiJsonRequest): Promise<{ data: any; meta: AgentResultMeta } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[Agents Service] GEMINI_API_KEY missing. Using deterministic fallback.');
      return null;
    }

    console.log('[Agents Service] Gemini prompt instruction:', request.instruction);

    for (const model of GEMINI_MODELS) {
      try {
        console.log('[Agents Service] Calling Gemini model:', model);
        const response = await fetch(`${GEMINI_URL_BASE}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${request.instruction}\n\nINPUT_JSON:\n${JSON.stringify(request.payload)}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 800,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          let parsedErrorMessage: string | undefined;
          try {
            const parsed = JSON.parse(errorBody);
            parsedErrorMessage = parsed?.error?.message;
          } catch {
            parsedErrorMessage = undefined;
          }

          console.warn('[Agents Service] Gemini model failed:', {
            model,
            status: response.status,
            statusText: response.statusText,
            parsedErrorMessage: parsedErrorMessage || 'N/A',
            rawErrorBody: errorBody || 'N/A',
          });
          continue;
        }

        const raw = (await response.json()) as any;
        const text: string | undefined = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          console.warn('[Agents Service] Gemini returned empty text for model:', model);
          continue;
        }
        const parsed = this.tryParseJsonBlock(text);
        if (!parsed) {
          console.warn('[Agents Service] Gemini raw text (first 500 chars):', text.slice(0, 500));
          console.warn('[Agents Service] Gemini output was not valid JSON for model:', model);
          continue;
        }

        console.log('[Agents Service] Gemini success with model:', model);

        return {
          data: parsed,
          meta: {
            generatedBy: 'gemini',
            model,
          },
        };
      } catch (error) {
        console.warn('[Agents] Gemini request failed, falling back to deterministic output.', error);
      }
    }

    console.warn('[Agents Service] All Gemini models failed. Using deterministic fallback.');
    return null;
  },

  async tryGeminiText(request: GeminiTextRequest): Promise<{ text: string; model: string } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    for (const model of GEMINI_MODELS) {
      try {
        console.log('[Agents Service] Calling Gemini text fallback with model:', model);
        const response = await fetch(`${GEMINI_URL_BASE}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${request.instruction}\n\nINPUT_JSON:\n${JSON.stringify(request.payload)}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 500,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          let parsedErrorMessage: string | undefined;
          try {
            const parsed = JSON.parse(errorBody);
            parsedErrorMessage = parsed?.error?.message;
          } catch {
            parsedErrorMessage = undefined;
          }

          console.warn('[Agents Service] Gemini text fallback model failed:', {
            model,
            status: response.status,
            statusText: response.statusText,
            parsedErrorMessage: parsedErrorMessage || 'N/A',
            rawErrorBody: errorBody || 'N/A',
          });
          continue;
        }

        const raw = (await response.json()) as any;
        const text: string | undefined = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text || !text.trim()) {
          console.warn('[Agents Service] Gemini text fallback returned empty text for model:', model);
          continue;
        }

        return { text: text.trim(), model };
      } catch (error) {
        console.warn('[Agents Service] Gemini text fallback threw error:', { model, error });
      }
    }

    return null;
  },

  tryParseJsonBlock(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      // Gemini often wraps JSON in markdown code fences.
      const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch {
          // Continue to object extraction fallback below.
        }
      }

      // Fallback: extract the first JSON object block from mixed text.
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          return null;
        }
      }

      return null;
    }
  },
};
