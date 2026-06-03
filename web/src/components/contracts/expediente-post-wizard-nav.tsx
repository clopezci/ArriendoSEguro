"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: (id: string) => `/dashboard/contracts/${id}/evidencias`,
    label: "Evidencias del expediente",
    match: (path: string) =>
      path.includes("/evidencias") ||
      path.includes("/evidencia") ||
      path.includes("/soportes-codeudor") ||
      path.includes("/notarial") ||
      path.includes("/payments"),
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/novedades`,
    label: "Novedades del arriendo",
    match: (path: string) => path.includes("/novedades"),
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/reputacion`,
    label: "Calificar (reputación)",
    match: (path: string) => path.includes("/reputacion"),
  },
  {
    href: (id: string) => `/dashboard/contracts/${id}/alertas`,
    label: "Alertas (vencimiento)",
    match: (path: string) => path.includes("/alertas"),
  },
] as const;

/** Navegación post-firma / durante el arriendo (pasos 12 y 13). */
export function ExpedientePostWizardNav({ contractId }: { contractId: string }) {
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
              active
                ? "border-violet-500 bg-violet-50 text-violet-900"
                : "border-slate-200 text-slate-700 hover:border-violet-300"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
