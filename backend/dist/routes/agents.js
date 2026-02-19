"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const agentOrchestrationService_1 = require("../services/agentOrchestrationService");
const router = (0, express_1.Router)();
const roleSchema = zod_1.z.enum(['parent', 'therapist', 'doctor']);
const severitySchema = zod_1.z.enum(['low', 'moderate', 'high']);
const clinicalSummarySchema = zod_1.z.object({
    childName: zod_1.z.string().min(1),
    role: roleSchema,
    screeningReport: zod_1.z.record(zod_1.z.any()),
});
const clinicalSummaryByChildSchema = zod_1.z.object({
    childId: zod_1.z.string().uuid(),
    role: roleSchema.default('doctor'),
    forceRefresh: zod_1.z.boolean().optional().default(false),
});
const therapyPlanningSchema = zod_1.z.object({
    childName: zod_1.z.string().min(1),
    diagnosis: zod_1.z.string().min(1),
    severityLevel: severitySchema,
    ageYears: zod_1.z.number().min(1).max(25),
    primaryChallenges: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    constraints: zod_1.z.array(zod_1.z.string().min(1)).optional(),
});
const therapyPlanningByChildSchema = zod_1.z.object({
    childId: zod_1.z.string().uuid(),
});
const monitoringInferenceSchema = zod_1.z.object({
    childName: zod_1.z.string().min(1),
    role: roleSchema,
    metricSeries: zod_1.z
        .array(zod_1.z.object({
        metric: zod_1.z.string().min(1),
        previous: zod_1.z.number(),
        current: zod_1.z.number(),
        higherIsBetter: zod_1.z.boolean().optional(),
    }))
        .min(1),
    therapistSessionFeedback: zod_1.z
        .array(zod_1.z.object({
        sessionDate: zod_1.z.string().min(1),
        strengths: zod_1.z.array(zod_1.z.string()),
        concerns: zod_1.z.array(zod_1.z.string()),
        notes: zod_1.z.string().optional(),
    }))
        .optional(),
});
router.get('/contracts', (_req, res) => {
    return res.json({
        agents: {
            screening: {
                status: 'existing',
                note: 'Handled by CV + questionnaire flow under /api/screening',
            },
            clinicalSummary: {
                endpoint: 'POST /api/agents/clinical-summary',
                input: {
                    childName: 'string',
                    role: 'parent|therapist|doctor',
                    screeningReport: 'object',
                },
            },
            clinicalSummaryByChild: {
                endpoint: 'POST /api/agents/clinical-summary/by-child',
                input: {
                    childId: 'uuid',
                    role: 'parent|therapist|doctor',
                    forceRefresh: 'boolean?',
                },
            },
            therapyPlanning: {
                endpoint: 'POST /api/agents/therapy-planning',
                input: {
                    childName: 'string',
                    diagnosis: 'string',
                    severityLevel: 'low|moderate|high',
                    ageYears: 'number',
                    primaryChallenges: 'string[]',
                    constraints: 'string[]?',
                },
            },
            therapyPlanningByChild: {
                endpoint: 'POST /api/agents/therapy-planning/by-child',
                input: {
                    childId: 'uuid',
                },
            },
            therapyPlanningGenerateByChild: {
                endpoint: 'POST /api/agents/therapy-planning/by-child/generate',
                input: {
                    childId: 'uuid',
                },
            },
            monitoringInference: {
                endpoint: 'POST /api/agents/monitoring-inference',
                input: {
                    childName: 'string',
                    role: 'parent|therapist|doctor',
                    metricSeries: '[{ metric, previous, current, higherIsBetter? }]',
                    therapistSessionFeedback: '[{ sessionDate, strengths[], concerns[], notes? }]?',
                },
            },
        },
    });
});
router.post('/clinical-summary', async (req, res) => {
    console.log('[Agents API] POST /clinical-summary received');
    const parsed = clinicalSummarySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid clinical summary payload', details: parsed.error.flatten() });
    }
    try {
        console.log('[Agents API] clinical-summary payload:', {
            childName: parsed.data.childName,
            role: parsed.data.role,
            reportKeys: Object.keys(parsed.data.screeningReport || {}),
        });
        const result = await agentOrchestrationService_1.agentOrchestrationService.generateClinicalSummary(parsed.data);
        console.log('[Agents API] clinical-summary response source:', result.meta?.generatedBy || 'deterministic');
        return res.json(result);
    }
    catch (error) {
        console.error('[Agents API] Failed to generate clinical summary', error);
        return res.status(500).json({ error: 'Failed to generate clinical summary' });
    }
});
router.post('/clinical-summary/by-child', async (req, res) => {
    console.log('[Agents API] POST /clinical-summary/by-child received');
    const parsed = clinicalSummaryByChildSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid clinical summary by-child payload', details: parsed.error.flatten() });
    }
    const { childId } = parsed.data;
    try {
        const cached = await agentOrchestrationService_1.agentOrchestrationService.getLatestClinicalSummaryForChild(childId);
        if (!cached?.summary_json) {
            return res.status(404).json({
                error: 'No cached clinical summary found for this child. Run screening to generate summary.',
            });
        }
        console.log('[Agents API] clinical-summary/by-child cache hit', {
            childId,
            sourceScreeningId: cached.source_screening_id,
            generatedBy: cached.generated_by,
        });
        return res.json({
            data: cached.summary_json,
            meta: {
                generatedBy: cached.generated_by,
                model: cached.model || undefined,
                cached: true,
            },
            sourceScreeningId: cached.source_screening_id,
        });
    }
    catch (error) {
        console.error('[Agents API] Failed to fetch by-child clinical summary', error);
        return res.status(500).json({ error: 'Failed to fetch by-child clinical summary' });
    }
});
router.post('/therapy-planning', async (req, res) => {
    console.log('[Agents API] POST /therapy-planning received');
    const parsed = therapyPlanningSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid therapy planning payload', details: parsed.error.flatten() });
    }
    try {
        console.log('[Agents API] therapy-planning payload:', {
            childName: parsed.data.childName,
            severityLevel: parsed.data.severityLevel,
            ageYears: parsed.data.ageYears,
            challengesCount: parsed.data.primaryChallenges.length,
        });
        const result = await agentOrchestrationService_1.agentOrchestrationService.generateTherapyPlan(parsed.data);
        console.log('[Agents API] therapy-planning response source:', result.meta?.generatedBy || 'deterministic');
        return res.json(result);
    }
    catch (error) {
        console.error('[Agents API] Failed to generate therapy plan', error);
        return res.status(500).json({ error: 'Failed to generate therapy plan' });
    }
});
router.post('/therapy-planning/by-child', async (req, res) => {
    console.log('[Agents API] POST /therapy-planning/by-child received');
    const parsed = therapyPlanningByChildSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid therapy planning by-child payload', details: parsed.error.flatten() });
    }
    const { childId } = parsed.data;
    try {
        const cached = await agentOrchestrationService_1.agentOrchestrationService.getLatestTherapyPlanForChild(childId);
        if (!cached?.plan_json) {
            return res.status(404).json({
                error: 'No cached therapy plan found for this child. Generate after diagnostic report.',
            });
        }
        return res.json({
            data: cached.plan_json,
            meta: {
                generatedBy: cached.generated_by,
                model: cached.model || undefined,
                cached: true,
            },
            sourceReportId: cached.source_report_id,
        });
    }
    catch (error) {
        console.error('[Agents API] Failed to fetch cached therapy plan', error);
        return res.status(500).json({ error: 'Failed to fetch cached therapy plan' });
    }
});
router.post('/therapy-planning/by-child/generate', async (req, res) => {
    console.log('[Agents API] POST /therapy-planning/by-child/generate received');
    const parsed = therapyPlanningByChildSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid therapy planning generate payload', details: parsed.error.flatten() });
    }
    const { childId } = parsed.data;
    try {
        const diagnostic = await agentOrchestrationService_1.agentOrchestrationService.getLatestDiagnosticReportForChild(childId);
        if (!diagnostic?.content) {
            return res.status(404).json({ error: 'No diagnostic report found for this child' });
        }
        console.log('[Agents API] therapy-planning/by-child/generate diagnostic found', {
            childId,
            diagnosticReportId: diagnostic.id,
            diagnosticCreatedAt: diagnostic.created_at,
        });
        const existing = await agentOrchestrationService_1.agentOrchestrationService.getTherapyPlanForSourceReport(childId, diagnostic.id);
        if (existing?.plan_json && existing.generated_by === 'gemini') {
            console.log('[Agents API] therapy-planning/by-child/generate cache hit', {
                childId,
                sourceReportId: diagnostic.id,
                generatedBy: existing.generated_by,
                model: existing.model || null,
            });
            return res.json({
                data: existing.plan_json,
                meta: {
                    generatedBy: existing.generated_by,
                    model: existing.model || undefined,
                    cached: true,
                },
                sourceReportId: diagnostic.id,
            });
        }
        if (existing?.plan_json && existing.generated_by === 'deterministic') {
            console.log('[Agents API] therapy-planning/by-child/generate deterministic cache found; regenerating with Gemini.', {
                childId,
                sourceReportId: diagnostic.id,
            });
        }
        console.log('[Agents API] therapy-planning/by-child/generate cache miss; generating via orchestration', {
            childId,
            sourceReportId: diagnostic.id,
        });
        const childName = await agentOrchestrationService_1.agentOrchestrationService.getChildName(childId);
        const ageYears = await agentOrchestrationService_1.agentOrchestrationService.getChildAgeYears(childId);
        const riskRaw = String(diagnostic.content?.cvRiskLevel || '').toLowerCase();
        const severityLevel = riskRaw.includes('high')
            ? 'high'
            : riskRaw.includes('low')
                ? 'low'
                : 'moderate';
        const primaryChallenges = Array.isArray(diagnostic.content?.developmentalGaps)
            ? diagnostic.content.developmentalGaps
            : ['Social communication'];
        const result = await agentOrchestrationService_1.agentOrchestrationService.generateTherapyPlan({
            childName,
            diagnosis: diagnostic.content?.diagnosisConfirmation ||
                diagnostic.content?.screeningSummary ||
                'Developmental concerns confirmed on diagnostic review',
            severityLevel,
            ageYears,
            primaryChallenges,
            constraints: ['Therapist-reviewed recommendations only'],
        });
        await agentOrchestrationService_1.agentOrchestrationService.persistTherapyPlan({
            childId,
            sourceReportId: diagnostic.id,
            planJson: result.data,
            generatedBy: result.meta.generatedBy,
            model: result.meta.model,
        });
        console.log('[Agents API] therapy-planning/by-child/generate completed', {
            childId,
            sourceReportId: diagnostic.id,
            generatedBy: result.meta.generatedBy,
            model: result.meta.model || null,
        });
        return res.json({
            ...result,
            sourceReportId: diagnostic.id,
        });
    }
    catch (error) {
        console.error('[Agents API] Failed to generate therapy plan by child', error);
        return res.status(500).json({ error: 'Failed to generate therapy plan by child' });
    }
});
router.post('/monitoring-inference', async (req, res) => {
    console.log('[Agents API] POST /monitoring-inference received');
    const parsed = monitoringInferenceSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid monitoring payload', details: parsed.error.flatten() });
    }
    try {
        console.log('[Agents API] monitoring-inference payload:', {
            childName: parsed.data.childName,
            role: parsed.data.role,
            metricSeriesCount: parsed.data.metricSeries.length,
            feedbackCount: parsed.data.therapistSessionFeedback?.length || 0,
        });
        const result = await agentOrchestrationService_1.agentOrchestrationService.generateMonitoringInference(parsed.data);
        console.log('[Agents API] monitoring-inference response source:', result.meta?.generatedBy || 'deterministic');
        return res.json(result);
    }
    catch (error) {
        console.error('[Agents API] Failed to generate monitoring inference', error);
        return res.status(500).json({ error: 'Failed to generate monitoring inference' });
    }
});
exports.default = router;
