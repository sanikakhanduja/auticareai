import { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Users,
  FileText,
  Calendar,
  Settings,
  LogOut,
  Baby,
  Stethoscope,
  HeartPulse,
  Bot,
  Loader2,
} from "lucide-react";
import { useAppStore, UserRole } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

import {
  BookOpen,
  Search as SearchIcon,
  ClipboardList,
} from "lucide-react";

const roleNavItems: Record<UserRole, NavItem[]> = {
  parent: [
    { label: "Dashboard", href: "/parent", icon: Home },
    { label: "My Children", href: "/parent/children", icon: Baby },
    { label: "Screening", href: "/parent/screening", icon: FileText },
    { label: "Progress", href: "/parent/progress", icon: Calendar },
    { label: "Awareness", href: "/parent/awareness", icon: BookOpen },
    { label: "Find Care", href: "/parent/find", icon: SearchIcon },
    { label: "Reports", href: "/parent/reports", icon: ClipboardList },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor", icon: Home },
    { label: "Patients", href: "/doctor/patients", icon: Users },
    { label: "Reviews", href: "/doctor/reviews", icon: FileText },
    { label: "Reports", href: "/doctor/reports", icon: ClipboardList },
  ],
  therapist: [
    { label: "Dashboard", href: "/therapist", icon: Home },
    { label: "Patients", href: "/therapist/patients", icon: Users },
    { label: "Sessions", href: "/therapist/sessions", icon: Calendar },
  ],
};

const roleLabels: Record<UserRole, string> = {
  parent: "Parent Portal",
  doctor: "Doctor Portal",
  therapist: "Therapist Portal",
};

const roleIcons: Record<UserRole, React.ElementType> = {
  parent: Baby,
  doctor: Stethoscope,
  therapist: HeartPulse,
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { currentUser, authInitialized, setCurrentUser } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!authInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Restoring your session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  const navItems = roleNavItems[currentUser.role];
  const RoleIcon = roleIcons[currentUser.role];

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    navigate("/auth");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card shadow-soft">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-border px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg">AutiCare</span>
              <span className="text-primary ml-1 text-sm">AI</span>
            </div>
          </div>

          {/* Role Badge */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <RoleIcon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{roleLabels[currentUser.role]}</p>
                <p className="text-xs text-muted-foreground">{currentUser.name}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-border p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
