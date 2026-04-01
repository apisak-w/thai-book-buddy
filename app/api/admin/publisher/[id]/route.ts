import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "../../rate-limit";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = checkAdminAuth(req);
  if (denied) return denied;

  const { id: publisherId } = await context.params;
  const supabase = adminClient();

  const [{ data: publisher }, { data: demoRows }, { data: books }] =
    await Promise.all([
      supabase
        .from("publishers")
        .select("id, name_th, name_en")
        .eq("id", publisherId)
        .single(),
      supabase.rpc("admin_get_publisher_demographics", { p_publisher_id: publisherId }),
      supabase
        .from("user_books")
        .select("title")
        .eq("publisher_id", publisherId)
        .order("title"),
    ]);

  const demographics = (demoRows ?? []).map((d: { age: string; gender: string; count: number }) => ({
    age: d.age,
    gender: d.gender,
    count: Number(d.count),
  }));

  // Group book titles (freetext — duplicates possible)
  const titleMap = new Map<string, number>();
  for (const b of books ?? []) {
    const title = b.title ? b.title.normalize("NFC").trim().replace(/\s+/g, " ") || "(ไม่มีชื่อ)" : "(ไม่มีชื่อ)";
    titleMap.set(title, (titleMap.get(title) ?? 0) + 1);
  }
  const bookList = Array.from(titleMap.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "th"));

  return NextResponse.json({
    name_th: publisher?.name_th ?? "",
    name_en: publisher?.name_en ?? null,
    demographics,
    books: bookList,
  });
}
