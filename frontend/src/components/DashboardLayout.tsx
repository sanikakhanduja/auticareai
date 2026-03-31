import { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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

interface RoleNavItemsConfig {
  parent: Omit<NavItem, 'label'>[];
  doctor: Omit<NavItem, 'label'>[];
  therapist: Omit<NavItem, 'label'>[];
}

const roleNavItemsConfig: RoleNavItemsConfig = {
  parent: [
    { href: "/parent", icon: Home },
    { href: "/parent/children", icon: Baby },
    { href: "/parent/screening", icon: FileText },
    { href: "/parent/progress", icon: Calendar },
    { href: "/parent/awareness", icon: BookOpen },
    { href: "/parent/find", icon: SearchIcon },
    { href: "/parent/reports", icon: ClipboardList },
  ],
  doctor: [
    { href: "/doctor", icon: Home },
    { href: "/doctor/patients", icon: Users },
    { href: "/doctor/reviews", icon: FileText },
    { href: "/doctor/reports", icon: ClipboardList },
  ],
  therapist: [
    { href: "/therapist", icon: Home },
    { href: "/therapist/patients", icon: Users },
    { href: "/therapist/sessions", icon: Calendar },
  ],
};

const roleNavLabels: Record<UserRole, string[]> = {
  parent: [
    "nav.dashboard",
    "nav.myChildren",
    "nav.screening",
    "nav.progress",
    "nav.awareness",
    "nav.findCare",
    "nav.reports",
  ],
  doctor: [
    "nav.dashboard",
    "nav.patients",
    "nav.reviews",
    "nav.reports",
  ],
  therapist: [
    "nav.dashboard",
    "nav.patients",
    "nav.sessions",
  ],
};

const roleLabelsMap: Record<UserRole, string> = {
  parent: "portal.parentPortal",
  doctor: "portal.doctorPortal",
  therapist: "portal.therapistPortal",
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
  const { t } = useTranslation();
  const { currentUser, authInitialized, setCurrentUser } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!authInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t("portal.restoringSession")}</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  const navItemsConfig = roleNavItemsConfig[currentUser.role];
  const navLabels = roleNavLabels[currentUser.role];
  const navItems: NavItem[] = navItemsConfig.map((item, index) => ({
    ...item,
    label: t(navLabels[index]),
  }));
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
                <p className="text-sm font-medium">{t(roleLabelsMap[currentUser.role])}</p>
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
          <div className="border-t border-border p-4 space-y-2">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-sm text-muted-foreground">{t("common.theme")}</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-sm text-muted-foreground">{t("common.language")}</span>
              <LanguageSwitcher />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-5 w-5" />
              {t("nav.logout")}
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
