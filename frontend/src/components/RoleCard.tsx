import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
}

export function RoleCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: RoleCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border-2 bg-card p-6 text-left transition-all duration-200",
        selected
          ? "border-primary shadow-elevated"
          : "border-border shadow-card hover:border-primary/50"
      )}
    >
      <div
        className={cn(
          "mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl transition-colors",
          selected ? "gradient-primary" : "bg-muted"
        )}
      >
        <Icon
          className={cn(
            "h-7 w-7 transition-colors",
            selected ? "text-primary-foreground" : "text-primary"
          )}
        />
      </div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.button>
  );
}
