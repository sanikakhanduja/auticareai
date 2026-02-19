import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Baby, Plus, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ChildCard } from "@/components/ChildCard";
import { Child, useAppStore } from "@/lib/store";
import { childrenService, profilesService } from "@/services/data";

export default function ChildrenList() {
  const navigate = useNavigate();
  const { setSelectedChildId } = useAppStore();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doctorNameById, setDoctorNameById] = useState<Record<string, string>>({});
  const [therapistNameById, setTherapistNameById] = useState<Record<string, string>>({});

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
    const loadProfessionals = async () => {
      const [{ data: doctors }, { data: therapists }] = await Promise.all([
        profilesService.getDoctors(),
        profilesService.getTherapists(),
      ]);

      const doctorMap: Record<string, string> = {};
      (doctors || []).forEach((d: any) => {
        doctorMap[d.id] = d.full_name || "Doctor";
      });
      setDoctorNameById(doctorMap);

      const therapistMap: Record<string, string> = {};
      (therapists || []).forEach((t: any) => {
        therapistMap[t.id] = t.full_name || "Therapist";
      });
      setTherapistNameById(therapistMap);
    };

    loadProfessionals();
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

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Children</h1>
            <p className="text-muted-foreground mt-2">
              Manage child profiles and access individual screening data
            </p>
          </div>
          <Button onClick={() => navigate("/parent/children/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Child
          </Button>
        </div>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mappedChildren.map((child, index) => (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <ChildCard
                child={child}
                assignedDoctorName={child.assignedDoctorId ? doctorNameById[child.assignedDoctorId] || null : null}
                assignedTherapistName={child.assignedTherapistId ? therapistNameById[child.assignedTherapistId] || null : null}
                onFindDoctor={() => navigate("/parent/find?tab=doctors")}
                onFindTherapist={() => navigate("/parent/find?tab=therapists")}
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
    </DashboardLayout>
  );
}
