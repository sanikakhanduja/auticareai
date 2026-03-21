"use strict";
/**
 * Structured therapy metrics analytics engine.
 * - Stores validated numeric session metrics
 * - Computes progress numerically (no LLM math)
 * - Persists cached analytics for fast reads
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressAnalyticsService = exports.TherapyProgressAnalytics = void 0;
const supabase_1 = require("../config/supabase");
const CONFIG = {
    REGRESSION_THRESHOLD_PCT: 10,
    STAGNATION_THRESHOLD_PCT: 5,
    IMPROVEMENT_THRESHOLD_PCT: 5,
    MOVING_AVERAGE_WINDOW: 5,
    RECENT_PERIOD_DAYS: 30,
    PREVIOUS_PERIOD_DAYS: 30,
    MAX_ANALYSIS_SESSIONS: 1000,
    MIN_SESSIONS_FOR_TREND: 3,
    ALERT_STAGNATION_COUNT: 3,
};
const SCORE_FIELDS = {
    eye_contact: 'eye_contact_score',
    social_engagement: 'social_engagement_score',
    emotional_regulation: 'emotional_regulation_score',
    attention_span: 'attention_span_score',
    communication: 'communication_score',
    session_engagement: 'session_engagement_score',
};
const round = (value, places = 3) => {
    const power = Math.pow(10, places);
    return Math.round(value * power) / power;
};
const mean = (values) => {
    if (values.length === 0)
        return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
};
const stdDev = (values) => {
    if (values.length < 2)
        return 0;
    const avg = mean(values);
    const variance = values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
};
const slope = (values) => {
    if (values.length < 2)
        return 0;
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = mean(values);
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (values[i] - yMean);
        denominator += Math.pow(i - xMean, 2);
    }
    return denominator === 0 ? 0 : numerator / denominator;
};
const pctChange = (previous, current) => {
    if (!previous || previous <= 0)
        return 0;
    return ((current - previous) / previous) * 100;
};
const mapRowToInput = (input) => ({
    child_id: input.childId,
    therapist_id: input.therapistId,
    session_id: input.sessionId || null,
    session_date: input.sessionDate,
    therapy_type: input.therapyType,
    session_duration_minutes: input.sessionDurationMinutes,
    eye_contact_score: input.eyeContactScore ?? null,
    social_engagement_score: input.socialEngagementScore ?? null,
    emotional_regulation_score: input.emotionalRegulationScore ?? null,
    attention_span_score: input.attentionSpanScore ?? null,
    communication_score: input.communicationScore ?? null,
    motor_coordination_score: input.motorCoordinationScore ?? null,
    session_engagement_score: input.sessionEngagementScore ?? null,
    response_latency_seconds: input.responseLatencySeconds ?? null,
    gesture_frequency: input.gestureFrequency ?? null,
    verbal_utterances: input.verbalUtterances ?? null,
    attention_span_seconds: input.attentionSpanSeconds ?? null,
    cv_model_version: input.cvModelVersion ?? null,
    cv_confidence_score: input.cvConfidenceScore ?? null,
    video_quality_score: input.videoQualityScore ?? null,
});
class TherapyProgressAnalytics {
    static async saveSessionMetrics(input) {
        const row = mapRowToInput(input);
        if (input.sessionId) {
            const { data: existing, error: readError } = await supabase_1.supabase
                .from('therapy_session_metrics')
                .select('id')
                .eq('session_id', input.sessionId)
                .limit(1)
                .maybeSingle();
            if (readError) {
                throw new Error(`Failed to check existing session metrics: ${readError.message}`);
            }
            if (existing?.id) {
                const { data: updated, error: updateError } = await supabase_1.supabase
                    .from('therapy_session_metrics')
                    .update(row)
                    .eq('id', existing.id)
                    .select('*')
                    .single();
                if (updateError) {
                    throw new Error(`Failed to update session metrics: ${updateError.message}`);
                }
                return updated;
            }
        }
        const { data, error } = await supabase_1.supabase
            .from('therapy_session_metrics')
            .insert(row)
            .select('*')
            .single();
        if (error) {
            throw new Error(`Failed to save session metrics: ${error.message}`);
        }
        return data;
    }
    static async computeProgress(childId, therapyType) {
        const allSessions = await this.fetchSessionHistory(childId, therapyType, CONFIG.MAX_ANALYSIS_SESSIONS);
        if (allSessions.length < CONFIG.MIN_SESSIONS_FOR_TREND) {
            const defaults = this.getDefaultAnalytics(childId, therapyType);
            await this.saveAnalytics(defaults);
            return defaults;
        }
        const now = new Date();
        const recentStart = new Date(now);
        recentStart.setDate(recentStart.getDate() - CONFIG.RECENT_PERIOD_DAYS);
        const previousStart = new Date(recentStart);
        previousStart.setDate(previousStart.getDate() - CONFIG.PREVIOUS_PERIOD_DAYS);
        const recentSessions = allSessions.filter((row) => new Date(row.session_date) >= recentStart);
        const previousSessions = allSessions.filter((row) => {
            const dt = new Date(row.session_date);
            return dt >= previousStart && dt < recentStart;
        });
        // If recent window is too narrow, keep using latest sessions to avoid empty analytics.
        const recentWindow = recentSessions.length >= CONFIG.MIN_SESSIONS_FOR_TREND
            ? recentSessions
            : allSessions.slice(-Math.min(30, allSessions.length));
        const recentStats = this.computeStats(recentWindow);
        const previousStats = previousSessions.length > 0 ? this.computeStats(previousSessions) : null;
        const eyeContactChange = pctChange(previousStats?.averages.eye_contact || 0, recentStats.averages.eye_contact);
        const socialChange = pctChange(previousStats?.averages.social_engagement || 0, recentStats.averages.social_engagement);
        const emotionalChange = pctChange(previousStats?.averages.emotional_regulation || 0, recentStats.averages.emotional_regulation);
        const changeValues = [eyeContactChange, socialChange, emotionalChange];
        const overallImprovement = round(mean(changeValues), 2);
        const regressionMetrics = [
            eyeContactChange < -CONFIG.REGRESSION_THRESHOLD_PCT ? 'eye_contact' : null,
            socialChange < -CONFIG.REGRESSION_THRESHOLD_PCT ? 'social_engagement' : null,
            emotionalChange < -CONFIG.REGRESSION_THRESHOLD_PCT ? 'emotional_regulation' : null,
        ].filter((value) => Boolean(value));
        const trendMap = {
            eye_contact: this.toTrend(recentStats.slopes.eye_contact),
            social_engagement: this.toTrend(recentStats.slopes.social_engagement),
            emotional_regulation: this.toTrend(recentStats.slopes.emotional_regulation),
            attention_span: this.toTrend(recentStats.slopes.attention_span),
            communication: this.toTrend(recentStats.slopes.communication),
            session_engagement: this.toTrend(recentStats.slopes.session_engagement),
            overall: 'stable',
        };
        trendMap.overall = this.resolveOverallTrend([
            trendMap.eye_contact,
            trendMap.social_engagement,
            trendMap.emotional_regulation,
        ]);
        const metricEntries = Object.entries(recentStats.averages)
            .filter(([key]) => key !== 'session_engagement')
            .sort(([, a], [, b]) => b - a);
        const stagnationCount = await this.computeStagnationCount(childId, therapyType, overallImprovement);
        const analytics = {
            child_id: childId,
            therapy_type: therapyType,
            total_sessions: recentWindow.length,
            average_eye_contact: recentStats.averages.eye_contact,
            average_social_engagement: recentStats.averages.social_engagement,
            average_emotional_regulation: recentStats.averages.emotional_regulation,
            average_attention_span: recentStats.averages.attention_span,
            average_communication: recentStats.averages.communication,
            average_session_engagement: recentStats.averages.session_engagement,
            eye_contact_trend: trendMap.eye_contact,
            social_engagement_trend: trendMap.social_engagement,
            emotional_regulation_trend: trendMap.emotional_regulation,
            overall_trend: trendMap.overall,
            eye_contact_change_pct: round(eyeContactChange, 2),
            social_engagement_change_pct: round(socialChange, 2),
            emotional_regulation_change_pct: round(emotionalChange, 2),
            overall_improvement_pct: overallImprovement,
            has_regression: regressionMetrics.length > 0,
            regression_metrics: regressionMetrics,
            stagnation_count: stagnationCount,
            consistency_score: round(Math.max(0, 1 - recentStats.stdDev.session_engagement), 3),
            best_performing_metric: metricEntries[0]?.[0] || 'unknown',
            needs_attention_metric: metricEntries[metricEntries.length - 1]?.[0] || 'unknown',
            moving_average_eye_contact: recentStats.movingAverage.eye_contact,
            moving_average_social_engagement: recentStats.movingAverage.social_engagement,
            moving_average_emotional_regulation: recentStats.movingAverage.emotional_regulation,
            moving_average_session_engagement: recentStats.movingAverage.session_engagement,
            eye_contact_std_dev: recentStats.stdDev.eye_contact,
            social_engagement_std_dev: recentStats.stdDev.social_engagement,
            emotional_regulation_std_dev: recentStats.stdDev.emotional_regulation,
        };
        await this.saveAnalytics(analytics);
        await this.generateAlerts(analytics, recentWindow);
        return analytics;
    }
    static async fetchSessionSeries(childId, therapyType, limit = 15) {
        const normalizedLimit = Math.min(Math.max(limit, 1), 200);
        const { data, error } = await supabase_1.supabase
            .from('therapy_session_metrics')
            .select('id, child_id, therapist_id, session_id, session_date, therapy_type, session_duration_minutes, eye_contact_score, social_engagement_score, emotional_regulation_score, attention_span_score, communication_score, motor_coordination_score, session_engagement_score, response_latency_seconds, gesture_frequency, verbal_utterances, attention_span_seconds, cv_model_version, cv_confidence_score, video_quality_score, created_at')
            .eq('child_id', childId)
            .eq('therapy_type', therapyType)
            .order('session_date', { ascending: false })
            .limit(normalizedLimit);
        if (error) {
            throw new Error(`Failed to fetch session series: ${error.message}`);
        }
        return (data || []).reverse();
    }
    static async fetchSessionHistory(childId, therapyType, limit) {
        const { data, error } = await supabase_1.supabase
            .from('therapy_session_metrics')
            .select('id, child_id, therapist_id, session_id, session_date, therapy_type, session_duration_minutes, eye_contact_score, social_engagement_score, emotional_regulation_score, attention_span_score, communication_score, motor_coordination_score, session_engagement_score, response_latency_seconds, gesture_frequency, verbal_utterances, attention_span_seconds, cv_model_version, cv_confidence_score, video_quality_score, created_at')
            .eq('child_id', childId)
            .eq('therapy_type', therapyType)
            .order('session_date', { ascending: false })
            .limit(limit);
        if (error) {
            throw new Error(`Failed to fetch sessions: ${error.message}`);
        }
        return (data || []).reverse();
    }
    static computeStats(sessions) {
        const averages = {
            eye_contact: 0,
            social_engagement: 0,
            emotional_regulation: 0,
            attention_span: 0,
            communication: 0,
            session_engagement: 0,
        };
        const slopes = {
            eye_contact: 0,
            social_engagement: 0,
            emotional_regulation: 0,
            attention_span: 0,
            communication: 0,
            session_engagement: 0,
        };
        const movingAverage = {
            eye_contact: 0,
            social_engagement: 0,
            emotional_regulation: 0,
            attention_span: 0,
            communication: 0,
            session_engagement: 0,
        };
        const deviation = {
            eye_contact: 0,
            social_engagement: 0,
            emotional_regulation: 0,
            attention_span: 0,
            communication: 0,
            session_engagement: 0,
        };
        Object.keys(SCORE_FIELDS).forEach((metric) => {
            const field = SCORE_FIELDS[metric];
            const values = sessions
                .map((session) => session[field])
                .filter((value) => typeof value === 'number' && Number.isFinite(value));
            averages[metric] = round(mean(values));
            slopes[metric] = slope(values);
            movingAverage[metric] = this.computeMovingAverage(values, CONFIG.MOVING_AVERAGE_WINDOW);
            deviation[metric] = round(stdDev(values), 3);
        });
        return {
            averages,
            slopes,
            movingAverage,
            stdDev: deviation,
        };
    }
    static computeMovingAverage(values, window) {
        if (values.length === 0)
            return 0;
        const subset = values.slice(-Math.min(window, values.length));
        return round(mean(subset));
    }
    static toTrend(metricSlope) {
        if (metricSlope > CONFIG.IMPROVEMENT_THRESHOLD_PCT / 100)
            return 'improving';
        if (metricSlope < -(CONFIG.REGRESSION_THRESHOLD_PCT / 100))
            return 'regressing';
        return 'stable';
    }
    static resolveOverallTrend(trends) {
        const score = trends.reduce((acc, trend) => {
            if (trend === 'improving')
                return acc + 1;
            if (trend === 'regressing')
                return acc - 1;
            return acc;
        }, 0);
        if (score > 0)
            return 'improving';
        if (score < 0)
            return 'regressing';
        return 'stable';
    }
    static async computeStagnationCount(childId, therapyType, overallImprovementPct) {
        if (Math.abs(overallImprovementPct) >= CONFIG.STAGNATION_THRESHOLD_PCT) {
            return 0;
        }
        const { data, error } = await supabase_1.supabase
            .from('progress_analytics')
            .select('stagnation_count')
            .eq('child_id', childId)
            .eq('therapy_type', therapyType)
            .maybeSingle();
        if (error) {
            return 1;
        }
        return (data?.stagnation_count || 0) + 1;
    }
    static async saveAnalytics(analytics) {
        const { error } = await supabase_1.supabase
            .from('progress_analytics')
            .upsert({
            child_id: analytics.child_id,
            therapy_type: analytics.therapy_type,
            total_sessions: analytics.total_sessions,
            average_eye_contact: analytics.average_eye_contact,
            average_social_engagement: analytics.average_social_engagement,
            average_emotional_regulation: analytics.average_emotional_regulation,
            average_attention_span: analytics.average_attention_span,
            average_communication: analytics.average_communication,
            average_session_engagement: analytics.average_session_engagement,
            eye_contact_trend: analytics.eye_contact_trend,
            social_engagement_trend: analytics.social_engagement_trend,
            emotional_regulation_trend: analytics.emotional_regulation_trend,
            overall_trend: analytics.overall_trend,
            eye_contact_change_pct: analytics.eye_contact_change_pct,
            social_engagement_change_pct: analytics.social_engagement_change_pct,
            emotional_regulation_change_pct: analytics.emotional_regulation_change_pct,
            overall_improvement_pct: analytics.overall_improvement_pct,
            has_regression: analytics.has_regression,
            regression_metrics: analytics.regression_metrics,
            stagnation_count: analytics.stagnation_count,
            consistency_score: analytics.consistency_score,
            best_performing_metric: analytics.best_performing_metric,
            needs_attention_metric: analytics.needs_attention_metric,
            last_session_date: new Date().toISOString(),
            analysis_period_start: new Date(Date.now() - CONFIG.RECENT_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
            analysis_period_end: new Date().toISOString(),
            calculated_at: new Date().toISOString(),
        }, { onConflict: 'child_id,therapy_type' });
        if (error) {
            throw new Error(`Failed to save analytics: ${error.message}`);
        }
    }
    static async generateAlerts(analytics, sessions) {
        const latestTherapistId = sessions[sessions.length - 1]?.therapist_id;
        if (!latestTherapistId)
            return;
        const alerts = [];
        if (analytics.has_regression) {
            alerts.push({
                child_id: analytics.child_id,
                therapist_id: latestTherapistId,
                alert_type: 'regression',
                severity: analytics.regression_metrics.length >= 2 ? 'high' : 'medium',
                title: 'Regression detected',
                description: `Regression threshold crossed for: ${analytics.regression_metrics.join(', ')}`,
                affected_metrics: analytics.regression_metrics,
                metric_values: {
                    overall_change_pct: analytics.overall_improvement_pct,
                },
            });
        }
        if (analytics.stagnation_count >= CONFIG.ALERT_STAGNATION_COUNT) {
            alerts.push({
                child_id: analytics.child_id,
                therapist_id: latestTherapistId,
                alert_type: 'stagnation',
                severity: analytics.stagnation_count >= 5 ? 'high' : 'medium',
                title: 'Progress plateau',
                description: `Progress is stagnant for ${analytics.stagnation_count} periods.`,
                affected_metrics: ['overall_progress'],
                metric_values: {
                    stagnation_count: analytics.stagnation_count,
                    overall_change_pct: analytics.overall_improvement_pct,
                },
            });
        }
        if (alerts.length === 0)
            return;
        const { error } = await supabase_1.supabase.from('progress_alerts').insert(alerts);
        if (error) {
            // Alerts should not block analytics pipeline.
            console.warn('[Analytics] Failed to save alerts:', error.message);
        }
    }
    static getDefaultAnalytics(childId, therapyType) {
        return {
            child_id: childId,
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
            best_performing_metric: 'unknown',
            needs_attention_metric: 'unknown',
            moving_average_eye_contact: 0,
            moving_average_social_engagement: 0,
            moving_average_emotional_regulation: 0,
            moving_average_session_engagement: 0,
            eye_contact_std_dev: 0,
            social_engagement_std_dev: 0,
            emotional_regulation_std_dev: 0,
        };
    }
}
exports.TherapyProgressAnalytics = TherapyProgressAnalytics;
exports.progressAnalyticsService = {
    async saveSessionMetrics(input) {
        const saved = await TherapyProgressAnalytics.saveSessionMetrics(input);
        const analytics = await TherapyProgressAnalytics.computeProgress(input.childId, input.therapyType);
        return { saved, analytics };
    },
    async computeProgress(childId, therapyType) {
        return TherapyProgressAnalytics.computeProgress(childId, therapyType);
    },
    async getAnalytics(childId, therapyType) {
        let query = supabase_1.supabase.from('progress_analytics').select('*').eq('child_id', childId);
        if (therapyType) {
            query = query.eq('therapy_type', therapyType);
        }
        const { data, error } = await query.order('calculated_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to fetch analytics: ${error.message}`);
        }
        return data || [];
    },
    async getSessionSeries(childId, therapyType, limit = 15) {
        return TherapyProgressAnalytics.fetchSessionSeries(childId, therapyType, limit);
    },
    async getAlerts(childId) {
        const { data, error } = await supabase_1.supabase
            .from('progress_alerts')
            .select('*')
            .eq('child_id', childId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to fetch alerts: ${error.message}`);
        }
        return data || [];
    },
    async acknowledgeAlert(alertId, userId) {
        const { error } = await supabase_1.supabase
            .from('progress_alerts')
            .update({
            status: 'acknowledged',
            acknowledged_by: userId,
            acknowledged_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', alertId);
        if (error) {
            throw new Error(`Failed to acknowledge alert: ${error.message}`);
        }
    },
};
