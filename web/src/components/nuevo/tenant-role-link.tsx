"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

/**
 * Enlace "Ver como inquilino" que aparece SOLO si el usuario también es inquilino
 * (o codeudor) en algún contrato. Así, quien es dueño e inquilino a la vez puede
 * cambiar de rol; quien solo es dueño no ve la opción.
 */
export function TenantRoleLink() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/tenant-contracts", { headers: { ...(await buildAuthHeaders(user)) } });
        const j = (await res.json()) as { success?: boolean; contracts?: unknown[] };
        if (!cancelled && j.success && Array.isArray(j.contracts) && j.contracts.length > 0) setShow(true);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!show) return null;
  return (
    <Link
      href="/inquilino"
      className="col-span-full flex items-center justify-center gap-2 rounded-2xl border-2 border-[#12B886] bg-[#12B886]/10 p-3 text-sm font-bold text-[#0B7A55] transition hover:bg-[#12B886]/20"
    >
      🏠 También eres inquilino — Ver mis arriendos como inquilino →
    </Link>
  );
}
