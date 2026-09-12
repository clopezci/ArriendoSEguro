import type { Metadata } from "next";
import { TopBackNav } from "@/components/nav/top-back-nav";

export const metadata: Metadata = {
  title: "Fuentes oficiales y aviso",
  description:
    "ArriendoSeguro es una app privada de LOTIC, no representa a ninguna entidad gubernamental. Enlaces a las fuentes oficiales (.gov.co) de toda la información normativa citada.",
  alternates: { canonical: "/legal/fuentes" },
};

/** Portales OFICIALES del Estado que contienen TODA la normativa colombiana. */
const MASTER: { name: string; what: string; href: string }[] = [
  {
    name: "SUIN-Juriscol (Ministerio de Justicia y del Derecho)",
    what: "Sistema Único de Información Normativa del Estado colombiano: contiene el texto vigente de CUALQUIER ley, decreto o norma citada en la app.",
    href: "https://www.suin-juriscol.gov.co",
  },
  {
    name: "Gestor Normativo (Departamento Administrativo de la Función Pública)",
    what: "Buscador oficial de normas con su texto y estado de vigencia.",
    href: "https://www.funcionpublica.gov.co/eva/gestornormativo/",
  },
];

/** Normas específicas más citadas (enlace directo a su fuente oficial). */
const NORMS: { law: string; what: string; href: string }[] = [
  { law: "Ley 820 de 2003", what: "Régimen de arrendamiento de vivienda urbana (contrato, canon, reajuste, prórroga, terminación).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8738" },
  { law: "Ley 527 de 1999", what: "Comercio electrónico, mensajes de datos y firma electrónica.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276" },
  { law: "Decreto 2364 de 2012", what: "Reglamenta la firma electrónica.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=50583" },
  { law: "Ley 1581 de 2012", what: "Protección de datos personales (Habeas Data).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981" },
  { law: "Decreto 1074 de 2015", what: "Decreto Único Reglamentario del sector comercio (incluye protección de datos).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=76608" },
  { law: "Ley 1266 de 2008", what: "Habeas Data financiero (reportes de crédito).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34488" },
  { law: "Ley 1564 de 2012 (Código General del Proceso)", what: "Proceso de restitución del inmueble arrendado.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=48425" },
  { law: "Decreto 620 de 2020", what: "Servicios ciudadanos digitales (firma y autenticación del Estado).", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=153053" },
  { law: "Decreto 3130 de 2003", what: "Reglamenta servicios públicos en el arrendamiento.", href: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=10482" },
  { law: "Ley 142 de 1994", what: "Régimen de los servicios públicos domiciliarios.", href: "http://www.secretariasenado.gov.co/senado/basedoc/ley_0142_1994.html" },
  { law: "Código Civil colombiano", what: "Arrendamiento, obligaciones y obligaciones solidarias (codeudor).", href: "http://www.secretariasenado.gov.co/senado/basedoc/codigo_civil.html" },
];

/** Datos y servicios oficiales del Estado (no son normas). */
const SERVICES: { name: string; what: string; href: string }[] = [
  { name: "DANE", what: "Índice de Precios al Consumidor (IPC), base del tope del reajuste anual del canon.", href: "https://www.dane.gov.co" },
  { name: "Superintendencia de Industria y Comercio (SIC)", what: "Autoridad de protección de datos personales.", href: "https://www.sic.gov.co/proteccion-de-datos-personales" },
  { name: "DIAN", what: "Unidad de Valor Tributario (UVT) e información de impuestos.", href: "https://www.dian.gov.co" },
  { name: "Agencia Nacional Digital (AND)", what: "Firma y autenticación digital gratuita del Estado.", href: "https://firmaautenticaciondigital.and.gov.co/" },
  { name: "Contaduría General de la Nación (BDME)", what: "Boletín de Deudores Morosos del Estado.", href: "https://eris.contaduria.gov.co/BDME/" },
];

function SourceItem({ title, what, href }: { title: string; what: string; href: string }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-600">{what}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm text-violet-700 underline">
        {href}
      </a>
    </li>
  );
}

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
          <h2 className="text-xl font-semibold">Portales oficiales del Estado (cubren TODA la normativa)</h2>
          <p className="mt-2 text-sm text-slate-700">
            Cualquier ley, decreto o norma colombiana que la app mencione se puede consultar, en su texto oficial y
            vigente, en estos portales del Estado (dominios <code>.gov.co</code>):
          </p>
          <ul className="mt-4 space-y-3">
            {MASTER.map((s) => (
              <SourceItem key={s.href} title={s.name} what={s.what} href={s.href} />
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Normas más citadas (enlace directo)</h2>
          <p className="mt-2 text-sm text-slate-700">
            La app no genera esta información: remite a su fuente oficial para que la verifiques. Cualquier otra norma no
            listada aquí también está en los portales oficiales de arriba.
          </p>
          <ul className="mt-4 space-y-3">
            {NORMS.map((s) => (
              <SourceItem key={s.law} title={s.law} what={s.what} href={s.href} />
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-xl font-semibold">Datos y servicios oficiales del Estado</h2>
          <ul className="mt-4 space-y-3">
            {SERVICES.map((s) => (
              <SourceItem key={s.href} title={s.name} what={s.what} href={s.href} />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
