import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { exportCsv, isDate, todayWIB } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** Ekspor CSV (bisa dibuka di Excel). Hanya admin. */
export async function GET(req: NextRequest) {
  if ((await getUser())?.role !== "admin") return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const today = await todayWIB();
  const from = isDate(p.get("from")) ? p.get("from")! : today;
  const to = isDate(p.get("to")) ? p.get("to")! : today;
  return new NextResponse(await exportCsv(from, to), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="antre-in-${from}_${to}.csv"`, "Cache-Control": "no-store" },
  });
}
