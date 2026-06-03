import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de evaluación estructurada de experiencia",
  description: "Uso de evaluaciones cerradas en ArriendoSeguro; sin listas negras ni búsqueda por cédula.",
};

export default function EvaluacionPage() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-700">
      <header className="space-y-2 border-b border-slate-300 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Política de evaluación estructurada de experiencia
        </h1>
        <p className="text-xs text-slate-500">
          Alineada al tratamiento de datos personales (Ley 1581 de 2012) y a la Ley 1480 de 2011 en lo pertinente a
          información al consumidor.
        </p>
        <Link href="/" className="inline-block text-xs text-violet-700 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Evaluación privada</h2>
        <p>
          Las respuestas del cuestionario estructurado sobre la experiencia de arriendo se consideran información con
          fines de mejora del servicio y, cuando se implemente, retroalimentación entre partes bajo reglas de
          visibilidad que {appConfig.name} publique. En esta fase inicial no hay perfil público de reputación salvo que se indique
          expresamente en el producto.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. Preguntas cerradas</h2>
        <p>
          El diseño prioriza ítems cerrados (escalas, opciones múltiples) para reducir sesgos y facilitar análisis
          agregado. Si en el futuro se permiten comentarios abiertos, se aplicarán filtros y moderación razonables.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. No lista negra</h2>
        <p>
          {appConfig.name} no opera ni promueve “listas negras” de arrendatarios o arrendadores. No facilitamos
          mecanismos de exclusión colectiva sin fundamento legal y debido proceso.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. No búsqueda pública por cédula</h2>
        <p>
          No habrá, en el alcance de esta fase inicial, un buscador público que permita localizar historiales ingresando el número
          de cédula u otro documento de identidad de terceros. Cualquier cambio futuro de modelo de visibilidad será
          comunicado con antelación y, cuando corresponda, con nueva base legal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. No comentarios ofensivos</h2>
        <p>
          Queda prohibido usar la herramienta para insultos, discriminación, datos sensibles innecesarios, acoso o
          contenido ilícito. Podremos eliminar contenido o suspender cuentas ante incumplimientos graves.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. Finalidad</h2>
        <p>
          La finalidad es conocer la satisfacción con el proceso de formalización, detectar fallas del producto y, en su
          caso, apoyar la confianza entre usuarios sin sustituir investigaciones judiciales o administrativas.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">7. Rectificación o revisión futura</h2>
        <p>
          Si usted considera que una calificación o dato es inexacto y la función lo permite, podrá solicitar revisión
          por los canales de soporte. Las políticas de publicación podrán actualizarse; se le informará de cambios
          relevantes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">8. Tratamiento de datos</h2>
        <p>
          Los datos de evaluación se tratan como datos personales cuando permiten identificar o hacer identificable a
          una persona; aplican los derechos del titular y las medidas de seguridad descritas en la{" "}
          <Link href="/legal/privacidad" className="text-violet-700 hover:underline">
            Política de tratamiento de datos personales
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
