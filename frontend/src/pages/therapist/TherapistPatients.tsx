import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Users, FileText, Video } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, therapySessionsService, notificationsService } from "@/services/data";

const MEET_LINK_REGEX = /(https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+)/;
const THERAPIST_MEET_LINK_STORAGE_KEY = "therapist_default_meet_link";

export default function TherapistPatients() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [defaultMeetLink, setDefaultMeetLink] = useState("");
  const [meetLinkError, setMeetLinkError] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, { date: string; time: string; endTime: string }>>({});

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(THERAPIST_MEET_LINK_STORAGE_KEY);
    if (saved) setDefaultMeetLink(saved);
  }, []);

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
        parentId: child.parent_id,
      }));

      setChildren(normalized);
      setLoading(false);
    };

    loadChildren();
  }, []);

  const mappedChildren = useMemo(() => {
    return children.map((child) => {
      const dob = new Date(child.dateOfBirth);
      const age = Number.isNaN(dob.getTime())
        ? child.age
        : Math.max(0, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      return { ...child, age };
    });
  }, [children]);

  const assignedChildren = currentUserId
    ? mappedChildren.filter((child) => child.assignedTherapistId === currentUserId)
    : mappedChildren;

  const handleScheduleMeeting = async (child: Child & { parentId?: string }) => {
    if (!currentUserId) return;
    const draft = scheduleDrafts[child.id];
    if (!draft?.date || !draft?.time || !draft?.endTime) {
      setLoadError("Please select date, start time, and end time before scheduling.");
      return;
    }
    if (new Date(`${draft.date}T${draft.endTime}`).getTime() <= new Date(`${draft.date}T${draft.time}`).getTime()) {
      setLoadError("Session end time must be after start time.");
      return;
    }
    if (!defaultMeetLink.trim() || !MEET_LINK_REGEX.test(defaultMeetLink.trim())) {
      setMeetLinkError("Please add a valid Google Meet link.");
      return;
    }
    setMeetLinkError(null);
    const sessionMeta = {
      schedulingSource: "portal",
      googleMeetLink: defaultMeetLink.trim(),
      sessionEndTime: draft.endTime,
      createdAt: new Date().toISOString(),
    };

    const { error: sessionError } = await therapySessionsService.createSession({
      childId: child.id,
      therapistId: currentUserId,
      type: 'social',
      scheduledDate: draft.date,
      scheduledTime: draft.time,
      goals: `Online therapy session for ${child.name}`,
      notes: JSON.stringify(sessionMeta),
    });

    if (sessionError) {
      setLoadError(sessionError.message || "Failed to create session");
      return;
    }

    if (child.parentId) {
      await notificationsService.createNotification({
        userId: child.parentId,
        type: 'session_scheduled',
        title: 'Therapy Session Scheduled',
        message: `A new therapy session has been scheduled for ${child.name} on ${new Date(`${draft.date}T${draft.time}`).toLocaleDateString()} at ${draft.time}.`,
        link: '/parent/dashboard',
      });
    }
    setScheduleDrafts((prev) => ({
      ...prev,
      [child.id]: { date: "", time: "", endTime: "" },
    }));
  };

  const handleSaveMeetLinkForAllSessions = async () => {
    if (!currentUserId) return;
    const normalized = defaultMeetLink.trim();
    if (!normalized || !MEET_LINK_REGEX.test(normalized)) {
      setMeetLinkError("Please enter a valid Google Meet link.");
      return;
    }
    setMeetLinkError(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THERAPIST_MEET_LINK_STORAGE_KEY, normalized);
    }

    const { data: therapistSessions, error: sessionsError } = await therapySessionsService.getSessionsForTherapist(currentUserId);
    if (sessionsError) {
      setLoadError(sessionsError.message || "Failed to load therapist sessions");
      return;
    }

    await Promise.all(
      (therapistSessions || []).map((session: any) => {
        let parsed: any = {};
        if (session.notes) {
          try {
            parsed = JSON.parse(session.notes);
          } catch {
            parsed = {};
          }
        }
        return therapySessionsService.updateSession(session.id, {
          notes: JSON.stringify({
            ...parsed,
            googleMeetLink: normalized,
          }),
        });
      })
    );
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Assigned Patients</h1>
        <p className="text-muted-foreground mt-2">
          View children assigned to you and access their therapy plans
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading patients...
        </div>
      )}

      {!loading && assignedChildren.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No patients assigned yet.
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium mb-2">Google Meet Link For All Sessions</p>
        <Input
          type="url"
          value={defaultMeetLink}
          onChange={(e) => {
            setDefaultMeetLink(e.target.value);
            if (meetLinkError) setMeetLinkError(null);
          }}
          placeholder="https://meet.google.com/..."
        />
        {meetLinkError && <p className="text-xs text-destructive mt-2">{meetLinkError}</p>}
        <Button size="sm" variant="outline" className="mt-3" onClick={handleSaveMeetLinkForAllSessions}>
          Save For All Sessions
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {assignedChildren.map((child, index) => (
          <motion.div
            key={child.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{child.name}</h3>
                <p className="text-sm text-muted-foreground">{child.age} years old</p>
              </div>
              <div className="flex items-center gap-2">
                {child.riskLevel && <StatusBadge riskLevel={child.riskLevel} />}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/therapist/plan/${child.id}`)}>
                <FileText className="mr-2 h-4 w-4" />
                View Therapy Plan
              </Button>
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="date"
                    value={scheduleDrafts[child.id]?.date || ""}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) =>
                      setScheduleDrafts((prev) => ({
                        ...prev,
                        [child.id]: {
                          date: e.target.value,
                          time: prev[child.id]?.time || "",
                          endTime: prev[child.id]?.endTime || "",
                        },
                      }))
                    }
                  />
                  <Input
                    type="time"
                    value={scheduleDrafts[child.id]?.time || ""}
                    onChange={(e) =>
                      setScheduleDrafts((prev) => ({
                        ...prev,
                        [child.id]: {
                          date: prev[child.id]?.date || "",
                          time: e.target.value,
                          endTime: prev[child.id]?.endTime || "",
                        },
                      }))
                    }
                  />
                  <Input
                    type="time"
                    value={scheduleDrafts[child.id]?.endTime || ""}
                    onChange={(e) =>
                      setScheduleDrafts((prev) => ({
                        ...prev,
                        [child.id]: {
                          date: prev[child.id]?.date || "",
                          time: prev[child.id]?.time || "",
                          endTime: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <Button variant="default" className="w-full" onClick={() => handleScheduleMeeting(child)}>
                  <Video className="mr-2 h-4 w-4" />
                  Schedule Meeting
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
}
