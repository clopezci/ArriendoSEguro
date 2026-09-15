import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";

export const metadata: Metadata = {
  title: "Fuentes oficiales y aviso",
  description:
    "ArriendoSeguro es una app privada de LOTIC, no representa a ninguna entidad gubernamental. Enlaces a la fuente oficial del Estado (Gestor Normativo de Función Pública) de toda la normativa citada.",
  alternates: { canonical: "/legal/fuentes" },
};

/**
 * Todas las fuentes apuntan al Gestor Normativo de la Función Pública
 * (funcionpublica.gov.co), la fuente oficial del Estado colombiano, accesible de
 * forma estable desde cualquier país. Se evitan a propósito otros dominios .gov.co
 * (SUIN, Secretaría del Senado, DANE, DIAN, SIC) porque geobloquean o fallan para
 * verificadores externos.
 */
const PORTAL = "https://www.funcionpublica.gov.co/eva/gestornormativo/";

const NORMS: { law: string; what: string; href: string }[] = [
  { law: "Ley 820 de 2003", what: "Régimen de arrendamiento de vivienda urbana (contrato, canon, reajuste, prórroga, terminación).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
  { law: "Ley 527 de 1999", what: "Comercio electrónico, mensajes de datos y firma electrónica.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276" },
  { law: "Decreto 2364 de 2012", what: "Reglamenta la firma electrónica.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583" },
  { law: "Ley 1581 de 2012", what: "Protección de datos personales (Habeas Data).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981" },
  { law: "Decreto 1074 de 2015", what: "Decreto Único Reglamentario del sector comercio (incluye protección de datos).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=76608" },
  { law: "Ley 1266 de 2008", what: "Habeas Data financiero (reportes de crédito).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34488" },
  { law: "Ley 1564 de 2012 (Código General del Proceso)", what: "Proceso de restitución del inmueble arrendado.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=48425" },
  { law: "Decreto 620 de 2020", what: "Servicios ciudadanos digitales (firma y autenticación del Estado).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=153053" },
  { law: "Decreto 3130 de 2003", what: "Servicios públicos en el arrendamiento.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=10482" },
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
              sobre normas que aparece en la app es <strong>orientativa e ilustrativa</strong> y{" "}
              <strong>no sustituye la asesoría jurídica</strong>. Verifica siempre el texto vigente en la fuente oficial
              enlazada abajo.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Fuente oficial del Estado</h2>
          <p className="mt-2 text-sm text-slate-700">
            Toda la normativa colombiana que la app menciona se puede consultar, en su texto oficial y vigente, en el{" "}
            <strong>Gestor Normativo del Departamento Administrativo de la Función Pública</strong>, el buscador oficial de
            normas del Estado colombiano (dominio <code>.gov.co</code>):
          </p>
          <a
            href={PORTAL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block break-all rounded-lg bg-[#5646E5] px-3 py-2 text-sm font-semibold text-white hover:brightness-105"
          >
            {PORTAL}
          </a>
          <p className="mt-2 text-xs text-slate-500">
            Allí puedes buscar cualquier ley o decreto por número y año, incluidas las que la app cita y no aparezcan en la
            lista de abajo.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Normas citadas (enlace directo)</h2>
          <p className="mt-2 text-sm text-slate-700">
            La app no genera esta información: remite a su fuente oficial para que la verifiques.
          </p>
          <ul className="mt-4 space-y-3">
            {NORMS.map((s) => (
              <li key={s.law} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">{s.law}</p>
                <p className="mt-0.5 text-xs text-slate-600">{s.what}</p>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm text-violet-700 underline">
                  {s.href}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Datos y entidades del Estado que se mencionan</h2>
          <p className="mt-2 text-sm text-slate-700">
            La app puede mencionar datos o servicios de entidades públicas —por ejemplo, el <strong>IPC del DANE</strong>{" "}
            (base del reajuste anual del canon), la <strong>UVT de la DIAN</strong> (referencia tributaria), la{" "}
            <strong>firma digital gratuita de la Agencia Nacional Digital</strong> y la autoridad de datos personales
            (<strong>SIC</strong>). Su <strong>marco normativo</strong> es el de las leyes y decretos enlazados arriba
            (por ejemplo, el reajuste del canon se rige por la Ley 820 de 2003 y la firma digital por la Ley 527 de 1999 y
            el Decreto 620 de 2020). ArriendoSeguro solo referencia estos datos; no los produce ni representa a esas
            entidades.
          </p>
        </section>
      </main>
    </div>
  );
}
