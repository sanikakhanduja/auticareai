"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const progressAnalytics_1 = require("../services/progressAnalytics");
const llmExplanationService_1 = require("../services/llmExplanationService");
const progressInferenceService_1 = require("../services/progressInferenceService");
const router = (0, express_1.Router)();
const therapyTypeSchema = zod_1.z.enum(['speech', 'motor', 'social', 'behavioral']);
const roleSchema = zod_1.z.enum(['parent', 'therapist', 'doctor']);
const score = zod_1.z.number().min(0).max(1);
const sessionMetricsBodySchema = zod_1.z.object({
    childId: zod_1.z.string().uuid(),
    therapistId: zod_1.z.string().uuid(),
    sessionId: zod_1.z.string().uuid().optional(),
    sessionDate: zod_1.z.string().datetime().optional(),
    sessionDurationMinutes: zod_1.z.number().int().min(1).max(300).default(45),
    therapyType: therapyTypeSchema,
    eyeContactScore: score.optional(),
    socialEngagementScore: score.optional(),
    emotionalRegulationScore: score.optional(),
    attentionSpanScore: score.optional(),
    communicationScore: score.optional(),
    motorCoordinationScore: score.optional(),
    sessionEngagementScore: score.optional(),
    responseLatencySeconds: zod_1.z.number().min(0).max(600).optional(),
    gestureFrequency: zod_1.z.number().min(0).max(10000).optional(),
    verbalUtterances: zod_1.z.number().int().min(0).max(10000).optional(),
    attentionSpanSeconds: zod_1.z.number().int().min(0).max(7200).optional(),
    cvModelVersion: zod_1.z.string().max(120).optional(),
    cvConfidenceScore: score.optional(),
    videoQualityScore: score.optional(),
});
const getDefaultAnalytics = (therapyType) => ({
    child_id: '',
    therapy_type: therapyType,
    total_sessions: 0,
    average_eye_contact: 0,
    average_social_engagement: 0,
    average_emotional_regulation: 0,
    average_attention_span: 0,
    average_communication: 0,
    average_session_engagement: 0,
    eye_contact_trend: 'stable',
    social_engagement_trend: 'stable',
    emotional_regulation_trend: 'stable',
    overall_trend: 'stable',
    eye_contact_change_pct: 0,
    social_engagement_change_pct: 0,
    emotional_regulation_change_pct: 0,
    overall_improvement_pct: 0,
    has_regression: false,
    regression_metrics: [],
    stagnation_count: 0,
    consistency_score: 1,
    best_performing_metric: 'report_based',
    needs_attention_metric: 'report_based',
});
router.post('/metrics', async (req, res) => {
    const parseResult = sessionMetricsBodySchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid session metrics payload', details: parseResult.error.flatten() });
    }
    const payload = parseResult.data;
    try {
        const data = await progressAnalytics_1.progressAnalyticsService.saveSessionMetrics({
            ...payload,
            sessionDate: payload.sessionDate || new Date().toISOString(),
        });
        return res.status(201).json({ data });
    }
    catch (error) {
        console.error('[Progress API] Failed to save metrics:', error);
        return res.status(500).json({ error: 'Failed to save session metrics' });
    }
});
router.get('/sessions', async (req, res) => {
    const parseResult = zod_1.z
        .object({
        childId: zod_1.z.string().uuid(),
        therapyType: therapyTypeSchema,
        limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
    })
        .safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.flatten() });
    }
    const { childId, therapyType, limit = 15 } = parseResult.data;
    try {
        const data = await progressAnalytics_1.progressAnalyticsService.getSessionSeries(childId, therapyType, limit);
        return res.json({ data });
    }
    catch (error) {
        console.error('[Progress API] Failed to load session series:', error);
        return res.status(500).json({ error: 'Failed to load session series' });
    }
});
router.get('/analytics', async (req, res) => {
    const parseResult = zod_1.z
        .object({
        childId: zod_1.z.string().uuid(),
        therapyType: therapyTypeSchema.optional(),
    })
        .safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.flatten() });
    }
    const { childId, therapyType } = parseResult.data;
    try {
        const data = await progressAnalytics_1.progressAnalyticsService.getAnalytics(childId, therapyType);
        return res.json({ data });
    }
    catch (error) {
        console.error('[Progress API] Failed to load analytics:', error);
        return res.status(500).json({ error: 'Failed to load analytics' });
    }
});
router.post('/analytics/compute', async (req, res) => {
    const parseResult = zod_1.z
        .object({
        childId: zod_1.z.string().uuid(),
        therapyType: therapyTypeSchema,
    })
        .safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }
    const { childId, therapyType } = parseResult.data;
    try {
        const analytics = await progressAnalytics_1.progressAnalyticsService.computeProgress(childId, therapyType);
        return res.json({ data: analytics });
    }
    catch (error) {
        console.error('[Progress API] Failed to compute analytics:', error);
        return res.status(500).json({ error: 'Failed to compute analytics' });
    }
});
router.get('/alerts', async (req, res) => {
    const parseResult = zod_1.z
        .object({
        childId: zod_1.z.string().uuid(),
    })
        .safeParse(req.query);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.flatten() });
    }
    const { childId } = parseResult.data;
    try {
        const data = await progressAnalytics_1.progressAnalyticsService.getAlerts(childId);
        return res.json({ data });
    }
    catch (error) {
        console.error('[Progress API] Failed to load alerts:', error);
        return res.status(500).json({ error: 'Failed to load alerts' });
    }
});
router.post('/explanation', async (req, res) => {
    const parseResult = zod_1.z
        .object({
        childId: zod_1.z.string().uuid(),
        analytics: zod_1.z.any().optional(),
        role: roleSchema,
        childName: zod_1.z.string().min(1),
        therapyType: therapyTypeSchema,
        recentMilestones: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }
    try {
        const { role, childName, therapyType, childId } = parseResult.data;
        const context = await progressInferenceService_1.progressInferenceService.buildContext({
            childId,
            therapyType,
            role,
            existingMilestones: parseResult.data.recentMilestones,
        });
        if (context.cachedSummaryForSource) {
            return res.json({
                data: {
                    summary: context.cachedSummaryForSource,
                    keyHighlights: [context.cachedSummaryForSource.slice(0, 120) + '...'],
                    tone: role === 'parent' ? 'encouraging' : role === 'therapist' ? 'professional' : 'clinical',
                },
            });
        }
        const data = await llmExplanationService_1.llmExplanationService.generateExplanation({
            analytics: parseResult.data.analytics || getDefaultAnalytics(therapyType),
            role,
            childName,
            therapyType,
            recentMilestones: context.milestones,
        });
        await progressInferenceService_1.progressInferenceService.persistInference({
            childId,
            therapyType,
            role,
            summary: data.summary,
            sourceReportId: context.sourceReportId,
            previousInferenceId: context.previousInferenceId,
            metadata: {
                usedReportsCount: context.usedReportsCount,
            },
        });
        return res.json({ data });
    }
    catch (error) {
        console.error('[Progress API] Failed to generate explanation:', error);
        return res.status(500).json({ error: 'Failed to generate explanation' });
    }
});
exports.default = router;
