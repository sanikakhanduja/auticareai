import { Router } from 'express';
import { z } from 'zod';
import { progressAnalyticsService, TherapyType } from '../services/progressAnalytics';
import { llmExplanationService } from '../services/llmExplanationService';
import { progressInferenceService } from '../services/progressInferenceService';

const router = Router();

const therapyTypeSchema = z.enum(['speech', 'motor', 'social', 'behavioral']);
const roleSchema = z.enum(['parent', 'therapist', 'doctor']);

const score = z.number().min(0).max(1);

const sessionMetricsBodySchema = z.object({
  childId: z.string().uuid(),
  therapistId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  sessionDate: z.string().datetime().optional(),
  sessionDurationMinutes: z.number().int().min(1).max(300).default(45),
  therapyType: therapyTypeSchema,
  eyeContactScore: score.optional(),
  socialEngagementScore: score.optional(),
  emotionalRegulationScore: score.optional(),
  attentionSpanScore: score.optional(),
  communicationScore: score.optional(),
  motorCoordinationScore: score.optional(),
  sessionEngagementScore: score.optional(),
  responseLatencySeconds: z.number().min(0).max(600).optional(),
  gestureFrequency: z.number().min(0).max(10000).optional(),
  verbalUtterances: z.number().int().min(0).max(10000).optional(),
  attentionSpanSeconds: z.number().int().min(0).max(7200).optional(),
  cvModelVersion: z.string().max(120).optional(),
  cvConfidenceScore: score.optional(),
  videoQualityScore: score.optional(),
});

const getDefaultAnalytics = (therapyType: string) => ({
  child_id: '',
  therapy_type: therapyType,
  total_sessions: 0,
  average_eye_contact: 0,
  average_social_engagement: 0,
  average_emotional_regulation: 0,
  average_attention_span: 0,
  average_communication: 0,
  average_session_engagement: 0,
  eye_contact_trend: 'stable' as const,
  social_engagement_trend: 'stable' as const,
  emotional_regulation_trend: 'stable' as const,
  overall_trend: 'stable' as const,
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
    const data = await progressAnalyticsService.saveSessionMetrics({
      ...payload,
      sessionDate: payload.sessionDate || new Date().toISOString(),
    });

    return res.status(201).json({ data });
  } catch (error) {
    console.error('[Progress API] Failed to save metrics:', error);
    return res.status(500).json({ error: 'Failed to save session metrics' });
  }
});

router.get('/sessions', async (req, res) => {
  const parseResult = z
    .object({
      childId: z.string().uuid(),
      therapyType: therapyTypeSchema,
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.flatten() });
  }

  const { childId, therapyType, limit = 15 } = parseResult.data;

  try {
    const data = await progressAnalyticsService.getSessionSeries(childId, therapyType, limit);
    return res.json({ data });
  } catch (error) {
    console.error('[Progress API] Failed to load session series:', error);
    return res.status(500).json({ error: 'Failed to load session series' });
  }
});

router.get('/analytics', async (req, res) => {
  const parseResult = z
    .object({
      childId: z.string().uuid(),
      therapyType: therapyTypeSchema.optional(),
    })
    .safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.flatten() });
  }

  const { childId, therapyType } = parseResult.data;

  try {
    const data = await progressAnalyticsService.getAnalytics(childId, therapyType);
    return res.json({ data });
  } catch (error) {
    console.error('[Progress API] Failed to load analytics:', error);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
});

router.post('/analytics/compute', async (req, res) => {
  const parseResult = z
    .object({
      childId: z.string().uuid(),
      therapyType: therapyTypeSchema,
    })
    .safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
  }

  const { childId, therapyType } = parseResult.data;

  try {
    const analytics = await progressAnalyticsService.computeProgress(childId, therapyType as TherapyType);
    return res.json({ data: analytics });
  } catch (error) {
    console.error('[Progress API] Failed to compute analytics:', error);
    return res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

router.get('/alerts', async (req, res) => {
  const parseResult = z
    .object({
      childId: z.string().uuid(),
    })
    .safeParse(req.query);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parseResult.error.flatten() });
  }

  const { childId } = parseResult.data;

  try {
    const data = await progressAnalyticsService.getAlerts(childId);
    return res.json({ data });
  } catch (error) {
    console.error('[Progress API] Failed to load alerts:', error);
    return res.status(500).json({ error: 'Failed to load alerts' });
  }
});

router.post('/explanation', async (req, res) => {
  const parseResult = z
    .object({
      childId: z.string().uuid(),
      analytics: z.any().optional(),
      role: roleSchema,
      childName: z.string().min(1),
      therapyType: therapyTypeSchema,
      recentMilestones: z.array(z.string()).optional(),
    })
    .safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.flatten() });
  }

  try {
    const { role, childName, therapyType, childId } = parseResult.data;

    const context = await progressInferenceService.buildContext({
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

    const data = await llmExplanationService.generateExplanation({
      analytics: parseResult.data.analytics || getDefaultAnalytics(therapyType),
      role,
      childName,
      therapyType,
      recentMilestones: context.milestones,
    });

    await progressInferenceService.persistInference({
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
  } catch (error) {
    console.error('[Progress API] Failed to generate explanation:', error);
    return res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

export default router;
