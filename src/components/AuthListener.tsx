"use client";

import { useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";
import { hasEffectivePaidAccess, type ProfilePlanSnapshot } from "@/utils/effectivePlan";
import {
  useProjectStore,
  persistActiveProject,
  persistActiveProjectLocal,
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
const SESSION_NONCE_STORAGE = "tacticsboard:sessionNonce";
const SESSION_DEVICE_ID_STORAGE = "tacticsboard:deviceId";
const ACTIVE_SESSION_WINDOW_MS = 5 * 60 * 1000;

const safeSetLocalStorageItem = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not persist local storage key "${key}".`, error);
  }
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
    let sessionGuardCleanup: Array<() => void> = [];

    const getDeviceId = () => {
      const existingDeviceId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(SESSION_DEVICE_ID_STORAGE)
          : null;
      const deviceId =
        existingDeviceId && existingDeviceId.length > 0
          ? existingDeviceId
          : (typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      if (typeof window !== "undefined") {
        safeSetLocalStorageItem(SESSION_DEVICE_ID_STORAGE, deviceId);
      }
      return deviceId;
    };

    const parseDeviceIdFromSessionKey = (sessionKey: string | null | undefined) => {
      if (!sessionKey) {
        return null;
      }
      const parts = sessionKey.split(":");
      return parts.length >= 3 ? parts[1] : null;
    };

    const buildSessionKey = (userId: string, accessToken?: string | null) => {
      const deviceId = getDeviceId();
      const existingNonce =
        typeof window !== "undefined"
          ? window.localStorage.getItem(SESSION_NONCE_STORAGE)
          : null;
      const nonce =
        existingNonce && existingNonce.length > 0
          ? existingNonce
          : (typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      if (typeof window !== "undefined") {
        safeSetLocalStorageItem(SESSION_NONCE_STORAGE, nonce);
      }
      // Device-stable key prevents false conflict on reload/login on same device.
      return `${userId}:${deviceId}:${nonce}`;
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
        const currentDeviceId = parseDeviceIdFromSessionKey(sessionKey);
        const existingDeviceId = parseDeviceIdFromSessionKey(existing.session_key);
        if (currentDeviceId && existingDeviceId && currentDeviceId === existingDeviceId) {
          await sb.from("user_sessions").upsert(
            {
              user_id: userId,
              session_key: sessionKey,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
          if (typeof window !== "undefined") {
            safeSetLocalStorageItem(SESSION_KEY_STORAGE, sessionKey);
          }
          return true;
        }
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
          try {
            await sb.auth.signOut({ scope: "others" });
          } catch {
            // Continue with session claim even if remote revoke fails.
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
        safeSetLocalStorageItem(SESSION_KEY_STORAGE, sessionKey);
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

    const startSingleSessionGuard = (
      userId: string,
      accessToken?: string | null
    ) => {
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
          // Keep local backup but do not push stale data to cloud
          // when another device has already taken over the session.
          persistActiveProjectLocal();
          await sb.auth.signOut();
        }
      };
      // Immediate check when guard starts.
      void checkSession();
      // Low-frequency heartbeat to reduce read load.
      sessionGuardTimer = setInterval(() => {
        void checkSession();
      }, 10000);

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
      let data: ProfilePlanSnapshot | null = null;
      let error: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await supabase
          .from("profiles")
          .select("plan,manual_paid_override")
          .eq("id", userId)
          .single();
        data = result.data as ProfilePlanSnapshot | null;
        error = result.error;
        if (!error && data) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
      if (error || !data) {
        return;
      }
      const plan = hasEffectivePaidAccess(data) ? "PAID" : "AUTH";
      setPlanFromProfile(plan);
      persistPlanCheck();
    };

    const shouldRouteToResetPassword = (event?: string) => {
      if (typeof window === "undefined") {
        return false;
      }
      const path = window.location.pathname;
      if (path.startsWith("/reset-password")) {
        return false;
      }
      const hash = window.location.hash ?? "";
      const search = window.location.search ?? "";
      const href = window.location.href ?? "";
      return (
        event === "PASSWORD_RECOVERY" ||
        hash.includes("type=recovery") ||
        search.includes("type=recovery") ||
        search.includes("mode=recovery") ||
        href.includes("type=recovery")
      );
    };

    sb.auth.getSession().then(({ data }) => {
      persistActiveProject();
      const session = data.session;
      if (session?.user) {
        if (shouldRouteToResetPassword()) {
          window.location.replace("/reset-password");
          return;
        }
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
          window.localStorage.removeItem(SESSION_NONCE_STORAGE);
        }
        clearAuthUser();
      }
    });

    const { data: subscription } = sb.auth.onAuthStateChange(
      (event, session) => {
        persistActiveProject();
        if (session?.user) {
          if (shouldRouteToResetPassword(event)) {
            window.location.replace("/reset-password");
            return;
          }
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
            window.localStorage.removeItem(SESSION_NONCE_STORAGE);
          }
          clearAuthUser();
        }
      }
    );

    const planRefreshTimer = window.setInterval(() => {
      const user = useProjectStore.getState().authUser;
      if (!user?.id) {
        return;
      }
      void syncProfilePlan(user.id);
    }, 30_000);

    return () => {
      stopSingleSessionGuard();
      window.clearInterval(planRefreshTimer);
      subscription.subscription.unsubscribe();
    };
  }, [setAuthUser, clearAuthUser]);

  return null;
}
