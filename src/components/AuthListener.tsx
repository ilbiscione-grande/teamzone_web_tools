"use client";

import { useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import {
  useProjectStore,
  persistActiveProject,
  persistPlanCheck,
} from "@/state/useProjectStore";

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
    const sb = supabase;
    if (!sb) {
      return;
    }

    let sessionGuardTimer: ReturnType<typeof setInterval> | null = null;

    const buildSessionKey = (userId: string, accessToken?: string | null) => {
      if (!accessToken) {
        return null;
      }
      return `${userId}:${accessToken.slice(0, 24)}`;
    };

    const claimSingleSession = async (
      userId: string,
      accessToken?: string | null
    ) => {
      const sessionKey = buildSessionKey(userId, accessToken);
      if (!sessionKey) {
        return;
      }
      await sb.from("user_sessions").upsert(
        {
          user_id: userId,
          session_key: sessionKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    };

    const startSingleSessionGuard = (
      userId: string,
      accessToken?: string | null
    ) => {
      const currentKey = buildSessionKey(userId, accessToken);
      if (!currentKey) {
        return;
      }
      if (sessionGuardTimer) {
        clearInterval(sessionGuardTimer);
      }
      sessionGuardTimer = setInterval(async () => {
        const { data } = await sb
          .from("user_sessions")
          .select("session_key")
          .eq("user_id", userId)
          .single();
        const activeKey = data?.session_key;
        if (activeKey && activeKey !== currentKey) {
          persistActiveProject();
          await sb.auth.signOut();
        }
      }, 4000);
    };

    const stopSingleSessionGuard = () => {
      if (!sessionGuardTimer) {
        return;
      }
      clearInterval(sessionGuardTimer);
      sessionGuardTimer = null;
    };

    const syncProfilePlan = async (userId: string) => {
      if (!supabase) {
        return;
      }
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", userId)
        .single();
      if (error || !data) {
        return;
      }
      const plan = data?.plan === "PAID" ? "PAID" : "AUTH";
      setPlanFromProfile(plan);
      persistPlanCheck();
    };

    sb.auth.getSession().then(({ data }) => {
      persistActiveProject();
      const session = data.session;
      if (session?.user) {
        const user = session.user;
        setAuthUser({
          id: user.id,
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
        claimSingleSession(user.id, session.access_token).then(() =>
          startSingleSessionGuard(user.id, session.access_token)
        );
      } else {
        stopSingleSessionGuard();
        clearAuthUser();
      }
    });

    const { data: subscription } = sb.auth.onAuthStateChange(
      (_event, session) => {
        persistActiveProject();
        if (session?.user) {
          const user = session.user;
          setAuthUser({
            id: user.id,
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
          claimSingleSession(user.id, session.access_token).then(() =>
            startSingleSessionGuard(user.id, session.access_token)
          );
        } else {
          stopSingleSessionGuard();
          clearAuthUser();
        }
      }
    );

    return () => {
      stopSingleSessionGuard();
      subscription.subscription.unsubscribe();
    };
  }, [setAuthUser, clearAuthUser]);

  return null;
}
