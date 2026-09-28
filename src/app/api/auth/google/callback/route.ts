import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, googleSignIn, sessionCookieOpts } from "@/lib/auth";
import { appUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = await appUrl();
  const fail = (e: string) => NextResponse.redirect(`${base}/masuk?e=${e}`);
  const p = req.nextUrl.searchParams;
  const state = req.cookies.get("g_state")?.value;
  if (!state || state !== p.get("state") || !p.get("code")) return fail("state");

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: p.get("code")!, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${base}/api/auth/google/callback`, grant_type: "authorization_code",
    }),
  }).then((r) => r.json() as Promise<{ access_token?: string }>);
  if (!tok.access_token) return fail("google");

  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` } })
    .then((r) => r.json() as Promise<{ sub?: string; email?: string; email_verified?: boolean; name?: string }>);
  if (!me.sub || !me.email || !me.email_verified) return fail("google");

  const r = await googleSignIn({ sub: me.sub, email: me.email, name: me.name || me.email.split("@")[0] });
  if (r.error || !r.token) return fail("staff");
  const res = NextResponse.redirect(`${base}/akun`);
  res.cookies.set(SESSION_COOKIE, r.token, sessionCookieOpts);
  res.cookies.delete({ name: "g_state", path: "/api/auth/google" });
  return res;
}
