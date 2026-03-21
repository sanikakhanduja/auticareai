import { Router } from 'express';
import { z } from 'zod';
import { agentOrchestrationService } from '../services/agentOrchestrationService';

const router = Router();

const roleSchema = z.enum(['parent', 'therapist', 'doctor']);
const severitySchema = z.enum(['low', 'moderate', 'high']);

const clinicalSummarySchema = z.object({
  childName: z.string().min(1),
  role: roleSchema,
  screeningReport: z.record(z.any()),
});

const clinicalSummaryByChildSchema = z.object({
  childId: z.string().uuid(),
  role: roleSchema.default('doctor'),
  forceRefresh: z.boolean().optional().default(false),
});

const therapyPlanningSchema = z.object({
  childName: z.string().min(1),
  diagnosis: z.string().min(1),
  severityLevel: severitySchema,
  ageYears: z.number().min(1).max(25),
  primaryChallenges: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).optional(),
});

const therapyPlanningByChildSchema = z.object({
  childId: z.string().uuid(),
  forceRefresh: z.boolean().optional().default(false),
});

const monitoringInferenceSchema = z.object({
  childName: z.string().min(1),
  role: roleSchema,
  metricSeries: z
    .array(
      z.object({
        metric: z.string().min(1),
        previous: z.number(),
        current: z.number(),
        higherIsBetter: z.boolean().optional(),
      })
    )
    .min(1),
  therapistSessionFeedback: z
    .array(
      z.object({
        sessionDate: z.string().min(1),
        strengths: z.array(z.string()),
        concerns: z.array(z.string()),
        notes: z.string().optional(),
      })
    )
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
    const result = await agentOrchestrationService.generateClinicalSummary(parsed.data);
    console.log('[Agents API] clinical-summary response source:', result.meta?.generatedBy || 'deterministic');
    return res.json(result);
  } catch (error) {
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

  const { childId, role, forceRefresh } = parsed.data;

  try {
    if (!forceRefresh) {
      const cached = await agentOrchestrationService.getLatestClinicalSummaryForChild(childId);
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

    const latestScreening = await agentOrchestrationService.getLatestScreeningForChild(childId);
    if (!latestScreening?.cv_report) {
      return res.status(404).json({
        error: 'No screening report found for this child. Run screening first.',
      });
    }

    const childName = await agentOrchestrationService.getChildName(childId);
    const generated = await agentOrchestrationService.generateClinicalSummary({
      childName,
      role,
      screeningReport: latestScreening.cv_report,
    });

    await agentOrchestrationService.persistClinicalSummary({
      childId,
      sourceScreeningId: latestScreening.id,
      role,
      summaryJson: generated.data,
      generatedBy: generated.meta.generatedBy,
      model: generated.meta.model,
    });

    console.log('[Agents API] clinical-summary/by-child regenerated', {
      childId,
      sourceScreeningId: latestScreening.id,
      generatedBy: generated.meta.generatedBy,
      model: generated.meta.model || null,
    });

    return res.json({
      data: generated.data,
      meta: {
        generatedBy: generated.meta.generatedBy,
        model: generated.meta.model || undefined,
        cached: false,
      },
      sourceScreeningId: latestScreening.id,
    });
  } catch (error) {
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
    const result = await agentOrchestrationService.generateTherapyPlan(parsed.data);
    console.log('[Agents API] therapy-planning response source:', result.meta?.generatedBy || 'deterministic');
    return res.json(result);
  } catch (error) {
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
    const cached = await agentOrchestrationService.getLatestTherapyPlanForChild(childId);
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
  } catch (error) {
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

  const { childId, forceRefresh } = parsed.data;
  try {
    const diagnostic = await agentOrchestrationService.getLatestDiagnosticReportForChild(childId);
    if (!diagnostic?.content) {
      return res.status(404).json({ error: 'No diagnostic report found for this child' });
    }
    console.log('[Agents API] therapy-planning/by-child/generate diagnostic found', {
      childId,
      diagnosticReportId: diagnostic.id,
      diagnosticCreatedAt: diagnostic.created_at,
    });

    const existing = await agentOrchestrationService.getTherapyPlanForSourceReport(childId, diagnostic.id);
    if (!forceRefresh && existing?.plan_json && existing.generated_by === 'gemini') {
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
    if (forceRefresh && existing?.plan_json) {
      console.log('[Agents API] therapy-planning/by-child/generate force refresh requested; bypassing cache.', {
        childId,
        sourceReportId: diagnostic.id,
        existingGeneratedBy: existing.generated_by,
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

    const childName = await agentOrchestrationService.getChildName(childId);
    const ageYears = await agentOrchestrationService.getChildAgeYears(childId);
    const riskRaw = String(diagnostic.content?.cvRiskLevel || '').toLowerCase();
    const severityLevel = riskRaw.includes('high')
      ? 'high'
      : riskRaw.includes('low')
        ? 'low'
        : 'moderate';
    const primaryChallenges = Array.isArray(diagnostic.content?.developmentalGaps)
      ? diagnostic.content.developmentalGaps
      : ['Social communication'];

    const result = await agentOrchestrationService.generateTherapyPlan({
      childName,
      diagnosis:
        diagnostic.content?.diagnosisConfirmation ||
        diagnostic.content?.screeningSummary ||
        'Developmental concerns confirmed on diagnostic review',
      severityLevel,
      ageYears,
      primaryChallenges,
      constraints: ['Therapist-reviewed recommendations only'],
    });

    await agentOrchestrationService.persistTherapyPlan({
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
  } catch (error) {
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
    const result = await agentOrchestrationService.generateMonitoringInference(parsed.data);
    console.log('[Agents API] monitoring-inference response source:', result.meta?.generatedBy || 'deterministic');
    return res.json(result);
  } catch (error) {
    console.error('[Agents API] Failed to generate monitoring inference', error);
    return res.status(500).json({ error: 'Failed to generate monitoring inference' });
  }
});

export default router;
