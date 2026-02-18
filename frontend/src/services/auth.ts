import { supabase } from '@/lib/supabase';
import { UserRole } from '@/lib/store';

export const authService = {
  async signUp(
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    metadata?: {
      specialty?: string;
      state?: string;
      district?: string;
    },
  ) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          specialty: metadata?.specialty,
          state: metadata?.state,
          district: metadata?.district,
        },
      },
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch profile to get role
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      ...user,
      profile,
    };
  },
};
