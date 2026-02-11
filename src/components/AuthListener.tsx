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
const SESSION_KEY_STORAGE = "tacticsboard:sessionKey";
const ACTIVE_SESSION_WINDOW_MS = 5 * 60 * 1000;

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
    let sessionGuardCleanup: Array<() => void> = [];

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
        return false;
      }
      const { data: existing } = await sb
        .from("user_sessions")
        .select("session_key,updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing?.session_key && existing.session_key !== sessionKey) {
        const activeAt = Date.parse(existing.updated_at ?? "");
        const activeRecently =
          Number.isFinite(activeAt) &&
          Date.now() - activeAt <= ACTIVE_SESSION_WINDOW_MS;
        if (activeRecently) {
          const shouldTakeOver = window.confirm(
            "Du har en annan aktiv inloggning med ändringar de senaste minuterna. Om du fortsätter loggas den enheten ut och osparade ändringar där kan gå förlorade. Fortsätta?"
          );
          if (!shouldTakeOver) {
            await sb.auth.signOut();
            return false;
          }
        }
      }
      await sb.from("user_sessions").upsert(
        {
          user_id: userId,
          session_key: sessionKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SESSION_KEY_STORAGE, sessionKey);
      }
      return true;
    };

    const stopSingleSessionGuard = () => {
      if (sessionGuardTimer) {
        clearInterval(sessionGuardTimer);
        sessionGuardTimer = null;
      }
      sessionGuardCleanup.forEach((dispose) => dispose());
      sessionGuardCleanup = [];
    };

    const startSingleSessionGuard = (userId: string, accessToken?: string | null) => {
      const currentKey = buildSessionKey(userId, accessToken);
      if (!currentKey) {
        return;
      }
      stopSingleSessionGuard();
      const checkSession = async () => {
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
      };
      // Immediate check when guard starts.
      void checkSession();
      // Low-frequency heartbeat to reduce read load.
      sessionGuardTimer = setInterval(() => {
        void checkSession();
      }, 45000);

      const onFocus = () => void checkSession();
      const onVisible = () => {
        if (document.visibilityState === "visible") {
          void checkSession();
        }
      };
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisible);
      sessionGuardCleanup.push(() => {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisible);
      });
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
        claimSingleSession(user.id, session.access_token).then((allowed) => {
          if (allowed) {
            startSingleSessionGuard(user.id, session.access_token);
          }
        });
      } else {
        stopSingleSessionGuard();
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(SESSION_KEY_STORAGE);
        }
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
          claimSingleSession(user.id, session.access_token).then((allowed) => {
            if (allowed) {
              startSingleSessionGuard(user.id, session.access_token);
            }
          });
        } else {
          stopSingleSessionGuard();
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(SESSION_KEY_STORAGE);
          }
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
