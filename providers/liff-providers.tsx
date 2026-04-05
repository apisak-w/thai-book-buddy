"use client";

import { Liff } from "@line/liff";
import { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "../utils/supabase";
import { env } from "../utils/env";

interface LIFFContextValue {
  liff: Liff | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  needsOnboarding: boolean;
  liffError: string | null;
  authError: string | null;
  logout: () => void;
  skipOnboarding: () => void;
  completeProfile: (age: string, gender: string) => Promise<string | null>;
}

const LIFFContext = createContext<LIFFContextValue>({
  liff: null,
  isLoading: true,
  isLoggedIn: false,
  needsOnboarding: false,
  liffError: null,
  authError: null,
  logout: () => {},
  skipOnboarding: () => {},
  completeProfile: async () => null,
});

const ONBOARDING_KEY = "onboarding_complete";

function withTimeout<T>(promise: PromiseLike<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

async function signInWithLINE(
  liff: Liff
): Promise<{ error: string | null; needsOnboarding: boolean }> {
  const supabase = getSupabase();

  // Fast path: reuse existing valid session
  const { data: { session } } = await withTimeout(
    supabase.auth.getSession(),
    10_000,
    "Session check timed out. Please try again."
  );
  if (session) {
    const { data: profile } = await withTimeout(
      supabase.from("profiles").select("age, gender").eq("id", session.user.id).single(),
      10_000,
      "Profile fetch timed out. Please try again."
    ).catch(() => ({ data: null }));
    const needsOnboarding = !profile?.age || !profile?.gender;
    if (needsOnboarding) {
      localStorage.removeItem(ONBOARDING_KEY);
      // Re-create profile row only if it was deleted (profile fetch returned null)
      if (!profile) {
        const meta = session.user.user_metadata ?? {};
        supabase.from("profiles").upsert(
          { id: session.user.id, display_name: meta.display_name ?? null },
          { onConflict: "id", ignoreDuplicates: true }
        ).then(({ error }) => { if (error) console.error("[DB] Profile re-create failed:", error.message); });
      }
    } else {
      localStorage.setItem(ONBOARDING_KEY, "true");
    }
    return { error: null, needsOnboarding };
  }

  // Slow path: full edge function + verifyOtp flow
  const accessToken = liff.getAccessToken();
  if (!accessToken) {
    return {
      error: "No accessToken from LIFF — check that the LIFF app is properly initialized",
      needsOnboarding: false,
    };
  }

  // Skip onboarding check if already cached
  const onboardingCached = localStorage.getItem(ONBOARDING_KEY) === "true";

  // Step 1: Edge Function — verify LINE token + get profile
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/auth-line`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ accessToken }),
        signal: controller.signal,
      }
    );
    clearTimeout(fetchTimeout);
  } catch (err) {
    clearTimeout(fetchTimeout);
    const msg =
      err instanceof DOMException && err.name === "AbortError"
        ? "Request timed out. Please try again."
        : `Fetch failed: ${String(err)}`;
    return { error: msg, needsOnboarding: false };
  }

  const edgeData = await res.json();
  if (!res.ok) {
    return {
      error: `Edge function error (${res.status}): ${JSON.stringify(edgeData)}`,
      needsOnboarding: false,
    };
  }

  const { token_hash, display_name } = edgeData;

  // Step 2: Exchange token hash for Supabase session
  const { data, error } = await withTimeout(
    supabase.auth.verifyOtp({ token_hash, type: "email" }),
    10_000,
    "Authentication timed out. Please try again."
  ).catch((err) => ({ data: { user: null }, error: err as Error }));
  if (error || !data.user) {
    return {
      error: `verifyOtp failed: ${error?.message ?? "no user returned"}`,
      needsOnboarding: false,
    };
  }

  // Step 3: Upsert profile (ignoreDuplicates: true so existing profiles aren't overwritten)
  // + optionally check onboarding — run in parallel
  const upsertPromise = supabase.from("profiles").upsert(
    { id: data.user.id, display_name },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (onboardingCached) {
    // Don't wait for profile check — fire upsert and return immediately
    upsertPromise.then(({ error }) => { if (error) console.error("[DB] Profile upsert failed:", error.message); });
    return { error: null, needsOnboarding: false };
  }

  const [{ error: upsertError }, { data: profile }] = await Promise.all([
    upsertPromise,
    supabase.from("profiles").select("age, gender").eq("id", data.user.id).single(),
  ]);

  if (upsertError) {
    return { error: `Profile upsert failed: ${upsertError.message}`, needsOnboarding: false };
  }

  const needsOnboarding = !profile?.age || !profile?.gender;
  if (!needsOnboarding) localStorage.setItem(ONBOARDING_KEY, "true");

  return { error: null, needsOnboarding };
}

function LIFFProvider({ children }: { children: React.ReactNode }) {
  const [liffObject, setLiffObject] = useState<Liff | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Dev bypass: skip LIFF, create a real Supabase session with a test user
    if (process.env.NODE_ENV === "development" && env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") {
      const supabase = getSupabase();
      const devEmail = "dev@localhost.test";
      const devPassword = "dev-password-123";
      (async () => {
        // Try to sign in first, sign up if user doesn't exist
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: devEmail,
          password: devPassword,
        });
        if (signInError) {
          await supabase.auth.signUp({ email: devEmail, password: devPassword });
          await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword });
        }
        // Ensure profile exists
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          await supabase.from("profiles").upsert({
            id: session.session.user.id,
            display_name: "Dev User",
            age: "25_34",
            gender: "other",
          });
        }
        setIsLoggedIn(true);
        setIsLoading(false);
      })();
      return;
    }

    import("@line/liff")
      .then((liff) => liff.default)
      .catch((err: Error) => {
        setLiffError(`Failed to load LIFF: ${err.message}`);
        setIsLoading(false);
        return null;
      })
      .then((liff) => {
        if (!liff) return;
        const initTimeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Connection timed out. Please reload and try again.")),
            10_000
          )
        );
        Promise.race([liff.init({ liffId: env.NEXT_PUBLIC_LIFF_ID }), initTimeout])
          .then(async () => {
            setLiffObject(liff);
            setIsLoggedIn(liff.isLoggedIn());

            if (liff.isLoggedIn()) {
              const { error, needsOnboarding } = await signInWithLINE(liff);
              if (error) {
                console.error("[Auth error]", error);
                setAuthError(error);
                liff.logout();
                setIsLoggedIn(false);
              }
              setNeedsOnboarding(needsOnboarding);
            }
          })
          .catch((error: Error) => {
            console.error("[LIFF init error]", error);
            setLiffError(error.toString());
          })
          .finally(() => {
            setIsLoading(false);
          });
      });
  }, []);

  function logout() {
    liffObject?.logout();
    localStorage.removeItem(ONBOARDING_KEY);
    setIsLoggedIn(false);
    setNeedsOnboarding(false);
  }

  function skipOnboarding() {
    setNeedsOnboarding(false);
  }

  async function completeProfile(age: string, gender: string): Promise<string | null> {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not logged in";

    const { error } = await supabase.from("profiles").upsert(
      { id: user.id, age, gender },
      { onConflict: "id", ignoreDuplicates: false }
    );
    if (error) return error.message;

    localStorage.setItem(ONBOARDING_KEY, "true");
    setNeedsOnboarding(false);
    return null;
  }

  const value: LIFFContextValue = {
    liff: liffObject,
    isLoading,
    isLoggedIn,
    needsOnboarding,
    liffError,
    authError,
    logout,
    skipOnboarding,
    completeProfile,
  };
  return <LIFFContext.Provider value={value}>{children}</LIFFContext.Provider>;
}

function useLIFF(): LIFFContextValue {
  const liff = useContext(LIFFContext);
  if (!liff) throw new Error("useLIFF must be used within a LIFFProvider");
  return liff;
}

export { LIFFProvider, useLIFF };
