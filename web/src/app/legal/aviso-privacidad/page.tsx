import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Resumen del tratamiento de datos personales en ArriendoSeguro.",
};

export default function AvisoPrivacidadPage() {
  return (
    <article className="space-y-6 text-sm leading-relaxed text-slate-300">
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Aviso de privacidad</h1>
        <p className="text-xs text-slate-500">Versión corta. El detalle completo está en la política de datos.</p>
        <Link href="/" className="inline-block text-xs text-violet-400 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <p>
        {appConfig.name} trata datos personales para prestar el servicio de plataforma (cuenta, expediente de arriendo,
        documentos, firmas cuando aplique y soporte), con fundamento en la ejecución del contrato con usted, el
        consentimiento cuando sea necesario y el cumplimiento de obligaciones legales, conforme a la Ley 1581 de 2012 y
        el Decreto 1377 de 2013.
      </p>

      <p>
        Podemos tratar identificación, contacto, datos del inmueble, archivos que cargue, datos técnicos de conexión
        asociados a firmas, e información de pago de la suscripción a través de proveedores autorizados.
      </p>

      <p>
        Usted puede ejercer derechos de conocimiento, actualización, rectificación y supresión cuando proceda, y
        revocar consentimientos otorgados, salvo obligación legal de conservación. Puede presentar queja ante la
        Superintendencia de Industria y Comercio (SIC) cuando corresponda.
      </p>

      <p>
        También tratamos datos para la evaluación estructurada de experiencia y, cuando aplique legalmente, para
        integrar servicios con aliados estratégicos bajo principios de minimización y necesidad.
      </p>

      <p>
        El texto completo con encargos, transferencias, conservación y seguridad está en la{" "}
        <Link href="/legal/privacidad" className="text-violet-400 hover:underline">
          Política de tratamiento de la información personal (datos personales)
        </Link>
        .
      </p>
    </article>
  );
}
