/**
 * =====================================================
 * THERAPY PROGRESS TAB - PARENT VIEW
 * =====================================================
 * Displays: Therapy metrics, graphs, AI summary
 * SEPARATE from Doctor Evaluations
 * =====================================================
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { llmExplanationService } from '@/services/llmExplanationService';
import { reportsService } from '@/services/data';

interface TherapyProgressTabProps {
  childId: string;
  childName: string;
}

const INFERENCE_CACHE_KEY = 'progress_inference_cache_v1';

export default function TherapyProgressTab({ childId, childName }: TherapyProgressTabProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTherapy, setSelectedTherapy] = useState<string>('speech');
  const [latestReportId, setLatestReportId] = useState<string>('no-report');
  const [isGenerating, setIsGenerating] = useState(false);
  const [llmBlockedUntil, setLlmBlockedUntil] = useState<number | null>(null);
  const lastRequestKeyRef = useRef<string>('');

  useEffect(() => {
    loadTherapyProgress();
  }, [childId, selectedTherapy]);

  const getReportOnlyAnalytics = () => ({
    total_sessions: 0,
    overall_trend: 'stable',
    overall_improvement_pct: 0,
    consistency_score: 1,
    has_regression: false,
    average_eye_contact: 0,
    average_social_engagement: 0,
    average_emotional_regulation: 0,
    eye_contact_trend: 'stable',
    social_engagement_trend: 'stable',
    emotional_regulation_trend: 'stable',
    eye_contact_change_pct: 0,
    social_engagement_change_pct: 0,
    emotional_regulation_change_pct: 0,
    best_performing_metric: 'report_based',
    needs_attention_metric: 'report_based',
  });

  const loadTherapyProgress = async () => {
    setLoading(true);
    try {
      const reportsResponse = await reportsService.getReports(childId);
      const latestId = reportsResponse.data?.[0]?.id || 'no-report';
      setLatestReportId(latestId);

      const cacheKey = buildInferenceCacheKey(childId, selectedTherapy, latestId);
      const cachedSummary = readInferenceCache(cacheKey);
      if (cachedSummary) {
        setAiSummary(cachedSummary);
        lastRequestKeyRef.current = cacheKey;
      } else {
        setAiSummary('Click "Get AI Insights" to generate inference for the latest report.');
      }

      // Report-only mode: inference is based on doctor reports.
      setAnalytics(getReportOnlyAnalytics());
      setAlerts([]);
      
      // Fetch recent sessions for graph
      const sessionsData = await fetchRecentSessions();
      setSessions(sessionsData);
      
    } catch (error) {
      console.error('Error loading therapy progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIExplanation = async (analyticsData: any, cacheKey: string) => {
    if (isGenerating) return;
    if (llmBlockedUntil && Date.now() < llmBlockedUntil) {
      const retryIn = Math.ceil((llmBlockedUntil - Date.now()) / 1000);
      setAiSummary(`LLM temporarily rate-limited. Please retry in ~${retryIn}s.`);
      return;
    }

    setIsGenerating(true);
    try {
      const explanation = await llmExplanationService.generateExplanation({
        childId,
        role: 'parent',
        childName,
        therapyType: selectedTherapy,
      });
      
      setAiSummary(explanation.summary);
      writeInferenceCache(cacheKey, explanation.summary);
      lastRequestKeyRef.current = cacheKey;
    } catch (error) {
      console.error('Error generating AI summary:', error);
      const message = error instanceof Error ? error.message : 'Summary generation failed. Please try again.';
      const retryMatch = message.match(/retry in\s*~?\s*([\d.]+)s/i);
      if (retryMatch) {
        const retrySeconds = Math.max(1, Math.ceil(Number(retryMatch[1])));
        setLlmBlockedUntil(Date.now() + retrySeconds * 1000);
      }
      setAiSummary(`Summary generation failed: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchRecentSessions = async () => {
    // Implement session fetching
    // This should return last 10-15 sessions for graphing
    return [];
  };

  const buildInferenceCacheKey = (id: string, therapy: string, reportId: string) =>
    `${id}::${therapy}::${reportId || 'no-report'}`;

  const readInferenceCache = (cacheKey: string): string | null => {
    try {
      const raw = localStorage.getItem(INFERENCE_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      return parsed[cacheKey] || null;
    } catch {
      return null;
    }
  };

  const writeInferenceCache = (cacheKey: string, summary: string): void => {
    try {
      const raw = localStorage.getItem(INFERENCE_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[cacheKey] = summary;
      localStorage.setItem(INFERENCE_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore storage failures
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading therapy progress...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Therapy Data Yet</h3>
        <p className="text-muted-foreground">
          Therapy progress will appear here after the first session is completed.
        </p>
        <button
          className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded bg-primary text-white font-medium shadow hover:bg-primary/80 transition"
          onClick={() => loadTherapyProgress()}
        >
          <Sparkles className="h-4 w-4" /> Retry Loading
        </button>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'regressing':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-warning" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-success';
      case 'regressing':
        return 'text-destructive';
      default:
        return 'text-warning';
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'bg-success/10 text-success border-success/20';
      case 'regressing':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Therapy Type Selector */}
      <Tabs value={selectedTherapy} onValueChange={setSelectedTherapy}>
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="speech">Speech</TabsTrigger>
          <TabsTrigger value="motor">Motor</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Get AI Insights Button */}
      <div className="flex justify-end mb-2">
        <button
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-primary text-white font-medium shadow hover:bg-primary/80 transition disabled:opacity-50"
          onClick={() => {
            if (analytics) {
              if ((analytics?.total_sessions || 0) === 0 && latestReportId === 'no-report') {
                setAiSummary(
                  `${childName} has no completed therapy sessions or reports yet for ${selectedTherapy}. Add report/session data first to generate AI insights.`
                );
                return;
              }
              const cacheKey = buildInferenceCacheKey(childId, selectedTherapy, latestReportId);
              const cached = readInferenceCache(cacheKey);
              if (cached && lastRequestKeyRef.current === cacheKey) {
                setAiSummary(cached);
                return;
              }
              setAiSummary('Generating summary...');
              generateAIExplanation(analytics, cacheKey);
            }
          }}
          disabled={!analytics || isGenerating || (llmBlockedUntil !== null && Date.now() < llmBlockedUntil)}
        >
          <Sparkles className="h-4 w-4" /> Get AI Insights
        </button>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default'}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          ))}
        </motion.div>
      )}

      {/* AI-Generated Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Progress Summary</CardTitle>
            </div>
            <CardDescription>
              Personalized explanation of {childName}'s progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {aiSummary || 'Generating summary...'}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Overall Progress Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>Last 30 days · {analytics.total_sessions} sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Trend</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getTrendIcon(analytics.overall_trend)}
                    <span className={`text-sm font-semibold ${getTrendColor(analytics.overall_trend)}`}>
                      {analytics.overall_trend}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Improvement</p>
                  <p className="text-lg font-bold mt-1">
                    {analytics.overall_improvement_pct > 0 ? '+' : ''}
                    {analytics.overall_improvement_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Consistency</p>
                  <p className="text-lg font-bold mt-1">
                    {(analytics.consistency_score * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    {analytics.has_regression ? (
                      <Badge variant="destructive" className="text-xs">
                        Needs Attention
                      </Badge>
                    ) : (
                      <Badge variant="default" className="text-xs bg-success/10 text-success border-success/20">
                        On Track
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Metric Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid md:grid-cols-3 gap-4"
      >
        {[
          { key: 'eye_contact', label: 'Eye Contact', score: analytics.average_eye_contact, trend: analytics.eye_contact_trend, change: analytics.eye_contact_change_pct },
          { key: 'social_engagement', label: 'Social Engagement', score: analytics.average_social_engagement, trend: analytics.social_engagement_trend, change: analytics.social_engagement_change_pct },
          { key: 'emotional_regulation', label: 'Emotional Regulation', score: analytics.average_emotional_regulation, trend: analytics.emotional_regulation_trend, change: analytics.emotional_regulation_change_pct },
        ].map((metric, index) => (
          <Card key={metric.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold">{(metric.score * 100).toFixed(0)}%</span>
                  <Badge className={getTrendBadge(metric.trend)}>
                    <span className="flex items-center gap-1">
                      {getTrendIcon(metric.trend)}
                      {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </span>
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${metric.score * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Progress Graph */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Progress Over Time</CardTitle>
            <CardDescription>Tracking key metrics across sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={sessions}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="session_date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  className="text-xs"
                />
                <YAxis domain={[0, 1]} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} className="text-xs" />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="eye_contact_score"
                  name="Eye Contact"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="social_engagement_score"
                  name="Social Engagement"
                  stroke="hsl(var(--secondary))"
                  fill="hsl(var(--secondary))"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="emotional_regulation_score"
                  name="Emotional Regulation"
                  stroke="hsl(var(--accent))"
                  fill="hsl(var(--accent))"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Performance Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid md:grid-cols-2 gap-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Strongest Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">
              {analytics.best_performing_metric.replace(/_/g, ' ')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {childName} is doing great in this area!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Focus Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">
              {analytics.needs_attention_metric.replace(/_/g, ' ')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Working on improvements in upcoming sessions
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
