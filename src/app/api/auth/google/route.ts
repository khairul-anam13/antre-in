import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

/** Mulai login Google (OAuth code flow). State disimpan di cookie httpOnly untuk mencegah CSRF. */
export async function GET() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const base = await appUrl();
  if (!id) return NextResponse.redirect(`${base}/masuk?e=google`);
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: id, redirect_uri: `${base}/api/auth/google/callback`, response_type: "code",
    scope: "openid email profile", state, prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600 });
  return res;
}
