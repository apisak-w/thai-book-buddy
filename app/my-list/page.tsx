"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, HandHeart, Share2 } from "lucide-react";
import ShareCard from "../../components/ShareCard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "../../utils/supabase";
import { useLIFF } from "../../providers/liff-providers";
import BrandHeader from "../../components/BrandHeader";
import BottomNav from "../../components/BottomNav";
import LoadingScreen from "../../components/LoadingScreen";
import ErrorScreen from "../../components/ErrorScreen";
import SearchBar from "../../components/SearchBar";
import PublisherListItem from "../../components/PublisherListItem";
import type { Publisher, Book } from "../../types";
import { env } from "@/utils/env";

export default function MyListPage() {
  const { isLoggedIn, isLoading: authLoading } = useLIFF();
  const router = useRouter();

  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; onUndo: (() => void) | null } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAction = useRef<(() => Promise<void>) | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const [notesByPublisher, setNotesByPublisher] = useState<Map<string, string>>(new Map());
  const [showDonateBanner, setShowDonateBanner] = useState(
    () => env.NEXT_PUBLIC_DONATE_BANNER_ENABLED === "true" &&
          typeof window !== "undefined" && !sessionStorage.getItem("donate_banner_dismissed")
  );
  const [shareStats, setShareStats] = useState<{ purchasedCount: number; percentile: number; totalSpent: number; boothCount: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      // Commit any pending deletion immediately when navigating away
      if (pendingAction.current) { pendingAction.current(); pendingAction.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    function handleTap(e: MouseEvent | TouchEvent) {
      if (toastRef.current?.contains(e.target as Node)) return;
      commitPending();
    }
    document.addEventListener("mousedown", handleTap);
    document.addEventListener("touchstart", handleTap);
    return () => {
      document.removeEventListener("mousedown", handleTap);
      document.removeEventListener("touchstart", handleTap);
    };
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.replace("/");
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Dev bypass: use mock data to preview UI without a Supabase session
    if (process.env.NODE_ENV === "development" && env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") {
      setUserId("dev-user");
      setPublishers([
        { id: "p1", name_th: "สำนักพิมพ์แสงดาว", name_en: "Sangdao Publishing", booths: [{ zone: "A", booth_number: "A01" }] },
        { id: "p2", name_th: "นานมีบุ๊คส์", name_en: "Nanmeebooks", booths: [{ zone: "B", booth_number: "B12" }] },
        { id: "p3", name_th: "อมรินทร์", name_en: "Amarin", booths: [{ zone: "C", booth_number: "C05" }] },
      ]);
      setBooks([
        { id: "b1", publisher_id: "p1", title: "ดินแดนแห่งความฝัน", price: 280, is_purchased: false },
        { id: "b2", publisher_id: "p1", title: "มหาสมุทรและหุบเขาเล็กๆ", price: 320, is_purchased: true },
        { id: "b3", publisher_id: "p2", title: "Harry Potter", price: 450, is_purchased: false },
      ]);
      setNotesByPublisher(new Map([["p2", "อยากได้เล่ม special edition ถ้ามี"]]));
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const supabase = getSupabase();
        const [{ data: { session } }, { data: sels, error: selsError }, { data: bookData, error: bookError }] = await Promise.all([
          supabase.auth.getSession(),
          supabase
            .from("user_selections")
            .select("publisher_id, note, publishers(id, name_th, name_en, booths(zone, booth_number))")
            .order("created_at"),
          supabase.from("user_books").select("id, publisher_id, title, price, is_purchased").order("created_at"),
        ]);
        if (selsError) throw selsError;
        if (bookError) throw bookError;
        if (session?.user) setUserId(session.user.id);
        if (sels) {
          setPublishers(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sels.map((s: any) => Array.isArray(s.publishers) ? s.publishers[0] : s.publishers).filter(Boolean) as Publisher[]).sort((a, b) => a.name_th.localeCompare(b.name_th, "th"))
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const notesMap = new Map<string, string>(sels.filter((s: any) => s.note).map((s: any) => [s.publisher_id, s.note]));
          setNotesByPublisher(notesMap);
        }
        if (bookData) setBooks(bookData as Book[]);
      } catch {
        setLoadError(true);
      }
      setLoading(false);
    }
    load();
  }, [isLoggedIn, retryKey]);

  const totalBudget = useMemo(() => books.reduce((sum, b) => sum + (b.price ?? 0), 0), [books]);

  const filteredPublishers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return publishers;
    return publishers.filter(
      (p) => p.name_th.toLowerCase().includes(q) || (p.name_en ?? "").toLowerCase().includes(q)
    );
  }, [publishers, debouncedSearch]);

  const booksByPublisher = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const b of books) {
      const list = map.get(b.publisher_id) ?? [];
      list.push(b);
      map.set(b.publisher_id, list);
    }
    return map;
  }, [books]);

  function toggleExpand(publisherId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(publisherId) ? next.delete(publisherId) : next.add(publisherId);
      return next;
    });
  }

  function cancelPending() {
    if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
    pendingAction.current = null;
    setToast(null);
  }

  function commitPending() {
    if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
    if (pendingAction.current) { pendingAction.current(); pendingAction.current = null; }
    setToast(null);
  }

  function showToast(message: string, onUndo: () => void, action: () => Promise<void>) {
    commitPending();
    pendingAction.current = action;
    setToast({ message, onUndo });
    toastTimer.current = setTimeout(async () => {
      await pendingAction.current?.();
      pendingAction.current = null;
      setToast(null);
    }, 4000);
  }

  function removePublisher(publisherId: string) {
    if (!userId) return;
    const removed = publishers.find((p) => p.id === publisherId);
    if (!removed) return;
    const removedBooks = books.filter((b) => b.publisher_id === publisherId);
    const removedNote = notesByPublisher.get(publisherId);
    setPublishers((prev) => prev.filter((p) => p.id !== publisherId));
    setBooks((prev) => prev.filter((b) => b.publisher_id !== publisherId));
    setNotesByPublisher((prev) => { const next = new Map(prev); next.delete(publisherId); return next; });
    showToast(
      "ลบรายการสำเร็จ",
      () => {
        cancelPending();
        setPublishers((prev) => [...prev, removed].sort((a, b) => a.name_th.localeCompare(b.name_th, "th")));
        setBooks((prev) => [...prev, ...removedBooks]);
        if (removedNote) setNotesByPublisher((prev) => { const next = new Map(prev); next.set(publisherId, removedNote); return next; });
      },
      async () => {
        const supabase = getSupabase();
        await Promise.all([
          supabase.from("user_selections").delete().eq("user_id", userId).eq("publisher_id", publisherId),
          supabase.from("user_books").delete().eq("user_id", userId).eq("publisher_id", publisherId),
        ]);
      }
    );
  }

  function deleteBook(bookId: string) {
    const removed = books.find((b) => b.id === bookId);
    if (!removed) return;
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    showToast(
      "ลบหนังสือสำเร็จ",
      () => {
        cancelPending();
        setBooks((prev) => [...prev, removed]);
      },
      async () => {
        const supabase = getSupabase();
        await supabase.from("user_books").delete().eq("id", bookId);
      }
    );
  }

  async function togglePurchased(book: Book) {
    const updated = !book.is_purchased;
    setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, is_purchased: updated } : b));
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("user_books").update({ is_purchased: updated }).eq("id", book.id);
      if (error) throw error;
      if (updated) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ message: "ซื้อหนังสือแล้ว 🎉", onUndo: null });
        toastTimer.current = setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setBooks((prev) => prev.map((b) => b.id === book.id ? { ...b, is_purchased: !updated } : b));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: "เกิดข้อผิดพลาด กรุณาลองใหม่", onUndo: null });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleBookEdited(bookId: string, title: string, price: number | null) {
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, title, price } : b));
    const supabase = getSupabase();
    await supabase.from("user_books").update({ title, price }).eq("id", bookId);
  }

  async function handleNoteSaved(publisherId: string, note: string | null) {
    setNotesByPublisher((prev) => {
      const next = new Map(prev);
      if (note) next.set(publisherId, note);
      else next.delete(publisherId);
      return next;
    });
    if (!(process.env.NODE_ENV === "development" && env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") && userId) {
      const supabase = getSupabase();
      await supabase.from("user_selections").update({ note }).eq("user_id", userId).eq("publisher_id", publisherId);
    }
  }

  const purchasedCount = useMemo(() => books.filter((b) => b.is_purchased).length, [books]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("get_share_stats");
      if (error || !data || data.length === 0) throw new Error("Failed to load stats");
      const stats = data[0] as { purchased_count: number; percentile: number; total_spent: number; booth_count: number };
      setShareStats({
        purchasedCount: Number(stats.purchased_count),
        percentile: Number(stats.percentile),
        totalSpent: Number(stats.total_spent),
        boothCount: Number(stats.booth_count),
      });
      // Wait for React to render the ShareCard
      await new Promise((resolve) => setTimeout(resolve, 500));
      const html2canvas = (await import("html2canvas")).default;
      if (!shareCardRef.current) throw new Error("Card not rendered");
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 1,
        useCORS: true,
        backgroundColor: "#fafaf8",
        width: 1080,
        height: 1920,
      });
      const link = document.createElement("a");
      link.download = "bookfair-buddy-stats.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: "ไม่สามารถสร้างรูปได้ กรุณาลองใหม่", onUndo: null });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    } finally {
      setSharing(false);
      setShareStats(null);
    }
  }

  if (authLoading || loading) return <LoadingScreen />;
  if (loadError) return <ErrorScreen onRetry={() => { setLoadError(false); setLoading(true); setRetryKey((k) => k + 1); }} />;

  return (
    <div className="relative flex flex-col w-full h-[100dvh] bg-[#fafaf8]">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col gap-[16px] px-[16px] pt-[24px] pb-[12px]">
          {/* Brand */}
          <div className="flex flex-col items-start">
            <BrandHeader />
            <p className="font-[family-name:var(--font-sarabun)] font-semibold text-[32px] text-[#3d2b1a] leading-tight">
              รายการของฉัน
            </p>
          </div>

          {/* Summary card */}
          <div className="bg-[#f3ffeb] border border-[#c4d8b6] rounded-[16px] p-[24px]">
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col gap-[4px] items-center shrink-0">
                <p className="font-[family-name:var(--font-sarabun)] font-light text-[12px] text-[#9c7a5b]">จำนวนบูธ</p>
                <p className="font-[family-name:var(--font-jakarta)] font-extrabold text-[28px] text-[#e2c9a6] leading-none">
                  {publishers.length}
                </p>
              </div>
              <div className="w-px h-[57px] bg-[#c4d8b6] shrink-0" />
              <div className="flex flex-col gap-[4px] items-center shrink-0 w-[64px]">
                <p className="font-[family-name:var(--font-sarabun)] font-light text-[12px] text-[#9c7a5b]">หนังสือ</p>
                <p className="font-[family-name:var(--font-jakarta)] font-extrabold text-[28px] text-[#e2c9a6] leading-none text-center">
                  {books.length}
                </p>
              </div>
              <div className="w-px h-[57px] bg-[#c4d8b6] shrink-0" />
              <div className="flex flex-col gap-[4px] items-center shrink-0">
                <p className="font-[family-name:var(--font-sarabun)] font-light text-[12px] text-[#9c7a5b]">ราคา</p>
                <p className="font-[family-name:var(--font-jakarta)] font-extrabold text-[28px] text-[#c4855a] leading-none">
                  ฿{totalBudget.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          {purchasedCount > 0 && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center justify-center gap-[8px] h-[48px] w-full rounded-[16px] border border-[#e2c9a6] bg-[#fff8ee] active:scale-95 transition-all disabled:opacity-50"
            >
              <Share2 size={18} color="#c4855a" strokeWidth={2} />
              <span className="font-[family-name:var(--font-sarabun)] font-medium text-[16px] text-[#c4855a]">
                {sharing ? "กำลังสร้างรูป..." : "แชร์สถิติของฉัน"}
              </span>
            </button>
          )}
        </div>

        {/* Sticky search + count row */}
        {publishers.length > 0 && (
          <div className="sticky top-0 z-10 bg-[#fafaf8] px-[16px] pt-[12px] pb-[8px] flex flex-col gap-[8px]">
            <SearchBar onSearch={setDebouncedSearch} placeholder="ค้นหาสำนักพิมพ์..." />
            <div className="flex items-center justify-between px-[4px]">
              <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#6a7282]">
                {filteredPublishers.length} สำนักพิมพ์
              </p>
              <button
                onClick={() => {
                  const allExpanded = publishers.every((p) => expanded.has(p.id));
                  setExpanded(allExpanded ? new Set() : new Set(publishers.map((p) => p.id)));
                }}
                className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#9c7a5b] active:opacity-60 transition-opacity"
              >
                {publishers.every((p) => expanded.has(p.id)) ? "ย่อทั้งหมด" : "ขยายทั้งหมด"}
              </button>
            </div>
          </div>
        )}

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

        {/* Publisher list */}
        <div className="flex flex-col gap-[16px] px-[16px] py-[12px]">
          {publishers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-[16px] py-[48px]">
              <p className="font-[family-name:var(--font-sarabun)] text-[#9c7a5b] text-[16px] text-center">
                ยังไม่มีสำนักพิมพ์ในรายการ
              </p>
              <Link
                href="/browse"
                className="flex h-[48px] px-[24px] items-center justify-center rounded-[12px] bg-[#c4855a] shadow-[2px_2px_0px_0px_#e0d0c0]"
              >
                <span className="font-[family-name:var(--font-sarabun)] text-[16px] text-white">
                  ค้นหาสำนักพิมพ์
                </span>
              </Link>
            </div>
          ) : filteredPublishers.length === 0 ? (
            <div className="flex items-center justify-center py-[48px]">
              <p className="font-[family-name:var(--font-sarabun)] text-[#9c7a5b] text-[15px]">ไม่พบสำนักพิมพ์</p>
            </div>
          ) : (
            filteredPublishers.map((publisher) => (
              <PublisherListItem
                key={publisher.id}
                publisher={publisher}
                pubBooks={booksByPublisher.get(publisher.id) ?? []}
                isExpanded={expanded.has(publisher.id)}
                note={notesByPublisher.get(publisher.id)}
                userId={userId}
                onToggleExpand={() => toggleExpand(publisher.id)}
                onRemove={() => removePublisher(publisher.id)}
                onTogglePurchased={togglePurchased}
                onBookAdded={(book) => setBooks((prev) => [...prev, book])}
                onBookDeleted={deleteBook}
                onBookEdited={handleBookEdited}
                onNoteSaved={handleNoteSaved}
              />
            ))
          )}
        </div>
      </div>

      {toast && (
        <div ref={toastRef} className="fixed left-[16px] right-[16px] bottom-[84px] z-20 animate-[toast-in_0.25s_ease-out]">
          <div className="flex items-center justify-between h-[61px] px-[16px] bg-[#f0e4d4] border border-[#c4855a] rounded-[8px]">
            <div className="flex items-center gap-[8px]">
              {toast.onUndo && <Trash2 size={18} color="#973c00" strokeWidth={2} />}
              <p className="font-[family-name:var(--font-sarabun)] text-[16px] text-[#3d2b1a]">{toast.message}</p>
            </div>
            {toast.onUndo && (
              <button onClick={toast.onUndo}>
                <p className="font-[family-name:var(--font-sarabun)] font-medium text-[16px] text-[#973c00]">นำกลับมา</p>
              </button>
            )}
          </div>
        </div>
      )}
      {shareStats && (
        <ShareCard
          ref={shareCardRef}
          purchasedCount={shareStats.purchasedCount}
          percentile={shareStats.percentile}
          totalSpent={shareStats.totalSpent}
          boothCount={shareStats.boothCount}
        />
      )}
      <BottomNav />
    </div>
  );
}
