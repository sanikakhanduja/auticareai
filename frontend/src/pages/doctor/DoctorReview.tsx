import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Brain,
  User,
  Calendar,
  Eye,
  ClipboardCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentPanel, AgentBadge } from "@/components/AgentBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, profilesService, reportsService, screeningService } from "@/services/data";
import { cvService, CvReport } from "@/services/cv";
import { agentsService, ClinicalSummaryResponse } from "@/services/agents";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addMonths } from "date-fns";

type DecisionType = "observation" | "diagnosis" | null;
type FlowStep = "decision" | "observation-report" | "diagnosis-confirm" | "diagnosis-report" | "complete";

const parseMaybeNumber = (raw: unknown): number | null => {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const match = raw.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildCvReportFields = (cvReport: CvReport | null) => {
  if (!cvReport) {
    return {
      cvRiskLevel: undefined,
      cvRiskConfidence: undefined,
      cvRiskDescription: undefined,
      objectiveSignals: undefined,
      objectiveSignalValues: undefined,
      objectiveSignalBaselines: undefined,
      signalSummary: undefined,
    };
  }

  const rawSignals = cvReport.metrics?.objective_signals || {};
  const objectiveSignals: Record<string, { value: number | null; baseline: number | null; status: string }> = {};
  const objectiveSignalValues: Record<string, number> = {};
  const objectiveSignalBaselines: Record<string, number> = {};
  const signalSummary: string[] = [];

  for (const [key, signal] of Object.entries(rawSignals)) {
    const valueNum = parseMaybeNumber(signal?.value);
    const baselineNum = parseMaybeNumber(signal?.baseline);
    const status = signal?.status || "unknown";

    objectiveSignals[key] = {
      value: valueNum,
      baseline: baselineNum,
      status,
    };

    if (valueNum !== null) {
      objectiveSignalValues[key] = valueNum;
    }
    if (baselineNum !== null) {
      objectiveSignalBaselines[key] = baselineNum;
    }

    signalSummary.push(
      `${key}=${valueNum ?? "NA"}, baseline=${baselineNum ?? "NA"}, status=${status}`
    );
  }

  return {
    cvRiskLevel: cvReport.risk_assessment?.level,
    cvRiskConfidence: cvReport.risk_assessment?.confidence,
    cvRiskDescription: cvReport.risk_assessment?.description,
    objectiveSignals,
    objectiveSignalValues,
    objectiveSignalBaselines,
    signalSummary,
  };
};

export default function DoctorReview() {
  const navigate = useNavigate();
  const { childId } = useParams();
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<DecisionType>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("decision");
  const [followUpMonths, setFollowUpMonths] = useState("3");
  const [monitoringPlan, setMonitoringPlan] = useState("Continue developmental monitoring with weekly check-ins. Upload follow-up video after the observation period.");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [cvReport, setCvReport] = useState<CvReport | null>(null);
  const [cvReportError, setCvReportError] = useState<string | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [childLoading, setChildLoading] = useState(true);
  const [childError, setChildError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [assignedTherapist, setAssignedTherapist] = useState<{ name: string; specialty?: string | null } | null>(null);
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummaryResponse | null>(null);
  const [clinicalSummaryLoading, setClinicalSummaryLoading] = useState(false);
  const [clinicalSummaryError, setClinicalSummaryError] = useState<string | null>(null);
  const [latestScreeningVideoUrl, setLatestScreeningVideoUrl] = useState<string | null>(null);
  const [latestScreeningVideoError, setLatestScreeningVideoError] = useState<string | null>(null);

  useEffect(() => {
    const loadChild = async () => {
      if (!childId) return;
      setChildLoading(true);
      setChildError(null);

      const { data, error } = await childrenService.getChildById(childId);
      if (error) {
        setChildError(error.message || "Failed to load child");
        setChildLoading(false);
        return;
      }

      const dob = new Date(data.date_of_birth);
      const age = Number.isNaN(dob.getTime())
        ? 0
        : Math.max(0, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));

      setChild({
        id: data.id,
        name: data.name,
        dateOfBirth: data.date_of_birth,
        age,
        gender: data.gender,
        screeningStatus: data.screening_status,
        riskLevel: data.risk_level,
        assignedDoctorId: data.assigned_doctor_id,
        assignedTherapistId: data.assigned_therapist_id,
        observationEndDate: data.observation_end_date,
      });
      setChildLoading(false);
    };

    loadChild();
  }, [childId]);

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadAssignedTherapist = async () => {
      if (!child?.assignedTherapistId) {
        setAssignedTherapist(null);
        return;
      }

      const { data, error } = await profilesService.getProfileById(child.assignedTherapistId);
      if (error || !data) {
        setAssignedTherapist(null);
        return;
      }

      setAssignedTherapist({
        name: data.full_name || "Therapist",
        specialty: data.specialty,
      });
    };

    loadAssignedTherapist();
  }, [child?.assignedTherapistId]);

  useEffect(() => {
    const fetchReport = async () => {
      if (!childId) return;
      try {
        const response = await cvService.getLatestReport(childId);
        const report = response?.data?.cv_report as CvReport | undefined;
        if (report) {
          setCvReport(report);
        }
      } catch (error: any) {
        setCvReportError(error?.message || "Failed to load screening report");
      }
    };

    fetchReport();
  }, [childId]);

  useEffect(() => {
    const loadClinicalSummary = async () => {
      if (!childId || !child) return;
      setClinicalSummaryLoading(true);
      setClinicalSummaryError(null);
      try {
        const response = await agentsService.getClinicalSummaryByChild({
          childId,
          role: "doctor",
          forceRefresh: true,
        });
        setClinicalSummary(response.data);
      } catch (error: any) {
        setClinicalSummaryError(error?.message || "Failed to generate clinical summary");
      } finally {
        setClinicalSummaryLoading(false);
      }
    };

    loadClinicalSummary();
  }, [childId, child]);

  useEffect(() => {
    const loadLatestScreeningVideo = async () => {
      if (!childId) return;
      setLatestScreeningVideoError(null);
      const { data, error } = await screeningService.getLatestScreeningVideo(childId);
      if (error) {
        if (!/No screening video found/i.test(error.message || "")) {
          setLatestScreeningVideoError(error.message || "Failed to load screening video");
        }
        setLatestScreeningVideoUrl(null);
        return;
      }

      setLatestScreeningVideoUrl(data?.signedUrl || null);
    };

    loadLatestScreeningVideo();
  }, [childId]);

  if (!child) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {childLoading ? "Loading patient..." : childError || "Patient not found"}
          </p>
          <Button variant="outline" onClick={() => navigate("/doctor")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleSelectObservation = () => {
    setDecision("observation");
    setFlowStep("observation-report");
  };

  const handleSelectDiagnosis = () => {
    setDecision("diagnosis");
    setFlowStep("diagnosis-confirm");
  };

  const handleGenerateObservationReport = async () => {
    const followUpDate = addMonths(new Date(), parseInt(followUpMonths));

    if (!currentUserId) {
      setReportError("You must be signed in to create reports.");
      return;
    }
    
    const report = {
      childId: child.id,
      type: "observation" as const,
      doctorNotes: notes,
      screeningSummary: "Screening completed. Further observation recommended.",
      monitoringPlan,
      followUpDate: followUpDate.toISOString(),
      ...buildCvReportFields(cvReport),
    };

    const { error: reportError } = await reportsService.createReport(report, currentUserId);
    if (reportError) {
      setReportError(reportError.message || "Failed to create report");
      return;
    }

    const { error: updateError } = await childrenService.updateChild(child.id, {
      screeningStatus: "under-observation",
      observationEndDate: followUpDate.toISOString(),
      assignedTherapistId: null as unknown as string,
    });

    if (updateError) {
      setReportError(updateError.message || "Failed to update child status");
      return;
    }

    setChild({
      ...child,
      screeningStatus: "under-observation",
      observationEndDate: followUpDate.toISOString(),
      assignedTherapistId: undefined,
    });
    
    setFlowStep("complete");
  };

  const handleGenerateDiagnosticReport = () => {
    setShowReportDialog(true);
  };

  const confirmDiagnosticReport = async () => {
    if (!currentUserId) {
      setReportError("You must be signed in to create reports.");
      return;
    }

    const report = {
      childId: child.id,
      type: "diagnostic" as const,
      doctorNotes: notes,
      screeningSummary: "Comprehensive screening and clinical review completed.",
      diagnosisConfirmation: "Developmental concerns confirmed based on clinical assessment.",
      developmentalGaps: ["Social communication", "Behavioral patterns", "Motor coordination"],
      therapyRecommendations: [
        "Speech therapy 2x weekly",
        "Occupational therapy 1x weekly",
        "Social skills group sessions",
      ],
      ...buildCvReportFields(cvReport),
    };

    const { error: reportError } = await reportsService.createReport(report, currentUserId);
    if (reportError) {
      setReportError(reportError.message || "Failed to create report");
      return;
    }

    const { error: updateError } = await childrenService.updateChild(child.id, {
      screeningStatus: "diagnosed",
    });

    if (updateError) {
      setReportError(updateError.message || "Failed to update child status");
      return;
    }

    setChild({
      ...child,
      screeningStatus: "diagnosed",
    });
    
    setShowReportDialog(false);
    setFlowStep("complete");
  };

  return (
    <DashboardLayout>
      <Button variant="ghost" onClick={() => navigate("/doctor")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold">Clinical Review</h1>
          <StatusBadge status={child.screeningStatus} />
        </div>
        <p className="text-muted-foreground">
          Review AI-generated summary and provide clinical assessment
        </p>
      </div>

      {reportError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {reportError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-secondary/30 flex items-center justify-center">
                <User className="h-8 w-8 text-secondary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{child.name}</h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {child.age} years old
                  </span>
                  {child.riskLevel && <StatusBadge riskLevel={child.riskLevel} />}
                </div>
                {assignedTherapist && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Therapist: {assignedTherapist.name}
                    {assignedTherapist.specialty ? ` • ${assignedTherapist.specialty}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Clinical Summary */}
          {cvReport && (
            <AgentPanel type="screening">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5" />
                <h3 className="font-semibold">CV Screening Report</h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted-foreground">{cvReport.risk_assessment.description}</p>
                <p className="text-sm mt-1">
                  <strong>Risk:</strong> {cvReport.risk_assessment.level} • <strong>Confidence:</strong> {Math.round(cvReport.risk_assessment.confidence * 100)}%
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(cvReport.metrics.objective_signals).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{key.replace(/_/g, " ")}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        value.status.includes("below")
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {value.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{value.value}</span>
                      <span className="text-xs text-muted-foreground">/ baseline: {value.baseline}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AgentPanel>
          )}

          {!cvReport && !cvReportError && (
            <div className="rounded-2xl border border-border bg-muted/30 p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">No Video Screening Available</p>
                  <p className="text-sm mt-1">The parent hasn't uploaded a screening video yet. You can still proceed with clinical assessment based on other observations.</p>
                </div>
              </div>
            </div>
          )}

          {cvReportError && cvReportError !== "No screening results found" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {cvReportError}
            </div>
          )}

          {(latestScreeningVideoUrl || latestScreeningVideoError) && (
            <AgentPanel type="screening">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5" />
                <h3 className="font-semibold">Uploaded Screening Video</h3>
              </div>

              {latestScreeningVideoError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {latestScreeningVideoError}
                </div>
              ) : null}

              {latestScreeningVideoUrl ? (
                <video
                  controls
                  className="w-full max-h-[420px] rounded-xl border border-border bg-black"
                  src={latestScreeningVideoUrl}
                >
                  Your browser does not support video playback.
                </video>
              ) : null}
            </AgentPanel>
          )}

          <AgentPanel type="clinical">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5" />
              <h3 className="font-semibold">AI-Generated Clinical Summary</h3>
            </div>

            {clinicalSummaryLoading && (
              <p className="text-sm text-muted-foreground mb-4">Generating summary...</p>
            )}

            {clinicalSummaryError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {clinicalSummaryError}
              </div>
            )}

            {!clinicalSummaryLoading && clinicalSummary && (
              <>
                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words overflow-visible">
                  {clinicalSummary.overview || "Clinical assessment generated based on available screening data."}
                </div>
                {clinicalSummary.keyFindings?.length ? (
                  <div className="mt-4 space-y-2">
                    {clinicalSummary.keyFindings.map((item, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        • {item}
                      </div>
                    ))}
                  </div>
                ) : null}

                {clinicalSummary.reviewFlags?.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide mb-2">
                      Review Flags
                    </p>
                    <div className="space-y-2">
                      {clinicalSummary.reviewFlags.map((flag, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          • {flag}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {clinicalSummary.recommendedNextSteps?.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide mb-2">
                      Recommended Next Steps
                    </p>
                    <div className="space-y-2">
                      {clinicalSummary.recommendedNextSteps.map((step, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          • {step}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </AgentPanel>

          {/* Doctor Decision */}
          {flowStep === "decision" && (
            <div className="rounded-2xl border-2 border-primary bg-card p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Clinical Decision</h3>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  By Doctor
                </span>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Clinical Notes</label>
                <Textarea
                  placeholder="Add your clinical observations and notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-agent-monitoring text-agent-monitoring hover:bg-agent-monitoring/10"
                  onClick={handleSelectObservation}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Under Observation
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-success text-success hover:bg-success/10"
                  onClick={handleSelectDiagnosis}
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Diagnosis Complete
                </Button>
              </div>
            </div>
          )}

          {/* Observation Report Form */}
          {flowStep === "observation-report" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-agent-monitoring bg-card p-6 shadow-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-agent-monitoring" />
                <h3 className="font-semibold">Generate Observation Report</h3>
              </div>

              <div className="bg-agent-monitoring/10 rounded-lg p-4 mb-6">
                <p className="text-sm">
                  <strong>Note:</strong> This will place the child under observation. 
                  Therapy planning will <strong>NOT</strong> be initiated. 
                  The parent will be notified to continue monitoring and upload follow-up videos.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Follow-up Period</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={followUpMonths}
                      onChange={(e) => setFollowUpMonths(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">months</span>
                  </div>
                </div>

                <div>
                  <Label>Monitoring Plan</Label>
                  <Textarea
                    value={monitoringPlan}
                    onChange={(e) => setMonitoringPlan(e.target.value)}
                    className="mt-2 min-h-[100px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setFlowStep("decision")}>
                    Back
                  </Button>
                  <Button
                    className="bg-agent-monitoring hover:bg-agent-monitoring/90"
                    onClick={handleGenerateObservationReport}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Observation Report
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Diagnosis Confirmation */}
          {flowStep === "diagnosis-confirm" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 border-success bg-card p-6 shadow-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="h-5 w-5 text-success" />
                <h3 className="font-semibold">Confirm Diagnosis</h3>
              </div>

              <div className="bg-success/10 rounded-lg p-4 mb-6">
                <p className="text-sm">
                  <strong>Important:</strong> Confirming diagnosis will:
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Generate a comprehensive Diagnostic Report</li>
                  <li>• Notify the parent to select a therapist</li>
                  <li>• Enable therapy planning after assignment</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setFlowStep("decision")}>
                  Back
                </Button>
                <Button variant="success" onClick={handleGenerateDiagnosticReport}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Diagnostic Report
                </Button>
              </div>
            </motion.div>
          )}

          {/* Completion State */}
          {flowStep === "complete" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl p-8 text-center ${
                decision === "observation"
                  ? "bg-agent-monitoring/10 border-2 border-agent-monitoring"
                  : "bg-success/10 border-2 border-success"
              }`}
            >
              {decision === "observation" ? (
                <>
                  <Eye className="h-12 w-12 text-agent-monitoring mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Observation Report Generated</h3>
                  <p className="text-muted-foreground mb-4">
                    Child is kept under observation. The parent has been notified to continue 
                    monitoring and upload follow-up videos after the recommended period.
                  </p>
                  <div className="bg-card rounded-lg p-4 text-left max-w-md mx-auto">
                    <p className="text-sm font-medium mb-1">Status: Monitoring in progress – no diagnosis yet</p>
                    <p className="text-xs text-muted-foreground">
                      Therapist will NOT be notified at this stage.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Diagnostic Report Generated</h3>
                  <p className="text-muted-foreground mb-4">
                    Diagnostic report has been generated. The parent can now assign a therapist.
                    Therapy planning begins after assignment.
                  </p>
                  <div className="bg-card rounded-lg p-4 text-left max-w-md mx-auto">
                    <p className="text-sm font-medium mb-1">Status: Diagnosis Complete</p>
                    <p className="text-xs text-muted-foreground">
                      Awaiting therapist assignment by the parent.
                    </p>
                  </div>
                </>
              )}

              <Button variant="outline" onClick={() => navigate("/doctor")} className="mt-6">
                Return to Dashboard
              </Button>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-semibold mb-4">AI Agents Involved</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <AgentBadge type="screening" size="sm" showLabel={false} />
                <div>
                  <p className="text-sm font-medium">Screening Agent</p>
                  <p className="text-xs text-muted-foreground">Video analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AgentBadge type="clinical" size="sm" showLabel={false} />
                <div>
                  <p className="text-sm font-medium">Clinical Summary Agent</p>
                  <p className="text-xs text-muted-foreground">Summary generation</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
            <AlertCircle className="h-6 w-6 text-accent mb-3" />
            <h4 className="font-medium text-sm mb-2">Important</h4>
            <p className="text-xs text-muted-foreground">
              AI supports decisions, humans remain in control. The final clinical decision
              rests with the healthcare professional.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostic Report Confirmation Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Diagnostic Report?</DialogTitle>
            <DialogDescription>
              This action will generate a comprehensive diagnostic report and share it with:
              <ul className="mt-2 space-y-1 text-left">
                <li>• The child's parent</li>
                <li>• The assigned therapist</li>
              </ul>
              <p className="mt-2 font-medium text-foreground">
                Therapy planning will be initiated automatically.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={confirmDiagnosticReport}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm & Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
