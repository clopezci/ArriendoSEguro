"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: { href: (id: string) => string; label: string; match: (path: string) => boolean }[] = [
  { href: (id) => `/dashboard/contracts/${id}/soportes-codeudor`, label: "Soportes codeudor", match: (p) => p.includes("/soportes-codeudor") },
  { href: (id) => `/dashboard/contracts/${id}/evidencia`, label: "Evidencia", match: (p) => p.endsWith("/evidencia") },
  { href: (id) => `/dashboard/contracts/${id}/novedades`, label: "Novedades", match: (p) => p.endsWith("/novedades") },
  { href: (id) => `/dashboard/contracts/${id}/notarial`, label: "Notaría", match: (p) => p.endsWith("/notarial") },
  { href: (id) => `/dashboard/contracts/${id}/payments`, label: "Pagos", match: (p) => p.includes("/payments") },
];

export function ExpedienteNav({ contractId }: { contractId: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
      {links.map((item) => {
        const href = item.href(contractId);
        const active = item.match(pathname);
        return (
          <Link
            key={item.label}
            href={href}
            className={`rounded-full border px-3 py-1.5 font-medium ${
              active ? "border-violet-500 bg-violet-50 text-violet-900" : "border-slate-200 text-slate-700 hover:border-violet-300"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
