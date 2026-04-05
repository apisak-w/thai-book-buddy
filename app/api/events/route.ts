import { getSupabase } from "@/utils/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");

  const supabase = getSupabase();
  let query = supabase
    .from("events")
    .select("id, name_th, name_en, slug, description_th, description_en, start_date, end_date, location_th, location_en, location_url, map_image_url, status, created_at")
    .order("start_date", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
