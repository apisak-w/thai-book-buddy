"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Navigation, MapPin, Search } from "lucide-react";
import Link from "next/link";
import BrandHeader from "../../components/BrandHeader";
import BottomNav from "../../components/BottomNav";
import { useLIFF } from "../../providers/liff-providers";
import { getSupabase } from "../../utils/supabase";
import { BOOTH_DATA, IMAGE_W, IMAGE_H } from "../../utils/booth-coords-data";

// MRT entrance on the 2560×1932 image — left wall aisle, entering at middle horizontal corridor
const MRT_ENTRANCE = { x: 460, y: 919 };

// ---------------------------------------------------------------------------
// Globally-clear vertical aisles (no booth exists at ANY y in these x-ranges)
// Derived from booth polygon analysis. All paths between zones must route through these.
// ---------------------------------------------------------------------------
const V_AISLES = [460, 564, 748, 932, 1290, 1484, 1667, 2219];

// Globally-clear horizontal aisles (no booth exists at ANY x in these y-ranges)
// Plus top/bottom edges of the hall.
const H_AISLES = [340, 809, 919, 1264, 1400];

function nearestVAisle(x: number): number {
  return V_AISLES.reduce((best, a) => Math.abs(a - x) < Math.abs(best - x) ? a : best);
}

function nearestHAisle(y: number): number {
  return H_AISLES.reduce((best, a) => Math.abs(a - y) < Math.abs(best - y) ? a : best);
}

interface RouteStop {
  booth: string;
  name_th: string;
  pinX: number;
  pinY: number;
  fill: string;
  polygon: [number, number][];
}

export default function MapPage() {
  const { isLoggedIn } = useLIFF();
  const [route, setRoute] = useState<RouteStop[]>([]);
  const [showList, setShowList] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [activeBooth, setActiveBooth] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState(0);
  const [initialScale, setInitialScale] = useState(0.15);
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const waypoints = useMemo(() => buildWaypoints(route), [route]);

  useEffect(() => {
    return () => { if (activeTimer.current) clearTimeout(activeTimer.current); };
  }, []);

  // Compute initial scale so the map fills the container width
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        const fitScale = Math.min(width / IMAGE_W, height / IMAGE_H);
        setInitialScale(fitScale);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleFocusBooth(boothNum: string) {
    const stop = route.find((s) => s.booth === boothNum);
    if (!stop || !transformRef.current || !mapContainerRef.current) return;

    if (activeTimer.current) clearTimeout(activeTimer.current);
    setActiveBooth(boothNum);
    setActiveKey((k) => k + 1);
    activeTimer.current = setTimeout(() => setActiveBooth(null), 3200);

    const { clientWidth: vw, clientHeight: vh } = mapContainerRef.current;
    const scale = 0.4;
    const tx = vw / 2 - stop.pinX * scale;
    const ty = vh / 2 - stop.pinY * scale;
    transformRef.current.setTransform(tx, ty, scale, 400, "easeOut");
  }

  useEffect(() => {
    async function load() {
      // Preview mode: bypass LIFF, load mock booths spread across the map
      if (typeof window !== "undefined" && window.location.search.includes("preview=1")) {
        const mockPairs = [
          { booth: "C42", name_th: "สำนักพิมพ์ ก" },
          { booth: "G37", name_th: "สำนักพิมพ์ ข" },
          { booth: "L35", name_th: "สำนักพิมพ์ ค" },
          { booth: "P38", name_th: "สำนักพิมพ์ ง" },
          { booth: "D30", name_th: "สำนักพิมพ์ จ" },
          { booth: "K32", name_th: "สำนักพิมพ์ ฉ" },
          { booth: "R28", name_th: "สำนักพิมพ์ ช" },
          { booth: "Q01", name_th: "สำนักพิมพ์ ฌ" },
          { booth: "M11", name_th: "สำนักพิมพ์ ญ" },
          { booth: "B22", name_th: "สำนักพิมพ์ ซ" },
          { booth: "H20", name_th: "สำนักพิมพ์ ณ" },
          { booth: "N18", name_th: "สำนักพิมพ์ ด" },
          { booth: "D26", name_th: "สำนักพิมพ์ ทดสอบ D26" },
        ];
        setRoute(buildRoute(mockPairs));
        setLoaded(true);
        return;
      }

      if (!isLoggedIn) {
        setLoaded(true);
        return;
      }
      try {
        const supabase = getSupabase();
        const { data: sels } = await supabase
          .from("user_selections")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("publishers(name_th, booths(booth_number))") as any;

        const pairs: { booth: string; name_th: string }[] = [];
        if (sels) {
          for (const sel of sels) {
            const pub = Array.isArray(sel.publishers) ? sel.publishers[0] : sel.publishers;
            if (!pub) continue;
            for (const b of (pub.booths ?? [])) {
              if (b.booth_number) pairs.push({ booth: b.booth_number, name_th: pub.name_th });
            }
          }
        }

        if (pairs.length > 0) setRoute(buildRoute(pairs));
      } catch {
        // silently show empty state on error
      }
      setLoaded(true);
    }
    load();
  }, [isLoggedIn]);

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#fafaf8] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-[16px] pt-[24px] pb-[10px]">
        <BrandHeader />
        <div className="flex items-center justify-between">
          <p className="font-[family-name:var(--font-sarabun)] font-semibold text-[32px] text-[#3d2b1a] leading-tight">
            ผังงาน
          </p>
          <div className="px-[10px] py-[4px] rounded-full bg-[#f0e4d4]">
            <p className="font-[family-name:var(--font-sarabun)] font-light text-[11px] text-[#973c00]">
              ผังปี 2569
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainerRef} className="relative flex-1 overflow-hidden bg-[#e0dbd4]">
        <TransformWrapper
          key={initialScale}
          ref={transformRef}
          initialScale={initialScale}
          minScale={initialScale * 0.5}
          maxScale={4}
          centerOnInit
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: IMAGE_W, height: IMAGE_H, position: "relative" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/booth-map-2569.jpg" alt="ผังบูธปี 2569" width={IMAGE_W} height={IMAGE_H} />

            {/* SVG overlay: white mask with punch-holes at selected booths + route line + pins */}
            <svg
              width={IMAGE_W}
              height={IMAGE_H}
              viewBox={`0 0 ${IMAGE_W} ${IMAGE_H}`}
              style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
            >
              <defs>
                {/* Mask: white everywhere, black punches at selected booths */}
                <mask id="booth-mask">
                  <rect width={IMAGE_W} height={IMAGE_H} fill="white" />
                  {loaded && route.map((stop) => (
                    <polygon
                      key={`mask-${stop.booth}`}
                      points={stop.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill="black"
                    />
                  ))}
                </mask>

              </defs>

              {/* White desaturation overlay — punched out at pinned booths */}
              <rect
                width={IMAGE_W}
                height={IMAGE_H}
                fill="rgba(255,255,255,0.65)"
                mask="url(#booth-mask)"
              />

              {/* Route line */}
              {loaded && waypoints.length > 0 && (
                <polyline
                  points={waypoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#c4855a"
                  strokeWidth={6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeOpacity={0.95}
                />
              )}

              {/* Booth outlines for selected booths */}
              {loaded && route.map((stop) => (
                <polygon
                  key={`outline-${stop.booth}`}
                  points={stop.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="none"
                  stroke="#c4855a"
                  strokeWidth={4}
                  strokeLinejoin="round"
                />
              ))}

              {/* Flash polygon for focused booth */}
              {activeBooth && (() => {
                const stop = route.find((s) => s.booth === activeBooth);
                if (!stop) return null;
                return (
                  <polygon
                    key={`flash-${activeKey}`}
                    points={stop.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="#fff8ee"
                    fillOpacity={0}
                    stroke="none"
                    style={{ animation: 'booth-flash 1.5s ease-in-out 2 forwards' }}
                  />
                );
              })()}
            </svg>
          </TransformComponent>
        </TransformWrapper>

        {/* Empty state */}
        {loaded && route.length === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-[24px] pointer-events-none z-10">
            <div className="pointer-events-auto mx-[16px] w-full max-w-[360px] rounded-[20px] bg-[#fafaf8] shadow-lg px-[20px] py-[20px] flex flex-col gap-[12px]">
              <div className="flex items-center gap-[10px]">
                <div className="shrink-0 size-[40px] rounded-full bg-[#f0e4d4] flex items-center justify-center">
                  <MapPin size={20} color="#c4855a" strokeWidth={2} />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <p className="font-[family-name:var(--font-sarabun)] font-semibold text-[16px] text-[#3d2b1a]">
                    ยังไม่มีเส้นทางของคุณ
                  </p>
                  <p className="font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#9c7a5b] leading-snug">
                    เพิ่มสำนักพิมพ์ที่ชอบในหน้าค้นหา แล้วกลับมาดูเส้นทางเดินที่นี่
                  </p>
                </div>
              </div>
              <Link
                href="/browse"
                className="flex items-center justify-center gap-[6px] h-[44px] rounded-[12px] bg-[#c4855a] active:scale-95 transition-all"
              >
                <Search size={15} color="white" strokeWidth={2} />
                <span className="font-[family-name:var(--font-sarabun)] font-medium text-[14px] text-white">
                  ค้นหาสำนักพิมพ์
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Route stop list */}
      {loaded && route.length > 0 && (
        <div className="shrink-0 border-t border-[#f0e4d4] bg-[#fafaf8]">
          <div className="flex items-center justify-between px-[16px] pt-[12px] pb-[8px]">
            <p className="font-[family-name:var(--font-sarabun)] font-medium text-[13px] text-[#9c7a5b]">
              เส้นทางเดิน · เริ่มจากทางเข้า MRT
            </p>
            <button
              onClick={() => setShowList((v) => !v)}
              className="flex items-center gap-[6px] px-[12px] py-[4px] rounded-full border border-[#c4855a] active:scale-95 transition-all"
            >
              <Navigation size={12} color="#c4855a" strokeWidth={2} />
              <span className="font-[family-name:var(--font-sarabun)] text-[12px] text-[#c4855a] font-medium">
                {showList ? "ซ่อน" : `${new Set(route.map(s => s.name_th)).size} สำนักพิมพ์`}
              </span>
            </button>
          </div>
          {showList && (
            <div className="max-h-[32vh] overflow-y-auto">
              <div className="flex flex-col px-[16px] pb-[8px] gap-[10px]">
                {(() => {
                  // Group stops by publisher name (O(n) via Map), preserving route order
                  const groupMap = new Map<string, string[]>();
                  const order: string[] = [];
                  for (const stop of route) {
                    if (!groupMap.has(stop.name_th)) {
                      groupMap.set(stop.name_th, []);
                      order.push(stop.name_th);
                    }
                    groupMap.get(stop.name_th)!.push(stop.booth);
                  }
                  return order.map((name_th, i) => {
                    const booths = groupMap.get(name_th)!;
                    return (
                      <div key={`list-${i}`} className="flex items-center gap-[12px]">
                        <div className="shrink-0 size-[14px] rounded-full bg-[#8fad7a]" />
                        <button
                          onClick={() => handleFocusBooth(booths[0])}
                          className="flex-1 min-w-0 text-left font-[family-name:var(--font-sarabun)] font-light text-[14px] text-[#973c00] truncate active:opacity-60 transition-opacity"
                        >
                          {name_th}
                        </button>
                        <div className="flex gap-[4px]">
                          {booths.map(booth => (
                            <button
                              key={booth}
                              onClick={() => handleFocusBooth(booth)}
                              className={`shrink-0 h-[29px] px-[9px] py-[1px] rounded-[16px] border transition-all active:scale-95 ${
                                activeBooth === booth
                                  ? "bg-[#c4855a] border-[#c4855a]"
                                  : "bg-[#fff8ee] border-[#e2c9a6]"
                              }`}
                            >
                              <p className={`font-[family-name:var(--font-sarabun)] text-[14px] ${activeBooth === booth ? "text-white" : "text-[#c4855a]"}`}>
                                {booth}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route building helpers
// ---------------------------------------------------------------------------

function buildRoute(pairs: { booth: string; name_th: string }[]): RouteStop[] {
  const resolved: RouteStop[] = [];
  for (const p of pairs) {
    const data = BOOTH_DATA[p.booth];
    if (data) resolved.push({ booth: p.booth, name_th: p.name_th, ...data });
  }

  // Sort columns left→right, alternate direction within each column
  const colGroups = new Map<number, RouteStop[]>();
  for (const stop of resolved) {
    const group = colGroups.get(stop.pinX) ?? [];
    group.push(stop);
    colGroups.set(stop.pinX, group);
  }

  const colOrder = Array.from(colGroups.keys()).sort((a, b) => a - b);
  const route: RouteStop[] = [];
  let topToBottom = true;

  for (const col of colOrder) {
    const group = colGroups.get(col)!;
    const sorted = [...group].sort((a, b) => a.pinY - b.pinY);
    if (!topToBottom) sorted.reverse();
    route.push(...sorted);
    topToBottom = !topToBottom;
  }

  return route;
}

// Returns the intersection point of segment p1→p2 with a polygon edge, closest to p1.
// Falls back to p2 if no intersection found (e.g. p2 is outside the polygon).
function polygonEdgePoint(
  polygon: [number, number][],
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];

    // Segment-segment intersection: p1→p2 with polygon edge a→b
    const dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
    const dx2 = bx - ax, dy2 = by - ay;
    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((ax - p1.x) * dy2 - (ay - p1.y) * dx2) / denom;
    const u = ((ax - p1.x) * dy1 - (ay - p1.y) * dx1) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const pt = { x: p1.x + t * dx1, y: p1.y + t * dy1 };
      const d = Math.hypot(pt.x - p1.x, pt.y - p1.y);
      if (d < bestDist) { bestDist = d; best = pt; }
    }
  }

  return best ?? p2;
}

function buildWaypoints(route: RouteStop[]): { x: number; y: number }[] {
  if (route.length === 0) return [];

  type Pt = { x: number; y: number };

  // Route each segment through the globally-clear aisle corridors.
  // Between different vertical zones, the path must use a horizontal aisle to cross.
  function corridorPath(from: Pt, to: Pt): Pt[] {
    const va = nearestVAisle(from.x);
    const vb = nearestVAisle(to.x);

    if (va === vb) {
      // Same vertical zone: exit to zone's aisle, travel vertically, return to booth
      return [from, { x: va, y: from.y }, { x: va, y: to.y }, to];
    }

    // Different vertical zones: cross via the horizontal aisle nearest to the midpoint
    const hCross = nearestHAisle((from.y + to.y) / 2);
    return [
      from,
      { x: va, y: from.y },    // walk to own vertical aisle
      { x: va, y: hCross },     // travel along it to horizontal crossing
      { x: vb, y: hCross },     // cross to destination vertical aisle
      { x: vb, y: to.y },       // travel down/up to destination row
      to,                       // walk to destination booth
    ];
  }

  const all: Pt[] = [MRT_ENTRANCE];
  let prev: Pt = MRT_ENTRANCE;

  for (const stop of route) {
    const pinCenter: Pt = { x: stop.pinX, y: stop.pinY };
    const seg = corridorPath(prev, pinCenter);

    // Replace the last point (pin center) with the polygon boundary intersection
    // so the line stops at the booth edge instead of crossing into it.
    const approachFrom = seg[seg.length - 2] ?? prev;
    seg[seg.length - 1] = polygonEdgePoint(stop.polygon, approachFrom, pinCenter);

    all.push(...seg.slice(1));
    prev = pinCenter; // Use pin center as origin for the next segment
  }

  // Remove consecutive duplicate points
  return all.filter((p, i) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
}
