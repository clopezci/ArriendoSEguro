import { appConfig } from "@/lib/config";
import { getCurrentConsentText } from "@/domain/consents/consentVersions";
import { getCurrentPrivacyPolicyMeta } from "@/domain/legal/privacyPolicyVersions";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Tratamiento de datos personales en ArriendoSeguro conforme a la Ley 1581 de 2012.",
};

export default function AvisoPrivacidadPage() {
  const consent = getCurrentConsentText();
  const privacy = getCurrentPrivacyPolicyMeta();

  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-700">
      <header className="space-y-2 border-b border-slate-300 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Aviso de privacidad</h1>
        <p className="text-xs text-slate-500">
          Documento {privacy.id} · Publicado {privacy.publishedAt} · Consentimiento de registro vigente:{" "}
          {consent.version} ({consent.publishedAt})
        </p>
        <p className="text-xs text-slate-600">
          Este texto orienta sobre el tratamiento de datos personales en la plataforma. No sustituye asesoría legal
          particular; para revisar cláusulas contractuales o situaciones específicas consulta a un profesional idóneo.
        </p>
        <Link href="/" className="inline-block text-xs text-violet-400 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de datos personales a través de la plataforma es{" "}
          <strong>{privacy.controllerLabel}</strong>, en adelante &quot;nosotros&quot; o &quot;la plataforma&quot;, según
          corresponda al contexto. Los datos de identificación societaria (NIT, razón social, dirección de notificación
          judicial) se publicarán en esta misma sección cuando estén consolidados para producción.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">2. Finalidades del tratamiento</h2>
        <p>Tratamos datos personales para, entre otras:</p>
        <ul className="list-inside list-disc space-y-1 pl-1">
          <li>Crear y administrar la cuenta del usuario y el estado de acceso (demo, Plan Plus u otros productos).</li>
          <li>Gestionar expedientes de arriendo: datos de las partes, inmueble, términos, servicios, codeudor cuando aplique, inventario, actas, registro informativo de pagos y comunicaciones relacionadas.</li>
          <li>Emitir y conservar documentos y anexos (PDF/HTML), evidencia de firma electrónica simple y trazas operativas.</li>
          <li>Prestar soporte, seguridad, prevención de fraude y cumplimiento de obligaciones legales aplicables en Colombia.</li>
          <li>Mejorar la experiencia mediante encuestas o evaluaciones estructuradas, con base en interés legítimo o consentimiento cuando corresponda.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">3. Categorías de datos</h2>
        <p>
          Podemos tratar identificación y contacto de las partes, datos del inmueble, información financiera y laboral
          declarada en formularios, archivos que cargues (por ejemplo soportes del codeudor o documentos de expediente),
          datos técnicos de conexión asociados a firmas, y datos de facturación o pago de la suscripción tratados por
          proveedores de pago cuando aplique.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-base font-semibold text-slate-900">4. Encargados del tratamiento (proveedores)</h2>
        <p>
          Para operar utilizamos proveedores que tratan datos en nuestro nombre, entre ellos:{" "}
          <strong>Google Cloud / Firebase</strong> (autenticación, base de datos Firestore, almacenamiento de archivos),
          <strong> Vercel</strong> (despliegue e infraestructura serverless, con proveedores subyacentes),{" "}
          <strong>Resend</strong> (correo transaccional),{" "}
          <strong>Upstash</strong> (control de tasa/anti-abuso de formularios públicos; trata identificadores técnicos
          como la dirección IP de forma temporal) y, en formularios públicos,{" "}
          <strong>Cloudflare Turnstile</strong> (verificación anti-bot orientada a no conservar datos personales de
          contacto). Cuando habilitemos publicidad o medición, <strong>Google</strong> (Analytics y AdSense) podrá tratar
          datos según tu consentimiento de cookies. <strong>Supabase</strong> figura como proveedor reservado para fases
          futuras si se incorpora al stack; en ese caso actualizaremos este aviso.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">5. Transferencia internacional de datos</h2>
        <p>
          Los servidores de los proveedores mencionados pueden estar ubicados fuera de Colombia (por ejemplo en Estados
          Unidos). La transferencia internacional se realiza conforme al artículo 25 del Decreto 1377 de 2013 y a la
          Circular Externa 02 de 2015 de la Superintendencia de Industria y Comercio, cuando corresponda, y con las
          autorizaciones o consentimientos exigidos por la Ley 1581 de 2012. Al aceptar el consentimiento de registro o
          el tratamiento en formularios, puedes autorizar expresamente dichas transferencias cuando la norma lo exija.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">6. Derechos del titular (Ley 1581 de 2012, artículo 8)</h2>
        <p>Tienes derecho a:</p>
        <ol className="list-inside list-decimal space-y-1 pl-1">
          <li>Acceder a tus datos personales que obren en nuestra base, salvo excepciones legales.</li>
          <li>Conocer, actualizar y rectificar tus datos frente a datos parciales, inexactos, incompletos, divididos, que induzcan a error o cuyo tratamiento esté prohibido o no haya sido autorizado.</li>
          <li>Solicitar prueba del consentimiento otorgado, salvo cuando la ley dispense consentimiento.</li>
          <li>Presentar ante la Superintendencia de Industria y Comercio (SIC) quejas por infracciones a lo dispuesto en la ley y el decreto reglamentario.</li>
          <li>Revocar el consentimiento y/o solicitar la supresión del dato cuando en el tratamiento no se respeten los principios, derechos y garantías constitucionales y legales, salvo deber legal o contractual de conservación.</li>
          <li>Solicitar una vez acreditada tu identidad, que te informemos sobre el uso dado a tus datos.</li>
        </ol>
        <p className="text-xs text-slate-600">
          Los plazos orientativos para responder consultas (hasta diez días hábiles) y reclamos (hasta quince días hábiles)
          pueden ajustarse según carga operativa y complejidad; en todo caso daremos acuse de recibo cuando proceda.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">7. Conservación y seguridad</h2>
        <p>
          Conservamos la información el tiempo necesario para las finalidades descritas y para cumplir obligaciones
          legales, contables o probatorias, en particular cuando existan contratos firmados o trazas de firma
          electrónica. Aplicamos medidas técnicas y organizativas razonables (control de acceso, cifrado en tránsito
          cuando el proveedor lo ofrece, minimización y registro de auditoría en eventos sensibles).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">8. Cómo eliminar tu cuenta o ejercer derechos</h2>
        <p>
          Puedes solicitar la eliminación de tu cuenta desde la aplicación, en la ruta{" "}
          <Link href="/dashboard/cuenta/eliminar" className="text-violet-600 underline">
            Eliminar mi cuenta
          </Link>
          , cuando no existan bloqueos por contratos firmados en los que hayas participado. Si aplica retención legal,
          podrás canalizar supresión o anonimización vía{" "}
          <a href="mailto:privacidad@arriendoseguro.com.co" className="text-violet-600 underline">
            privacidad@arriendoseguro.com.co
          </a>
          .
        </p>
        <p>
          También conserva el texto del consentimiento de registro vigente ({consent.version}) y la{" "}
          <Link href="/legal/privacidad" className="text-violet-600 hover:underline">
            Política de tratamiento de la información personal
          </Link>
          , que complementa este aviso.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">9. Cookies y tecnologías similares</h2>
        <p>
          Usamos cookies necesarias para el funcionamiento del sitio y, solo con tu consentimiento, cookies de analítica
          (Google Analytics 4) y de publicidad (Google AdSense, cuando se active). Gestionamos el consentimiento con el
          modo de consentimiento de Google (Consent Mode v2): por defecto, analítica y publicidad quedan denegadas hasta
          que las autorices en el banner. Puedes cambiar tu decisión en cualquier momento desde &quot;Preferencias de
          cookies&quot; en el pie de página. El detalle está en la{" "}
          <Link href="/legal/cookies" className="text-violet-600 underline">
            política de cookies
          </Link>
          .
        </p>
      </section>

      <section className="rounded-lg border border-violet-200 bg-violet-50/60 p-4">
        <h2 className="text-base font-semibold text-slate-900">Canal Habeas Data</h2>
        <p className="mt-2 text-sm">
          Consultas y solicitudes sobre datos personales:{" "}
          <a href="mailto:privacidad@arriendoseguro.com.co" className="font-medium text-violet-700 underline">
            privacidad@arriendoseguro.com.co
          </a>
          .
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          {appConfig.name} — Plataforma de apoyo a formalización de arriendos en Colombia. Versión de aviso: {privacy.id}.
        </p>
      </footer>
    </article>
  );
}
