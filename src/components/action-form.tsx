"use client";
import { useActionState, type ReactNode } from "react";
import { Button } from "./ios";
import type { FormState } from "@/lib/form";

/** Form dengan server action: menampilkan pesan error/sukses dan status "menyimpan". */
export function ActionForm({ action, children, submit = "Simpan", variant = "filled", className = "form", destructive }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>; children?: ReactNode; submit?: string;
  variant?: "filled" | "tinted" | "gray"; className?: string; destructive?: boolean;
}) {
  const [s, fire, pending] = useActionState(action, undefined);
  return (
    <form action={fire} className={className}>
      {children}
      {s?.error && <p className="err" role="alert">{s.error}</p>}
      {s?.ok && <p className="ok" role="status">{s.ok}</p>}
      <Button type="submit" variant={variant} destructive={destructive} disabled={pending}>{pending ? "Menyimpan…" : submit}</Button>
    </form>
  );
}
