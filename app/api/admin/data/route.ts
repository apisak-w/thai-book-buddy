import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "../rate-limit";
import { env } from "@/utils/env";

function adminClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheByEvent = new Map<string, { data: unknown; timestamp: number }>();

export async function GET(req: NextRequest) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  const eventId = req.nextUrl.searchParams.get("event_id");

  const supabaseAdmin = adminClient();

  let resolvedEventId = eventId;
  if (!resolvedEventId) {
    const { data: activeEvent } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .single();
    resolvedEventId = activeEvent?.id;
  }

  const cacheKey = resolvedEventId ?? "__none__";
  const cachedResult = cacheByEvent.get(cacheKey);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedResult.data);
  }

  const supabase = supabaseAdmin;

  const [
    { data: publisherStatsRaw },
    { data: dauRows },
    { count: uniqueUsers },
    { count: totalSaves },
    { count: totalBooks },
    { data: demoRows },
  ] = await Promise.all([
    supabase.rpc("admin_get_publisher_stats", { p_event_id: resolvedEventId }),
    supabase.rpc("admin_get_dau", { p_event_id: resolvedEventId }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    resolvedEventId
      ? supabase.from("user_selections").select("*", { count: "exact", head: true }).eq("event_id", resolvedEventId)
      : supabase.from("user_selections").select("*", { count: "exact", head: true }),
    resolvedEventId
      ? supabase.from("user_books").select("*", { count: "exact", head: true }).eq("event_id", resolvedEventId)
      : supabase.from("user_books").select("*", { count: "exact", head: true }),
    supabase.rpc("admin_get_global_demographics", { p_event_id: resolvedEventId }),
  ]);

  const publisherStats = (publisherStatsRaw ?? []).map((p: {
    id: string; name_th: string; name_en: string | null; saves: number; books_added: number;
  }) => {
    const saves = Number(p.saves);
    const booksAdded = Number(p.books_added);
    return {
      id: p.id,
      name_th: p.name_th,
      name_en: p.name_en ?? null,
      saves,
      books_added: booksAdded,
      books_per_saver: saves > 0 ? Math.round((booksAdded / saves) * 10) / 10 : 0,
    };
  });

  const dau = (dauRows ?? []).map((r: { date: string; count: number }) => ({
    date: r.date,
    count: Number(r.count),
  }));

  const totals = {
    unique_users: uniqueUsers ?? 0,
    total_saves: totalSaves ?? 0,
    total_books: totalBooks ?? 0,
  };

  // Global demographics from profiles
  // age is stored as a string key from the onboarding form (e.g. "25_34", "55_plus")
  const AGE_KEY_ORDER = ["under_18", "18_24", "25_34", "35_44", "45_54", "55_plus"];
  const AGE_KEY_LABEL: Record<string, string> = {
    under_18: "<18",
    "18_24": "18-24",
    "25_34": "25-34",
    "35_44": "35-44",
    "45_54": "45-54",
    "55_plus": "55+",
  };

  const ageMap = new Map<string, number>();
  const genderMap = new Map<string, number>();
  for (const row of demoRows ?? []) {
    const r = row as { dimension: string; value: string; count: number };
    if (r.dimension === "age") ageMap.set(r.value, Number(r.count));
    else genderMap.set(r.value, Number(r.count));
  }
  const demographics = {
    age: AGE_KEY_ORDER
      .filter((k) => ageMap.has(k))
      .map((k) => ({ value: AGE_KEY_LABEL[k] ?? k, count: ageMap.get(k)! })),
    gender: Array.from(genderMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
  };

  // Top 10 books globally via RPC (avoids PostgREST max_rows cap on full-table scans)
  const { data: topBooksData } = await supabase.rpc("admin_get_top_books", { p_event_id: resolvedEventId, n: 10 });
  const top_books = (topBooksData ?? []).map((b: { title: string; count: number; publisher_name: string }) => ({
    title: b.title,
    count: Number(b.count),
    publisher_name: b.publisher_name,
  }));

  const result = { publishers: publisherStats, dau, totals, demographics, top_books };
  cacheByEvent.set(cacheKey, { data: result, timestamp: Date.now() });
  return NextResponse.json(result);
}
