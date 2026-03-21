import { supabase } from '../config/supabase';

type Role = 'parent' | 'therapist' | 'doctor';

interface StoredInferenceRow {
  id: string;
  child_id: string;
  therapy_type: string;
  role: Role;
  summary: string;
  source_report_id: string | null;
  metadata: any;
  created_at: string;
}

interface ReportRow {
  id: string;
  child_id: string;
  type: 'observation' | 'diagnostic';
  content: any;
  created_at: string;
}

interface ContextResult {
  milestones: string[];
  previousInferenceId: string | null;
  sourceReportId: string | null;
  usedReportsCount: number;
  cachedSummaryForSource: string | null;
}

export const progressInferenceService = {
  async buildContext(params: {
    childId: string;
    therapyType: string;
    role: Role;
    existingMilestones?: string[];
  }): Promise<ContextResult> {
    const { childId, therapyType, role, existingMilestones = [] } = params;

    const [reports, previousInference] = await Promise.all([
      this.getLatestReports(childId, 2),
      this.getLatestInference(childId, therapyType, role),
    ]);
    const sourceReportId = reports[0]?.id || null;
    const cachedForSource = sourceReportId
      ? await this.getInferenceForSourceReport(childId, therapyType, role, sourceReportId)
      : null;

    const reportMilestones = this.buildReportMilestones(reports);
    const inferenceMilestones = previousInference
      ? [
          `Previous inference (${new Date(previousInference.created_at).toLocaleDateString()}): ${previousInference.summary.slice(0, 300)}`,
        ]
      : ['No previous inference exists. This is the initial progress inference for this child.'];

    const merged = [...existingMilestones, ...reportMilestones, ...inferenceMilestones];
    const deduped = Array.from(new Set(merged.map((v) => v.trim()).filter(Boolean))).slice(0, 25);

    return {
      milestones: deduped,
      previousInferenceId: previousInference?.id || null,
      sourceReportId,
      usedReportsCount: reports.length,
      cachedSummaryForSource: cachedForSource?.summary || null,
    };
  },

  async persistInference(params: {
    childId: string;
    therapyType: string;
    role: Role;
    summary: string;
    sourceReportId?: string | null;
    previousInferenceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const {
      childId,
      therapyType,
      role,
      summary,
      sourceReportId = null,
      previousInferenceId = null,
      metadata = {},
    } = params;

    const { error } = await supabase.from('progress_inference_history').insert({
      child_id: childId,
      therapy_type: therapyType,
      role,
      summary,
      source_report_id: sourceReportId,
      previous_inference_id: previousInferenceId,
      metadata,
    });

    // If schema is not yet applied, do not block inference generation.
    if (error) {
      console.warn('[Inference Cycle] Failed to persist inference (apply SQL migration):', error.message);
    }
  },

  async getLatestReports(childId: string, limit: number): Promise<ReportRow[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('id, child_id, type, content, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load reports: ${error.message}`);
    }

    return (data || []) as ReportRow[];
  },

  async getLatestInference(childId: string, therapyType: string, role: Role): Promise<StoredInferenceRow | null> {
    const { data, error } = await supabase
      .from('progress_inference_history')
      .select('*')
      .eq('child_id', childId)
      .eq('therapy_type', therapyType)
      .eq('role', role)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Table may not exist yet; treat as no history.
    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to load previous inference: ${error.message}`);
    }

    return (data as StoredInferenceRow) || null;
  },

  async getInferenceForSourceReport(
    childId: string,
    therapyType: string,
    role: Role,
    sourceReportId: string
  ): Promise<StoredInferenceRow | null> {
    const { data, error } = await supabase
      .from('progress_inference_history')
      .select('*')
      .eq('child_id', childId)
      .eq('therapy_type', therapyType)
      .eq('role', role)
      .eq('source_report_id', sourceReportId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to load inference cache: ${error.message}`);
    }

    return (data as StoredInferenceRow) || null;
  },

  buildReportMilestones(reports: ReportRow[]): string[] {
    if (reports.length === 0) {
      return ['No reports available yet for this child. Use analytics-only inference.'];
    }

    const latest = reports[0];
    const previous = reports[1];
    const latestMetrics = this.extractNumericMetrics(latest.content || {});
    const previousMetrics = previous ? this.extractNumericMetrics(previous.content || {}) : {};

    const lines: string[] = [];
    lines.push(
      `Latest report: ${latest.type} (${new Date(latest.created_at).toLocaleDateString()})`
    );

    const latestSummary =
      latest.content?.screeningSummary ||
      latest.content?.doctorNotes ||
      latest.content?.cvRiskDescription ||
      '';
    if (latestSummary) {
      lines.push(`Latest report summary: ${String(latestSummary).slice(0, 140)}`);
    }

    if (latest.content?.cvRiskLevel) {
      lines.push(
        `Latest CV risk assessment: level=${latest.content.cvRiskLevel}, confidence=${latest.content?.cvRiskConfidence ?? 'NA'}`
      );
    }

    if (Array.isArray(latest.content?.signalSummary) && latest.content.signalSummary.length > 0) {
      lines.push('Latest objective signals from doctor report:');
      lines.push(...latest.content.signalSummary.slice(0, 10));
    }

    const deltas = this.computeDeltas(latestMetrics, previousMetrics);
    if (deltas.length > 0) {
      lines.push('Backend-calculated metric deltas (latest vs previous report):');
      lines.push(...deltas.slice(0, 8));
    } else if (Object.keys(latestMetrics).length > 0) {
      lines.push('Latest numeric report metrics:');
      const top = Object.entries(latestMetrics).slice(0, 10);
      for (const [k, v] of top) {
        lines.push(`${k}: ${v.toFixed(3)}`);
      }
    } else {
      lines.push('No structured numeric metrics found in report content.');
    }

    return lines;
  },

  extractNumericMetrics(input: any, prefix = '', out: Record<string, number> = {}): Record<string, number> {
    if (input === null || input === undefined) return out;
    if (typeof input === 'number' && Number.isFinite(input)) {
      if (prefix) out[prefix] = input;
      return out;
    }
    if (typeof input === 'string') {
      const shouldParse = /value|baseline|score|rate|eye|social|emotion|attention|communication|motor|engagement/i.test(
        prefix
      );
      if (shouldParse) {
        const match = input.match(/-?\d+(\.\d+)?/);
        if (match) {
          const parsed = Number(match[0]);
          if (Number.isFinite(parsed) && prefix) {
            out[prefix] = parsed;
          }
        }
      }
      return out;
    }
    if (Array.isArray(input)) {
      input.forEach((item, idx) => this.extractNumericMetrics(item, `${prefix}[${idx}]`, out));
      return out;
    }
    if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        const normalizedKey = prefix ? `${prefix}.${key}` : key;
        this.extractNumericMetrics(value, normalizedKey, out);
      }
    }
    return out;
  },

  computeDeltas(
    latest: Record<string, number>,
    previous: Record<string, number>
  ): string[] {
    const keys = Object.keys(latest);
    const interesting = keys.filter((key) =>
      /eye|social|emotion|attention|communication|motor|engagement|score|rate|value/i.test(key)
    );
    const selected = (interesting.length > 0 ? interesting : keys).slice(0, 15);

    const rows: string[] = [];
    for (const key of selected) {
      const latestValue = latest[key];
      const previousValue = previous[key];
      if (typeof previousValue === 'number' && Number.isFinite(previousValue)) {
        const delta = latestValue - previousValue;
        rows.push(
          `${key}: new=${latestValue.toFixed(3)}, previous=${previousValue.toFixed(3)}, delta=${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`
        );
      } else {
        rows.push(`${key}: new=${latestValue.toFixed(3)}, previous=NA`);
      }
    }
    return rows;
  },
};
