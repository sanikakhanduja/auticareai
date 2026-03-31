import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AgentBadge } from "@/components/AgentBadge";
import { Child, Report, useAppStore } from "@/lib/store";
import { childrenService, reportsService } from "@/services/data";
import { format } from "date-fns";

export default function ChildProfile() {
  const navigate = useNavigate();
  const { childId } = useParams();
  const { setSelectedChildId } = useAppStore();
  const [child, setChild] = useState<Child | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleEndTreatment = async () => {
    if (!child) return;
    const confirmed = window.confirm(
      "Are you sure you want to remove this child from active treatment? You can add them again later."
    );
    if (!confirmed) return;

    const { error: updateError } = await childrenService.updateChild(child.id, { isActive: false });
    if (updateError) {
      setError(updateError.message || "Failed to remove child");
      return;
    }

    navigate("/parent/children");
  };

  useEffect(() => {
    const loadChild = async () => {
      if (!childId) return;
      setLoading(true);
      setError(null);

      const { data, error } = await childrenService.getChildById(childId);
      if (error) {
        setError(error.message || "Failed to load child");
        setLoading(false);
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

      setSelectedChildId(data.id);

      const { data: reportRows } = await reportsService.getReports(data.id);
      const mappedReports = (reportRows || []).map((report: any) => ({
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

      setReports(mappedReports);
      setLoading(false);
    };

    loadChild();
  }, [childId]);

  if (!child) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {loading ? "Loading child..." : error || "Child not found"}
          </p>
          <Button variant="outline" onClick={() => navigate("/parent")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusInfo = () => {
    switch (child.screeningStatus) {
      case "not-started":
        return {
          icon: Clock,
          color: "text-muted-foreground",
          bg: "bg-muted/50",
          title: "Screening Not Started",
          description: "No screening has been initiated yet for this child.",
        };
      case "in-progress":
        return {
          icon: Clock,
          color: "text-warning",
          bg: "bg-warning/10",
          title: "Screening In Progress",
          description: "Screening is currently being processed.",
        };
      case "pending-review":
        return {
          icon: AlertCircle,
          color: "text-warning",
          bg: "bg-warning/10",
          title: "Pending Doctor Review",
          description: "Screening complete. Awaiting clinical review by doctor.",
        };
      case "under-observation":
        return {
          icon: Eye,
          color: "text-agent-monitoring",
          bg: "bg-agent-monitoring/10",
          title: "Under Observation",
          description: "Child is being monitored. Follow-up screening recommended.",
        };
      case "diagnosed":
        return {
          icon: CheckCircle2,
          color: "text-success",
          bg: "bg-success/10",
          title: "Diagnosis Complete",
          description: "Clinical assessment completed. Therapy planning initiated.",
        };
      default:
        return {
          icon: Clock,
          color: "text-muted-foreground",
          bg: "bg-muted/50",
          title: "Unknown Status",
          description: "",
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <DashboardLayout>
      <Button variant="ghost" onClick={() => navigate("/parent/children")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Children
      </Button>

      {/* Child Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-6 shadow-card mb-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-secondary/30 flex items-center justify-center">
              <User className="h-8 w-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{child.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {child.age} years old
                </span>
                {child.gender && (
                  <span className="capitalize">{child.gender}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {child.riskLevel && <StatusBadge riskLevel={child.riskLevel} />}
            <Button variant="destructive" size="sm" onClick={handleEndTreatment}>
              End Treatment
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-2xl border border-border ${statusInfo.bg} p-6`}
          >
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-xl bg-card flex items-center justify-center`}>
                <statusInfo.icon className={`h-6 w-6 ${statusInfo.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{statusInfo.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusInfo.description}
                </p>
                {child.screeningStatus === "under-observation" && child.observationEndDate && (
                  <p className="text-sm text-agent-monitoring mt-2">
                    Follow-up recommended by: {format(new Date(child.observationEndDate), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>

            {child.screeningStatus === "not-started" && (
              <div className="mt-4">
                <Button onClick={() => navigate(`/parent/screening?childId=${child.id}`)}>
                  Start Screening
                </Button>
              </div>
            )}

            {child.screeningStatus === "under-observation" && (
              <div className="mt-4">
                {(() => {
                  const now = new Date();
                  const followUpDate = child.observationEndDate ? new Date(child.observationEndDate) : null;
                  const isFollowUpDateReached = !followUpDate || now >= followUpDate;
                  
                  return (
                    <Button 
                      onClick={() => navigate(`/parent/screening?childId=${child.id}`)}
                      disabled={!isFollowUpDateReached}
                      className="relative"
                    >
                      {isFollowUpDateReached ? (
                        "Upload Follow-up Video"
                      ) : (
                        <>
                          <Clock className="h-4 w-4 mr-2" />
                          Follow-up Available {followUpDate ? format(followUpDate, "MMM d, yyyy") : "Soon"}
                        </>
                      )}
                    </Button>
                  );
                })()}
                {child.observationEndDate && new Date() < new Date(child.observationEndDate) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Follow-up upload will be available on {format(new Date(child.observationEndDate), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* Reports Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Reports</h3>
            </div>

            {reports.length > 0 ? (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`rounded-xl border p-4 ${
                      report.type === "diagnostic"
                        ? "border-success/30 bg-success/5"
                        : "border-agent-monitoring/30 bg-agent-monitoring/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {report.type === "diagnostic" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Eye className="h-4 w-4 text-agent-monitoring" />
                        )}
                        <span className="font-medium capitalize">
                          {report.type === "diagnostic" ? "Diagnostic Report" : "Observation Report"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(report.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{report.doctorNotes}</p>
                    {report.type === "diagnostic" && report.therapyRecommendations && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Therapy Recommendations:
                        </p>
                        <ul className="space-y-1">
                          {report.therapyRecommendations.map((rec, i) => (
                            <li key={i} className="text-sm flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-success" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {report.type === "observation" && report.followUpDate && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-agent-monitoring">
                          Follow-up by: {format(new Date(report.followUpDate), "MMMM d, yyyy")}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No reports available yet</p>
              </div>
            )}
          </motion.div>

          {/* Progress Section (Mock) */}
          {child.screeningStatus === "diagnosed" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-agent-monitoring/30 bg-agent-monitoring/5 p-6"
            >
              <div className="flex items-start gap-4">
                <AgentBadge type="monitoring" />
                <div>
                  <h3 className="font-semibold">Monitoring & Progress</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Therapy progress is being tracked. View detailed progress reports and
                    developmental trajectory insights.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate(`/parent/progress?childId=${child.id}`)}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    View Progress
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-semibold mb-4">Child Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date of Birth</span>
                <span className="font-medium">
                  {format(new Date(child.dateOfBirth), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age</span>
                <span className="font-medium">{child.age} years</span>
              </div>
              {child.gender && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gender</span>
                  <span className="font-medium capitalize">{child.gender}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
            <AlertCircle className="h-6 w-6 text-accent mb-3" />
            <h4 className="font-medium text-sm mb-2">Important</h4>
            <p className="text-xs text-muted-foreground">
              AI supports decisions, humans remain in control. All clinical decisions are
              made by qualified healthcare professionals.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
