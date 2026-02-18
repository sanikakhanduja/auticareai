import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { authService } from "@/services/auth";
import { supabase } from "@/lib/supabase";

export function AuthProvider() {
  const { setCurrentUser, setAuthInitialized } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    const syncCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!isMounted) {
          return;
        }

        if (!user) {
          setCurrentUser(null);
          return;
        }

        const role = user.profile?.role || "parent";
        setCurrentUser({
          id: user.id,
          name: user.profile?.full_name || "User",
          email: user.email,
          role,
        });
      } catch (error) {
        console.error("Error restoring session:", error);
      } finally {
        if (isMounted) {
          setAuthInitialized(true);
        }
      }
    };

    syncCurrentUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      syncCurrentUser();
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [setCurrentUser, setAuthInitialized]);

  return null;
}
