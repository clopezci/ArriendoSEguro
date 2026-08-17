import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";
import { TaxLegalNote } from "@/components/legal/tax-legal-note";

export const metadata: Metadata = {
  title: "Términos y condiciones de uso",
  description: "Condiciones generales de uso de la plataforma ArriendoSeguro en Colombia.",
};

export default function TerminosPage() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-700">
      <header className="space-y-2 border-b border-slate-300 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Términos y condiciones de uso</h1>
        <p className="text-xs text-slate-500">
          Última actualización: 11 de agosto de 2026. Vigencia: Colombia. Responsable/operador: LOTIC (persona natural
          comerciante, NIT 71.217.228, Medellín).
        </p>
        <Link href="/" className="inline-block text-xs text-violet-700 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Objeto de la plataforma</h2>
        <p>
          {appConfig.name} es una plataforma tecnológica (software como servicio) que acompaña a las personas que
          arriendan directamente entre sí, sin inmobiliaria, en todo el ciclo del arriendo de vivienda urbana en
          Colombia. Mediante un asistente guiado, fácil e intuitivo, la plataforma permite:
        </p>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>
            <strong>Crear y personalizar el contrato de arrendamiento</strong> de vivienda urbana conforme a la
            Ley 820 de 2003, paso a paso, con controles de calidad (validación del documento de identidad por tipo, del
            teléfono y del <strong>tope legal del canon</strong> —1% del valor comercial, Ley 820—) que impiden avanzar
            con datos inválidos o en blanco.
          </li>
          <li>
            <strong>Herramientas de cálculo</strong>: canon máximo legal, reajuste anual por IPC, preaviso y garantía de
            servicios públicos.
          </li>
          <li>
            <strong>Sugerencias de cumplimiento normativo</strong> durante el diligenciamiento (topes, notificaciones,
            garantías permitidas y formalidades aplicables).
          </li>
          <li>
            <strong>Invitar a la otra parte</strong> (arrendatario y codeudor) para que ingrese sus propios datos y
            acepte sus propias declaraciones y juramentos, con verificación por código de un solo uso (OTP).
          </li>
          <li>
            <strong>Cargar y almacenar documentos soporte</strong> del expediente (por ejemplo, el poder del apoderado y
            demás soportes), con versiones identificadas.
          </li>
          <li>
            <strong>Firma electrónica simple con evidencia</strong> (fecha, IP y hash del documento) conforme a la
            Ley 527 de 1999 y el Decreto 2364 de 2012, por el principio de equivalencia funcional.
          </li>
          <li>
            <strong>Inventario guiado del inmueble</strong> con fotos por ambiente y generación del <strong>acta de
            entrega</strong>.
          </li>
          <li>
            <strong>Calendario y registro informativo de pagos</strong> del canon, con recordatorios al arrendatario,
            carga de soportes de pago y escalamiento cuando el pago no se confirma.
          </li>
          <li>
            <strong>Módulo de novedades y mantenimientos</strong> para registrar solicitudes, reparaciones y su
            seguimiento entre las partes.
          </li>
          <li>
            <strong>Alertas y notificaciones</strong> de vencimiento, terminación, renovación y reajuste por IPC, por
            los canales habilitados.
          </li>
          <li>
            <strong>Renovar el contrato</strong> a partir del expediente anterior.
          </li>
          <li>
            <strong>Evaluación estructurada de la experiencia</strong> (calificación mutua entre las partes) y consulta
            de reputación con el consentimiento del titular, conforme a la Ley 1581 de 2012 (Habeas Data).
          </li>
          <li>
            <strong>Generar evidencia y exportables</strong> del expediente, además de plantillas y guías legales
            orientativas.
          </li>
        </ul>
        <p>
          Todo lo anterior se ofrece dentro de los límites técnicos y legales descritos en estos términos. La
          disponibilidad de cada función depende del plan contratado (ver cláusula 13) y de la configuración vigente de
          la plataforma.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. Naturaleza del servicio</h2>
        <p>
          El servicio es de intermediación tecnológica y de software: no sustituye asesoría legal, tributaria,
          catastral ni notarial. Las partes son responsables del negocio jurídico del arriendo, de la veracidad de los
          datos y de cumplir la normativa aplicable (por ejemplo, normas de vivienda urbana y defensa del consumidor
          cuando corresponda, conforme a la Ley 1480 de 2011 y sus desarrollos).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. ArriendoSeguro como herramienta tecnológica</h2>
        <p>
          La plataforma organiza en un <strong>expediente digital único</strong> los datos, borradores, versiones,
          documentos soporte, firmas, inventario, acta de entrega, registros de pago, novedades, alertas y
          calificaciones asociados al arriendo que usted gestiona, de modo que las partes tengan trazabilidad y
          evidencia en un solo lugar. La plataforma automatiza cálculos, recordatorios y notificaciones, pero
          <strong> no reemplaza la voluntad ni las decisiones de las partes</strong>: la validez y oportunidad de los
          actos jurídicos dependen de las partes, del contenido acordado y de las formalidades que exija la ley para
          cada caso concreto.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. No somos inmobiliaria</h2>
        <p>
          {appConfig.name} no promueve inmuebles, no publica ofertas de arriendo como corredor, no visita predios, no
          negocia condiciones por cuenta de las partes ni cobra comisión por arrendar. Las partes contratan entre sí
          por su propia cuenta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. No somos abogado</h2>
        <p>
          Nada en la plataforma constituye asesoría legal. Para revisar cláusulas, situaciones especiales, personas
          jurídicas, subsidios, garantías distintas a las permitidas o cualquier duda jurídica, debe consultar a un
          abogado colegiado en Colombia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. No somos aseguradora</h2>
        <p>
          El nombre comercial no implica póliza, cobertura, liquidación de siniestros ni servicios propios de compañías
          de seguros supervisadas por la Superintendencia Financiera de Colombia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">7. No garantizamos pagos</h2>
        <p>
          La plataforma no garantiza que el arrendatario pague el canon ni que el arrendador cumpla entrega u
          obligaciones accesorias. Cualquier registro de pagos es informativo y no constituye recaudo, fideicomiso ni
          garantía de cumplimiento salvo que en el futuro se ofrezca un producto distinto expresamente regulado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">8. No recaudamos cánones</h2>
        <p>
          {appConfig.name} no recibe ni administra el dinero del canon entre las partes. Los pagos del canon se
          realizan fuera de la plataforma o por los medios que las partes acuerden, bajo su propio riesgo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">9. Uso permitido</h2>
        <p>Usted se compromete a:</p>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>Usar la plataforma de buena fe y con datos veraces.</li>
          <li>No suplantar identidades ni cargar documentos falsos.</li>
          <li>No emplear la plataforma para lavado de activos, fraude, acoso, discriminación ilícita o fines delictivos.</li>
          <li>Respetar los derechos de terceros y la propiedad intelectual de {appConfig.name} y de otros usuarios.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">10. Obligaciones del usuario</h2>
        <p>
          Debe mantener la confidencialidad de su cuenta, revisar las versiones del contrato antes de firmar, conservar
          copias propias de los documentos importantes y cumplir la normativa de protección de datos cuando actúe como
          responsable frente a otras personas (por ejemplo, al compartir datos de codeudores o fotos de terceros en
          inventarios).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">11. Documentos generados</h2>
        <p>
          Las plantillas y salidas de la plataforma son ayudas de formalización. La validez frente a terceros y
          autoridades depende del cumplimiento de requisitos legales, de la correspondencia con la realidad y de las
          firmas o solemnidades aplicables. Las versiones quedan identificadas en el sistema cuando la funcionalidad lo
          permita, según la política de firma electrónica.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">11B. Conservación y eliminación de información al terminar el contrato</h2>
        <p>
          Finalizado el contrato, el usuario podrá <strong>descargar</strong> la totalidad de su expediente y evidencias
          (contrato, actas, soportes y fotografías) para conservarlo por su cuenta, u <strong>optar por la custodia en la
          nube</strong> de ArriendoSeguro por el término y valor que se le informen al momento del cierre.
        </p>
        <p>
          Transcurridos <strong>siete (7) días</strong> desde el cierre del contrato, y salvo que el usuario haya elegido
          la custodia en la nube, ArriendoSeguro <strong>eliminará las fotografías y los soportes</strong> asociados, con
          el fin de optimizar el almacenamiento. Se <strong>conservarán</strong> el documento del contrato, la carta de
          recomendación, el historial y la calificación del arriendo por los términos legales aplicables (por ejemplo,
          hasta diez (10) años, artículos 28 y 60 del Código de Comercio).
        </p>
        <p>
          Es <strong>responsabilidad exclusiva del usuario</strong> descargar oportunamente su información. ArriendoSeguro
          <strong> no será responsable</strong> por la información que el usuario no haya descargado, ni por la eliminación
          realizada conforme a esta cláusula, todo ello en el marco de la Ley 1581 de 2012 (Habeas Data).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">12. Plan demo</h2>
        <p>
          El modo demo permite explorar la interfaz con datos ficticios o marcas de agua. No produce contratos válidos
          para uso probatorio ni sustituye el Plan Plus. Detalle en{" "}
          <Link href="/legal/demo" className="text-violet-700 hover:underline">
            Condiciones del modo demo
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">13. Planes: precio de introducción y contrato gratis por referidos, y servicios de aliados</h2>
        <p>{appConfig.name} ofrece un plan por contrato y un mecanismo de contrato gratis por referidos:</p>
        <ul className="list-inside list-disc space-y-1 text-slate-600">
          <li>
            <strong>Plan por contrato (precio de introducción):</strong> pago único por contrato (sin mensualidades),
            con un <strong>precio de introducción vigente</strong> que se muestra al contratar. Incluye la <strong>firma
            electrónica</strong> con validez y evidencia (Ley 527 de 1999), el inventario y acta de entrega, el
            calendario y registro de pagos, los soportes y anexos, el módulo de novedades, las alertas de terminación o
            renovación y la calificación de reputación. El <strong>precio de introducción es una oferta promocional de
            lanzamiento, de carácter temporal</strong>, y puede actualizarse con preaviso razonable.
          </li>
          <li>
            <strong>Contrato gratis por referidos:</strong> si invitas a <strong>3 personas</strong> y{" "}
            <strong>al menos 2 de ellas usan la app</strong> (generan su propio contrato), obtienes un{" "}
            <strong>contrato gratis</strong> con la firma incluida. Es un
            beneficio <strong>promocional y temporal</strong>: {appConfig.name} podrá, en cualquier momento y en la
            medida permitida por la ley, modificarlo, condicionarlo, limitar su alcance o darlo por terminado de manera
            prospectiva y con aviso razonable. <strong>No genera derechos adquiridos</strong> sobre su permanencia,
            precio futuro ni condiciones, y <strong>no afecta los contratos que ya hayas generado</strong> ni lo que ya
            hayas adquirido, conforme a la Ley 1480 de 2011.
          </li>
        </ul>
        <p>
          <strong>Servicios de aliados (terceros):</strong> de forma opcional podrás acceder a servicios de aliados con
          costo independiente (por ejemplo, seguros de arrendamiento, estudio de crédito, autenticación notarial,
          cobranza o asesoría jurídica). No son planes de {appConfig.name}: los presta y cobra directamente el tercero,
          bajo sus propias condiciones, y tú decides libremente si los tomas según tu necesidad puntual.{" "}
          {appConfig.name} no garantiza ni responde por esos servicios de terceros.
        </p>
        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <strong>Tratamiento tributario (IVA).</strong>{" "}
          <TaxLegalNote variant="inline" />
        </p>
        <p className="mt-3">
          <strong>Inicio del contrato definitivo y uso del cupo.</strong> Mientras un expediente no se haya
          <strong> iniciado como definitivo</strong>, puedes editarlo o eliminarlo libremente y el cupo del plan no se
          consume. Al pulsar <strong>“Iniciar contrato definitivo”</strong>, el expediente queda <strong>guardado, iniciado
          y bloqueado</strong>: no podrá eliminarse y <strong>consume el cupo pagado</strong>. Desde ese momento solo podrás
          ajustar elementos que <strong>no alteran el contenido contractual</strong> (recordatorios de pago, datos de
          contacto para notificaciones, novedades y soportes); los datos de fondo (partes, canon, fechas, cláusulas e
          inmueble) quedan en firme. Generar un <strong>nuevo contrato</strong> requiere un <strong>nuevo pago</strong>.
          Cualquier cambio de fondo sobre un contrato ya iniciado deberá ser autorizado y realizado por {appConfig.name}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">14. Pagos de la plataforma</h2>
        <p>
          Los cobros de {appConfig.name} corresponden al software y servicios de la plataforma (suscripción u otro
          modelo publicado), no al canon de arrendamiento. Los pagos se procesan a través de proveedores de pago; al
          usarlos acepta también sus términos cuando aplique.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">15. Limitación de responsabilidad</h2>
        <p>
          En la medida permitida por la ley colombiana, {appConfig.name} no responde por lucro cesante, daños indirectos
          o pérdidas derivadas de decisiones de las partes, de indisponibilidad temporal del servicio o de hechos de
          terceros. No se excluyen responsabilidades que la ley considere irrenunciables.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">16. Propiedad intelectual</h2>
        <p>
          Marca, diseño, código, textos de la plataforma y plantillas propias están protegidos. Usted conserva los
          derechos sobre el contenido que cargue; otorga a {appConfig.name} una licencia limitada para alojar,
          procesar y mostrar ese contenido según sea necesario para prestar el servicio.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">17. Suspensión de cuentas</h2>
        <p>
          Podemos suspender o cerrar cuentas ante uso fraudulento, incumplimiento grave de estos términos, requerimiento
          de autoridad competente o riesgo para la seguridad. Cuando sea razonable, se enviará aviso por los canales
          disponibles.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">18. Soporte</h2>
        <p>
          El soporte se presta por los canales habilitados en la aplicación (correo, formulario o chat según
          disponibilidad). Los tiempos de respuesta son orientativos y no incluyen asesoría legal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">19. Modificaciones</h2>
        <p>
          Podemos actualizar estos términos publicando la nueva versión en esta sección. El uso continuado después de
          la publicación puede implicar aceptación, salvo que la ley exija otro procedimiento para cambios sustanciales.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">20. Contacto</h2>
        <p>
          Consultas sobre estos términos: escriba a{" "}
          <a href="mailto:contacto@arriendoseguro.app" className="text-violet-700 hover:underline">
            contacto@arriendoseguro.app
          </a>{" "}
          o use los canales de contacto publicados en el sitio o en la aplicación. Para
          ejercer derechos sobre datos personales, consulte la{" "}
          <Link href="/legal/privacidad" className="text-violet-700 hover:underline">
            Política de tratamiento de datos personales
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
