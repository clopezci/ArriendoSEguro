"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ContractRootRedirect() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/contracts/${id}/landlord`);
  }, [id, router]);

  return <p className="text-sm text-slate-300">Redirigiendo…</p>;
}

