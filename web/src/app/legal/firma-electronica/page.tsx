import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de firma electrónica",
  description: "Uso de firma electrónica simple y evidencias en ArriendoSeguro.",
};

export default function FirmaElectronicaPage() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-700">
      <header className="space-y-2 border-b border-slate-300 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Política de firma electrónica</h1>
        <p className="text-xs text-slate-500">
          Marco general: Ley 527 de 1999 (mensajes de datos y certificados digitales) y normas concordantes. No
          sustituye asesoría sobre el tipo de firma exigible en cada acto.
        </p>
        <Link href="/" className="inline-block text-xs text-violet-700 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Aceptación del mecanismo</h2>
        <p>
          Al usar la función de firma ofrecida por {appConfig.name}, usted declara haber leído esta política y aceptar
          un mecanismo de firma electrónica acorde a las capacidades del producto (por ejemplo, firma con enlace
          autenticado y registro de evidencias), sin que la plataforma actúe como notario ni como proveedor de
          certificación digital cualificada, salvo integración futura expresamente indicada.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. Uso de enlace seguro</h2>
        <p>
          Las invitaciones a firmar se envían mediante enlace bajo conexión cifrada (HTTPS). El enlace es personal y
          no debe compartirse con terceros no autorizados. La caducidad del enlace y los reintentos se configuran por
          razones de seguridad.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. Registro de fecha, hora, IP, user agent y hash</h2>
        <p>
          Para fines de trazabilidad y evidencia, el sistema puede registrar, entre otros: fecha y hora del acto,
          dirección IP de origen, user agent del navegador o dispositivo, identificador de la versión del documento y
          resumen criptográfico (hash) del contenido firmado. Estos datos forman parte del expediente y se tratan según
          la{" "}
          <Link href="/legal/privacidad" className="text-violet-700 hover:underline">
            Política de tratamiento de datos personales
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. Firma asociada a versión específica del contrato</h2>
        <p>
          Cada firma queda ligada a una versión concreta del documento identificada en el sistema. Si el contenido
          cambia después de firmado, se genera una nueva versión que requiere nuevo consentimiento o firma según el
          flujo configurado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. Invalidez de firmas sobre versiones modificadas</h2>
        <p>
          Una firma aplicada a una versión no surte efectos probatorios automáticos sobre cláusulas alteradas sin
          refrendo posterior. Las partes no deben usar versiones descargadas o editadas fuera del sistema como si
          estuvieran firmadas, si el hash no coincide con el registrado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. Evidencia de firma</h2>
        <p>
          {appConfig.name} puede poner a disposición un anexo o registro de evidencia (por ejemplo, constancia con
          datos del acto y del documento). Esa evidencia complementa el expediente; la eficacia jurídica frente a
          terceros depende del tipo de documento, de la ley aplicable y de lo que acuerden las partes con asesoría
          profesional.
        </p>
      </section>
    </article>
  );
}
