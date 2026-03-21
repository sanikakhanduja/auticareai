import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MessageSquare,
  Hand,
  Users,
  Save,
  Target,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, therapySessionsService } from "@/services/data";
import { useToast } from "@/hooks/use-toast";

const sessionTypes = [
  {
    value: "speech",
    label: "Speech Therapy",
    icon: MessageSquare,
    color: "text-agent-therapy",
    description: "Communication and language development",
  },
  {
    value: "motor",
    label: "Motor Skills",
    icon: Hand,
    color: "text-primary",
    description: "Fine and gross motor development",
  },
  {
    value: "social",
    label: "Social Interaction",
    icon: Users,
    color: "text-secondary",
    description: "Social skills and peer interaction",
  },
];

export default function CreateSession() {
  const navigate = useNavigate();
  const { childId } = useParams();
  const { toast } = useToast();

  const [sessionType, setSessionType] = useState<"speech" | "motor" | "social" | "">("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [goals, setGoals] = useState("");

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, []);

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
      setLoading(false);
    };

    loadChild();
  }, [childId]);

  if (!child) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {loading ? "Loading patient..." : error || "Patient not found"}
          </p>
          <Button variant="outline" onClick={() => navigate("/therapist")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Check if child has diagnosis
  if (child.screeningStatus !== "diagnosed") {
    return (
      <DashboardLayout>
        <Button variant="ghost" onClick={() => navigate("/therapist")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="rounded-2xl border-2 border-warning/50 bg-warning/5 p-8 text-center max-w-xl mx-auto">
          <Clock className="h-12 w-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Therapy Not Available Yet</h2>
          <p className="text-muted-foreground mb-4">
            {child.name} has not received a diagnosis yet. Therapy planning can only begin 
            after the doctor completes the diagnostic assessment.
          </p>
          <p className="text-sm text-muted-foreground">
            Current status: <strong className="capitalize">{child.screeningStatus.replace("-", " ")}</strong>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionType || !scheduledDate || !scheduledTime || !goals.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!currentUserId) {
      toast({
        title: "Not signed in",
        description: "Please sign in again to create a session.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await therapySessionsService.createSession({
      childId: child.id,
      therapistId: currentUserId,
      type: sessionType as "speech" | "motor" | "social",
      scheduledDate,
      scheduledTime,
      goals: goals.trim(),
    });

    if (error) {
      setIsSaving(false);
      toast({
        title: "Failed to create session",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Session Created",
      description: `${sessionTypes.find((t) => t.value === sessionType)?.label} session scheduled for ${child.name}.`,
    });

    setIsSaving(false);
    navigate(`/therapist/plan/${child.id}`);
  };

  const selectedType = sessionTypes.find((t) => t.value === sessionType);

  return (
    <DashboardLayout>
      <Button variant="ghost" onClick={() => navigate(`/therapist/plan/${child.id}`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Therapy Plan
      </Button>

      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-card"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-xl bg-agent-therapy/20 flex items-center justify-center">
              <Calendar className="h-7 w-7 text-agent-therapy" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Therapy Session</h1>
              <p className="text-muted-foreground">
                Schedule a new session for {child.name}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Session Type */}
            <div className="space-y-3">
              <Label>Session Type *</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {sessionTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSessionType(type.value as "speech" | "motor" | "social")}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      sessionType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <type.icon className={`h-6 w-6 mb-2 ${type.color}`} />
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Goals */}
            <div className="space-y-2">
              <Label htmlFor="goals">
                <Target className="inline h-4 w-4 mr-1" />
                Session Goals *
              </Label>
              <Textarea
                id="goals"
                placeholder="Describe the goals and focus areas for this session..."
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                className="min-h-[120px]"
                required
              />
              {selectedType && (
                <p className="text-xs text-muted-foreground">
                  Suggested focus for {selectedType.label}: {selectedType.description}
                </p>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/therapist/plan/${child.id}`)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
