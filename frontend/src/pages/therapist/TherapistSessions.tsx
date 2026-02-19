import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, FileText, Pencil, Save, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth";
import { childrenService, therapySessionsService } from "@/services/data";

const MEET_LINK_REGEX = /(https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+)/;
const SESSION_DURATION_MS = 60 * 60 * 1000;
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

const getFallbackEndTime = (scheduledDate: string, scheduledTime: string) => {
  const end = parseSessionStart(scheduledDate, scheduledTime).getTime() + SESSION_DURATION_MS;
  const endDate = new Date(end);
  const hh = String(endDate.getHours()).padStart(2, "0");
  const mm = String(endDate.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const getSessionEndTimestamp = (scheduledDate: string, scheduledTime: string, notes?: string | null) => {
  const explicitEndTime = extractSessionEndTimeFromNotes(notes);
  if (explicitEndTime) return parseSessionStart(scheduledDate, explicitEndTime).getTime();
  return parseSessionStart(scheduledDate, scheduledTime).getTime() + SESSION_DURATION_MS;
};

const isSessionOngoing = (scheduledDate: string, scheduledTime: string, notes?: string | null) => {
  const start = parseSessionStart(scheduledDate, scheduledTime).getTime();
  const end = getSessionEndTimestamp(scheduledDate, scheduledTime, notes);
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

const withSessionMetaInNotes = (
  notes: string | null | undefined,
  updates: { meetLink: string; endTime: string }
) => {
  const parsed = parseSessionMeta(notes);
  return JSON.stringify({
    ...parsed,
    googleMeetLink: updates.meetLink.trim(),
    sessionEndTime: updates.endTime,
  });
};

export default function TherapistSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [childMap, setChildMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    scheduledDate: string;
    scheduledTime: string;
    endTime: string;
    type: "speech" | "motor" | "social";
    goals: string;
    meetLink: string;
  } | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
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

      const map: Record<string, string> = {};
      (childrenData || []).forEach((child: any) => {
        map[child.id] = child.name;
      });
      setChildMap(map);

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

  const startEditing = (session: any) => {
    setEditingId(session.id);
    setDraft({
      scheduledDate: session.scheduled_date,
      scheduledTime: session.scheduled_time,
      endTime: extractSessionEndTimeFromNotes(session.notes) || getFallbackEndTime(session.scheduled_date, session.scheduled_time),
      type: session.type,
      goals: session.goals || "",
      meetLink: extractMeetLinkFromNotes(session.notes),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveSession = async (session: any) => {
    if (!draft) return;
    if (!MEET_LINK_REGEX.test(draft.meetLink.trim())) {
      setLoadError("Please enter a valid Google Meet link before saving.");
      return;
    }
    if (parseSessionStart(draft.scheduledDate, draft.endTime).getTime() <= parseSessionStart(draft.scheduledDate, draft.scheduledTime).getTime()) {
      setLoadError("Session end time must be after start time.");
      return;
    }

    const { error } = await therapySessionsService.updateSession(session.id, {
      scheduledDate: draft.scheduledDate,
      scheduledTime: draft.scheduledTime,
      type: draft.type,
      goals: draft.goals,
      notes: withSessionMetaInNotes(session.notes, { meetLink: draft.meetLink, endTime: draft.endTime }),
    });

    if (error) {
      setLoadError(error.message || "Failed to update session");
      return;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id
          ? {
              ...s,
              scheduled_date: draft.scheduledDate,
              scheduled_time: draft.scheduledTime,
              type: draft.type,
              goals: draft.goals,
              notes: withSessionMetaInNotes(s.notes, { meetLink: draft.meetLink, endTime: draft.endTime }),
            }
          : s
      )
    );
    setEditingId(null);
    setDraft(null);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">All Sessions</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage your therapy sessions
        </p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading sessions...
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No sessions scheduled yet.
        </div>
      )}

      <div className="space-y-4">
        {sessions.map((session, index) => {
          const meetLink = extractMeetLinkFromNotes(session.notes);
          const endTime = extractSessionEndTimeFromNotes(session.notes);
          const ongoing = isSessionOngoing(session.scheduled_date, session.scheduled_time, session.notes);
          const isEditing = editingId === session.id && draft;

          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{childMap[session.child_id] || "Unknown"}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{session.type} therapy</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" />
                    {session.scheduled_date}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {session.scheduled_time}
                    {endTime ? ` - ${endTime}` : ""}
                  </div>
                  <span className="text-xs text-success capitalize">{session.status}</span>
                </div>
              </div>

              {isEditing ? (
                <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      type="date"
                      value={draft.scheduledDate}
                      onChange={(e) => setDraft({ ...draft, scheduledDate: e.target.value })}
                    />
                    <Input
                      type="time"
                      value={draft.scheduledTime}
                      onChange={(e) => setDraft({ ...draft, scheduledTime: e.target.value })}
                    />
                    <Input
                      type="time"
                      value={draft.endTime}
                      onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                    />
                  </div>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.type}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        type: e.target.value as "speech" | "motor" | "social",
                      })
                    }
                  >
                    <option value="speech">Speech</option>
                    <option value="motor">Motor</option>
                    <option value="social">Social</option>
                  </select>
                  <Input
                    value={draft.goals}
                    onChange={(e) => setDraft({ ...draft, goals: e.target.value })}
                    placeholder="Session goals"
                  />
                  <Input
                    type="url"
                    value={draft.meetLink}
                    onChange={(e) => setDraft({ ...draft, meetLink: e.target.value })}
                    placeholder="https://meet.google.com/..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveSession(session)}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditing}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!meetLink || !ongoing}
                    onClick={() => {
                      if (!meetLink || !ongoing) return;
                      window.open(meetLink, "_blank");
                    }}
                  >
                    Start Session
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEditing(session)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/therapist/sessions/${session.id}/notes`)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Add Notes
                  </Button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
