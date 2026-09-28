"use client";
import { useActionState } from "react";
import { Button, GlassCard } from "@/components/ios";
import { staffLogin } from "@/app/actions";

export function StaffLogin() {
  const [state, action, pending] = useActionState(staffLogin, undefined);
  return (
    <GlassCard variant="strong">
      <form action={action} className="form">
        <div><label className="label" htmlFor="em">Email</label><input id="em" name="email" type="email" className="field" autoComplete="username" required /></div>
        <div><label className="label" htmlFor="pw">Password</label><input id="pw" name="password" type="password" className="field" autoComplete="current-password" required /></div>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <Button type="submit" size="large" className="full" disabled={pending}>{pending ? "Masuk…" : "Masuk"}</Button>
      </form>
    </GlassCard>
  );
}
