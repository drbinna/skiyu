import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface ClaimableSkill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  install_count: number;
  avg_rating: number | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: {
    id: string;
    github_username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_publisher: boolean;
    is_verified: boolean;
  } | null;
  loading: boolean;
  claimableSkills: ClaimableSkill[];
  claimedSkills: ClaimableSkill[];
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  claimAllSkills: () => Promise<number>;
  claimSkill: (skillId: string) => Promise<boolean>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  claimableSkills: [],
  claimedSkills: [],
  signInWithGitHub: async () => {},
  signOut: async () => {},
  claimAllSkills: async () => 0,
  claimSkill: async () => false,
  refreshClaims: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const [claimableSkills, setClaimableSkills] = useState<ClaimableSkill[]>([]);
  const [claimedSkills, setClaimedSkills] = useState<ClaimableSkill[]>([]);

  // Fetch user profile from our users table
  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("id, github_username, display_name, avatar_url, is_publisher, is_verified")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
    return data;
  }, []);

  // Fetch skills this user can claim (matching GitHub username, unclaimed)
  const fetchClaimable = useCallback(async (githubUsername: string | null) => {
    if (!githubUsername) return;

    // Skills by this author that are unclaimed
    const { data: claimable } = await supabase
      .from("v_skill_catalog")
      .select("id, name, slug, description, install_count, avg_rating")
      .eq("author_username", githubUsername)
      .eq("is_claimed", false);

    if (claimable) setClaimableSkills(claimable);

    // Skills already claimed by this user
    const { data: claimed } = await supabase
      .from("v_skill_catalog")
      .select("id, name, slug, description, install_count, avg_rating")
      .eq("author_username", githubUsername)
      .eq("is_claimed", true);

    if (claimed) setClaimedSkills(claimed);
  }, []);

  // Refresh claims data
  const refreshClaims = useCallback(async () => {
    if (profile?.github_username) {
      await fetchClaimable(profile.github_username);
    }
  }, [profile, fetchClaimable]);

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).then((p) => {
          if (p) fetchClaimable(p.github_username);
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          // Small delay to let the trigger create the user row
          setTimeout(async () => {
            const p = await fetchProfile(s.user.id);
            if (p) fetchClaimable(p.github_username);
          }, 1000);
        } else {
          setProfile(null);
          setClaimableSkills([]);
          setClaimedSkills([]);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchClaimable]);

  // Sign in with GitHub OAuth
  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
        scopes: "read:user",
      },
    });
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setClaimableSkills([]);
    setClaimedSkills([]);
  };

  // Claim all matching skills at once
  const claimAllSkills = async (): Promise<number> => {
    if (!user) return 0;
    const { data, error } = await supabase.rpc("auto_claim_skills", {
      claiming_user_id: user.id,
    });
    if (!error && data) {
      await refreshClaims();
      return data.length;
    }
    return 0;
  };

  // Claim a single skill
  const claimSkill = async (skillId: string): Promise<boolean> => {
    if (!user) return false;
    const { data, error } = await supabase.rpc("claim_skill", {
      claiming_user_id: user.id,
      target_skill_id: skillId,
    });
    if (!error && data) {
      await refreshClaims();
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        claimableSkills,
        claimedSkills,
        signInWithGitHub,
        signOut,
        claimAllSkills,
        claimSkill,
        refreshClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
