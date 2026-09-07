import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";

export const metadata: Metadata = {
  title: "Fuentes oficiales y aviso",
  description:
    "ArriendoSeguro es una app privada de LOTIC, no representa a ninguna entidad gubernamental. Enlaces a las fuentes oficiales (.gov.co) de la información normativa citada.",
  alternates: { canonical: "/legal/fuentes" },
};

/** Norma citada en la app + enlace a su fuente OFICIAL del Estado (.gov.co). */
const SOURCES: { law: string; what: string; href: string }[] = [
  {
    law: "Ley 820 de 2003",
    what: "Régimen de arrendamiento de vivienda urbana (contrato, canon, reajuste, prórroga, terminación).",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738",
  },
  {
    law: "Ley 527 de 1999",
    what: "Comercio electrónico, mensajes de datos y firma electrónica (validez de la firma en la app).",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276",
  },
  {
    law: "Decreto 2364 de 2012",
    what: "Reglamenta la firma electrónica.",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583",
  },
  {
    law: "Ley 1581 de 2012",
    what: "Protección de datos personales (Habeas Data).",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981",
  },
  {
    law: "Superintendencia de Industria y Comercio (SIC)",
    what: "Autoridad de protección de datos personales en Colombia.",
    href: "https://www.sic.gov.co/proteccion-de-datos-personales",
  },
  {
    law: "DANE",
    what: "Índice de Precios al Consumidor (IPC), base del tope del reajuste anual del canon.",
    href: "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
  },
  {
    law: "Agencia Nacional Digital (AND)",
    what: "Firma y autenticación digital gratuita del Estado (opción de firma).",
    href: "https://firmaautenticaciondigital.and.gov.co/",
  },
  {
    law: "Contaduría General de la Nación (BDME)",
    what: "Boletín de Deudores Morosos del Estado.",
    href: "https://eris.contaduria.gov.co/BDME/",
  },
  {
    law: "Ley 820 de 2003 — Secretaría del Senado",
    what: "Texto oficial alterno de la Ley 820.",
    href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0820_2003.html",
  },
];

export default function FuentesOficialesPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBackNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Fuentes oficiales y aviso</h1>
          <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Aviso importante</p>
            <p className="mt-1 text-sm text-amber-900/90">
              <strong>ArriendoSeguro</strong> es una <strong>aplicación privada</strong> desarrollada por{" "}
              <strong>LOTIC</strong>. <strong>No es una entidad gubernamental</strong>, no representa ni está afiliada a
              ningún organismo público del Estado colombiano, y no presta servicios oficiales del gobierno. La información
              sobre normas y trámites que aparece en la app es <strong>orientativa e ilustrativa</strong> y{" "}
              <strong>no sustituye la asesoría jurídica</strong>. Verifica siempre el texto vigente en las fuentes
              oficiales enlazadas abajo.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Normas y trámites citados en la app</h2>
          <p className="mt-2 text-sm text-slate-700">
            Estos son los enlaces a las fuentes oficiales (dominios del Estado, <code>.gov.co</code>) de la información
            gubernamental que la app menciona. La app no genera esta información: remite a su fuente para que la
            verifiques.
          </p>
          <ul className="mt-4 space-y-3">
            {SOURCES.map((s) => (
              <li key={s.href} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">{s.law}</p>
                <p className="mt-0.5 text-xs text-slate-600">{s.what}</p>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block break-all text-sm text-violet-700 underline"
                >
                  {s.href}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
