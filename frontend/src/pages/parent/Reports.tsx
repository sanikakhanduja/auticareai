import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Eye,
  ClipboardCheck,
  Calendar,
  User,
  Download,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserPlus,
  MapPin,
  Star,
  Stethoscope,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Child, Report } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, reportsService, secondOpinionService } from "@/services/data";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AvailableDoctor {
  id: string;
  full_name?: string | null;
  name?: string | null;
  specialty?: string | null;
  state?: string | null;
  district?: string | null;
  patientCount?: number | null;
  canAcceptPatients?: boolean;
}

export default function Reports() {
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [secondOpinionNotes, setSecondOpinionNotes] = useState("");
  const [secondOpinionStatus, setSecondOpinionStatus] = useState<string | null>(null);
  const [secondOpinionError, setSecondOpinionError] = useState<string | null>(null);
  const [secondOpinionLoading, setSecondOpinionLoading] = useState(false);
  const [showDoctorSelectModal, setShowDoctorSelectModal] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState<AvailableDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorSelectError, setDoctorSelectError] = useState<string | null>(null);
  const [reportForConsult, setReportForConsult] = useState<Report | null>(null);

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
    if (normalized.length > 0) {
      setSelectedChild((current) => current || normalized[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadReports = async () => {
      if (!selectedChild) return;
      const { data, error } = await reportsService.getReports(selectedChild);
      if (error) {
        setLoadError(error.message || "Failed to load reports");
        return;
      }

      const mappedReports = (data || []).map((report: any) => ({
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
    };

    loadReports();
  }, [selectedChild]);

  const childReports = reports.filter((r) => r.childId === selectedChild);
  const child = children.find((c) => c.id === selectedChild);

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  useEffect(() => {
    const loadSecondOpinion = async () => {
      setSecondOpinionStatus(null);
      setSecondOpinionError(null);
      setSecondOpinionNotes("");

      if (!selectedReport || selectedReport.type !== "diagnostic" || !currentUserId) return;

      const { data, error } = await secondOpinionService.getRequestForReport(
        selectedReport.id,
        currentUserId,
      );

      if (error) {
        setSecondOpinionError(error.message || "Failed to load second opinion status");
        return;
      }

      if (data) {
        setSecondOpinionStatus(data.status || "requested");
        setSecondOpinionNotes(data.notes || "");
      }
    };

    loadSecondOpinion();
  }, [selectedReport, currentUserId]);

  const handleSecondOpinionRequest = async () => {
    if (!selectedReport || !currentUserId) return;
    if (!child?.assignedDoctorId) {
      setSecondOpinionError("No assigned doctor found for this child.");
      return;
    }
    setSecondOpinionError(null);
    setSecondOpinionLoading(true);

    const { data, error } = await secondOpinionService.createRequest({
      childId: selectedReport.childId,
      reportId: selectedReport.id,
      parentId: currentUserId,
      requestedDoctorId: child.assignedDoctorId,
      notes: secondOpinionNotes.trim() ? secondOpinionNotes.trim() : null,
    });

    setSecondOpinionLoading(false);

    if (error) {
      setSecondOpinionError(error.message || "Failed to request a second opinion");
      return;
    }

    setSecondOpinionStatus(data?.status || "requested");
  };

  const handleConsultAnotherDoctor = async (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    setReportForConsult(report);
    setDoctorSelectError(null);
    setLoadingDoctors(true);
    setShowDoctorSelectModal(true);

    // Fetch available doctors excluding the currently assigned one
    const apiBase = import.meta.env.VITE_API_URL;
    if (!apiBase) {
      setDoctorSelectError("API URL not configured");
      setLoadingDoctors(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/api/doctors/available/second-opinion/${report.childId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch available doctors');
      }
      const result = await response.json();
      setAvailableDoctors(result.doctors || []);
    } catch (error) {
      setDoctorSelectError(error instanceof Error ? error.message : 'Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const handleSelectDoctorForConsult = async (doctorId: string) => {
    if (!reportForConsult || !currentUserId) return;
    
    setDoctorSelectError(null);
    setLoadingDoctors(true);

    // Find selected doctor's name
    const selectedDoctor = availableDoctors.find((d) => d.id === doctorId);
    const doctorName = selectedDoctor?.full_name || selectedDoctor?.name || "the selected doctor";

    const { data, error } = await secondOpinionService.createRequest({
      childId: reportForConsult.childId,
      reportId: reportForConsult.id,
      parentId: currentUserId,
      requestedDoctorId: doctorId,
      notes: `Consultation requested for another doctor review`,
    });

    setLoadingDoctors(false);

    if (error) {
      setDoctorSelectError(error.message || "Failed to send report to doctor");
      return;
    }

    setShowDoctorSelectModal(false);
    setReportForConsult(null);

    // Reload children data to update the doctor name
    await loadChildren();

    // Show success toast with checkmark that auto-dismisses after 5 seconds
    toast({
      title: "Consulting Another Doctor",
      description: `Your child has been assigned to ${doctorName}. They will review the report shortly.`,
      duration: 5000,
    });
  };

  const diagnosticReports = childReports.filter(r => r.type === "diagnostic");
  const latestDiagnosticReport = diagnosticReports.length > 0 
    ? diagnosticReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-2">
            View observation and diagnostic reports for your children
          </p>
        </div>
        {latestDiagnosticReport && (
          <Button
            variant="default"
            onClick={(e) => handleConsultAnotherDoctor(latestDiagnosticReport, e)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Consult Another Doctor
          </Button>
        )}
      </div>

      {/* Child Selection */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-2 block">Select Child</label>
        <Select value={selectedChild} onValueChange={setSelectedChild}>
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

      {loadError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading reports...
        </div>
      )}

      {/* Report Type Legend */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-agent-monitoring/10 px-4 py-2">
          <Eye className="h-4 w-4 text-agent-monitoring" />
          <span className="text-sm font-medium">Observation Report</span>
          <span className="text-xs text-muted-foreground">• Visible to Parent & Doctor</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2">
          <ClipboardCheck className="h-4 w-4 text-success" />
          <span className="text-sm font-medium">Diagnostic Report</span>
          <span className="text-xs text-muted-foreground">• Visible to Parent, Doctor & Therapist</span>
        </div>
      </div>

      {/* Reports List */}
      {!loading && childReports.length > 0 ? (
        <div className="space-y-4">
          {childReports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border bg-card p-6 shadow-card cursor-pointer transition-all hover:shadow-elevated ${
                report.type === "observation"
                  ? "border-agent-monitoring/30 hover:border-agent-monitoring"
                  : "border-success/30 hover:border-success"
              }`}
              onClick={() => handleViewReport(report)}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      report.type === "observation"
                        ? "bg-agent-monitoring/10"
                        : "bg-success/10"
                    }`}
                  >
                    {report.type === "observation" ? (
                      <Eye className="h-6 w-6 text-agent-monitoring" />
                    ) : (
                      <ClipboardCheck className="h-6 w-6 text-success" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {report.type === "observation"
                          ? "Observation Report"
                          : "Diagnostic Report"}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          report.type === "observation"
                            ? "bg-agent-monitoring/10 text-agent-monitoring"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {report.type === "observation" ? "Monitoring" : "Complete"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(report.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {child?.name}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {report.screeningSummary}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : !loading ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Reports Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Reports will appear here after your child completes screening and receives
            clinical review from a doctor.
          </p>
        </div>
      ) : null}

      {/* Report Detail Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedReport.type === "observation" ? (
                    <>
                      <Eye className="h-5 w-5 text-agent-monitoring" />
                      Observation Report
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-5 w-5 text-success" />
                      Diagnostic Report
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Generated on {format(new Date(selectedReport.createdAt), "MMMM d, yyyy")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Screening Summary */}
                <div className="rounded-xl bg-muted/50 p-4">
                  <h4 className="font-medium text-sm mb-2">Screening Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedReport.screeningSummary}
                  </p>
                </div>

                {/* Doctor Notes */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Clinical Notes</h4>
                  <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
                    {selectedReport.doctorNotes || "No additional notes provided."}
                  </p>
                </div>

                {/* Observation-specific content */}
                {selectedReport.type === "observation" && (
                  <>
                    <div className="rounded-xl bg-agent-monitoring/5 border border-agent-monitoring/20 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-agent-monitoring" />
                        <h4 className="font-medium text-sm">Monitoring Plan</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.monitoringPlan || "Continue regular monitoring."}
                      </p>
                      {selectedReport.followUpDate && (
                        <p className="text-sm mt-2">
                          <strong>Follow-up Date:</strong>{" "}
                          {format(new Date(selectedReport.followUpDate), "MMMM d, yyyy")}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl bg-warning/5 border border-warning/20 p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <p className="text-sm">
                          <strong>Status:</strong> Monitoring in progress – no diagnosis yet.
                          Therapist access is not enabled for observation reports.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Diagnostic-specific content */}
                {selectedReport.type === "diagnostic" && (
                  <>
                    <div className="rounded-xl bg-success/5 border border-success/20 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <h4 className="font-medium text-sm">Diagnosis Confirmation</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedReport.diagnosisConfirmation}
                      </p>
                    </div>

                    {selectedReport.developmentalGaps && selectedReport.developmentalGaps.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Developmental Gaps Identified</h4>
                        <ul className="space-y-2">
                          {selectedReport.developmentalGaps.map((gap, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full bg-warning" />
                              {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedReport.therapyRecommendations && selectedReport.therapyRecommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Therapy Recommendations</h4>
                        <ul className="space-y-2">
                          {selectedReport.therapyRecommendations.map((rec, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                      <p className="text-sm">
                        <strong>Visibility:</strong> This report has been shared with your assigned
                        doctor and therapist to coordinate care.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                      <h4 className="font-medium text-sm mb-2">Second Opinion</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Request an independent review from another doctor if you want additional
                        clarity.
                      </p>

                      {secondOpinionStatus ? (
                        <div className="rounded-lg bg-muted/50 p-3 text-sm">
                          Status: {secondOpinionStatus.replace("-", " ")}
                        </div>
                      ) : (
                        <>
                          <Textarea
                            value={secondOpinionNotes}
                            onChange={(event) => setSecondOpinionNotes(event.target.value)}
                            placeholder="Optional: share specific concerns or questions"
                            className="mb-3 min-h-[90px]"
                          />
                          {secondOpinionError && (
                            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              {secondOpinionError}
                            </div>
                          )}
                          <Button onClick={handleSecondOpinionRequest} disabled={secondOpinionLoading}>
                            {secondOpinionLoading ? "Requesting..." : "Request Second Opinion"}
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Disclaimer */}
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    This report is for informational purposes. AI supports decisions,
                    clinicians make final assessments.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Doctor Selection Modal */}
      <Dialog open={showDoctorSelectModal} onOpenChange={setShowDoctorSelectModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Consult Another Doctor
            </DialogTitle>
            <DialogDescription>
              Select a doctor to review this report and provide consultation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {doctorSelectError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {doctorSelectError}
              </div>
            )}

            {loadingDoctors && (
              <div className="text-center py-8 text-muted-foreground">
                Loading available doctors...
              </div>
            )}

            {!loadingDoctors && availableDoctors.length === 0 && !doctorSelectError && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No other doctors available at this time</p>
              </div>
            )}

            {!loadingDoctors && availableDoctors.length > 0 && (
              <div className="space-y-3">
                {availableDoctors.map((doctor) => (
                  <motion.div
                    key={doctor.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border bg-card p-4 transition-all hover:border-primary/50 cursor-pointer ${
                      !doctor.canAcceptPatients ? 'opacity-50' : ''
                    }`}
                    onClick={() => doctor.canAcceptPatients && handleSelectDoctorForConsult(doctor.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{doctor.full_name || 'Doctor'}</h4>
                          <p className="text-sm text-primary mt-0.5">
                            {doctor.specialty || 'General Medicine'}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            {(doctor.district || doctor.state) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {doctor.district && doctor.state 
                                  ? `${doctor.district}, ${doctor.state}`
                                  : doctor.state || doctor.district || 'Location not set'}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {doctor.patientCount || 0}/5 Patients
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        {!doctor.canAcceptPatients ? (
                          <span className="text-xs bg-destructive/20 px-3 py-1.5 rounded-full text-destructive font-medium">
                            At Capacity
                          </span>
                        ) : (
                          <Button size="sm" variant="outline">
                            Select
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
