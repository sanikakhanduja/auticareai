import { motion } from "framer-motion";
import { Bot, Brain, HeartPulse, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentType = "screening" | "clinical" | "therapy" | "monitoring";

interface AgentBadgeProps {
  type: AgentType;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

const agentConfig = {
  screening: {
    label: "Screening Agent",
    icon: Bot,
    colorClass: "bg-agent-screening text-white",
    description: "Analyzing behavioral patterns",
  },
  clinical: {
    label: "Clinical Summary Agent",
    icon: Brain,
    colorClass: "bg-agent-clinical text-white",
    description: "Generating clinical insights",
  },
  therapy: {
    label: "Therapy Planning Agent",
    icon: HeartPulse,
    colorClass: "bg-agent-therapy text-white",
    description: "Optimizing therapy plans",
  },
  monitoring: {
    label: "Monitoring Agent",
    icon: Activity,
    colorClass: "bg-agent-monitoring text-white",
    description: "Tracking progress",
  },
};

export function AgentBadge({
  type,
  showLabel = true,
  size = "md",
  animated = false,
  className,
}: AgentBadgeProps) {
  const config = agentConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-6 px-2 text-xs gap-1",
    md: "h-8 px-3 text-sm gap-2",
    lg: "h-10 px-4 text-base gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  return (
    <motion.div
      initial={animated ? { scale: 0.9, opacity: 0 } : false}
      animate={animated ? { scale: 1, opacity: 1 } : false}
      className={cn(
        "inline-flex items-center rounded-full font-medium shadow-soft",
        config.colorClass,
        sizeClasses[size],
        animated && "animate-pulse-soft",
        className
      )}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </motion.div>
  );
}

export function AgentPanel({
  type,
  children,
  className,
}: {
  type: AgentType;
  children: React.ReactNode;
  className?: string;
}) {
  const config = agentConfig[type];

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card p-4 shadow-card",
        className
      )}
      style={{
        borderColor: `hsl(var(--agent-${type}))`,
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <AgentBadge type={type} size="sm" />
      </div>
      {children}
    </div>
  );
}

export { agentConfig };
