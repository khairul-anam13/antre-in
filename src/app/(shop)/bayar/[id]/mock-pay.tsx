"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ios";
import { simulatePay } from "@/app/actions";

export function MockPay({ id, token }: { id: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (ok: boolean) => {
    setBusy(true);
    await simulatePay(id, token, ok);
    router.replace(`/pesanan/${id}${token ? `?t=${token}` : ""}`);
  };
  return (
    <div className="stack">
      <Button size="large" className="full" disabled={busy} onClick={() => go(true)}>Simulasikan bayar berhasil</Button>
      <Button size="large" variant="gray" destructive className="full" disabled={busy} onClick={() => go(false)}>Batalkan pembayaran</Button>
    </div>
  );
}
