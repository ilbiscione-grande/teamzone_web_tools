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
  const clearAuthUser = useProjectStore((state) => state.clearAuthUser);
  const hydrateIndex = useProjectStore((state) => state.hydrateIndex);

  useEffect(() => {
    if (!supabase) {
      return;
    }

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
        hydrateIndex();
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
          hydrateIndex();
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
