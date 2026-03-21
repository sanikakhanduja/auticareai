import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setCurrentUser } = useAppStore();

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (token) {
      // In a real app, you would exchange this token for a JWT 
      // or verify it with your backend.
      // For this MVP, we simulate a successful login.
      
      const user = {
        id: "google-user-" + Math.random().toString(36).substr(2, 9),
        name: "Google User",
        email: "google@example.com",
        role: "parent" as const, // Default role, user might need to select it
      };

      setCurrentUser(user);
      
      // Redirect to dashboard
      // Ideally, check if user has a role, if not redirect to role selection
      navigate("/parent"); 
    } else {
      // Handle error
      navigate("/auth");
    }
  }, [searchParams, navigate, setCurrentUser]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <h2 className="mt-4 text-xl font-semibold">Authenticating...</h2>
        <p className="text-muted-foreground">Please wait while we log you in.</p>
      </div>
    </div>
  );
}
