"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentOrchestrationService = void 0;
const supabase_1 = require("../config/supabase");
const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = (process.env.GEMINI_MODELS?.split(',').map((m) => m.trim()).filter(Boolean) || [
    'gemini-2.5-flash',
]);
const CLINICAL_SUMMARY_MIN_WORDS = 12;
const CLINICAL_SUMMARY_MAX_WORDS = 24;
const THERAPY_PLAN_MIN_WORDS = 12;
const THERAPY_PLAN_MAX_WORDS = 24;
exports.agentOrchestrationService = {
    async getLatestClinicalSummaryForChild(childId) {
        const { data, error } = await supabase_1.supabase
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
        return data || null;
    },
    async getLatestDiagnosticReportForChild(childId) {
        const { data, error } = await supabase_1.supabase
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
        return data || null;
    },
    async getChildAgeYears(childId) {
        const { data, error } = await supabase_1.supabase
            .from('children')
            .select('date_of_birth')
            .eq('id', childId)
            .maybeSingle();
        if (error || !data?.date_of_birth) {
            return 3;
        }
        const dob = new Date(data.date_of_birth);
        if (Number.isNaN(dob.getTime()))
            return 3;
        return Math.max(1, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
    },
    async getLatestTherapyPlanForChild(childId) {
        const { data, error } = await supabase_1.supabase
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
        return data || null;
    },
    async getTherapyPlanForSourceReport(childId, sourceReportId) {
        const { data, error } = await supabase_1.supabase
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
        return data || null;
    },
    async persistTherapyPlan(input) {
        const { childId, sourceReportId, planJson, generatedBy, model } = input;
        const { error } = await supabase_1.supabase.from('therapy_plans').insert({
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
    async getLatestScreeningForChild(childId) {
        const { data, error } = await supabase_1.supabase
            .from('screening_results')
            .select('id, child_id, risk_level, cv_report, created_at')
            .eq('child_id', childId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to load screening report: ${error.message}`);
        }
        return data || null;
    },
    async getChildName(childId) {
        const { data, error } = await supabase_1.supabase
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
    async getCachedClinicalSummary(childId, sourceScreeningId, role) {
        const { data, error } = await supabase_1.supabase
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
        return data || null;
    },
    async persistClinicalSummary(input) {
        const { childId, sourceScreeningId, role, summaryJson, generatedBy, model } = input;
        const { error } = await supabase_1.supabase.from('clinical_summaries').insert({
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
    async generateClinicalSummary(input) {
        console.log('[Agents Service] generateClinicalSummary start', {
            childName: input.childName,
            role: input.role,
        });
        const deterministic = this.buildClinicalSummaryDeterministic(input);
        let normalized = this.normalizeClinicalSummary(deterministic);
        let meta = { generatedBy: 'deterministic' };
        const textInference = await this.tryGeminiText({
            instruction: [
                'You are a clinical assistant for doctors reviewing autism screening outputs.',
                `Write exactly one short English inference sentence for doctor-facing UI, ${CLINICAL_SUMMARY_MIN_WORDS}-${CLINICAL_SUMMARY_MAX_WORDS} words.`,
                'Start with reported risk level (and confidence if available).',
                'Then include the most important objective signal insight (value vs baseline).',
                'Mention relevant behavioral indicators if present.',
                'End with one practical clinical next step (evaluation, follow-up, or referral).',
                'No markdown, no bullets, no headings, and no prefixes like "Sure", "Here is", or "Summary:".',
            ].join(' '),
            payload: input,
        });
        if (textInference?.text) {
            let cleaned = this.cleanClinicalText(textInference.text);
            cleaned = await this.ensureClinicalSummaryWordRange(cleaned, input);
            normalized = {
                ...normalized,
                overview: cleaned,
                keyFindings: [],
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
    async generateTherapyPlan(input) {
        console.log('[Agents Service] generateTherapyPlan start', {
            childName: input.childName,
            severityLevel: input.severityLevel,
            ageYears: input.ageYears,
        });
        const deterministic = this.buildTherapyPlanDeterministic(input);
        let data = { ...deterministic };
        let meta = { generatedBy: 'deterministic' };
        const textInference = await this.tryGeminiText({
            instruction: [
                'You are a pediatric therapy planning assistant.',
                `Write exactly one short English inference sentence (${THERAPY_PLAN_MIN_WORDS}-${THERAPY_PLAN_MAX_WORDS} words).`,
                'Focus on top priorities, immediate therapist actions, and one home carryover suggestion.',
                'No markdown, no bullets, no headings.',
            ].join(' '),
            payload: input,
        });
        if (textInference?.text) {
            let cleaned = this.cleanClinicalText(textInference.text);
            cleaned = await this.ensureTherapyPlanWordRange(cleaned, input);
            data = {
                ...data,
                aiInsightsParagraph: cleaned,
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
    async generateMonitoringInference(input) {
        console.log('[Agents Service] generateMonitoringInference start', {
            childName: input.childName,
            role: input.role,
            metricSeriesCount: input.metricSeries.length,
        });
        const deterministic = this.buildMonitoringDeterministic(input);
        const llm = await this.tryGeminiJson({
            instruction: 'Given metric deltas and therapist feedback, produce monitoring inference JSON with keys: overview, metricInsights[], riskFlags[], nextActions[]. Return strict JSON only.',
            payload: input,
        });
        return {
            data: llm?.data || deterministic,
            meta: llm?.meta || { generatedBy: 'deterministic' },
        };
    },
    buildClinicalSummaryDeterministic(input) {
        const report = input.screeningReport || {};
        const level = String(report?.risk_assessment?.level || report?.riskLevel || 'unknown');
        const confidence = report?.risk_assessment?.confidence;
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
    normalizeClinicalSummary(data) {
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
                    .map((entry) => ({
                    name: String(entry?.name || ''),
                    value: String(entry?.value || 'NA'),
                    baseline: String(entry?.baseline || 'NA'),
                    status: String(entry?.status || 'unknown'),
                }))
                    .filter((entry) => entry.name)
                : [],
            behavioralIndicators: Array.isArray(normalized.behavioralIndicators)
                ? normalized.behavioralIndicators.map(String)
                : [],
        };
    },
    extractObjectiveSignals(report) {
        const raw = report?.metrics?.objective_signals || {};
        const signals = [];
        for (const [name, signal] of Object.entries(raw)) {
            signals.push({
                name: String(name).replace(/_/g, ' '),
                value: String(signal?.value ?? 'NA'),
                baseline: String(signal?.baseline ?? 'NA'),
                status: String(signal?.status ?? 'unknown').replace(/_/g, ' '),
            });
        }
        return signals;
    },
    extractBehavioralIndicators(report) {
        const indicators = report?.behavioral_indicators || report?.behavioralIndicators;
        if (Array.isArray(indicators)) {
            return indicators.map((value) => String(value));
        }
        return this
            .flattenStringSignals(report, 30)
            .filter((line) => /behavior|social|communication|gaze|repetitive|engagement/i.test(line))
            .slice(0, 6);
    },
    extractBulletLines(text) {
        return text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => line.replace(/^[-*•]\s*/, ''))
            .filter((line) => line.length > 0);
    },
    extractSentenceLines(text) {
        return text
            .split(/(?<=[.!?])\s+/)
            .map((line) => line.trim())
            .filter(Boolean);
    },
    cleanClinicalText(text) {
        return text
            .replace(/^\s*(sure|certainly|here(?:'s| is)|clinical summary|summary)\s*[:,.-]?\s*/i, '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },
    countWords(text) {
        return (text.match(/\b[\w'-]+\b/g) || []).length;
    },
    async ensureClinicalSummaryWordRange(text, input) {
        const wordCount = this.countWords(text);
        if (wordCount >= CLINICAL_SUMMARY_MIN_WORDS && wordCount <= CLINICAL_SUMMARY_MAX_WORDS) {
            return text;
        }
        const rewrite = await this.tryGeminiText({
            instruction: [
                `Rewrite DRAFT as exactly one short English inference sentence with ${CLINICAL_SUMMARY_MIN_WORDS}-${CLINICAL_SUMMARY_MAX_WORDS} words.`,
                'Keep only facts present in INPUT_JSON and DRAFT.',
                'No markdown, no bullets, no headings.',
            ].join(' '),
            payload: {
                draft: text,
                input,
            },
        });
        if (!rewrite?.text) {
            return text;
        }
        const cleaned = this.cleanClinicalText(rewrite.text);
        const cleanedWordCount = this.countWords(cleaned);
        if (cleanedWordCount >= CLINICAL_SUMMARY_MIN_WORDS && cleanedWordCount <= CLINICAL_SUMMARY_MAX_WORDS) {
            return cleaned;
        }
        return text;
    },
    async ensureTherapyPlanWordRange(text, input) {
        const wordCount = this.countWords(text);
        if (wordCount >= THERAPY_PLAN_MIN_WORDS && wordCount <= THERAPY_PLAN_MAX_WORDS) {
            return text;
        }
        const rewrite = await this.tryGeminiText({
            instruction: [
                `Rewrite DRAFT as exactly one short English inference sentence with ${THERAPY_PLAN_MIN_WORDS}-${THERAPY_PLAN_MAX_WORDS} words.`,
                'Keep only facts present in INPUT_JSON and DRAFT.',
                'No markdown, no bullets, no headings.',
            ].join(' '),
            payload: {
                draft: text,
                input,
            },
        });
        if (!rewrite?.text) {
            return text;
        }
        const cleaned = this.cleanClinicalText(rewrite.text);
        const cleanedWordCount = this.countWords(cleaned);
        if (cleanedWordCount >= THERAPY_PLAN_MIN_WORDS && cleanedWordCount <= THERAPY_PLAN_MAX_WORDS) {
            return cleaned;
        }
        return text;
    },
    extractGeminiText(raw) {
        const parts = raw?.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) {
            return null;
        }
        const text = parts
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .join('')
            .trim();
        return text || null;
    },
    buildTherapyPlanDeterministic(input) {
        const baseIntensity = input.severityLevel === 'high' ? 'high' : input.severityLevel === 'moderate' ? 'moderate' : 'light';
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
    buildMonitoringDeterministic(input) {
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
    flattenStringSignals(input, max) {
        const lines = [];
        const walk = (value, keyPath) => {
            if (lines.length >= max)
                return;
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
                for (const [k, v] of Object.entries(value)) {
                    walk(v, keyPath ? `${keyPath}.${k}` : k);
                    if (lines.length >= max)
                        break;
                }
            }
        };
        walk(input, '');
        return lines;
    },
    async tryGeminiJson(request) {
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
                    let parsedErrorMessage;
                    try {
                        const parsed = JSON.parse(errorBody);
                        parsedErrorMessage = parsed?.error?.message;
                    }
                    catch {
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
                const raw = (await response.json());
                const text = this.extractGeminiText(raw);
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
            }
            catch (error) {
                console.warn('[Agents] Gemini request failed, falling back to deterministic output.', error);
            }
        }
        console.warn('[Agents Service] All Gemini models failed. Using deterministic fallback.');
        return null;
    },
    async tryGeminiText(request) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey)
            return null;
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
                    let parsedErrorMessage;
                    try {
                        const parsed = JSON.parse(errorBody);
                        parsedErrorMessage = parsed?.error?.message;
                    }
                    catch {
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
                const raw = (await response.json());
                const text = this.extractGeminiText(raw);
                if (!text || !text.trim()) {
                    console.warn('[Agents Service] Gemini text fallback returned empty text for model:', model);
                    continue;
                }
                return { text: text.trim(), model };
            }
            catch (error) {
                console.warn('[Agents Service] Gemini text fallback threw error:', { model, error });
            }
        }
        return null;
    },
    tryParseJsonBlock(text) {
        try {
            return JSON.parse(text);
        }
        catch {
            // Gemini often wraps JSON in markdown code fences.
            const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i);
            if (match) {
                try {
                    return JSON.parse(match[1].trim());
                }
                catch {
                    // Continue to object extraction fallback below.
                }
            }
            // Fallback: extract the first JSON object block from mixed text.
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    return JSON.parse(text.slice(start, end + 1));
                }
                catch {
                    return null;
                }
            }
            return null;
        }
    },
};
