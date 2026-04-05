"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/utils/supabase";
import { useLIFF } from "@/providers/liff-providers";

export default function BrowseRedirect() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useLIFF();

  useEffect(() => {
    if (isLoading) return;
    if (!isLoggedIn) {
      router.replace("/");
      return;
    }

    async function redirect() {
      const supabase = getSupabase();
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        router.replace("/events");
        return;
      }

      // Find user's active event
      const { data: activeEvent } = await supabase
        .from("user_events")
        .select("events(slug, status)")
        .eq("user_id", session.session.user.id)
        .eq("is_active", true)
        .single();

      if (activeEvent?.events && (activeEvent.events as { status: string }).status === "active") {
        router.replace(`/events/${(activeEvent.events as { slug: string }).slug}/browse`);
      } else {
        router.replace("/events");
      }
    }
    redirect();
  }, [isLoading, isLoggedIn, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c4855a]" />
    </div>
  );
}
