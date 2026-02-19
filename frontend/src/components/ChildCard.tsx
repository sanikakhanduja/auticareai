import { motion } from "framer-motion";
import { Baby, Calendar, ArrowRight } from "lucide-react";
import { Child } from "@/lib/store";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChildCardProps {
  child: Child;
  onClick?: () => void;
  showActions?: boolean;
  className?: string;
  assignedDoctorName?: string | null;
  assignedTherapistName?: string | null;
  onFindDoctor?: () => void;
  onFindTherapist?: () => void;
}

export function ChildCard({
  child,
  onClick,
  showActions = true,
  className,
  assignedDoctorName,
  assignedTherapistName,
  onFindDoctor,
  onFindTherapist,
}: ChildCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elevated",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/30">
            <Baby className="h-7 w-7 text-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{child.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{child.age} years old</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={child.screeningStatus} />
          {child.riskLevel && <StatusBadge riskLevel={child.riskLevel} />}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="text-muted-foreground">
          Doctor:{" "}
          {assignedDoctorName ? (
            <span className="font-medium text-foreground">{assignedDoctorName}</span>
          ) : (
            <button
              type="button"
              onClick={onFindDoctor}
              className="font-medium text-primary underline underline-offset-2"
            >
              Find a doctor
            </button>
          )}
        </div>
        <div className="text-muted-foreground">
          Therapist:{" "}
          {assignedTherapistName ? (
            <span className="font-medium text-foreground">{assignedTherapistName}</span>
          ) : (
            <button
              type="button"
              onClick={onFindTherapist}
              className="font-medium text-primary underline underline-offset-2"
            >
              Find a therapist
            </button>
          )}
        </div>
      </div>

      {showActions && (
        <div className="mt-6 flex gap-3">
          <Button onClick={onClick} className="flex-1">
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
