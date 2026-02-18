import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, FileText, Video } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Child } from "@/lib/store";
import { authService } from "@/services/auth";
import { childrenService, therapySessionsService, notificationsService } from "@/services/data";

export default function TherapistPatients() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
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

    alert('Session scheduled successfully!');

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
              <Button variant="default" className="flex-1" onClick={() => handleScheduleMeeting(child)}>
                <Video className="mr-2 h-4 w-4" />
                Schedule Meeting
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </DashboardLayout>
  );
}
