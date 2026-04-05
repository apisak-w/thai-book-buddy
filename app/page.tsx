"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLIFF } from "../providers/liff-providers";
import OnboardingForm from "../components/OnboardingForm";
import { getSupabase } from "../utils/supabase";

export default function Home() {
  const { liff, liffError, authError, isLoading, isLoggedIn, needsOnboarding } = useLIFF();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn && !needsOnboarding) {
      (async () => {
        const supabase = getSupabase();
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: activeUserEvent } = await supabase
            .from("user_events")
            .select("events(slug, status)")
            .eq("user_id", session.session.user.id)
            .eq("is_active", true)
            .single();

          if (activeUserEvent?.events && (activeUserEvent.events as { status: string }).status === "active") {
            router.replace(`/events/${(activeUserEvent.events as { slug: string }).slug}/browse`);
          } else {
            router.replace("/events");
          }
        } else {
          router.replace("/events");
        }
      })();
    }
  }, [isLoading, isLoggedIn, needsOnboarding, router]);

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#fafaf8] overflow-hidden justify-between pt-[188px]">

      {/* Logo + Title */}
      <div className="flex flex-col gap-[48px] items-center shrink-0">
        <img
          src="/mascot.png"
          alt="BookFair Buddy mascot"
          className="size-[180px] rounded-[40px] object-cover shrink-0"
        />
        <div className="flex flex-col gap-[8px] items-center leading-normal">
          <p className="font-[family-name:var(--font-jakarta)] font-extrabold text-[40px] text-[#8fad7a] whitespace-nowrap">
            BookFair Buddy
          </p>
          <p className="font-[family-name:var(--font-sarabun)] font-light text-[24px] text-[#973c00] whitespace-nowrap">
            เพื่อนช่วยป้ายยาหนังสือ
          </p>
        </div>
      </div>

      {/* Button */}
      <div className="shrink-0 px-[16px] pt-[12px]" style={{ paddingBottom: "calc(32px + var(--sab))" }}>
        {isLoading && (
          <div className="flex h-[56px] w-full items-center justify-center rounded-[16px] bg-[#c4855a]/20">
            <p className="font-[family-name:var(--font-jakarta)] font-medium text-[#c4855a] text-[20px] whitespace-nowrap">Loading...</p>
          </div>
        )}
        {(liffError || authError) && (
          <div className="mb-[12px] px-[16px] py-[12px] rounded-[12px] bg-red-50 border border-red-200 flex flex-col gap-[8px]">
            <p className="font-[family-name:var(--font-sarabun)] font-light text-[13px] text-red-600 text-center leading-relaxed">
              มีบางอย่างผิดพลาด กรุณาลองใหม่อีกครั้ง
            </p>
            <button
              onClick={() => window.location.reload()}
              className="font-[family-name:var(--font-jakarta)] font-medium text-[14px] text-red-600 underline text-center"
            >
              Try again
            </button>
          </div>
        )}
        {liff && !isLoggedIn && (
          <button
            onClick={() => (liff.login as (config?: { redirectUri?: string; botPrompt?: string }) => void)({ botPrompt: "normal" })}
            className="flex h-[56px] w-full items-center justify-center rounded-[16px] bg-[#c4855a] shadow-[2px_2px_0px_0px_#e0d0c0] active:scale-95 transition-all"
          >
            <span className="font-[family-name:var(--font-jakarta)] font-medium text-[20px] text-[#fafaf8] leading-normal whitespace-nowrap">
              Login with LINE
            </span>
          </button>
        )}
      </div>

      {isLoggedIn && needsOnboarding && <OnboardingForm />}
    </div>
  );
}
