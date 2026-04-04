"use client";

import { useCallback, useEffect, useState } from "react";

type PublisherStat = {
  id: string;
  name_th: string;
  name_en: string | null;
  saves: number;
  books_added: number;
  books_per_saver: number;
};

type DauEntry = { date: string; count: number };

type DemoEntry = { value: string; count: number };

type AdminData = {
  publishers: PublisherStat[];
  dau: DauEntry[];
  totals: { unique_users: number; total_saves: number; total_books: number };
  demographics: { age: DemoEntry[]; gender: DemoEntry[] };
  top_books: { title: string; count: number; publisher_name: string }[];
};

type PublisherDetail = {
  name_th: string;
  saves: number;
  books_added: number;
  demographics: { age: string; gender: string; count: number }[];
  books: { title: string; count: number }[];
};

type SortKey = "saves" | "books_added" | "books_per_saver" | "name_th";

const DONUT_COLORS = [
  "#c4855a", // primary orange
  "#8fad7a", // green
  "#973c00", // dark orange-brown
  "#e2c9a6", // light tan
  "#9c7a5b", // medium brown
  "#a6a09b", // muted gray
];

function DonutChart({ entries, label }: { entries: DemoEntry[]; label: string }) {
  const total = entries.reduce((s, e) => s + e.count, 0);
  if (total === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
        <p className="text-xs text-gray-400">ยังไม่มีข้อมูล</p>
      </div>
    );
  }

  const R = 40;
  const CX = 56;
  const CY = 56;

  let cumulativeAngle = -90; // start from top
  const slices = entries.map((e, i) => {
    const pct = e.count / total;
    const angle = pct * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;
    const x1 = CX + R * Math.cos(startRad);
    const y1 = CY + R * Math.sin(startRad);
    const x2 = CX + R * Math.cos(endRad);
    const y2 = CY + R * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...e, d, color: DONUT_COLORS[i % DONUT_COLORS.length], pct };
  });

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-center gap-4">
        <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} />
          ))}
          {/* Donut hole */}
          <circle cx={CX} cy={CY} r={22} fill="white" />
        </svg>
        <div className="flex flex-col gap-1.5 min-w-0">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-gray-600 truncate">{s.value}</span>
              <span className="text-xs text-gray-400 shrink-0 ml-auto pl-2">
                {(s.pct * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function AdminPage() {
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("saves");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dauFrom, setDauFrom] = useState("");
  const [dauTo, setDauTo] = useState("");
  const [detail, setDetail] = useState<(PublisherDetail & { id: string }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async (pw: string) => {
    setLoading(true);
    const res = await fetch("/api/admin/data", {
      headers: { "x-admin-password": pw },
    });
    setLoading(false);
    if (res.status === 401) {
      setAuthError(true);
      return;
    }
    const json = await res.json();
    setData(json);
    setAuthed(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(false);
    setPassword(input);
    fetchData(input);
  }

  async function openDetail(pub: PublisherStat) {
    setDetail({ id: pub.id, name_th: pub.name_th, saves: pub.saves, books_added: pub.books_added, demographics: [], books: [] });
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/publisher/${pub.id}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDetail({ id: pub.id, saves: pub.saves, books_added: pub.books_added, ...json });
    } catch {
      setDetail(null);
      alert("โหลดข้อมูลสำนักพิมพ์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDetailLoading(false);
    }
  }

  const sorted = data
    ? [...data.publishers].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const cmp =
          typeof aVal === "string"
            ? (aVal as string).localeCompare(bVal as string, "th")
            : (aVal as number) - (bVal as number);
        return sortDir === "desc" ? -cmp : cmp;
      })
    : [];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "desc" ? " ↓" : " ↑";
  }

  function exportLeaderboard() {
    downloadCsv(
      [
        ["อันดับ", "สำนักพิมพ์", "Saves", "Books Added", "Books/Saver"],
        ...sorted.map((p, i) => [i + 1, p.name_th, p.saves, p.books_added, p.books_per_saver]),
      ],
      "publisher-leaderboard.csv"
    );
  }

  function exportPublisherDetail() {
    if (!detail) return;
    downloadCsv(
      [
        ["สำนักพิมพ์", detail.name_th],
        ["Saves", detail.saves],
        ["Books Added", detail.books_added],
        [],
        ["Demographics"],
        ["Age", "Gender", "Count"],
        ...detail.demographics.map((d) => [d.age, d.gender, d.count]),
        [],
        ["Books Added by Users"],
        ["Title", "Count"],
        ...detail.books.map((b) => [b.title, b.count]),
      ],
      `${detail.name_th}-report.csv`
    );
  }

  const filteredDau = data
    ? data.dau.filter((d) => {
        if (dauFrom && d.date < dauFrom) return false;
        if (dauTo && d.date > dauTo) return false;
        return true;
      })
    : [];
  const dauMax = filteredDau.length > 0 ? Math.max(...filteredDau.map((d) => d.count), 1) : 1;

  function toLocalDate(daysAgo: number) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  }

  function applyDauPreset(preset: "24h" | "7d" | "30d" | "all") {
    const today = toLocalDate(0);
    if (preset === "24h") { setDauFrom(today); setDauTo(today); }
    else if (preset === "7d") { setDauFrom(toLocalDate(6)); setDauTo(today); }
    else if (preset === "30d") { setDauFrom(toLocalDate(29)); setDauTo(today); }
    else { setDauFrom(""); setDauTo(""); }
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-1">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mb-6">Thai Book Buddy — งานสัปดาห์หนังสือ 2569</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-[#c4855a]"
              autoFocus
            />
            {authError && <p className="text-red-500 text-xs">รหัสผ่านไม่ถูกต้อง</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-[#c4855a] text-white rounded-lg py-3 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">กำลังโหลด...</p>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              งานสัปดาห์หนังสือแห่งชาติ — 26 มี.ค. – 6 เม.ย. 2569
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportLeaderboard}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setAuthed(false);
                setData(null);
                setPassword("");
              }}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Unique Users", value: data.totals.unique_users },
              { label: "Total Wishlisted Publishers", value: data.totals.total_saves },
              { label: "Books Added", value: data.totals.total_books },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
              >
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className="text-3xl font-bold text-gray-800">
                  {s.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* DAU + Demographics row */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {/* DAU chart */}
            {data.dau.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 lg:col-span-2 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-gray-500">Daily Active Users</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {(["24h", "7d", "30d", "all"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => applyDauPreset(p)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        {p === "24h" ? "24 ชม." : p === "7d" ? "7 วัน" : p === "30d" ? "1 เดือน" : "ทั้งหมด"}
                      </button>
                    ))}
                    <span className="text-xs text-gray-300">|</span>
                    <input
                      type="date"
                      value={dauFrom}
                      onChange={(e) => setDauFrom(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 outline-none focus:border-[#c4855a]"
                    />
                    <span className="text-xs text-gray-400">–</span>
                    <input
                      type="date"
                      value={dauTo}
                      onChange={(e) => setDauTo(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 outline-none focus:border-[#c4855a]"
                    />
                  </div>
                </div>
                {filteredDau.length > 0 ? (
                  <div className="flex items-end gap-1.5 h-32 mt-auto">
                    {filteredDau.map((d) => (
                      <div
                        key={d.date}
                        className="flex flex-col items-center gap-1 flex-1 min-w-0"
                      >
                        <span className="text-[10px] text-gray-400">{d.count}</span>
                        <div
                          className="w-full bg-[#c4855a] rounded-t"
                          style={{
                            height: `${Math.max(4, Math.round((d.count / dauMax) * 80))}px`,
                          }}
                        />
                        <span className="text-[10px] text-gray-400 truncate w-full text-center">
                          {formatDate(d.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูลในช่วงเวลานี้</p>
                )}
              </div>
            )}

            {/* Demographics */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-6">
              <h2 className="text-sm font-semibold text-gray-500">Demographics</h2>
              <DonutChart entries={data.demographics.age} label="Age" />
              <DonutChart entries={data.demographics.gender} label="Gender" />
            </div>
          </div>
        )}

        {/* Top 5 publishers + Top 10 books */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Top 5 wishlisted publishers */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 mb-4">Top 10 Wishlisted Publishers</h2>
              <div className="flex flex-col gap-2">
                {data.publishers.slice(0, 10).map((p, i) => {
                  const max = data.publishers[0]?.saves || 1;
                  const pct = Math.round((p.saves / max) * 100);
                  return (
                    <div key={p.id} className="relative flex items-center gap-3 py-2 px-3 rounded-lg overflow-hidden">
                      <div className="absolute inset-0 bg-[#fff8ee] rounded-lg" style={{ width: `${pct}%` }} />
                      <span className="relative text-xs text-gray-300 w-4 shrink-0">{i + 1}</span>
                      <div className="relative flex-1 min-w-0">
                        <p className="text-sm text-gray-700 font-medium truncate">{p.name_th}</p>
                        {p.name_en && <p className="text-xs text-gray-400 truncate">{p.name_en}</p>}
                      </div>
                      <span className="relative text-sm font-semibold text-[#c4855a] shrink-0">{p.saves}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 10 books saved */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 mb-4">Top 10 Books Added</h2>
              {data.top_books.length === 0 ? (
                <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.top_books.map((b, i) => {
                    const max = data.top_books[0]?.count || 1;
                    const pct = Math.round((b.count / max) * 100);
                    return (
                      <div key={i} className="relative flex items-center gap-3 py-2 px-3 rounded-lg overflow-hidden">
                        <div className="absolute inset-0 bg-[#fff8ee] rounded-lg" style={{ width: `${pct}%` }} />
                        <span className="relative text-xs text-gray-300 w-4 shrink-0">{i + 1}</span>
                        <div className="relative flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{b.title}</p>
                          <p className="text-xs text-gray-400 truncate">{b.publisher_name}</p>
                        </div>
                        <span className="relative text-sm font-semibold text-[#c4855a] shrink-0">{b.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Publisher leaderboard */}
        {data && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500">
                Publisher Leaderboard
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium w-8">
                      #
                    </th>
                    <th
                      className="text-left px-5 py-3 text-xs text-gray-400 font-medium cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort("name_th")}
                    >
                      Publisher{sortIndicator("name_th")}
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs text-gray-400 font-medium cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort("saves")}
                    >
                      Wishlisted{sortIndicator("saves")}
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs text-gray-400 font-medium cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort("books_added")}
                    >
                      Books Added{sortIndicator("books_added")}
                    </th>
                    <th
                      className="text-right px-5 py-3 text-xs text-gray-400 font-medium cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort("books_per_saver")}
                    >
                      Books/Saver{sortIndicator("books_per_saver")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors"
                      onClick={() => openDetail(p)}
                    >
                      <td className="px-5 py-3 text-gray-300 text-xs">{i + 1}</td>
                      <td className="px-5 py-3">
                        <p className="text-gray-800 font-medium">{p.name_th}</p>
                        {p.name_en && (
                          <p className="text-gray-400 text-xs">{p.name_en}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-[#c4855a]">
                        {p.saves}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {p.books_added}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400">
                        {p.books_per_saver}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Publisher detail modal */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-bold text-gray-800">{detail.name_th}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {detail.saves} wishlisted · {detail.books_added} books added
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportPublisherDetail}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => setDetail(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-1"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-6">
              {detailLoading ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  กำลังโหลด...
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Demographics */}
                  {(() => {
                    const AGE_KEY_ORDER = ["under_18", "18_24", "25_34", "35_44", "45_54", "55_plus"];
                    const AGE_KEY_LABEL: Record<string, string> = {
                      under_18: "<18", "18_24": "18-24", "25_34": "25-34",
                      "35_44": "35-44", "45_54": "45-54", "55_plus": "55+",
                    };

                    const ageMap = new Map<string, number>();
                    const genderMap = new Map<string, number>();
                    for (const d of detail.demographics) {
                      ageMap.set(d.age, (ageMap.get(d.age) ?? 0) + d.count);
                      genderMap.set(d.gender, (genderMap.get(d.gender) ?? 0) + d.count);
                    }
                    const ageBars = AGE_KEY_ORDER
                      .filter((k) => ageMap.has(k))
                      .map((k) => ({ label: AGE_KEY_LABEL[k] ?? k, count: ageMap.get(k)! }));
                    const genderBars = Array.from(genderMap.entries())
                      .map(([label, count]) => ({ label, count }))
                      .sort((a, b) => b.count - a.count);

                    if (ageBars.length === 0 && genderBars.length === 0) {
                      return (
                        <p className="text-sm text-gray-400">
                          ยังไม่มีข้อมูล demographics (ผู้ใช้ยังไม่ผ่าน onboarding)
                        </p>
                      );
                    }

                    function VerticalBarChart({ bars }: { bars: { label: string; count: number }[] }) {
                      const max = Math.max(...bars.map((b) => b.count), 1);
                      return (
                        <div className="flex items-end gap-2 h-28">
                          {bars.map((b, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                              <span className="text-[10px] text-gray-400">
                                {b.count}
                              </span>
                              <div
                                className="w-full rounded-t"
                                style={{
                                  height: `${Math.max(4, Math.round((b.count / max) * 64))}px`,
                                  backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                                }}
                              />
                              <span className="text-[10px] text-gray-400 truncate w-full text-center">
                                {b.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Age</p>
                          <VerticalBarChart bars={ageBars} />
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Gender</p>
                          <VerticalBarChart bars={genderBars} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Book titles */}
                  {detail.books.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Books Added by Users ({detail.books.length} titles)
                      </h3>
                      <div className="flex flex-col">
                        {detail.books.map((b, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-gray-50"
                          >
                            <span className="text-sm text-gray-700">{b.title}</span>
                            {b.count > 1 && (
                              <span className="text-xs text-gray-400 shrink-0 ml-3">
                                ×{b.count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.demographics.length === 0 &&
                    detail.books.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">
                        ยังไม่มีข้อมูลเพิ่มเติม
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
