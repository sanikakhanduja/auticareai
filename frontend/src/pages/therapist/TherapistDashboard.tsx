import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { StatusBadge } from "@/components/StatusBadge";
import { AgentBadge } from "@/components/AgentBadge";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, therapySessionsService, notificationsService } from "@/services/data";

export default function TherapistDashboard() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
    };
  });

  const handleScheduleMeeting = async (child: Child & { parentId?: string }) => {
    if (!currentUserId) return;
    
    // Create Google Calendar event with Google Meet
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 24); // Tomorrow at same time
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1); // 1 hour session

    const scheduledDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const scheduledTime = startDate.toTimeString().split(' ')[0]; // HH:MM:SS

    // Create therapy session in database
    const { data: sessionData, error: sessionError } = await therapySessionsService.createSession({
      childId: child.id,
      therapistId: currentUserId,
      type: 'social', // Default type
      scheduledDate,
      scheduledTime,
      goals: `Online therapy session for ${child.name}`,
      notes: 'Scheduled via Google Calendar',
    });

    if (sessionError) {
      alert('Failed to create session: ' + sessionError.message);
      return;
    }

    // Create notification for parent if parentId exists
    if (child.parentId) {
      await notificationsService.createNotification({
        userId: child.parentId,
        type: 'session_scheduled',
        title: 'Therapy Session Scheduled',
        message: `A new therapy session has been scheduled for ${child.name} on ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}.`,
        link: '/parent/dashboard',
      });
    }

    // Refresh sessions list
    const { data: updatedSessions } = await therapySessionsService.getSessionsForTherapist(currentUserId);
    if (updatedSessions) {
      setSessions(updatedSessions);
    }

    const eventTitle = `Therapy Session - ${child.name}`;
    const eventDescription = `Online therapy session for ${child.name}\n\nThis is a scheduled therapy session. Google Meet link will be automatically generated.`;
    
    // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    };

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(eventDescription)}&add=${encodeURIComponent('')}&conf=1`;
    
    // Open Google Calendar in new tab
    window.open(googleCalendarUrl, '_blank');
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
        <h1 className="text-3xl font-bold">Therapist Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage therapy plans and track session progress
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
                    </div>
                    <span className="text-xs text-success capitalize">{session.status}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1">
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
