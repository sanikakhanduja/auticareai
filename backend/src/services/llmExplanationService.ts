/**
 * =====================================================
 * LLM PROMPT TEMPLATES - ROLE-BASED SUMMARIES
 * =====================================================
 * Purpose: Convert structured numeric data into natural language
 * LLM does NOT compute or analyze - only explains
 * Input: Pre-computed structured analytics
 * Output: Role-specific human-readable summary
 * =====================================================
 */

import { ProgressAnalytics } from './progressAnalytics';

// =====================================================
// TYPES
// =====================================================

export interface LLMExplanationRequest {
  analytics: ProgressAnalytics;
  role: 'parent' | 'therapist' | 'doctor';
  childName: string;
  therapyType: string;
  recentMilestones?: string[];
}

export interface LLMExplanationResponse {
  summary: string;
  keyHighlights: string[];
  recommendations?: string[];
  tone: 'encouraging' | 'professional' | 'clinical';
}

// =====================================================
// PROMPT TEMPLATES
// =====================================================

export class TherapyProgressExplanationService {
  private static resolvedGeminiModel: string | null = null;
  private static llmBlockedUntilMs = 0;
  private static readonly GEMINI_MODEL_CANDIDATES = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];
  
  /**
   * Generate role-specific explanation
   * Calls LLM with structured data
   */
  static async generateExplanation(
    request: LLMExplanationRequest
  ): Promise<LLMExplanationResponse> {
    
    console.log('\n🤖 [LLM] Generating explanation for:', {
      childName: request.childName,
      role: request.role,
      therapyType: request.therapyType,
      totalSessions: request.analytics.total_sessions
    });
    
    try {
      const prompt = this.buildPrompt(request);
      
      // Call your LLM API (OpenAI, Anthropic, etc.)
      const llmResponse = await this.callLLM(prompt, request.role);
      
      return this.parseResponse(llmResponse, request.role);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/temporarily unavailable due to quota limits|quota|rate limit/i.test(message)) {
        console.warn('[LLM] Falling back to deterministic summary (quota/rate limit)');
      } else {
        console.error('[LLM] Falling back to deterministic summary:', error);
      }
      const fallbackSummary = this.buildFallbackSummary(request);
      return this.parseResponse(fallbackSummary, request.role);
    }
  }
  
  /**
   * Build role-specific prompt
   */
  private static buildPrompt(request: LLMExplanationRequest): string {
    const { analytics, role, childName, therapyType } = request;
    
    // Base structured data (same for all roles)
    const structuredData = `
CHILD: ${childName}
THERAPY TYPE: ${therapyType}
ANALYSIS PERIOD: Last 30 days
TOTAL SESSIONS: ${analytics.total_sessions}

== CURRENT PERFORMANCE (0.0 - 1.0 scale) ==
Eye Contact: ${this.safeNumber(analytics.average_eye_contact).toFixed(3)}
Social Engagement: ${this.safeNumber(analytics.average_social_engagement).toFixed(3)}
Emotional Regulation: ${this.safeNumber(analytics.average_emotional_regulation).toFixed(3)}
Attention Span: ${this.safeNumber(analytics.average_attention_span).toFixed(3)}
Communication: ${this.safeNumber(analytics.average_communication).toFixed(3)}
Session Engagement: ${this.safeNumber(analytics.average_session_engagement).toFixed(3)}

== TREND ANALYSIS ==
Eye Contact: ${analytics.eye_contact_trend} (${this.formatChange(this.safeNumber(analytics.eye_contact_change_pct))}%)
Social Engagement: ${analytics.social_engagement_trend} (${this.formatChange(this.safeNumber(analytics.social_engagement_change_pct))}%)
Emotional Regulation: ${analytics.emotional_regulation_trend} (${this.formatChange(this.safeNumber(analytics.emotional_regulation_change_pct))}%)
Overall Trend: ${analytics.overall_trend} (${this.formatChange(this.safeNumber(analytics.overall_improvement_pct))}%)

== PERFORMANCE ANALYSIS ==
Best Performing Metric: ${this.formatMetricName(analytics.best_performing_metric || 'unknown')}
Needs Attention: ${this.formatMetricName(analytics.needs_attention_metric || 'unknown')}
Consistency Score: ${this.safeNumber(analytics.consistency_score).toFixed(3)} (${this.getConsistencyLevel(this.safeNumber(analytics.consistency_score))})

== FLAGS ==
Regression Detected: ${analytics.has_regression ? 'YES' : 'NO'}
${analytics.has_regression ? `Regressing Metrics: ${analytics.regression_metrics.join(', ')}` : ''}
Stagnation Count: ${this.safeNumber(analytics.stagnation_count)}${this.safeNumber(analytics.stagnation_count) >= 3 ? ' ⚠️ ALERT' : ''}
`.trim();
    
    // Role-specific instructions
    const rolePrompts = {
      parent: this.getParentPrompt(structuredData, request),
      therapist: this.getTherapistPrompt(structuredData, request),
      doctor: this.getDoctorPrompt(structuredData, request),
    };
    
    return rolePrompts[role];
  }
  
  // =====================================================
  // ROLE-SPECIFIC PROMPTS
  // =====================================================
  
  /**
   * PARENT PROMPT: Encouraging, easy to understand, celebrates progress
   */
  private static getParentPrompt(data: string, request: LLMExplanationRequest): string {
    return `
You are a compassionate child development specialist explaining therapy progress to a parent.

YOUR TASK:
Convert the structured numeric data below into a warm, encouraging, and easy-to-understand summary for ${request.childName}'s parent.

TONE:
- Warm and supportive
- Celebrate improvements (even small ones)
- Frame challenges as "areas we're working on"
- Use everyday language (no technical jargon)
- Be honest but always end on a hopeful note

STRUCTURE YOUR RESPONSE:
1. **Overall Progress**: Start with the big picture (improving/stable/needs attention)
2. **What's Going Well**: Highlight strengths and improvements
3. **Areas We're Focusing On**: Gently mention areas needing work
4. **What This Means**: Translate metrics into real-world examples
5. **What You Can Do**: 1-2 simple things parents can practice at home

GUIDELINES:
- Use child's name: ${request.childName}
- Avoid saying "regression" - say "we noticed a small dip" or "taking a short break"
- Use percentages sparingly - focus on meaning
- If stagnation alert is active, frame as "plateau" and normal part of development
- If regression detected, acknowledge it gently but reassure it's common

STRUCTURED DATA:
${data}

${request.recentMilestones ? `\nRECENT MILESTONES:\n${request.recentMilestones.join('\n')}` : ''}

GENERATE:
A 150-200 word parent-friendly summary following the structure above.
`.trim();
  }
  
  /**
   * THERAPIST PROMPT: Professional, actionable, detailed
   */
  private static getTherapistPrompt(data: string, request: LLMExplanationRequest): string {
    return `
You are an experienced clinical therapist reviewing progress data for one of your clients.

YOUR TASK:
Convert the structured numeric data below into a professional clinical summary for ${request.childName}'s therapy progress.

TONE:
- Professional and precise
- Clinically accurate
- Action-oriented
- Objective but empathetic

STRUCTURE YOUR RESPONSE:
1. **Progress Summary**: Overall trajectory with specific metrics
2. **Metric Analysis**: Detailed breakdown of each key metric
3. **Clinical Observations**: What the trends suggest about development
4. **Recommended Interventions**: Specific therapeutic strategies to implement
5. **Session Planning**: Suggested focus areas for upcoming sessions

GUIDELINES:
- Use clinical terminology appropriately
- Reference specific metrics and percentage changes
- If regression detected, suggest possible causes and interventions
- If stagnation detected, recommend strategy adjustments
- Always include 2-3 concrete action items
- Consider consistency score when planning interventions

STRUCTURED DATA:
${data}

${request.recentMilestones ? `\nRECENT MILESTONES:\n${request.recentMilestones.join('\n')}` : ''}

GENERATE:
A 200-250 word professional therapist summary following the structure above.
`.trim();
  }
  
  /**
   * DOCTOR PROMPT: Clinical, diagnostic, concise
   */
  private static getDoctorPrompt(data: string, request: LLMExplanationRequest): string {
    return `
You are a developmental pediatrician reviewing therapy outcome data for diagnostic assessment.

YOUR TASK:
Convert the structured numeric data below into a concise clinical report for ${request.childName}'s medical records.

TONE:
- Clinical and objective
- Evidence-based
- Diagnostic focus
- Suitable for medical documentation

STRUCTURE YOUR RESPONSE:
1. **Clinical Summary**: Overall treatment response in medical terms
2. **Quantitative Outcomes**: Key metrics with numerical values
3. **Trend Analysis**: Improvement trajectory or concerning patterns
4. **Clinical Significance**: Medical interpretation of findings
5. **Recommendations**: Medical/diagnostic considerations

GUIDELINES:
- Use ICD/DSM-appropriate language
- Reference specific metrics and statistical trends
- If regression detected, note as "treatment response decline" with affected domains
- If stagnation detected, note as "plateau in therapeutic gains"
- Include consistency score as measure of treatment stability
- Suggest medication review if severe regression
- Recommend diagnostic reassessment if prolonged stagnation

STRUCTURED DATA:
${data}

${request.recentMilestones ? `\nTREATMENT MILESTONES:\n${request.recentMilestones.join('\n')}` : ''}

GENERATE:
A 150-200 word clinical report following the structure above, suitable for medical documentation.
`.trim();
  }
  
  // =====================================================
  // LLM INTEGRATION
  // =====================================================
  
  /**
   * Call LLM API using Google Gemini
   */
  private static async callLLM(prompt: string, role: string): Promise<string> {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured in .env file');
    }
    
    if (Date.now() < this.llmBlockedUntilMs) {
      const waitMs = this.llmBlockedUntilMs - Date.now();
      throw new Error(`LLM temporarily unavailable due to quota limits. Retry in ~${Math.ceil(waitMs / 1000)}s.`);
    }

    const model = await this.resolveGeminiModel(GEMINI_API_KEY);

    console.log('📡 [LLM] Calling Gemini API...');
    console.log('   Model:', model);
    console.log('   Role:', role);
    console.log('   Prompt length:', prompt.length, 'characters');
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a medical AI assistant specializing in developmental therapy for children with autism. You explain complex data in role-appropriate ways.\n\n${prompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
              topP: 0.95,
              topK: 40,
            },
          }),
        }
      );
      
      const data = await response.json() as any;
      
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        const apiMessage = data.error?.message || 'Unknown error';
        const retrySeconds = this.extractRetrySeconds(apiMessage);
        const isQuotaError = /quota|rate limit|exceeded/i.test(apiMessage);

        if (isQuotaError) {
          this.llmBlockedUntilMs = Date.now() + retrySeconds * 1000;
          console.warn(`⚠️ [LLM] Quota/rate-limited. Skipping Gemini until ${new Date(this.llmBlockedUntilMs).toISOString()}`);
        } else {
          console.error('❌ [LLM] Gemini API error:', apiMessage);
        }

        throw new Error(`Gemini API error: ${apiMessage}`);
      }
      
      // Extract text from Gemini response format
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        console.error('❌ [LLM] No content generated from Gemini API');
        throw new Error('No content generated from Gemini API');
      }
      
      console.log('✅ [LLM] Response received in', duration, 'ms');
      console.log('   Response length:', generatedText.length, 'characters');
      console.log('   Preview:', generatedText.substring(0, 100) + '...\n');
      
      return generatedText;
      
    } catch (error) {
      console.error('[LLM] Error calling Gemini API:', error);
      throw new Error(`Failed to generate explanation: ${(error as Error).message}`);
    }
  }
  
  /**
   * Parse LLM response into structured format
   */
  private static parseResponse(
    llmResponse: string,
    role: 'parent' | 'therapist' | 'doctor'
  ): LLMExplanationResponse {
    
    // Extract key highlights (look for bullet points or numbered items)
    const highlightRegex = /[•\-*]|(?:^\d+\.)/gm;
    const highlights = llmResponse
      .split('\n')
      .filter(line => highlightRegex.test(line.trim()))
      .map(line => line.replace(highlightRegex, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 5); // Max 5 highlights
    
    const toneMap = {
      parent: 'encouraging' as const,
      therapist: 'professional' as const,
      doctor: 'clinical' as const,
    };
    
    return {
      summary: llmResponse,
      keyHighlights: highlights.length > 0 ? highlights : [llmResponse.slice(0, 100) + '...'],
      tone: toneMap[role],
    };
  }
  
  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================
  
  private static formatChange(value: number): string {
    return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  }
  
  private static formatMetricName(metric: string): string {
    return metric
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  private static getConsistencyLevel(score: number): string {
    if (score >= 0.8) return 'Very Consistent';
    if (score >= 0.6) return 'Moderately Consistent';
    if (score >= 0.4) return 'Variable';
    return 'Inconsistent';
  }

  private static safeNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  private static buildFallbackSummary(request: LLMExplanationRequest): string {
    const overall = request.analytics?.overall_trend || 'stable';
    const improvement = this.safeNumber(request.analytics?.overall_improvement_pct).toFixed(1);
    const best = this.formatMetricName(request.analytics?.best_performing_metric || 'overall progress');
    const focus = this.formatMetricName(request.analytics?.needs_attention_metric || 'consistency');
    const sessions = this.safeNumber(request.analytics?.total_sessions);

    return `${request.childName} has ${overall} therapy progress over the last ${sessions} sessions in ${request.therapyType}. Overall change is ${improvement}%. Strongest area: ${best}. Focus area: ${focus}. Continue regular sessions and home practice while monitoring weekly progress for steady gains.`;
  }

  private static async resolveGeminiModel(apiKey: string): Promise<string> {
    const envModel = process.env.GEMINI_MODEL?.trim();
    if (envModel) {
      return envModel;
    }

    if (this.resolvedGeminiModel) {
      return this.resolvedGeminiModel;
    }

    try {
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );

      if (listResponse.ok) {
        const payload = (await listResponse.json()) as any;
        const models: any[] = Array.isArray(payload.models) ? payload.models : [];

        const supported = models.filter((m) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m?.name === 'string'
        );

        const supportedNames = supported.map((m) =>
          String(m.name).replace(/^models\//, '')
        );

        for (const candidate of this.GEMINI_MODEL_CANDIDATES) {
          if (supportedNames.includes(candidate)) {
            this.resolvedGeminiModel = candidate;
            return candidate;
          }
        }

        if (supportedNames.length > 0) {
          this.resolvedGeminiModel = supportedNames[0];
          return supportedNames[0];
        }
      }
    } catch (error) {
      console.warn('[LLM] Could not list Gemini models, using fallback candidate:', error);
    }

    this.resolvedGeminiModel = this.GEMINI_MODEL_CANDIDATES[0];
    return this.resolvedGeminiModel;
  }

  private static extractRetrySeconds(message: string): number {
    const match = message.match(/retry in\s+([\d.]+)s/i);
    const value = match ? Number(match[1]) : NaN;
    if (Number.isFinite(value) && value > 0) {
      return Math.ceil(value);
    }
    return 60;
  }
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*

// Example 1: Generate parent explanation
const parentExplanation = await TherapyProgressExplanationService.generateExplanation({
  analytics: computedAnalytics,
  role: 'parent',
  childName: 'Rahul',
  therapyType: 'Speech Therapy',
  recentMilestones: ['First consistent eye contact', 'Responded to name 3 times'],
});

console.log(parentExplanation.summary);
// Output: "Great news! Rahul is making wonderful progress in his speech therapy sessions..."

// Example 2: Generate therapist explanation
const therapistExplanation = await TherapyProgressExplanationService.generateExplanation({
  analytics: computedAnalytics,
  role: 'therapist',
  childName: 'Rahul',
  therapyType: 'Speech Therapy',
});

console.log(therapistExplanation.summary);
// Output: "Clinical Summary: Rahul demonstrates consistent improvement across multiple developmental domains..."

// Example 3: Generate doctor explanation
const doctorExplanation = await TherapyProgressExplanationService.generateExplanation({
  analytics: computedAnalytics,
  role: 'doctor',
  childName: 'Rahul',
  therapyType: 'Speech Therapy',
});

console.log(doctorExplanation.summary);
// Output: "Treatment Response: Patient exhibits positive response to speech therapy interventions..."

*/

// =====================================================
// EXPORT
// =====================================================

export const llmExplanationService = {
  async generateExplanation(request: LLMExplanationRequest) {
    return await TherapyProgressExplanationService.generateExplanation(request);
  },
  
  async generateMultiRoleExplanations(
    analytics: ProgressAnalytics,
    childName: string,
    therapyType: string,
    milestones?: string[]
  ) {
    const [parent, therapist, doctor] = await Promise.all([
      TherapyProgressExplanationService.generateExplanation({
        analytics,
        role: 'parent',
        childName,
        therapyType,
        recentMilestones: milestones,
      }),
      TherapyProgressExplanationService.generateExplanation({
        analytics,
        role: 'therapist',
        childName,
        therapyType,
        recentMilestones: milestones,
      }),
      TherapyProgressExplanationService.generateExplanation({
        analytics,
        role: 'doctor',
        childName,
        therapyType,
        recentMilestones: milestones,
      }),
    ]);
    
    return { parent, therapist, doctor };
  },
};
