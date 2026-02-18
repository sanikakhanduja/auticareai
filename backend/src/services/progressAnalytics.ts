/**
 * =====================================================
 * THERAPY PROGRESS ANALYTICS SERVICE - PRODUCTION GRADE
 * =====================================================
 * Purpose: Compute numeric progress metrics efficiently
 * NO LLM involvement - pure mathematical computation
 * Scalable for 1000+ sessions per child
 * =====================================================
 */

import { supabase } from '../config/supabase';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface SessionMetrics {
  id: string;
  child_id: string;
  therapist_id: string;
  session_date: string;
  therapy_type: 'speech' | 'motor' | 'social' | 'behavioral';
  eye_contact_score?: number;
  social_engagement_score?: number;
  emotional_regulation_score?: number;
  attention_span_score?: number;
  communication_score?: number;
  motor_coordination_score?: number;
  session_engagement_score?: number;
  response_latency_seconds?: number;
  gesture_frequency?: number;
  verbal_utterances?: number;
}

export interface ProgressAnalytics {
  child_id: string;
  therapy_type: string;
  total_sessions: number;
  
  // Averages
  average_eye_contact: number;
  average_social_engagement: number;
  average_emotional_regulation: number;
  average_attention_span: number;
  average_communication: number;
  average_session_engagement: number;
  
  // Trends
  eye_contact_trend: 'improving' | 'stable' | 'regressing';
  social_engagement_trend: 'improving' | 'stable' | 'regressing';
  emotional_regulation_trend: 'improving' | 'stable' | 'regressing';
  overall_trend: 'improving' | 'stable' | 'regressing';
  
  // Change Metrics
  eye_contact_change_pct: number;
  social_engagement_change_pct: number;
  emotional_regulation_change_pct: number;
  overall_improvement_pct: number;
  
  // Flags
  has_regression: boolean;
  regression_metrics: string[];
  stagnation_count: number;
  consistency_score: number;
  
  best_performing_metric: string;
  needs_attention_metric: string;
}

export interface ProgressAlert {
  child_id: string;
  therapist_id?: string;
  doctor_id?: string;
  alert_type: 'regression' | 'stagnation' | 'milestone' | 'urgent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affected_metrics: string[];
  metric_values: Record<string, number>;
}

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
  REGRESSION_THRESHOLD: 0.10, // 10% drop = regression
  STAGNATION_THRESHOLD: 0.05, // <5% change = stagnation
  IMPROVEMENT_THRESHOLD: 0.05, // >5% increase = improvement
  ANALYSIS_PERIOD_DAYS: 30, // Analyze last 30 days
  COMPARISON_PERIOD_DAYS: 30, // Compare to previous 30 days
  MIN_SESSIONS_FOR_TREND: 3, // Need 3+ sessions to determine trend
  ALERT_STAGNATION_COUNT: 3, // Alert after 3 consecutive stagnant sessions
};

// =====================================================
// CORE ANALYTICS ENGINE
// =====================================================

export class TherapyProgressAnalytics {
  
  /**
   * Main entry point: Compute all progress metrics for a child
   * Called after each new session is added
   * 
   * @param childId - Child UUID
   * @param therapyType - Type of therapy
   * @returns Computed analytics
   */
  static async computeProgress(
    childId: string,
    therapyType: 'speech' | 'motor' | 'social' | 'behavioral'
  ): Promise<ProgressAnalytics> {
    
    console.log(`[Analytics] Computing progress for child ${childId}, therapy: ${therapyType}`);
    
    try {
      // Step 1: Fetch recent sessions (last 30 days)
      const recentSessions = await this.fetchRecentSessions(childId, therapyType, CONFIG.ANALYSIS_PERIOD_DAYS);
      
      if (recentSessions.length < CONFIG.MIN_SESSIONS_FOR_TREND) {
        console.log(`[Analytics] Insufficient data: ${recentSessions.length} sessions (need ${CONFIG.MIN_SESSIONS_FOR_TREND})`);
        return this.getDefaultAnalytics(childId, therapyType);
      }
      
      // Step 2: Fetch previous period sessions for comparison
      const previousSessions = await this.fetchPreviousPeriodSessions(
        childId,
        therapyType,
        CONFIG.COMPARISON_PERIOD_DAYS
      );
      
      // Step 3: Compute averages
      const recentAverages = this.computeAverages(recentSessions);
      const previousAverages = previousSessions.length > 0 
        ? this.computeAverages(previousSessions)
        : null;
      
      // Step 4: Compute trends and changes
      const trends = this.computeTrends(recentSessions);
      const changes = previousAverages 
        ? this.computeChanges(previousAverages, recentAverages)
        : this.getDefaultChanges();
      
      // Step 5: Detect regression
      const regressionAnalysis = this.detectRegression(changes);
      
      // Step 6: Compute consistency (standard deviation)
      const consistency = this.computeConsistency(recentSessions);
      
      // Step 7: Identify best/worst metrics
      const metricAnalysis = this.analyzeMetrics(recentAverages);
      
      // Step 8: Check stagnation
      const stagnationCount = await this.checkStagnation(childId, therapyType);
      
      // Build analytics object
      const analytics: ProgressAnalytics = {
        child_id: childId,
        therapy_type: therapyType,
        total_sessions: recentSessions.length,
        
        // Averages
        average_eye_contact: recentAverages.eye_contact,
        average_social_engagement: recentAverages.social_engagement,
        average_emotional_regulation: recentAverages.emotional_regulation,
        average_attention_span: recentAverages.attention_span,
        average_communication: recentAverages.communication,
        average_session_engagement: recentAverages.session_engagement,
        
        // Trends
        eye_contact_trend: trends.eye_contact,
        social_engagement_trend: trends.social_engagement,
        emotional_regulation_trend: trends.emotional_regulation,
        overall_trend: trends.overall,
        
        // Changes
        eye_contact_change_pct: changes.eye_contact,
        social_engagement_change_pct: changes.social_engagement,
        emotional_regulation_change_pct: changes.emotional_regulation,
        overall_improvement_pct: changes.overall,
        
        // Flags
        has_regression: regressionAnalysis.hasRegression,
        regression_metrics: regressionAnalysis.metrics,
        stagnation_count: stagnationCount,
        consistency_score: consistency,
        
        best_performing_metric: metricAnalysis.best,
        needs_attention_metric: metricAnalysis.worst,
      };
      
      // Step 9: Save to database
      await this.saveAnalytics(analytics);
      
      // Step 10: Generate alerts if needed
      await this.generateAlerts(analytics, recentSessions);
      
      console.log(`[Analytics] ✅ Progress computed successfully`);
      return analytics;
      
    } catch (error) {
      console.error('[Analytics] ❌ Error computing progress:', error);
      throw new Error(`Failed to compute progress: ${(error as Error).message}`);
    }
  }
  
  // =====================================================
  // DATA FETCHING
  // =====================================================
  
  /**
   * Fetch recent sessions for analysis
   * Optimized query with indexes
   */
  private static async fetchRecentSessions(
    childId: string,
    therapyType: string,
    days: number
  ): Promise<SessionMetrics[]> {
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('therapy_session_metrics')
      .select('*')
      .eq('child_id', childId)
      .eq('therapy_type', therapyType)
      .gte('session_date', startDate.toISOString())
      .order('session_date', { ascending: true });
    
    if (error) throw error;
    return data as SessionMetrics[];
  }
  
  /**
   * Fetch previous period sessions for comparison
   */
  private static async fetchPreviousPeriodSessions(
    childId: string,
    therapyType: string,
    days: number
  ): Promise<SessionMetrics[]> {
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - days);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('therapy_session_metrics')
      .select('*')
      .eq('child_id', childId)
      .eq('therapy_type', therapyType)
      .gte('session_date', startDate.toISOString())
      .lt('session_date', endDate.toISOString())
      .order('session_date', { ascending: true });
    
    if (error) throw error;
    return data as SessionMetrics[];
  }
  
  // =====================================================
  // COMPUTATION FUNCTIONS
  // =====================================================
  
  /**
   * Compute average scores for all metrics
   */
  private static computeAverages(sessions: SessionMetrics[]) {
    const metrics = [
      'eye_contact_score',
      'social_engagement_score',
      'emotional_regulation_score',
      'attention_span_score',
      'communication_score',
      'session_engagement_score',
    ];
    
    const averages: Record<string, number> = {};
    
    for (const metric of metrics) {
      const values = sessions
        .map(s => s[metric as keyof SessionMetrics] as number)
        .filter(v => v != null && !isNaN(v));
      
      const avg = values.length > 0
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : 0;
      
      const key = metric.replace('_score', '');
      averages[key] = Math.round(avg * 1000) / 1000; // 3 decimal places
    }
    
    return averages;
  }
  
  /**
   * Compute trend for each metric (improving/stable/regressing)
   * Uses linear regression on recent sessions
   */
  private static computeTrends(sessions: SessionMetrics[]) {
    const metrics = [
      'eye_contact_score',
      'social_engagement_score',
      'emotional_regulation_score',
    ];
    
    const trends: Record<string, 'improving' | 'stable' | 'regressing'> = {};
    
    for (const metric of metrics) {
      const values = sessions
        .map(s => s[metric as keyof SessionMetrics] as number)
        .filter(v => v != null && !isNaN(v));
      
      if (values.length < 2) {
        trends[metric.replace('_score', '')] = 'stable';
        continue;
      }
      
      // Simple linear regression slope
      const slope = this.calculateSlope(values);
      
      if (slope > CONFIG.IMPROVEMENT_THRESHOLD) {
        trends[metric.replace('_score', '')] = 'improving';
      } else if (slope < -CONFIG.REGRESSION_THRESHOLD) {
        trends[metric.replace('_score', '')] = 'regressing';
      } else {
        trends[metric.replace('_score', '')] = 'stable';
      }
    }
    
    // Overall trend is most common individual trend
    const trendValues = Object.values(trends);
    const mostCommon = trendValues.sort((a, b) =>
      trendValues.filter(v => v === a).length - trendValues.filter(v => v === b).length
    ).pop() || 'stable';
    
    trends.overall = mostCommon;
    
    return trends;
  }
  
  /**
   * Calculate slope for trend analysis
   */
  private static calculateSlope(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  /**
   * Compute % changes between periods
   */
  private static computeChanges(
    previous: Record<string, number>,
    recent: Record<string, number>
  ) {
    const changes: Record<string, number> = {};
    
    for (const key of Object.keys(recent)) {
      if (previous[key] && previous[key] > 0) {
        const change = ((recent[key] - previous[key]) / previous[key]) * 100;
        changes[key] = Math.round(change * 100) / 100; // 2 decimal places
      } else {
        changes[key] = 0;
      }
    }
    
    // Overall change is average of all changes
    const allChanges = Object.values(changes).filter(v => !isNaN(v));
    changes.overall = allChanges.length > 0
      ? Math.round((allChanges.reduce((sum, v) => sum + v, 0) / allChanges.length) * 100) / 100
      : 0;
    
    return changes;
  }
  
  /**
   * Detect regression in any metric
   */
  private static detectRegression(changes: Record<string, number>) {
    const regressionMetrics: string[] = [];
    
    for (const [key, value] of Object.entries(changes)) {
      if (key !== 'overall' && value < -(CONFIG.REGRESSION_THRESHOLD * 100)) {
        regressionMetrics.push(key);
      }
    }
    
    return {
      hasRegression: regressionMetrics.length > 0,
      metrics: regressionMetrics,
    };
  }
  
  /**
   * Compute consistency score (inverse of standard deviation)
   * Lower score = more inconsistent
   */
  private static computeConsistency(sessions: SessionMetrics[]): number {
    const engagementScores = sessions
      .map(s => s.session_engagement_score)
      .filter((v): v is number => v != null && !isNaN(v));
    
    if (engagementScores.length < 2) return 1.0;
    
    const mean = engagementScores.reduce((sum, v) => sum + v, 0) / engagementScores.length;
    const variance = engagementScores.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / engagementScores.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-1, higher = more consistent)
    const consistency = Math.max(0, 1 - stdDev);
    return Math.round(consistency * 1000) / 1000;
  }
  
  /**
   * Identify best and worst performing metrics
   */
  private static analyzeMetrics(averages: Record<string, number>) {
    const entries = Object.entries(averages)
      .filter(([key]) => key !== 'overall')
      .sort(([, a], [, b]) => b - a);
    
    return {
      best: entries[0]?.[0] || 'unknown',
      worst: entries[entries.length - 1]?.[0] || 'unknown',
    };
  }
  
  /**
   * Check how many consecutive sessions show stagnation
   */
  private static async checkStagnation(
    childId: string,
    therapyType: string
  ): Promise<number> {
    
    const lastFive = await this.fetchRecentSessions(childId, therapyType, 60); // Last 2 months
    
    if (lastFive.length < 4) return 0;
    
    const recent = lastFive.slice(-3);
    const comparison = lastFive.slice(-6, -3);
    
    if (comparison.length === 0) return 0;
    
    const recentAvg = this.computeAverages(recent);
    const comparisonAvg = this.computeAverages(comparison);
    
    const changes = this.computeChanges(comparisonAvg, recentAvg);
    
    const isStagnant = Math.abs(changes.overall) < CONFIG.STAGNATION_THRESHOLD * 100;
    
    if (isStagnant) {
      // Check previous analytics to get stagnation count
      const { data } = await supabase
        .from('progress_analytics')
        .select('stagnation_count')
        .eq('child_id', childId)
        .eq('therapy_type', therapyType)
        .single();
      
      return (data?.stagnation_count || 0) + 1;
    }
    
    return 0;
  }
  
  // =====================================================
  // DATABASE OPERATIONS
  // =====================================================
  
  /**
   * Save computed analytics to database
   * Uses UPSERT to update existing record
   */
  private static async saveAnalytics(analytics: ProgressAnalytics): Promise<void> {
    const { error } = await supabase
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
        analysis_period_start: new Date(Date.now() - CONFIG.ANALYSIS_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        analysis_period_end: new Date().toISOString(),
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'child_id,therapy_type'
      });
    
    if (error) throw error;
  }
  
  /**
   * Generate alerts based on analytics
   */
  private static async generateAlerts(
    analytics: ProgressAnalytics,
    sessions: SessionMetrics[]
  ): Promise<void> {
    
    const alerts: Omit<ProgressAlert, 'id'>[] = [];
    
    // Regression Alert
    if (analytics.has_regression) {
      alerts.push({
        child_id: analytics.child_id,
        therapist_id: sessions[sessions.length - 1].therapist_id,
        alert_type: 'regression',
        severity: analytics.regression_metrics.length >= 2 ? 'high' : 'medium',
        title: 'Regression Detected',
        description: `Child shows regression in ${analytics.regression_metrics.length} metric(s): ${analytics.regression_metrics.join(', ')}`,
        affected_metrics: analytics.regression_metrics,
        metric_values: {
          overall_change: analytics.overall_improvement_pct,
        },
      });
    }
    
    // Stagnation Alert
    if (analytics.stagnation_count >= CONFIG.ALERT_STAGNATION_COUNT) {
      alerts.push({
        child_id: analytics.child_id,
        therapist_id: sessions[sessions.length - 1].therapist_id,
        alert_type: 'stagnation',
        severity: analytics.stagnation_count >= 5 ? 'high' : 'medium',
        title: 'Progress Stagnation',
        description: `No significant improvement for ${analytics.stagnation_count} consecutive analysis periods`,
        affected_metrics: ['overall_progress'],
        metric_values: {
          stagnation_count: analytics.stagnation_count,
          overall_change: analytics.overall_improvement_pct,
        },
      });
    }
    
    // Save alerts
    for (const alert of alerts) {
      await supabase
        .from('progress_alerts')
        .insert(alert);
    }
  }
  
  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================
  
  private static getDefaultAnalytics(childId: string, therapyType: string): ProgressAnalytics {
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
    };
  }
  
  private static getDefaultChanges(): Record<string, number> {
    return {
      eye_contact: 0,
      social_engagement: 0,
      emotional_regulation: 0,
      attention_span: 0,
      communication: 0,
      session_engagement: 0,
      overall: 0,
    };
  }
}

// =====================================================
// EXPORT API ENDPOINTS
// =====================================================

export const progressAnalyticsService = {
  
  /**
   * Compute progress after new session
   */
  async computeProgress(childId: string, therapyType: 'speech' | 'motor' | 'social' | 'behavioral') {
    return await TherapyProgressAnalytics.computeProgress(childId, therapyType);
  },
  
  /**
   * Get cached analytics (fast)
   */
  async getAnalytics(childId: string, therapyType?: string) {
    let query = supabase
      .from('progress_analytics')
      .select('*')
      .eq('child_id', childId);
    
    if (therapyType) {
      query = query.eq('therapy_type', therapyType);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  
  /**
   * Get active alerts
   */
  async getAlerts(childId: string) {
    const { data, error } = await supabase
      .from('progress_alerts')
      .select('*')
      .eq('child_id', childId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string) {
    const { error } = await supabase
      .from('progress_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId);
    
    if (error) throw error;
  },
};
