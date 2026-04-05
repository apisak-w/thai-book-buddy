import { createClient } from "@supabase/supabase-js";
import { env } from "@/utils/env";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Per-event in-memory cache: slug → { data, timestamp }
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Check cache
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Resolve slug to event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch publishers for this event
  const { data, error } = await supabase
    .from("publishers")
    .select("id, name_th, name_en, category, event_id, booths(zone, booth_number)")
    .eq("event_id", event.id)
    .order("name_th");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  cache.set(slug, { data, timestamp: Date.now() });

  return NextResponse.json(data);
}
