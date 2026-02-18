import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Baby,
  FileSearch,
  Calendar,
  TrendingUp,
  Plus,
  ArrowRight,
  Bot,
  Bell,
  Video,
  Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ChildCard } from "@/components/ChildCard";
import { AgentBadge } from "@/components/AgentBadge";
import { Child, useAppStore } from "@/lib/store";
import { authService } from "@/services/auth";
import { childProgressFeedbackService, childrenService, therapySessionsService, notificationsService } from "@/services/data";

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { setSelectedChildId } = useAppStore();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [progressFeedbacks, setProgressFeedbacks] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
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
      }));

      setChildren(normalized);
      setLoading(false);
    };

    loadChildren();
  }, []);

  useEffect(() => {
    const loadSessionsAndNotifications = async () => {
      if (!currentUserId) return;

      // Load sessions for all children
      const childIds = children.map(c => c.id);
      const allSessions: any[] = [];
      
      for (const childId of childIds) {
        const { data } = await therapySessionsService.getSessionsForChild(childId);
        if (data) {
          allSessions.push(...data);
        }
      }
      setSessions(allSessions);

      // Load notifications
      const { data: notifData } = await notificationsService.getUnreadNotifications(currentUserId);
      if (notifData) {
        setNotifications(notifData);
      }

      // Load therapist progress feedback
      const { data: feedbackData } = await childProgressFeedbackService.getFeedbackForParent(currentUserId);
      if (feedbackData) {
        setProgressFeedbacks(feedbackData);
      }
    };

    loadSessionsAndNotifications();
  }, [currentUserId, children]);

  const mappedChildren = useMemo(() => {
    return children.map((child) => {
      const dob = new Date(child.dateOfBirth);
      const age = Number.isNaN(dob.getTime())
        ? child.age
        : Math.max(0, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      return { ...child, age };
    });
  }, [children]);

  const childNameById = useMemo(() => {
    const map: Record<string, string> = {};
    children.forEach((child) => {
      map[child.id] = child.name;
    });
    return map;
  }, [children]);

  const quickActions = [
    {
      icon: Baby,
      label: "Add Child Profile",
      description: "Register a new child",
      href: "/parent/children/add",
      color: "bg-secondary/20",
    },
    {
      icon: FileSearch,
      label: "Start Early Screening",
      description: "AI-powered assessment",
      href: "/parent/screening",
      color: "bg-primary/20",
    },
    {
      icon: Calendar,
      label: "Weekly Check-ins",
      description: "Track development",
      href: "/parent/checkins",
      color: "bg-agent-monitoring/20",
    },
    {
      icon: TrendingUp,
      label: "View Progress",
      description: "Developmental insights",
      href: "/parent/progress",
      color: "bg-success/20",
    },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor your children's development and access screening tools
        </p>
      </div>

      {/* AI Support Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border border-accent/30 gradient-accent p-6 text-primary-foreground"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">AI-Powered Support</h3>
            <p className="text-sm opacity-90">
              Our multi-agent AI system helps screen for early signs of autism.
              Remember: AI supports decisions, but trained professionals make final assessments.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(action.href)}
              className="group rounded-2xl border border-border bg-card p-6 text-left shadow-card transition-all hover:shadow-elevated hover:-translate-y-1"
            >
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${action.color}`}
              >
                <action.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                {action.label}
              </h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Notifications Section */}
      {notifications.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </h2>
          <div className="space-y-3">
            {notifications.slice(0, 3).map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-xl border border-primary/30 bg-primary/5 p-4 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={async () => {
                  await notificationsService.markAsRead(notification.id);
                  setNotifications(prev => prev.filter(n => n.id !== notification.id));
                  if (notification.link) {
                    navigate(notification.link);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Session Feedback Section */}
      {progressFeedbacks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Session Feedback
          </h2>
          <div className="space-y-3">
            {progressFeedbacks.slice(0, 3).map((feedback, index) => (
              <motion.div
                key={feedback.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {childNameById[feedback.child_id] || "Child"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {feedback.progress_text}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/parent/children/${feedback.child_id}`)}
                  >
                    View Child
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Sessions Section */}
      {sessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Video className="h-5 w-5" />
            Upcoming Therapy Sessions
          </h2>
          <div className="space-y-3">
            {sessions
              .filter(s => s.status === 'scheduled' && new Date(s.scheduled_date) >= new Date())
              .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
              .slice(0, 3)
              .map((session, index) => {
                const child = mappedChildren.find(c => c.id === session.child_id);
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Video className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{child?.name || 'Unknown Child'}</h4>
                          <p className="text-sm text-secondary capitalize mt-0.5">{session.type} Therapy</p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(session.scheduled_date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.scheduled_time}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs bg-secondary/10 text-secondary px-3 py-1 rounded-full font-medium">
                        Scheduled
                      </span>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* Children */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Children</h2>
          <Button variant="outline" size="sm" onClick={() => navigate("/parent/children/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Child
          </Button>
        </div>

        {loadError && (
          <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading children...
          </div>
        )}

        {!loading && mappedChildren.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {mappedChildren.map((child, index) => (
              <motion.div
                key={child.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChildCard
                  child={child}
                  onClick={() => {
                    setSelectedChildId(child.id);
                    navigate(`/parent/children/${child.id}`);
                  }}
                />
              </motion.div>
            ))}
          </div>
        ) : !loading ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <Baby className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No children registered yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your child's profile to start screening
            </p>
            <Button onClick={() => navigate("/parent/children/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Child Profile
            </Button>
          </div>
        ) : null}
      </div>

      {/* Active Agents */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Active AI Agents</h3>
        <div className="flex flex-wrap gap-3">
          <AgentBadge type="screening" />
          <AgentBadge type="monitoring" />
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          These AI agents are available to support your child's developmental journey.
        </p>
      </div>
    </DashboardLayout>
  );
}
