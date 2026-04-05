"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/utils/supabase";
import { useLIFF } from "@/providers/liff-providers";
import type { Event } from "@/types/events";

export default function EventsPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = useLIFF();
  const [events, setEvents] = useState<Event[]>([]);
  const [myEventIds, setMyEventIds] = useState<Set<string>>(new Set());
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
        // Fetch all events
        const res = await fetch("/api/events");
        const allEvents: Event[] = await res.json();
        setEvents(allEvents);

        // Fetch user's events
        const supabase = getSupabase();
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: userEvents } = await supabase
            .from("user_events")
            .select("event_id")
            .eq("user_id", session.session.user.id);

          if (userEvents) {
            setMyEventIds(new Set(userEvents.map((ue) => ue.event_id)));
            if (userEvents.length > 0) {
              setTab("my");
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
      className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-[#e8dfd5] hover:border-[#c4855a] transition-colors"
    >
      <h3 className="font-bold text-[#44240B] text-lg leading-snug">
        {event.name_th}
      </h3>
      {event.name_en && (
        <p className="text-sm text-[#8B7355] mt-0.5">{event.name_en}</p>
      )}
      <p className="text-sm text-[#8B7355] mt-2">
        {formatDate(event.start_date)} - {formatDate(event.end_date)}
      </p>
      {event.location_th && (
        <p className="text-sm text-[#8B7355] mt-1">{event.location_th}</p>
      )}
      {myEventIds.has(event.id) && (
        <span className="inline-block mt-2 text-xs bg-[#c4855a]/10 text-[#c4855a] px-2 py-0.5 rounded-full">
          เข้าร่วมแล้ว
        </span>
      )}
    </button>
  );

  const Section = ({ title, items }: { title: string; items: Event[] }) =>
    items.length > 0 ? (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[#8B7355] uppercase tracking-wide mb-3">
          {title}
        </h2>
        <div className="space-y-3">
          {items.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[#FBF6F0] pb-8">
      <div className="sticky top-0 bg-[#FBF6F0] z-10 px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-[#44240B] font-serif">
          งานหนังสือ
        </h1>
        <p className="text-sm text-[#8B7355] mt-1">เลือกงานที่ต้องการเข้าร่วม</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setTab("my")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "my"
                ? "bg-[#44240B] text-white"
                : "bg-white text-[#44240B] border border-[#e8dfd5]"
            }`}
          >
            งานของฉัน
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === "all"
                ? "bg-[#44240B] text-white"
                : "bg-white text-[#44240B] border border-[#e8dfd5]"
            }`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      <div className="px-4 mt-4">
        {tab === "my" && myEventIds.size === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8B7355]">ยังไม่ได้เข้าร่วมงานหนังสือ</p>
            <button
              onClick={() => setTab("all")}
              className="mt-3 text-[#c4855a] font-medium"
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
  );
}
