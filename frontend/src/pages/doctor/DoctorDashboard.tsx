import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Users,
  FileSearch,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Eye,
  Calendar,
  FileText,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AgentBadge } from "@/components/AgentBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Child } from "@/lib/store";
import { childrenService } from "@/services/data";

export default function DoctorDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadChildren = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await childrenService.getAssignedChildren();
      if (error) {
        setLoadError(error.message || "Failed to load assigned children");
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
    if (location.pathname === "/doctor/patients") {
      setActiveTab("patients");
      return;
    }
    if (location.pathname === "/doctor/reviews") {
      setActiveTab("reviews");
      return;
    }
    setActiveTab("dashboard");
  }, [location.pathname]);

  const mappedChildren = useMemo(() => {
    return children.map((child) => {
      const dob = new Date(child.dateOfBirth);
      const age = Number.isNaN(dob.getTime())
        ? child.age
        : Math.max(0, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      return { ...child, age };
    });
  }, [children]);

  const pendingReviews = mappedChildren.filter((c) => c.screeningStatus === "pending-review");
  const underObservation = mappedChildren.filter((c) => c.screeningStatus === "under-observation");
  const diagnosed = mappedChildren.filter((c) => c.screeningStatus === "diagnosed");

  const stats = [
    {
      label: "Total Patients",
      value: mappedChildren.length,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Pending Reviews",
      value: pendingReviews.length,
      icon: Clock,
      color: "bg-warning/10 text-warning",
    },
    {
      label: "Under Observation",
      value: underObservation.length,
      icon: Eye,
      color: "bg-agent-monitoring/10 text-agent-monitoring",
    },
    {
      label: "Diagnosed",
      value: diagnosed.length,
      icon: CheckCircle2,
      color: "bg-success/10 text-success",
    },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "patients") {
      navigate("/doctor/patients");
      return;
    }
    if (value === "reviews") {
      navigate("/doctor/reviews");
      return;
    }
    navigate("/doctor");
  };

  return (
    <DashboardLayout>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("portal.doctorDashboardTitle")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("portal.doctorDashboardDesc")}
          </p>
          <div className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard" className="gap-2">
                <FileSearch className="h-4 w-4" />
                {t("nav.dashboard")}
              </TabsTrigger>
              <TabsTrigger value="patients" className="gap-2">
                <Users className="h-4 w-4" />
                {t("nav.patients")}
              </TabsTrigger>
              <TabsTrigger value="reviews" className="gap-2">
                <FileText className="h-4 w-4" />
                {t("nav.reviews")}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-8">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI Agent Info */}
          <div className="rounded-2xl border border-agent-clinical/30 bg-agent-clinical/5 p-6">
            <div className="flex items-start gap-4">
              <AgentBadge type="clinical" />
              <div>
                <h3 className="font-semibold">Clinical Summary Agent Active</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-generated clinical summaries are available for each patient. Review and make
                  your clinical decision.
                </p>
              </div>
            </div>
          </div>

          {/* Pending Reviews */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Pending Reviews</h2>
              <StatusBadge status="pending-review" />
            </div>

            {loadError && (
              <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {loadError}
              </div>
            )}

            {loading && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Loading patients...
              </div>
            )}

            {!loading && pendingReviews.length > 0 ? (
              <div className="space-y-4">
                {pendingReviews.map((child, index) => (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="rounded-2xl border border-warning/30 bg-warning/5 p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center">
                          <AlertCircle className="h-6 w-6 text-warning" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{child.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {child.age} years old • Screening completed
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {child.riskLevel && <StatusBadge riskLevel={child.riskLevel} />}
                        <Button onClick={() => navigate(`/doctor/review/${child.id}`)}>
                          Review
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : !loading ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-4" />
                <p className="text-muted-foreground">All reviews completed!</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients" className="space-y-6">
          {loading && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading patients...
            </div>
          )}

          {!loading && children.length > 0 ? (
            <div className="space-y-4">
              {children.map((child, index) => (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-lg transition-shadow"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Patient Identity */}
                    <div>
                      <h3 className="font-semibold text-lg">{child.name}</h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-medium">Gender:</span>
                          <span className="capitalize">{child.gender || "Not specified"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-medium">Age:</span>
                          <span>{child.age} years</span>
                        </div>
                      </div>
                    </div>

                    {/* Patient Details */}
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>DOB: {child.dateOfBirth ? new Date(child.dateOfBirth).toLocaleDateString() : "Not set"}</span>
                        </div>
                        {child.riskLevel && (
                          <div className="flex items-center gap-2">
                            <StatusBadge riskLevel={child.riskLevel} />
                          </div>
                        )}
                        {child.screeningStatus && (
                          <div className="text-muted-foreground">
                            Screening: <span className="font-medium capitalize">{child.screeningStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Therapy Info */}
                    <div className="flex flex-col justify-between">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-3">Therapy</h4>
                        <div className="space-y-2 text-sm">
                          {child.therapistName ? (
                            <div>
                              <span className="text-muted-foreground">Assigned Therapist:</span>
                              <p className="font-medium">{child.therapistName}</p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">No therapist assigned</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate(`/doctor/review/${child.id}`)}
                        className="w-full mt-4"
                      >
                        View Full Details
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : !loading ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No patients assigned yet</p>
            </div>
          ) : null}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-8">
          {loading && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading reviews...
            </div>
          )}

          {!loading && (
            <>
              {/* Pending Reviews Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Pending Reviews</h2>
                  <StatusBadge status="pending-review" />
                </div>

                {pendingReviews.length > 0 ? (
                  <div className="space-y-3">
                    {pendingReviews.map((child, index) => (
                      <motion.div
                        key={child.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-xl border border-warning/30 bg-warning/5 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-warning" />
                            <div>
                              <p className="font-medium">{child.name}</p>
                              <p className="text-xs text-muted-foreground">{child.age} years old</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/doctor/review/${child.id}`)}
                          >
                            Review Now
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No pending reviews
                  </div>
                )}
              </div>

              {/* Under Observation Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Ongoing Reviews</h2>
                  <StatusBadge status="under-observation" />
                </div>

                {underObservation.length > 0 ? (
                  <div className="space-y-3">
                    {underObservation.map((child, index) => (
                      <motion.div
                        key={child.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-xl border border-agent-monitoring/30 bg-agent-monitoring/5 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Eye className="h-5 w-5 text-agent-monitoring" />
                            <div>
                              <p className="font-medium">{child.name}</p>
                              <p className="text-xs text-muted-foreground">{child.age} years old • Monitoring in progress</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/doctor/review/${child.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No patients under observation
                  </div>
                )}
              </div>

              {/* Diagnosed Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Completed Reviews</h2>
                  <StatusBadge status="diagnosed" />
                </div>

                {diagnosed.length > 0 ? (
                  <div className="space-y-3">
                    {diagnosed.map((child, index) => (
                      <motion.div
                        key={child.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-xl border border-success/30 bg-success/5 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                            <div>
                              <p className="font-medium">{child.name}</p>
                              <p className="text-xs text-muted-foreground">{child.age} years old • Therapy planning initiated</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/doctor/review/${child.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No diagnosed cases yet
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
