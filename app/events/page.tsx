"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSupabase } from "@/utils/supabase";
import { useLIFF } from "@/providers/liff-providers";
import BrandHeader from "@/components/BrandHeader";
import BottomNav from "@/components/BottomNav";
import type { Event } from "@/types/events";

export default function EventsPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = useLIFF();
  const [events, setEvents] = useState<Event[]>([]);
  const [myEventIds, setMyEventIds] = useState<Set<string>>(new Set());
  const [activeEventSlug, setActiveEventSlug] = useState<string | undefined>();
  const [tab, setTab] = useState<"my" | "all">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.replace("/");
      return;
    }

    async function loadData() {
      try {
        const res = await fetch("/api/events");
        const allEvents: Event[] = await res.json();
        setEvents(allEvents);

        const supabase = getSupabase();
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: userEvents } = await supabase
            .from("user_events")
            .select("event_id, is_active")
            .eq("user_id", session.session.user.id);

          if (userEvents) {
            setMyEventIds(new Set(userEvents.map((ue) => ue.event_id)));
            if (userEvents.length > 0) {
              setTab("my");
            }
            // Find the active event slug for BottomNav
            const activeUe = userEvents.find((ue) => ue.is_active);
            if (activeUe) {
              const activeEvt = allEvents.find((e) => e.id === activeUe.event_id);
              if (activeEvt) setActiveEventSlug(activeEvt.slug);
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [authLoading, isLoggedIn, router]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c4855a]" />
      </div>
    );
  }

  const now = new Date();
  const categorize = (e: Event) => {
    if (e.status === "archived") return "past";
    const start = new Date(e.start_date);
    const end = new Date(e.end_date);
    if (now >= start && now <= end) return "happening";
    if (now < start) return "upcoming";
    return "past";
  };

  const filtered =
    tab === "my" ? events.filter((e) => myEventIds.has(e.id)) : events;
  const happening = filtered.filter((e) => categorize(e) === "happening");
  const upcoming = filtered.filter((e) => categorize(e) === "upcoming");
  const past = filtered.filter((e) => categorize(e) === "past");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const EventCard = ({ event }: { event: Event }) => (
    <button
      onClick={() => router.push(`/events/${event.slug}/browse`)}
      className="w-full text-left bg-white border border-[#f0e4d4] rounded-[16px] p-[24px] flex items-center gap-[16px] cursor-pointer active:opacity-80 transition-opacity"
    >
      <div className="flex-1 min-w-0">
        <p className="font-[family-name:var(--font-sarabun)] font-medium text-[16px] text-[#3d2b1a] leading-snug">
          {event.name_th}
        </p>
        {event.name_en && (
          <p className="font-[family-name:var(--font-jakarta)] font-light text-[12px] text-[#3d2b1a] mt-[4px] leading-snug">
            {event.name_en}
          </p>
        )}
        <p className="font-[family-name:var(--font-sarabun)] font-light text-[12px] text-[#9c7a5b] mt-[12px]">
          {formatDate(event.start_date)} - {formatDate(event.end_date)}
        </p>
        {event.location_th && (
          <p className="font-[family-name:var(--font-sarabun)] font-light text-[12px] text-[#9c7a5b] mt-[4px]">
            {event.location_th}
          </p>
        )}
        {myEventIds.has(event.id) && (
          <div className="inline-flex self-start items-center px-[12px] py-[4px] rounded-[20px] bg-[#fff8ee] mt-[12px]">
            <span className="font-[family-name:var(--font-sarabun)] font-light text-[12px] text-[#9c7a5b] whitespace-nowrap">
              เข้าร่วมแล้ว
            </span>
          </div>
        )}
      </div>
      <ChevronRight size={20} color="#9c7a5b" strokeWidth={1.5} className="shrink-0" />
    </button>
  );

  const Section = ({ title, items }: { title: string; items: Event[] }) =>
    items.length > 0 ? (
      <div className="mb-[16px]">
        <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#9c7a5b] mb-[8px]">
          {title}
        </p>
        <div className="flex flex-col gap-[16px]">
          {items.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="relative flex flex-col w-full h-[100dvh] bg-[#fafaf8]">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-[16px] pt-[24px]">
          <BrandHeader />
          <p className="font-[family-name:var(--font-sarabun)] font-semibold text-[32px] text-[#3d2b1a] leading-tight mt-[8px]">
            งานหนังสือ
          </p>
          <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#9c7a5b] mt-[4px]">
            เลือกงานที่ต้องการเข้าร่วม
          </p>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 bg-[#fafaf8]">
          <div className="flex gap-[8px] px-[16px] py-[12px]">
            {(["my", "all"] as const).map((t) => {
              const active = tab === t;
              const label = t === "my" ? "งานของฉัน" : "ทั้งหมด";
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`shrink-0 px-[12px] py-[4px] rounded-[20px] text-[14px] font-[family-name:var(--font-sarabun)] transition-all ${
                    active
                      ? "bg-[#c4855a] text-[#fafaf8] font-semibold"
                      : "bg-[#fff8ee] border border-[#f0e4d4] text-[#9c7a5b] font-light"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-[16px] pb-[16px]">
          {tab === "my" && myEventIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-[48px]">
              <p className="font-[family-name:var(--font-sarabun)] text-[15px] text-[#9c7a5b]">
                ยังไม่ได้เข้าร่วมงานหนังสือ
              </p>
              <button
                onClick={() => setTab("all")}
                className="mt-[12px] font-[family-name:var(--font-sarabun)] font-medium text-[16px] text-[#c4855a]"
              >
                ดูงานทั้งหมด
              </button>
            </div>
          ) : (
            <>
              <Section title="กำลังจัดอยู่" items={happening} />
              <Section title="กำลังจะมาถึง" items={upcoming} />
              <Section title="จบแล้ว" items={past} />
            </>
          )}
        </div>
      </div>

      <BottomNav eventSlug={activeEventSlug} />
    </div>
  );
}
