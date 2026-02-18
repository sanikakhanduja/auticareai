import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import TherapyProgressTab from "@/components/TherapyProgressTab";
import { Child, Report, TherapySession, useAppStore } from "@/lib/store";
import { childrenService, reportsService, screeningService, therapySessionsService } from "@/services/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { format } from "date-fns";

const riskScoreMap: Record<string, number> = {
  low: 25,
  medium: 50,
  high: 75,
};

const buildProgressData = (results: any[]) => {
  if (!results || results.length === 0) return [];
  const sorted = [...results].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.map((result) => ({
    label: format(new Date(result.created_at), "MMM d"),
    riskScore: riskScoreMap[result.risk_level] ?? 50,
  }));
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
  const progressData = useMemo(() => buildProgressData(screeningResults), [screeningResults]);
  const milestones = useMemo(
    () => generateMilestones(selectedChildId, reports, therapySessions),
    [selectedChildId, reports, therapySessions]
  );

  const insights = useMemo(() => {
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
  }, [screeningResults]);

  const isTherapist = currentUser?.role === "therapist";
  const isDoctor = currentUser?.role === "doctor";

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
        {/* Main Chart */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Developmental Trajectory</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedChild?.name}'s progress over time
                </p>
              </div>
              <AgentBadge type="monitoring" size="sm" />
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressData}>
                  <defs>
                    <linearGradient id="colorSocial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(262, 60%, 65%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(262, 60%, 65%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(174, 62%, 47%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(174, 62%, 47%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMotor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(15, 90%, 65%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(15, 90%, 65%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="social"
                    stroke="hsl(262, 60%, 65%)"
                    fillOpacity={1}
                    fill="url(#colorSocial)"
                    name="Social Skills"
                  />
                  <Area
                    type="monotone"
                    dataKey="communication"
                    stroke="hsl(174, 62%, 47%)"
                    fillOpacity={1}
                    fill="url(#colorComm)"
                    name="Communication"
                  />
                  {(isTherapist || isDoctor) && (
                    <Area
                      type="monotone"
                      dataKey="motor"
                      stroke="hsl(15, 90%, 65%)"
                      fillOpacity={1}
                      fill="url(#colorMotor)"
                      name="Motor Skills"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-agent-screening" />
                <span className="text-sm">Social Skills</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-sm">Communication</span>
              </div>
              {(isTherapist || isDoctor) && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-secondary" />
                  <span className="text-sm">Motor Skills</span>
                </div>
              )}
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
            <p className="text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg p-2">
              AI-generated insights for monitoring support only. Simulated analysis for demonstration.
            </p>
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
            </div>
          </AgentPanel>

          {/* Feedback Loop Indicator */}
          <div className="mt-4 rounded-2xl border border-success/30 bg-success/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-success" />
              <span className="font-medium text-sm">Feedback Loop Active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Insights are automatically shared with your therapist and care team.
            </p>
          </div>

          {/* Simulated Recommendation */}
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              <span className="font-medium text-sm">AI Recommendation</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on recent progress, consider adjusting speech therapy frequency. 
              This insight has been shared with your assigned Therapist and Parent.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2 italic">
              Simulated AI analysis for demonstration purposes.
            </p>
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

      {selectedChild && (
        <div className="mt-8">
          <TherapyProgressTab childId={selectedChild.id} childName={selectedChild.name} />
        </div>
      )}
    </DashboardLayout>
  );
}
