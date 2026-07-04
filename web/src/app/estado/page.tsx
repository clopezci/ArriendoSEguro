import type { Metadata } from "next";
import { StatusBoard } from "@/components/status/status-board";

export const metadata: Metadata = {
  title: "Estado del servicio",
  description:
    "Estado operativo de ArriendoSeguro en tiempo real: aplicación, base de datos y correo, además de incidentes reportados.",
  alternates: { canonical: "/estado" },
  // Panel operativo sin contenido informativo: no indexar.
  robots: { index: false, follow: true },
};

export default function EstadoPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Estado</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Estado del servicio</h1>
        <p className="text-sm text-slate-600">
          Estado operativo de ArriendoSeguro en tiempo real. Si ves algo raro y aquí todo está en verde,{" "}
          <a href="/reportar" className="text-violet-700 underline">
            repórtalo
          </a>
          .
        </p>
      </header>
      <StatusBoard />
    </main>
  );
}
