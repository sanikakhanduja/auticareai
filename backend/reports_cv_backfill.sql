-- Backfill doctor reports with CV metrics from screening_results.cv_report
-- Run in Supabase SQL editor once.

WITH candidate_reports AS (
  SELECT
    r.id AS report_id,
    r.child_id,
    r.created_at AS report_created_at,
    r.content AS report_content,
    sr.cv_report
  FROM public.reports r
  LEFT JOIN LATERAL (
    SELECT s.cv_report
    FROM public.screening_results s
    WHERE s.child_id = r.child_id
      AND s.cv_report IS NOT NULL
      AND s.created_at <= r.created_at
    ORDER BY s.created_at DESC
    LIMIT 1
  ) sr ON TRUE
  WHERE r.content IS NOT NULL
)
UPDATE public.reports r
SET content = jsonb_strip_nulls(
  c.report_content
  || jsonb_build_object(
    'cvRiskLevel', c.cv_report->'risk_assessment'->>'level',
    'cvRiskConfidence', (c.cv_report->'risk_assessment'->>'confidence')::numeric,
    'cvRiskDescription', c.cv_report->'risk_assessment'->>'description',
    'objectiveSignals', c.cv_report->'metrics'->'objective_signals',
    'objectiveSignalValues',
      (
        SELECT jsonb_object_agg(
          key,
          to_jsonb(
            NULLIF(
              regexp_replace(value->>'value', '[^0-9\\.-]', '', 'g'),
              ''
            )::numeric
          )
        )
        FROM jsonb_each(c.cv_report->'metrics'->'objective_signals')
      ),
    'objectiveSignalBaselines',
      (
        SELECT jsonb_object_agg(
          key,
          to_jsonb(
            NULLIF(
              regexp_replace(value->>'baseline', '[^0-9\\.-]', '', 'g'),
              ''
            )::numeric
          )
        )
        FROM jsonb_each(c.cv_report->'metrics'->'objective_signals')
      ),
    'signalSummary',
      (
        SELECT jsonb_agg(
          format(
            '%s=%s, baseline=%s, status=%s',
            key,
            COALESCE(value->>'value', 'NA'),
            COALESCE(value->>'baseline', 'NA'),
            COALESCE(value->>'status', 'unknown')
          )
        )
        FROM jsonb_each(c.cv_report->'metrics'->'objective_signals')
      )
  )
)
FROM candidate_reports c
WHERE r.id = c.report_id
  AND c.cv_report IS NOT NULL;

