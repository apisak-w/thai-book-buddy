import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/utils/env";

// Force dynamic so Next.js doesn't try to pre-render this at build time
export const dynamic = "force-dynamic";

// Module-level cache as belt-and-suspenders for when the function is invoked
let memCache: { data: object[]; at: number } | null = null;
const MEM_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  if (memCache && Date.now() - memCache.at < MEM_TTL_MS) {
    return NextResponse.json(memCache.data);
  }

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from("publishers")
    .select("id, name_th, name_en, category, booths(zone, booth_number)")
    .order("name_th");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  memCache = { data: data ?? [], at: Date.now() };
  return NextResponse.json(memCache.data);
}
