"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, HandHeart } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "../../utils/supabase";
import { useLIFF } from "../../providers/liff-providers";
import PublisherCard from "../../components/PublisherCard";
import BottomNav from "../../components/BottomNav";
import BrandHeader from "../../components/BrandHeader";
import LoadingScreen from "../../components/LoadingScreen";
import ErrorScreen from "../../components/ErrorScreen";
import SearchBar from "../../components/SearchBar";
import BookFairReminderModal from "../../components/BookFairReminderModal";
import type { Publisher } from "../../types";

export default function BrowsePage() {
  const { isLoggedIn, isLoading: authLoading } = useLIFF();
  const router = useRouter();

  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeZone, setActiveZone] = useState<string>("ทั้งหมด");
  const [pubsLoaded, setPubsLoaded] = useState(false);
  const [pubsError, setPubsError] = useState(false);
  const [pubsRetryKey, setPubsRetryKey] = useState(0);
  const [userLoaded, setUserLoaded] = useState(false);
  const [bookCounts, setBookCounts] = useState<Map<string, number>>(new Map());
  const [confirmPublisherId, setConfirmPublisherId] = useState<string | null>(null);
  const togglingRef = useRef<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const [showDonateBanner, setShowDonateBanner] = useState(
    () => process.env.NEXT_PUBLIC_DONATE_BANNER_ENABLED === "true" &&
          typeof window !== "undefined" && !sessionStorage.getItem("donate_banner_dismissed")
  );

  const [showReminder, setShowReminder] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("bookfair_reminder_dismissed")
  );

  const isPreview = typeof window !== "undefined" && window.location.search.includes("preview=1");

  useEffect(() => {
    if (isPreview) return;
    if (!authLoading && !isLoggedIn) router.replace("/");
  }, [authLoading, isLoggedIn, router, isPreview]);

  useEffect(() => {
    if (isPreview) {
      setPublishers([
        { id: "mock-1", name_th: "สำนักพิมพ์แสงดาว", name_en: "Sangdao Publishing", booths: [{ zone: "A", booth_number: "A01" }] },
        { id: "mock-2", name_th: "นานมีบุ๊คส์", name_en: "Nanmeebooks", booths: [{ zone: "B", booth_number: "B12" }] },
        { id: "mock-3", name_th: "อมรินทร์", name_en: "Amarin", booths: [{ zone: "C", booth_number: "C05" }] },
        { id: "mock-4", name_th: "มติชน", name_en: "Matichon", booths: [{ zone: "D", booth_number: "D08" }] },
        { id: "mock-5", name_th: "บ้านพระอาทิตย์", name_en: "Baan Phra Arthit", booths: [{ zone: "E", booth_number: "E03" }] },
      ]);
      setUserId("preview-user");
      setSelectedIds(new Set(["mock-1", "mock-3"]));
      setPubsLoaded(true);
      setUserLoaded(true);
      return;
    }

    const CACHE_KEY = "publishers_cache";
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour

    async function loadPublishers() {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            setPublishers(data);
            setPubsLoaded(true);
            return; // cache is fresh — skip network fetch
          }
        } catch {
          localStorage.removeItem(CACHE_KEY);
        }
      }
      try {
        const res = await fetch("/api/publishers");
        if (!res.ok) throw new Error("fetch failed");
        const pubs = await res.json();
        setPublishers(pubs as Publisher[]);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: pubs, ts: Date.now() }));
      } catch {
        setPubsError(true);
      }
      setPubsLoaded(true);
    }
    loadPublishers();
  }, [pubsRetryKey]);

  useEffect(() => {
    if (isPreview || !isLoggedIn) return;
    async function loadUserData() {
      try {
        const supabase = getSupabase();
        const [{ data: { session } }, { data: sels }, { data: counts }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from("user_selections").select("publisher_id"),
          supabase.rpc("get_my_book_counts"),
        ]);
        if (session?.user) setUserId(session.user.id);
        if (sels) setSelectedIds(new Set(sels.map((s: { publisher_id: string }) => s.publisher_id)));
        if (counts) {
          const map = new Map<string, number>();
          for (const c of counts as { publisher_id: string; count: number }[]) {
            map.set(c.publisher_id, Number(c.count));
          }
          setBookCounts(map);
        }
      } catch {
        // Non-critical: list still works, user just won't see their selections
      }
      setUserLoaded(true);
    }
    loadUserData();
  }, [isLoggedIn]);

  const categories = useMemo(() => {
    const set = new Set(publishers.flatMap((p) => p.category ?? []));
    const sorted = Array.from(set).sort((a, b) => {
      if (a.includes("Non-book")) return 1;
      if (b.includes("Non-book")) return -1;
      return a.localeCompare(b, "th");
    });
    return ["ทั้งหมด", ...sorted];
  }, [publishers]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const qNorm = q.replace(/\s+/g, "");
    return publishers.filter((p) => {
      const nameTh = p.name_th.toLowerCase();
      const nameEn = (p.name_en ?? "").toLowerCase();
      const boothNumbers = (p.booths ?? []).map((b) => b.booth_number.toLowerCase());
      const matchSearch =
        !q ||
        nameTh.includes(q) ||
        nameEn.includes(q) ||
        (qNorm && nameTh.replace(/\s+/g, "").includes(qNorm)) ||
        (qNorm && nameEn.replace(/\s+/g, "").includes(qNorm)) ||
        boothNumbers.some((bn) => bn.includes(q));
      const matchCategory =
        q || activeZone === "ทั้งหมด" || p.category?.includes(activeZone);
      return matchSearch && matchCategory;
    });
  }, [publishers, debouncedSearch, activeZone]);

  const totalBooths = useMemo(
    () => publishers.reduce((sum, p) => sum + (p.booths?.length ?? 0), 0),
    [publishers]
  );

  const doRemoveOrAdd = useCallback(async (publisherId: string, isSelected: boolean) => {
    togglingRef.current.add(publisherId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      isSelected ? next.delete(publisherId) : next.add(publisherId);
      return next;
    });
    if (!isSelected) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast("เพิ่มในรายการแล้ว");
      toastTimer.current = setTimeout(() => setToast(null), 2500);
    }
    const supabase = getSupabase();
    if (isSelected) {
      await Promise.all([
        supabase.from("user_selections").delete()
          .eq("user_id", userId!).eq("publisher_id", publisherId),
        supabase.from("user_books").delete()
          .eq("user_id", userId!).eq("publisher_id", publisherId),
      ]);
    } else {
      await supabase.from("user_selections").insert({ user_id: userId!, publisher_id: publisherId });
    }
    togglingRef.current.delete(publisherId);
  }, [userId]); // toastTimer is a stable ref — intentionally not listed

  const handleToggle = useCallback(async (publisherId: string) => {
    if (!userId || togglingRef.current.has(publisherId)) return;
    const isSelected = selectedIds.has(publisherId);
    if (isSelected && (bookCounts.get(publisherId) ?? 0) > 0) {
      setConfirmPublisherId(publisherId);
      return;
    }
    await doRemoveOrAdd(publisherId, isSelected);
  }, [userId, selectedIds, bookCounts, doRemoveOrAdd]);

  if (!pubsLoaded) return <LoadingScreen />;
  if (pubsError) return <ErrorScreen onRetry={() => { setPubsError(false); setPubsLoaded(false); setPubsRetryKey((k) => k + 1); }} />;

  return (
    <div className="relative flex flex-col w-full h-[100dvh] bg-[#fafaf8]">
      {/* Scrollable area — header scrolls away, search stays sticky */}
      <div className="flex-1 overflow-y-auto">
        {/* Header — scrolls away */}
        <div className="px-[16px] pt-[24px]">
          <BrandHeader />
        </div>

        {/* Sticky search + filter */}
        <div className="sticky top-0 z-10 bg-[#fafaf8]">
          {/* Search */}
          <div className="px-[16px] py-[12px]">
            <SearchBar onSearch={setDebouncedSearch} placeholder="ค้นหาสำนักพิมพ์..." />
          </div>

          {/* Category filter */}
          <div className="flex gap-[8px] px-[16px] pb-[12px] overflow-x-auto no-scrollbar">
            {categories.map((cat) => {
              const active = activeZone === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveZone(cat)}
                  className={`shrink-0 px-[12px] py-[4px] rounded-[20px] text-[14px] font-[family-name:var(--font-sarabun)] transition-all ${
                    active
                      ? "bg-[#c4855a] text-[#fafaf8] font-semibold"
                      : "bg-[#fff8ee] border border-[#f0e4d4] text-[#9c7a5b] font-light"
                  }`}
                >
                  {cat.replace("โซน", "").trim()}
                </button>
              );
            })}
          </div>

          {/* Count row */}
          <div className="flex items-center justify-between px-[16px] pb-[12px]">
          <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#6a7282]">
            {filtered.length} สำนักพิมพ์
            {!userLoaded && isLoggedIn && (
              <span className="ml-[8px] inline-flex items-center gap-[3px] translate-y-[1px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block size-[4px] rounded-full bg-[#9c7a5b]"
                    style={{ animation: `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </span>
            )}
          </p>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-[4px]">
              <Bookmark size={20} color="#6a7282" strokeWidth={1.8} />
              <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#6a7282]">
                {selectedIds.size} รายการ
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Donate banner */}
        {showDonateBanner && (
          <a
            href="https://www.buymeacoffee.com/mangporh"
            target="_blank"
            rel="noopener noreferrer"
            className="block mx-[16px] mb-[8px] bg-[#fff8ee] border border-[#c4855a] rounded-[16px] p-[12px] shadow-[4px_4px_30px_0px_rgba(196,133,90,0.2)]"
            onClick={() => {
              sessionStorage.setItem("donate_banner_dismissed", "1");
              setShowDonateBanner(false);
            }}
          >
            <div className="flex items-center gap-[8px]">
              <HandHeart size={24} color="#DEA0A0" strokeWidth={1.5} />
              <p className="font-[family-name:var(--font-sarabun)] text-[16px] text-[#973c00]">
                สนับสนุน BookFair Buddy
              </p>
            </div>
          </a>
        )}

        {/* List */}
        <div className="flex flex-col gap-[16px] px-[16px] pb-[16px]">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="font-[family-name:var(--font-sarabun)] text-[#9c7a5b] text-[15px]">ไม่พบสำนักพิมพ์</p>
            </div>
          ) : (
            filtered.map((p) => (
              <PublisherCard
                key={p.id}
                publisher={p}
                selected={selectedIds.has(p.id)}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed left-[16px] right-[16px] bottom-[84px] z-20 animate-[toast-in_0.25s_ease-out]">
          <div className="flex items-center gap-[12px] h-[61px] px-[16px] bg-[#f0e4d4] border border-[#c4855a] rounded-[8px]">
            <div className="shrink-0 size-[20px] rounded-full bg-[#c4855a] flex items-center justify-center">
              <Check size={12} color="white" strokeWidth={3} />
            </div>
            <p className="font-[family-name:var(--font-sarabun)] text-[16px] text-[#3d2b1a] flex-1">{toast}</p>
            <Link href="/my-list" onClick={() => setToast(null)} className="shrink-0">
              <span className="font-[family-name:var(--font-sarabun)] font-medium text-[16px] text-[#973c00]">
                ดูรายการ
              </span>
            </Link>
          </div>
        </div>
      )}

      {confirmPublisherId && (() => {
        const pub = publishers.find((p) => p.id === confirmPublisherId);
        const count = bookCounts.get(confirmPublisherId) ?? 0;
        return (
          <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/40" onClick={() => setConfirmPublisherId(null)}>
            <div className="w-full bg-[#fafaf8] rounded-t-[24px] p-[24px] flex flex-col gap-[16px]" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-[8px]">
                <p className="font-[family-name:var(--font-sarabun)] font-semibold text-[18px] text-[#3d2b1a]">
                  ลบสำนักพิมพ์นี้?
                </p>
                <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#6a7282]">
                  {pub?.name_th} มีหนังสือในรายการ {count} เล่ม หากลบสำนักพิมพ์นี้ หนังสือทั้งหมดจะถูกลบออกด้วย
                </p>
              </div>
              <div className="flex gap-[8px]">
                <button
                  onClick={async () => {
                    const id = confirmPublisherId;
                    setConfirmPublisherId(null);
                    await doRemoveOrAdd(id, true);
                  }}
                  className="flex-1 h-[48px] rounded-[12px] bg-[#c4855a] font-[family-name:var(--font-sarabun)] text-[16px] text-white"
                >
                  ลบออก
                </button>
                <button
                  onClick={() => setConfirmPublisherId(null)}
                  className="flex-1 h-[48px] rounded-[12px] border border-[#e2c9a6] bg-[#fafaf8] font-[family-name:var(--font-sarabun)] text-[16px] text-[#c4855a]"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav />
      <BookFairReminderModal isOpen={showReminder} onClose={() => setShowReminder(false)} />
    </div>
  );
}
