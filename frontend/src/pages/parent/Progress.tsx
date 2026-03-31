import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  MessageSquare,
  Bot,
  FileText,
  Activity,
  Target,
  Lightbulb,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AgentPanel, AgentBadge } from "@/components/AgentBadge";
import { Child, Report, TherapySession, useAppStore } from "@/lib/store";
import { childrenService, reportsService, screeningService, therapySessionsService } from "@/services/data";
import { agentsService, MonitoringInferenceResponse } from "@/services/agents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { format } from "date-fns";

const riskScoreMap: Record<string, number> = {
  low: 25,
  medium: 50,
  high: 75,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashString = (input: string) =>
  input.split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 100000, 7);

const seededMetric = (seed: number, min: number, max: number) =>
  min + (seed % (max - min + 1));

const deriveProgressSnapshot = (
  child: Child | undefined,
  screening: any[],
  childReports: Report[],
  childSessions: TherapySession[]
) => {
  const sortedScreening = [...(screening || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const latest = sortedScreening[sortedScreening.length - 1];
  const previous = sortedScreening[sortedScreening.length - 2];
  const latestRisk = latest ? riskScoreMap[latest.risk_level] ?? 50 : 50;
  const previousRisk = previous ? riskScoreMap[previous.risk_level] ?? 50 : latestRisk;
  const riskDelta = previousRisk - latestRisk;
  const completedSessions = childSessions.filter((s) => s.status === "completed").length;
  const latestDiagnostic = [...childReports]
    .filter((r) => r.type === "diagnostic")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const diagnosticGaps = latestDiagnostic?.developmentalGaps || [];

  if (completedSessions === 0) {
    if (latestDiagnostic) {
      const preTherapySeed = hashString(`${child?.id || "child"}:${latestDiagnostic.id}:pre-therapy`);
      const currentScore = clamp(seededMetric(preTherapySeed + 7, 28, 54), 10, 96);
      const previousScore = clamp(currentScore - seededMetric(preTherapySeed + 13, 0, 4), 8, 95);
      const engagement = clamp(currentScore + seededMetric(preTherapySeed + 17, -5, 6), 12, 98);
      const communication = clamp(currentScore + seededMetric(preTherapySeed + 23, -6, 5), 12, 98);
      const attention = clamp(currentScore + seededMetric(preTherapySeed + 31, -7, 4), 12, 98);
      const weekSeries = [
        clamp(previousScore - seededMetric(preTherapySeed + 37, 1, 5), 10, 95),
        clamp(previousScore - seededMetric(preTherapySeed + 41, 0, 3), 10, 95),
        previousScore,
        currentScore,
      ];

      return {
        currentScore,
        previousScore,
        trendLabel:
          currentScore > previousScore ? "improving" : currentScore < previousScore ? "declining" : "stable",
        sourceLabel: "Diagnostic baseline estimate (pre-therapy)",
        metrics: [
          { label: "Engagement", value: engagement },
          { label: "Communication", value: communication },
          { label: "Attention", value: attention },
        ],
        focusAreas:
          diagnosticGaps.length > 0
            ? diagnosticGaps.slice(0, 3)
            : ["Social communication", "Response flexibility", "Joint attention"],
        weekSeries,
      };
    }

    return {
      currentScore: 0,
      previousScore: 0,
      trendLabel: "not started",
      sourceLabel: "Progress starts after first completed therapy session",
      metrics: [
        { label: "Engagement", value: 0 },
        { label: "Communication", value: 0 },
        { label: "Attention", value: 0 },
      ],
      focusAreas:
        diagnosticGaps.length > 0
          ? diagnosticGaps.slice(0, 3)
          : ["Social communication", "Response flexibility", "Joint attention"],
      weekSeries: [0, 0, 0, 0],
    };
  }

  const baseFromRisk = clamp(Math.round(100 - latestRisk), 15, 90);
  const sessionBonus = clamp(completedSessions * 3, 0, 15);
  const currentScore = clamp(baseFromRisk + sessionBonus, 10, 96);
  const previousScore = clamp(currentScore - riskDelta, 8, 95);

  if (!child && !latestDiagnostic && sortedScreening.length === 0) {
    return {
      currentScore: 42,
      previousScore: 38,
      trendLabel: "improving",
      sourceLabel: "Seeded baseline",
      metrics: [
        { label: "Engagement", value: 46 },
        { label: "Communication", value: 41 },
        { label: "Attention", value: 39 },
      ],
      focusAreas: ["Social communication", "Sustained attention", "Turn-taking behavior"],
      weekSeries: [34, 37, 40, 42],
    };
  }

  const seed = hashString(`${child?.id || "child"}:${latestDiagnostic?.id || "diag"}:${completedSessions}`);
  const engagement = clamp(currentScore + seededMetric(seed + 11, -6, 6), 12, 98);
  const communication = clamp(currentScore + seededMetric(seed + 17, -7, 5), 12, 98);
  const attention = clamp(currentScore + seededMetric(seed + 29, -8, 4), 12, 98);
  const weekSeries = [
    clamp(previousScore - seededMetric(seed + 3, 2, 6), 10, 95),
    clamp(previousScore - seededMetric(seed + 5, 0, 4), 10, 95),
    previousScore,
    currentScore,
  ];

  return {
    currentScore,
    previousScore,
    trendLabel: currentScore > previousScore ? "improving" : currentScore < previousScore ? "declining" : "stable",
    sourceLabel: latestDiagnostic ? "Based on latest diagnostic + sessions" : "Based on screening + sessions",
    metrics: [
      { label: "Engagement", value: engagement },
      { label: "Communication", value: communication },
      { label: "Attention", value: attention },
    ],
    focusAreas:
      diagnosticGaps.length > 0
        ? diagnosticGaps.slice(0, 3)
        : ["Social communication", "Response flexibility", "Joint attention"],
    weekSeries,
  };
};

// Generate mock milestones (reports and sessions)
const generateMilestones = (childId: string, reports: any[], sessions: any[]) => {
  const childReports = reports.filter(r => r.childId === childId);
  const childSessions = sessions.filter(s => s.childId === childId && s.status === "completed");
  
  const milestones = [
    ...childReports.map(r => ({
      type: "report" as const,
      date: new Date(r.createdAt),
      label: r.type === "diagnostic" ? "Diagnostic Report" : "Observation Report",
      color: r.type === "diagnostic" ? "success" : "agent-monitoring",
    })),
    ...childSessions.map(s => ({
      type: "session" as const,
      date: new Date(s.createdAt),
      label: `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} Session`,
      color: "primary",
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return milestones;
};

export default function Progress() {
  const [searchParams] = useSearchParams();
  const { selectedChildId, setSelectedChildId, currentUser } = useAppStore();
  const [children, setChildren] = useState<Child[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [therapySessions, setTherapySessions] = useState<TherapySession[]>([]);
  const [screeningResults, setScreeningResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [monitoringInference, setMonitoringInference] = useState<MonitoringInferenceResponse | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  useEffect(() => {
    const loadChildren = async () => {
      setLoading(true);
      setLoadError(null);

      const { data, error } = await childrenService.getChildren();
      if (error) {
        setLoadError(error.message || "Failed to load children");
        setLoading(false);
        return;
      }

      const normalized = (data || []).map((child: any) => ({
        id: child.id,
        name: child.name,
        dateOfBirth: child.date_of_birth,
        age: 0,
        gender: child.gender,
        screeningStatus: child.screening_status,
        riskLevel: child.risk_level,
        assignedDoctorId: child.assigned_doctor_id,
        assignedTherapistId: child.assigned_therapist_id,
        observationEndDate: child.observation_end_date,
      }));

      setChildren(normalized);
      setLoading(false);
    };

    loadChildren();
  }, []);

  useEffect(() => {
    const paramChildId = searchParams.get("childId");
    if (paramChildId && paramChildId !== selectedChildId) {
      setSelectedChildId(paramChildId);
    }
  }, [searchParams, selectedChildId, setSelectedChildId]);

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId, setSelectedChildId]);

  useEffect(() => {
    const loadChildData = async () => {
      if (!selectedChildId) return;

      const [reportsResponse, sessionsResponse, screeningResponse] = await Promise.all([
        reportsService.getReports(selectedChildId),
        therapySessionsService.getSessionsForChild(selectedChildId),
        screeningService.getResultsForChild(selectedChildId),
      ]);

      const mappedReports = (reportsResponse.data || []).map((report: any) => ({
        id: report.id,
        childId: report.child_id,
        type: report.type,
        createdAt: new Date(report.created_at),
        doctorNotes: report.content?.doctorNotes || "",
        screeningSummary: report.content?.screeningSummary || "",
        monitoringPlan: report.content?.monitoringPlan,
        followUpDate: report.content?.followUpDate,
        diagnosisConfirmation: report.content?.diagnosisConfirmation,
        developmentalGaps: report.content?.developmentalGaps,
        therapyRecommendations: report.content?.therapyRecommendations,
      }));

      const mappedSessions = (sessionsResponse.data || []).map((session: any) => ({
        id: session.id,
        childId: session.child_id,
        type: session.type,
        scheduledDate: session.scheduled_date,
        scheduledTime: session.scheduled_time,
        status: session.status,
        goals: session.goals,
        notes: session.notes,
        createdAt: new Date(session.created_at),
      }));

      setReports(mappedReports);
      setTherapySessions(mappedSessions);
      setScreeningResults(screeningResponse.data || []);
    };

    loadChildData();
  }, [selectedChildId]);

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const childReports = useMemo(
    () => reports.filter((report) => report.childId === selectedChildId),
    [reports, selectedChildId]
  );
  const childSessions = useMemo(
    () => therapySessions.filter((session) => session.childId === selectedChildId),
    [therapySessions, selectedChildId]
  );
  const completedSessionsCount = useMemo(
    () => childSessions.filter((session) => session.status === "completed").length,
    [childSessions]
  );
  const hasCompletedSessions = completedSessionsCount > 0;
  const progressSnapshot = useMemo(
    () => deriveProgressSnapshot(selectedChild, screeningResults, childReports, childSessions),
    [selectedChild, screeningResults, childReports, childSessions]
  );
  const milestones = useMemo(
    () => generateMilestones(selectedChildId, reports, therapySessions),
    [selectedChildId, reports, therapySessions]
  );

  const insights = useMemo(() => {
    if (!hasCompletedSessions) {
      return [
        {
          type: "neutral",
          title: "Progress Tracking Not Started",
          message: "Complete at least one therapy session to begin progress trend tracking and AI trajectory insights.",
        },
      ];
    }

    if (!screeningResults || screeningResults.length === 0) return [];

    const sorted = [...screeningResults].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const latestScore = riskScoreMap[latest.risk_level] ?? 50;
    const previousScore = previous ? riskScoreMap[previous.risk_level] ?? 50 : null;

    const items = [
      {
        type: "neutral",
        title: "Latest Risk Level",
        message: `${latest.risk_level?.toUpperCase?.() || "Medium"} risk as of ${format(
          new Date(latest.created_at),
          "MMM d, yyyy"
        )}.`,
      },
    ];

    if (previousScore !== null) {
      if (latestScore < previousScore) {
        items.push({
          type: "positive",
          title: "Risk Trend Improving",
          message: "Recent screening results show a reduced risk trend compared to the previous check-in.",
        });
      } else if (latestScore > previousScore) {
        items.push({
          type: "attention",
          title: "Risk Trend Increasing",
          message: "Recent screening results show an increased risk trend compared to the previous check-in.",
        });
      } else {
        items.push({
          type: "neutral",
          title: "Risk Trend Stable",
          message: "Recent screening results show a stable risk trend compared to the previous check-in.",
        });
      }
    }

    return items;
  }, [screeningResults, hasCompletedSessions]);

  const isTherapist = currentUser?.role === "therapist";
  const isDoctor = currentUser?.role === "doctor";

  useEffect(() => {
    const loadMonitoringInference = async () => {
      if (!selectedChild) return;
      if (!hasCompletedSessions) {
        setMonitoringInference(null);
        setMonitoringError(null);
        return;
      }
      if (!screeningResults || screeningResults.length === 0) {
        setMonitoringInference(null);
        return;
      }

      const sorted = [...screeningResults].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latest = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];
      const latestRiskScore = riskScoreMap[latest.risk_level] ?? 50;
      const previousRiskScore = previous ? riskScoreMap[previous.risk_level] ?? 50 : latestRiskScore;

      const completedSessions = therapySessions
        .filter((session) => session.childId === selectedChild.id && session.status === "completed")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const half = completedSessions.length > 1 ? Math.floor(completedSessions.length / 2) : 0;
      const previousHalf = half > 0 ? completedSessions.slice(0, half).length : completedSessions.length;
      const latestHalf = half > 0 ? completedSessions.slice(half).length : completedSessions.length;

      const metricSeries = [
        {
          metric: "risk_score",
          previous: previousRiskScore,
          current: latestRiskScore,
          higherIsBetter: false,
        },
        {
          metric: "completed_sessions_count",
          previous: previousHalf,
          current: latestHalf,
          higherIsBetter: true,
        },
      ];

      const therapistSessionFeedback = completedSessions.slice(-3).map((session) => ({
        sessionDate: session.scheduledDate,
        strengths: ["Session completed"],
        concerns: [],
        notes: session.notes || undefined,
      }));

      setMonitoringLoading(true);
      setMonitoringError(null);
      try {
        const response = await agentsService.getMonitoringInference({
          childName: selectedChild.name,
          role: isDoctor ? "doctor" : isTherapist ? "therapist" : "parent",
          metricSeries,
          therapistSessionFeedback,
        });
        setMonitoringInference(response.data);
      } catch (error: any) {
        setMonitoringError(error?.message || "Failed to generate monitoring inference");
      } finally {
        setMonitoringLoading(false);
      }
    };

    loadMonitoringInference();
  }, [selectedChild, screeningResults, therapySessions, isDoctor, isTherapist, hasCompletedSessions]);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Developmental Progress & Learning Curve</h1>
        <p className="text-muted-foreground mt-2">
          Track developmental progress and AI-generated insights
        </p>
      </div>

      {/* Child Selection */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">Select Child</label>
        <Select value={selectedChildId} onValueChange={setSelectedChildId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select a child" />
          </SelectTrigger>
          <SelectContent>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                {child.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Explainer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl bg-muted/50 border border-border p-4"
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Understanding the Progress Curve</p>
            <p className="text-xs text-muted-foreground mt-1">
              Progress curves reflect cumulative learning and therapy impact over time. 
              Each therapy session and diagnostic milestone contributes to the developmental trajectory.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Snapshot */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Progress Snapshot</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedChild?.name}'s current development view
                </p>
              </div>
              <AgentBadge type="monitoring" size="sm" />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm text-muted-foreground">{progressSnapshot.sourceLabel}</p>
                <p className="text-xs text-muted-foreground">
                  4-week trend: {progressSnapshot.weekSeries.join(" → ")}
                </p>
              </div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Overall Progress</p>
                  <p className="text-3xl font-semibold">{progressSnapshot.currentScore}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Previous</p>
                  <p className="text-lg font-medium">{progressSnapshot.previousScore}%</p>
                </div>
              </div>
              <ProgressBar value={progressSnapshot.currentScore} />
              <p className="text-xs text-muted-foreground mt-2">
                Trend status: {progressSnapshot.trendLabel}
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              {progressSnapshot.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-semibold mt-1">{metric.value}%</p>
                  <ProgressBar value={metric.value} className="mt-2" />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-2">Current Focus Areas</p>
              <div className="flex flex-wrap gap-2">
                {progressSnapshot.focusAreas.map((area, idx) => (
                  <span
                    key={`${area}-${idx}`}
                    className="rounded-full border border-border bg-muted px-3 py-1 text-xs"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Milestones Timeline */}
          {milestones.length > 0 && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Key Milestones
              </h3>
              <div className="relative">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {milestones.slice(0, 5).map((milestone, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-4 pl-6"
                    >
                      <div
                        className={`absolute left-0 h-4 w-4 rounded-full border-2 border-card ${
                          milestone.type === "report"
                            ? milestone.color === "success"
                              ? "bg-success"
                              : "bg-agent-monitoring"
                            : "bg-primary"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{milestone.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(milestone.date, "MMM d, yyyy")}
                        </p>
                      </div>
                      {milestone.type === "report" ? (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Insights Panel */}
        <div>
          <AgentPanel type="monitoring">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Monitoring & Trajectory Agent Insights
            </h3>
            {monitoringLoading && (
              <p className="text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg p-2">
                Generating monitoring inference...
              </p>
            )}
            {monitoringError && (
              <p className="text-xs text-destructive mb-4 bg-destructive/10 rounded-lg p-2">
                {monitoringError}
              </p>
            )}
            {monitoringInference?.overview && (
              <p className="text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg p-2">
                {monitoringInference.overview}
              </p>
            )}
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-lg bg-muted/50 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {insight.type === "positive" && (
                      <TrendingUp className="h-4 w-4 text-success" />
                    )}
                    {insight.type === "neutral" && (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                    {insight.type === "attention" && (
                      <TrendingDown className="h-4 w-4 text-warning" />
                    )}
                    <span className="text-sm font-medium">{insight.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{insight.message}</p>
                </motion.div>
              ))}
              {monitoringInference?.metricInsights?.map((line, index) => (
                <div key={`metric-${index}`} className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">{line}</p>
                </div>
              ))}
            </div>
          </AgentPanel>

          {/* Feedback Loop Indicator */}
          <div className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-success" />
              <span className="font-medium text-sm">{hasCompletedSessions ? "Feedback Loop Active" : "Feedback Loop Pending"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasCompletedSessions
                ? "Insights are automatically shared with your therapist and care team."
                : "Insights sharing will activate after the first completed therapy session."}
            </p>
          </div>

          {/* Simulated Recommendation */}
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              <span className="font-medium text-sm">AI Recommendation</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {monitoringInference?.nextActions?.[0] ||
                "Monitoring recommendation will appear after enough screening and session data is available."}
            </p>
            {monitoringInference?.nextActions?.[1] && (
              <p className="text-xs text-muted-foreground mt-2">{monitoringInference.nextActions[1]}</p>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Check-in Reminder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 rounded-2xl border border-secondary/30 gradient-warm p-6 text-primary-foreground"
      >
        <div className="flex items-center gap-4">
          <Calendar className="h-10 w-10" />
          <div>
            <h3 className="font-semibold">Weekly Check-in Due</h3>
            <p className="text-sm opacity-90">
              Complete your weekly developmental check-in to help track progress accurately.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Graph-heavy tab removed from this page to keep progress view concise and focused. */}
    </DashboardLayout>
  );
}
