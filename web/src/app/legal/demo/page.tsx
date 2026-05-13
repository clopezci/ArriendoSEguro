import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones del modo demo",
  description: "Alcance del modo demostrativo de ArriendoSeguro sin validez legal.",
};

export default function LegalDemoPage() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-700">
      <header className="space-y-2 border-b border-slate-300 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Condiciones del modo demo</h1>
        <p className="text-xs text-slate-500">Aplica al recorrido demostrativo y a datos de ejemplo en la interfaz.</p>
        <Link href="/" className="inline-block text-xs text-violet-400 hover:underline">
          Volver al inicio
        </Link>
        <p>
          El tour visual público está en{" "}
          <Link href="/demo" className="text-violet-400 hover:underline">
            /demo
          </Link>
          .
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Demo sin validez legal</h2>
        <p>
          El modo demo, recorridos con datos ficticios o marcas de agua no constituye contrato, consentimiento válido
          frente a terceros ni prueba judicial por sí solos. Su única finalidad es mostrar las funciones de {appConfig.name}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. Documentos con marca de agua</h2>
        <p>
          Toda salida identificada como demo puede incluir leyendas o marcas que impiden confundirla con un documento
          definitivo. No debe presentarse a notarías, juzgados o terceros como documento final.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. Datos ficticios</h2>
        <p>
          Los nombres, números de documento, direcciones y montos mostrados en demos ilustrativos son inventados o
          anonimizados. Cualquier parecido con personas reales es coincidencia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. No firma real</h2>
        <p>
          Las pantallas de firma en modo demo no generan firma electrónica válida ni envían a las mismas rutas de
          evidencia que un expediente de pago. No se crean obligaciones jurídicas entre las partes ficticias.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. No contrato real</h2>
        <p>
          No nacen derechos de arrendamiento, garantías locativas ni obligaciones de pago por usar el demo. El contrato
          real requiere Plan Plus o el mecanismo comercial vigente y el cumplimiento de los requisitos legales aplicables.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. No uso probatorio</h2>
        <p>
          No utilice archivos o capturas del demo como prueba en controversias. Para documentación útil debe generar su
          expediente real, firmar según políticas aplicables y conservar los soportes que exija su asesoría.
        </p>
      </section>
    </article>
  );
}
