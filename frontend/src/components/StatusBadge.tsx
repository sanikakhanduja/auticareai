import { cn } from "@/lib/utils";

type Status = "pending-review" | "reviewed" | "not-started" | "in-progress" | "under-observation" | "diagnosed";
type RiskLevel = "low" | "medium" | "high";

interface StatusBadgeProps {
  status?: Status;
  riskLevel?: RiskLevel;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  "not-started": {
    label: "Not Started",
    className: "bg-muted text-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-primary/10 text-primary",
  },
  "pending-review": {
    label: "Pending Review",
    className: "bg-warning/10 text-warning",
  },
  reviewed: {
    label: "Reviewed",
    className: "bg-success/10 text-success",
  },
  "under-observation": {
    label: "Under Observation",
    className: "bg-agent-monitoring/10 text-agent-monitoring",
  },
  diagnosed: {
    label: "Diagnosis Complete",
    className: "bg-success/10 text-success",
  },
};

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "Low Risk",
    className: "bg-success/10 text-success",
  },
  medium: {
    label: "Medium Risk",
    className: "bg-warning/10 text-warning",
  },
  high: {
    label: "High Risk",
    className: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status, riskLevel, className }: StatusBadgeProps) {
  if (status) {
    const config = statusConfig[status];
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          config.className,
          className
        )}
      >
        {config.label}
      </span>
    );
  }

  if (riskLevel) {
    const config = riskConfig[riskLevel];
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
          config.className,
          className
        )}
      >
        {config.label}
      </span>
    );
  }

  return null;
}
