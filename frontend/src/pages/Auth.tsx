import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Users, Stethoscope, HeartPulse, Mail, Lock, User, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleCard } from "@/components/RoleCard";
import { useAppStore, UserRole } from "@/lib/store";
import { authService } from "@/services/auth";
import { profilesService } from "@/services/data";

type AuthStep = "role" | "form";

export default function Auth() {
  const [step, setStep] = useState<AuthStep>("role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSignUp, setIsSignUp] = useState(true);
  const [requiresProviderLocation, setRequiresProviderLocation] = useState(false);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const [pendingProviderRole, setPendingProviderRole] = useState<"doctor" | "therapist" | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    state: "",
    district: "",
  });
  const navigate = useNavigate();
  const { setCurrentUser } = useAppStore();
  const isProviderRole = selectedRole === "doctor" || selectedRole === "therapist";

  const roles = [
    {
      role: "parent" as UserRole,
      icon: Users,
      title: "Parent",
      description: "Monitor your child's development and access screening tools",
    },
    {
      role: "doctor" as UserRole,
      icon: Stethoscope,
      title: "Doctor",
      description: "Review screenings and provide clinical assessments",
    },
    {
      role: "therapist" as UserRole,
      icon: HeartPulse,
      title: "Therapist",
      description: "Create therapy plans and track session progress",
    },
  ];

  const indiaStates = [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ];

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (selectedRole) {
      setStep("form");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole && isSignUp) return; // Role is required for signup

    if (requiresProviderLocation && pendingProviderId) {
      if (!formData.state || !formData.district) {
        alert("Please select a state and enter a district.");
        return;
      }

      const { error } = await profilesService.updateLocation(pendingProviderId, {
        state: formData.state,
        district: formData.district,
      });

      if (error) {
        alert(error.message || "Failed to update location");
        return;
      }

      const providerRole = pendingProviderRole || selectedRole;
      setRequiresProviderLocation(false);
      setPendingProviderId(null);
      setPendingProviderRole(null);
      if (providerRole === "therapist") {
        navigate("/therapist");
      } else {
        navigate("/doctor");
      }
      return;
    }

    if (isSignUp && isProviderRole) {
      if (!formData.state || !formData.district) {
        alert("Please select a state and enter a district.");
        return;
      }
    }

    try {
      if (isSignUp) {
        const { data, error } = await authService.signUp(
          formData.email,
          formData.password,
          formData.name,
          selectedRole as UserRole,
          isProviderRole
            ? {
                state: formData.state,
                district: formData.district,
              }
            : undefined
        );

        if (error) {
          alert(error.message || "Signup failed");
          return;
        }

        const profile = await authService.getCurrentUser();
        const role = profile?.profile?.role || selectedRole || "parent";

        setCurrentUser({
          id: profile?.id || data.user?.id || "",
          name: profile?.profile?.full_name || formData.name,
          email: formData.email,
          role,
        });

        switch (role) {
          case "parent":
            navigate("/parent");
            break;
          case "doctor":
            navigate("/doctor");
            break;
          case "therapist":
            navigate("/therapist");
            break;
          default:
            navigate("/parent");
        }
      } else {
        const { data, error } = await authService.signIn(formData.email, formData.password);
        if (error) {
          alert(error.message || "Login failed");
          return;
        }

        const profile = await authService.getCurrentUser();
        const role = profile?.profile?.role || "parent";

        const roleNeedsLocation = role === "doctor" || role === "therapist";
        if (roleNeedsLocation && (!profile?.profile?.state || !profile?.profile?.district)) {
          const providerRole = role as "doctor" | "therapist";
          setSelectedRole(providerRole);
          setRequiresProviderLocation(true);
          setPendingProviderId(profile?.id || data.user?.id || null);
          setPendingProviderRole(providerRole);
          return;
        }

        setCurrentUser({
          id: profile?.id || data.user?.id || "",
          name: profile?.profile?.full_name || "User",
          email: formData.email,
          role,
        });

        switch (role) {
          case "parent":
            navigate("/parent");
            break;
          case "doctor":
            navigate("/doctor");
            break;
          case "therapist":
            navigate("/therapist");
            break;
          default:
            navigate("/parent");
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      alert("An error occurred during authentication");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-xl">AutiCare</span>
              <span className="text-primary ml-1">AI</span>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Already have an account?" : "Need an account?"}
          </Button>
        </div>
      </header>

      <main className="container pt-24 pb-16">
        <AnimatePresence mode="wait">
          {step === "role" && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-3xl"
            >
              <div className="text-center mb-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-hero"
                >
                  <Bot className="h-10 w-10 text-primary-foreground" />
                </motion.div>
                <h1 className="text-4xl font-bold mb-4">
                  Welcome to <span className="text-primary">AutiCare AI</span>
                </h1>
                <p className="text-xl text-muted-foreground">
                  AI-powered early autism screening and care platform
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-center text-lg font-medium mb-6">
                  {isSignUp ? "Create your account" : "Sign in to your account"}
                </h2>
                <p className="text-center text-muted-foreground mb-8">
                  Select your role to continue
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {roles.map((role) => (
                  <RoleCard
                    key={role.role}
                    icon={role.icon}
                    title={role.title}
                    description={role.description}
                    selected={selectedRole === role.role}
                    onClick={() => handleRoleSelect(role.role)}
                  />
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <Button
                  size="lg"
                  variant="hero"
                  onClick={handleContinue}
                  disabled={!selectedRole}
                >
                  Continue
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              {/* AI Disclaimer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 rounded-xl border border-accent/30 bg-accent/5 p-4 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  <Bot className="inline-block h-4 w-4 mr-2 text-accent" />
                  <strong>AI supports decisions, humans remain in control.</strong>
                  <br />
                  Our AI agents assist healthcare professionals but never make diagnoses.
                </p>
              </motion.div>
            </motion.div>
          )}

          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-md"
            >
              <Button
                variant="ghost"
                className="mb-6"
                onClick={() => setStep("role")}
              >
                ← Back to role selection
              </Button>

              <div className="rounded-2xl border border-border bg-card p-8 shadow-elevated">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold">
                    {requiresProviderLocation
                      ? "Complete Profile"
                      : isSignUp
                        ? "Create Account"
                        : "Welcome Back"}
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    {requiresProviderLocation
                      ? "Add your state and district to appear in search"
                      : isSignUp
                        ? "Enter your details to get started"
                        : "Sign in to continue"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!requiresProviderLocation && isSignUp && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        placeholder="Full Name"
                        className="pl-10"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                  )}
                  {!requiresProviderLocation && (
                    <>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="Email Address"
                          className="pl-10"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Password"
                          className="pl-10"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  {(isSignUp && isProviderRole) || requiresProviderLocation ? (
                    <>
                      <div>
                        <Select
                          value={formData.state}
                          onValueChange={(value) =>
                            setFormData({ ...formData, state: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select State" />
                          </SelectTrigger>
                          <SelectContent>
                            {indiaStates.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          placeholder="District"
                          className="pl-10"
                          value={formData.district}
                          onChange={(e) =>
                            setFormData({ ...formData, district: e.target.value })
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  <Button type="submit" size="lg" variant="hero" className="w-full">
                    {requiresProviderLocation
                      ? "Save Location"
                      : isSignUp
                        ? "Create Account"
                        : "Sign In"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  {!requiresProviderLocation && (
                    <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                    </div>
                  )}

                  {!requiresProviderLocation && (
                    <Button variant="outline" type="button" className="w-full" onClick={() => window.location.href = 'http://localhost:3000/api/auth/google'}>
                      <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                      Google
                    </Button>
                  )}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
