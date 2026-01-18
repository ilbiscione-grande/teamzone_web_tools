"use client";

import { useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import { useProjectStore } from "@/state/useProjectStore";

const getDisplayName = (email: string | null, fullName?: string | null) => {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }
  if (email && email.includes("@")) {
    return email.split("@")[0];
  }
  return email ?? "Coach";
};

export default function AuthListener() {
  const setAuthUser = useProjectStore((state) => state.setAuthUser);
  const setPlanFromProfile = useProjectStore(
    (state) => state.setPlanFromProfile
  );
  const clearAuthUser = useProjectStore((state) => state.clearAuthUser);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const maybeEnforceSingleSession = async (
      userId: string,
      accessToken?: string | null
    ) => {
      if (!accessToken) {
        return;
      }
      const key = `tacticsboard:singleSession:${userId}:${accessToken.slice(0, 12)}`;
      if (typeof window === "undefined") {
        return;
      }
      if (window.localStorage.getItem(key)) {
        return;
      }
      const confirmKick = window.confirm(
        "Sign out other devices to keep only this session active?"
      );
      if (confirmKick && supabase) {
        try {
          await supabase.auth.signOut({ scope: "others" });
        } catch {
          // Ignore sign-out errors to avoid blocking sign-in.
        }
      }
      window.localStorage.setItem(key, "1");
    };

    const syncProfilePlan = async (userId: string) => {
      if (!supabase) {
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", userId)
        .single();
      const plan =
        data?.plan === "PAID" || data?.plan === "AUTH" ? data.plan : "FREE";
      setPlanFromProfile(plan);
    };

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (session?.user) {
        const user = session.user;
        setAuthUser({
          email: user.email ?? "",
          name: getDisplayName(
            user.email ?? null,
            (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined) ??
              null
          ),
          createdAt: user.created_at ?? new Date().toISOString(),
        });
        syncProfilePlan(user.id).finally(() => hydrateIndex());
        maybeEnforceSingleSession(user.id, session.access_token);
      } else {
        clearAuthUser();
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const user = session.user;
          setAuthUser({
            email: user.email ?? "",
            name: getDisplayName(
              user.email ?? null,
              (user.user_metadata?.full_name as string | undefined) ??
                (user.user_metadata?.name as string | undefined) ??
                null
            ),
            createdAt: user.created_at ?? new Date().toISOString(),
          });
          syncProfilePlan(user.id).finally(() => hydrateIndex());
          maybeEnforceSingleSession(user.id, session.access_token);
        } else {
          clearAuthUser();
        }
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [setAuthUser, clearAuthUser]);

  return null;
}
