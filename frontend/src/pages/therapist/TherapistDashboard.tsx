import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Users,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  Video,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { AgentBadge } from "@/components/AgentBadge";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, therapySessionsService, notificationsService } from "@/services/data";

const MEET_LINK_REGEX = /(https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+)/;
const SESSION_DURATION_MS = 60 * 60 * 1000;
const THERAPIST_MEET_LINK_STORAGE_KEY = "therapist_default_meet_link";
const TIME_VALUE_REGEX = /^\d{2}:\d{2}(?::\d{2})?$/;

const parseSessionStart = (scheduledDate: string, scheduledTime: string) => {
  return new Date(`${scheduledDate}T${scheduledTime}`);
};

const parseSessionMeta = (notes?: string | null): Record<string, any> => {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const extractSessionEndTimeFromNotes = (notes?: string | null) => {
  const parsed = parseSessionMeta(notes);
  if (typeof parsed.sessionEndTime === "string" && TIME_VALUE_REGEX.test(parsed.sessionEndTime)) {
    return parsed.sessionEndTime;
  }
  return null;
};

const getSessionEndTime = (scheduledDate: string, scheduledTime: string, notes?: string | null) => {
  const explicitEndTime = extractSessionEndTimeFromNotes(notes);
  if (explicitEndTime) return parseSessionStart(scheduledDate, explicitEndTime).getTime();
  const startDate = parseSessionStart(scheduledDate, scheduledTime);
  return startDate.getTime() + SESSION_DURATION_MS;
};

const isSessionOngoing = (scheduledDate: string, scheduledTime: string, notes?: string | null) => {
  const start = parseSessionStart(scheduledDate, scheduledTime).getTime();
  const end = getSessionEndTime(scheduledDate, scheduledTime, notes);
  const now = Date.now();
  return now >= start && now <= end;
};

const extractMeetLinkFromNotes = (notes?: string | null) => {
  if (!notes) return "";
  try {
    const parsed = JSON.parse(notes);
    if (typeof parsed?.googleMeetLink === "string" && parsed.googleMeetLink) {
      const meetMatch = parsed.googleMeetLink.match(MEET_LINK_REGEX);
      if (meetMatch) return meetMatch[1];
    }
  } catch {
    const meetMatch = notes.match(MEET_LINK_REGEX);
    if (meetMatch) return meetMatch[1];
  }
  return "";
};

export default function TherapistDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
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
    const loadData = async () => {
      if (!currentUserId) return;
      setLoading(true);
      setLoadError(null);

      const { data: childrenData, error: childrenError } = await childrenService.getChildren();
      if (childrenError) {
        setLoadError(childrenError.message || "Failed to load children");
        setLoading(false);
        return;
      }

      const normalizedChildren = (childrenData || []).map((child: any) => ({
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
      setChildren(normalizedChildren);

      const { data: sessionsData, error: sessionsError } = await therapySessionsService.getSessionsForTherapist(currentUserId);
      if (sessionsError) {
        setLoadError(sessionsError.message || "Failed to load sessions");
        setLoading(false);
        return;
      }

      setSessions(sessionsData || []);
      setLoading(false);
    };

    loadData();
  }, [currentUserId]);

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

  const today = new Date().toISOString().split("T")[0];
  const todaysSessions = sessions.filter((session) => session.scheduled_date === today);
  const upcomingSessions = sessions.filter((session) => session.scheduled_date >= today);
  
  const sessionView = todaysSessions.map((session) => {
    const child = mappedChildren.find((c) => c.id === session.child_id);
    return {
      id: session.id,
      childName: child?.name || "Unknown",
      type: session.type,
      time: session.scheduled_time,
      date: session.scheduled_date,
      status: session.status,
    };
  });

  const upcomingSessionView = upcomingSessions.map((session) => {
    const child = mappedChildren.find((c) => c.id === session.child_id);
    return {
      id: session.id,
      childName: child?.name || "Unknown",
      type: session.type,
      time: session.scheduled_time,
      date: session.scheduled_date,
      status: session.status,
      meetLink: extractMeetLinkFromNotes(session.notes),
      endTime: extractSessionEndTimeFromNotes(session.notes),
      isOngoing: isSessionOngoing(session.scheduled_date, session.scheduled_time, session.notes),
    };
  });

  const handleScheduleMeeting = async (child: Child & { parentId?: string }) => {
    if (!currentUserId) return;
    const draft = scheduleDrafts[child.id];
    if (!draft?.date || !draft?.time || !draft?.endTime) {
      setLoadError("Please select date, start time, and end time before scheduling.");
      return;
    }
    if (parseSessionStart(draft.date, draft.endTime).getTime() <= parseSessionStart(draft.date, draft.time).getTime()) {
      setLoadError("Session end time must be after start time.");
      return;
    }
    if (!defaultMeetLink.trim() || !MEET_LINK_REGEX.test(defaultMeetLink.trim())) {
      setMeetLinkError("Please add a valid Google Meet link before scheduling.");
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

    const { data: updatedSessions } = await therapySessionsService.getSessionsForTherapist(currentUserId);
    if (updatedSessions) {
      setSessions(updatedSessions);
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

    const updates = sessions.map((session) => {
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
    });
    await Promise.all(updates);

    const { data: refreshedSessions, error } = await therapySessionsService.getSessionsForTherapist(currentUserId);
    if (error) {
      setLoadError(error.message || "Failed to refresh sessions");
      return;
    }
    setSessions(refreshedSessions || []);
  };

  const stats = [
    {
      label: "Active Patients",
      value: assignedChildren.length,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Upcoming Sessions",
      value: upcomingSessionView.length,
      icon: Calendar,
      color: "bg-agent-therapy/10 text-agent-therapy",
    },
    {
      label: "Plans Created",
      value: assignedChildren.length,
      icon: FileText,
      color: "bg-success/10 text-success",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("portal.therapistDashboardTitle")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("portal.therapistDashboardDesc")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
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
      <div className="mb-8 rounded-2xl border border-agent-therapy/30 bg-agent-therapy/5 p-6">
        <div className="flex items-start gap-4">
          <AgentBadge type="therapy" />
          <div>
            <h3 className="font-semibold">Therapy Planning Agent Active</h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated therapy suggestions are available for each patient. Customize plans
              based on individual needs.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
            <Button variant="outline" size="sm" onClick={() => navigate("/therapist/sessions")}>
              View All
            </Button>
          </div>

          <div className="space-y-4">
            {loadError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {loadError}
              </div>
            )}
            {loading && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Loading sessions...
              </div>
            )}
            {!loading && upcomingSessionView.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                No upcoming sessions scheduled.
              </div>
            )}
            {!loading && upcomingSessionView.slice(0, 5).map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{session.childName}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{session.type} therapy</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-4 w-4" />
                      {session.date}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {session.time}
                      {session.endTime ? ` - ${session.endTime}` : ""}
                    </div>
                    <span className="text-xs text-success capitalize">{session.status}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!session.meetLink || !session.isOngoing}
                    onClick={() => {
                      if (!session.meetLink || !session.isOngoing) return;
                      window.open(session.meetLink, "_blank");
                    }}
                  >
                    Start Session
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/therapist/sessions/${session.id}/notes`)}>
                    Add Notes
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Patients Requiring Attention */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Assigned Patients</h2>
            <Button variant="outline" size="sm" onClick={() => navigate("/therapist/patients")}>
              View All
            </Button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium mb-2">Google Meet Link</p>
              <Input
                type="url"
                value={defaultMeetLink}
                onChange={(e) => {
                  setDefaultMeetLink(e.target.value);
                  if (meetLinkError) setMeetLinkError(null);
                }}
                placeholder="https://meet.google.com/..."
              />
              {meetLinkError && (
                <p className="text-xs text-destructive mt-2">{meetLinkError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Use the same link for scheduled meetings. It activates only for ongoing sessions.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={handleSaveMeetLinkForAllSessions}>
                Save For All Sessions
              </Button>
            </div>
            {loading && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Loading patients...
              </div>
            )}
            {!loading && assignedChildren.map((child, index) => (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
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
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/therapist/plan/${child.id}`)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Therapy Plan
                  </Button>
                </div>
                <div className="mt-2">
                  <div className="mb-2 grid grid-cols-3 gap-2">
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
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => handleScheduleMeeting(child)}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Schedule Meeting
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-success" />
            <h3 className="font-semibold">Weekly Progress Summary</h3>
          </div>
          <AgentBadge type="monitoring" size="sm" />
        </div>
        <p className="text-muted-foreground text-sm">
          Review session notes and progress updates to monitor each child’s therapy journey.
        </p>
      </motion.div>
    </DashboardLayout>
  );
}
