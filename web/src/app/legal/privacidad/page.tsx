import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de tratamiento de la información personal",
  description:
    "Política de tratamiento de la información personal (datos personales) de ArriendoSeguro conforme a la normativa colombiana.",
};

export default function PrivacidadPage() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-700">
      <header className="space-y-2 border-b border-slate-300 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Política de tratamiento de la información personal (datos personales)
        </h1>
        <p className="text-xs text-slate-500">
          Marco: Ley 1581 de 2012, Decreto 1377 de 2013 y demás normas concordantes (Colombia).
        </p>
        <Link href="/" className="inline-block text-xs text-violet-700 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de los datos personales tratados a través de la plataforma {appConfig.name} es
          quien se identifique como titular del servicio en los avisos de registro y en la sección de contacto (en
          esta fase inicial puede figurar la razón social o nombre del operador y NIT cuando estén disponibles públicamente). Los
          datos de contacto para ejercer derechos se indican al final de esta política.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. Datos recolectados</h2>
        <p>Según las funciones que use, podemos tratar, entre otros:</p>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>Datos de identificación y contacto (nombre, documento, correo, teléfono, ciudad).</li>
          <li>Direcciones y datos del inmueble objeto del expediente.</li>
          <li>Contenido que usted carga (contratos, inventarios, fotografías, anexos).</li>
          <li>Datos técnicos de conexión (dirección IP, user agent, fecha y hora) asociados a firmas y auditoría.</li>
          <li>Datos de pago de la suscripción a la plataforma (a través del proveedor de pagos; no almacenamos PAN completo).</li>
          <li>Respuestas a formularios de evaluación estructurada cuando la función esté activa.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. Finalidades</h2>
        <p>Tratamos datos para:</p>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>Prestar el servicio de software (creación de expediente, plantillas, almacenamiento, notificaciones).</li>
          <li>Gestionar la cuenta, autenticación, seguridad, control de acceso y prevención de fraude.</li>
          <li>Gestionar la evaluación estructurada de experiencia arrendaticia mediante preguntas cerradas y trazabilidad.</li>
          <li>Cumplir obligaciones legales y responder a requerimientos de autoridades competentes.</li>
          <li>Mejorar el producto con analítica, auditoría técnica y métricas agregadas cuando sea posible sin identificarlo.</li>
          <li>Facturación y cobro de planes, reclamaciones, soporte y gestión comercial con el titular.</li>
          <li>
            Evaluar y habilitar servicios con futuros aliados estratégicos (tecnológicos, financieros, aseguradores u
            operativos), siempre bajo base legal, principio de necesidad y minimización de datos.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. Tratamiento de datos de arrendador, arrendatario y codeudor</h2>
        <p>
          Quien crea el expediente es responsable de contar con la base legal (por ejemplo, consentimiento, relación
          contractual o habilitación legal) para cargar datos de otras personas. El codeudor y el arrendatario deben ser
          informados del tratamiento conforme a esta política y, cuando corresponda, deben aceptarla o manifestar su
          consentimiento fuera o dentro de la plataforma según el flujo implementado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. Tratamiento de documentos</h2>
        <p>
          Los documentos (borradores de contrato, anexos, inventarios) se alojan en infraestructura controlada por el
          responsable o sus encargados. Se aplican medidas razonables de seguridad. El contenido jurídico es
          responsabilidad de las partes que lo suscriben.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. Tratamiento de firmas electrónicas</h2>
        <p>
          Cuando use la firma electrónica ofrecida por la plataforma, se conservan datos de evidencia (fecha, hora, IP,
          user agent, identificador de versión y hash del documento) según lo descrito en la{" "}
          <Link href="/legal/firma-electronica" className="text-violet-700 hover:underline">
            Política de firma electrónica
          </Link>
          , en concordancia con el marco general de mensajes de datos y firmas (Ley 527 de 1999 y normas concordantes).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">7. Tratamiento de soportes de pago del canon</h2>
        <p>
          Si la funcionalidad permite registrar soportes del pago del arriendo, dichos archivos y metadatos se tratan
          solo con fines informativos entre las partes y de trazabilidad del expediente, sin que {appConfig.name}{" "}
          recaude el canon. La conservación y el acceso se rigen por esta política y por los permisos del expediente.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">8. Tratamiento de evaluaciones estructuradas</h2>
        <p>
          Las respuestas a cuestionarios cerrados sobre la experiencia de arriendo se tratan según la{" "}
          <Link href="/legal/evaluacion" className="text-violet-700 hover:underline">
            Política de evaluación estructurada
          </Link>
          : no publicamos listas negras ni permitimos búsqueda pública por cédula en esta fase inicial.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">9. Derechos del titular</h2>
        <p>Usted puede ejercer, entre otros, los derechos a:</p>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>Conocer, actualizar y rectificar sus datos.</li>
          <li>Solicitar prueba de la autorización cuando sea del caso.</li>
          <li>Revocar el consentimiento cuando no exista deber legal o contractual que impida suprimir.</li>
          <li>Acceder de forma gratuita a sus datos tratados, en los casos previstos en la ley.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) cuando proceda.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">10. Canales de consulta y reclamo</h2>
        <p>
          Solicitudes de ejercicio de derechos y reclamos: use el correo o formulario publicado en la aplicación como
          canal principal. Podrá solicitar información sobre el tratamiento y, si aplica, corrección o supresión cuando
          no exista deber de conservación legal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">11. Conservación</h2>
        <p>
          Los datos se conservan mientras exista relación contractual o legal con usted, y después durante los plazos
          necesarios para defensa de derechos, auditoría o cumplimiento de obligaciones legales (por ejemplo,
          tributarias o probatorias), adoptando supresión o anonimización cuando corresponda.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">12. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito cuando proceda, control de accesos,
          copias de seguridad). Ningún sistema es invulnerable; le recomendamos usar contraseñas robustas y no compartir
          su cuenta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">13. Transferencia y transmisión a proveedores y aliados estratégicos</h2>
        <p>
          Podemos encargar el tratamiento a proveedores de nube, autenticación, correo electrónico, pasarela de pagos,
          soporte o seguridad, con contratos de encargo y deberes de confidencialidad conforme a la ley.
        </p>
        <p>
          Además, para funciones presentes o futuras del producto, podremos compartir datos con aliados estratégicos
          estrictamente necesarios (por ejemplo, firma electrónica, validaciones, cobertura o servicios complementarios),
          siempre que exista base legal, finalidad compatible y medidas de seguridad razonables.
        </p>
        <p>
          No vendemos bases de datos personales como activo autónomo. Cuando haya proveedores o aliados en el exterior,
          aplicarán reglas de transferencia internacional y se informará la categoría de destinatarios en los términos
          exigidos por la normativa colombiana.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">14. Contacto</h2>
        <p>
          Para ejercicio de derechos y preguntas sobre privacidad: utilice los canales oficiales publicados en la
          aplicación. Consulte también el{" "}
          <Link href="/legal/aviso-privacidad" className="text-violet-700 hover:underline">
            Aviso de privacidad
          </Link>{" "}
          (resumen).
        </p>
      </section>
    </article>
  );
}
