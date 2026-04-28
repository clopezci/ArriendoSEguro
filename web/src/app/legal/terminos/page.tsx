import { appConfig } from "@/lib/config";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones de uso",
  description: "Condiciones generales de uso de la plataforma ArriendoSeguro en Colombia.",
};

export default function TerminosPage() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-slate-300">
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Información legal</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Términos y condiciones de uso</h1>
        <p className="text-xs text-slate-500">
          Última actualización orientativa para esta fase inicial del servicio. Vigencia: Colombia.
        </p>
        <Link href="/" className="inline-block text-xs text-violet-400 hover:underline">
          Volver al inicio
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">1. Objeto de la plataforma</h2>
        <p>
          {appConfig.name} es una plataforma digital que ayuda a personas que ya acordaron un arriendo entre sí a
          organizar información, usar plantillas orientativas, registrar hitos (como inventario o pagos de forma
          informativa) y, cuando aplique, apoyar procesos de firma electrónica simple, siempre dentro de los límites
          técnicos y legales descritos aquí.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">2. Naturaleza del servicio</h2>
        <p>
          El servicio es de intermediación tecnológica y de software: no sustituye asesoría legal, tributaria,
          catastral ni notarial. Las partes son responsables del negocio jurídico del arriendo, de la veracidad de los
          datos y de cumplir la normativa aplicable (por ejemplo, normas de vivienda urbana y defensa del consumidor
          cuando corresponda, conforme a la Ley 1480 de 2011 y sus desarrollos).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">3. ArriendoSeguro como herramienta tecnológica</h2>
        <p>
          La plataforma ofrece herramientas para cargar datos, generar borradores, almacenar versiones y documentos
          asociados al expediente que usted crea. La validez y oportunidad de los actos jurídicos dependen de las
          partes, del contenido acordado y de las formalidades que exija la ley para cada caso concreto.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">4. No somos inmobiliaria</h2>
        <p>
          {appConfig.name} no promueve inmuebles, no publica ofertas de arriendo como corredor, no visita predios, no
          negocia condiciones por cuenta de las partes ni cobra comisión por arrendar. Las partes contratan entre sí
          por su propia cuenta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">5. No somos abogado</h2>
        <p>
          Nada en la plataforma constituye asesoría legal. Para revisar cláusulas, situaciones especiales, personas
          jurídicas, subsidios, garantías distintas a las permitidas o cualquier duda jurídica, debe consultar a un
          abogado colegiado en Colombia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">6. No somos aseguradora</h2>
        <p>
          El nombre comercial no implica póliza, cobertura, liquidación de siniestros ni servicios propios de compañías
          de seguros supervisadas por la Superintendencia Financiera de Colombia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">7. No garantizamos pagos</h2>
        <p>
          La plataforma no garantiza que el arrendatario pague el canon ni que el arrendador cumpla entrega u
          obligaciones accesorias. Cualquier registro de pagos es informativo y no constituye recaudo, fideicomiso ni
          garantía de cumplimiento salvo que en el futuro se ofrezca un producto distinto expresamente regulado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">8. No recaudamos cánones</h2>
        <p>
          {appConfig.name} no recibe ni administra el dinero del canon entre las partes. Los pagos del canon se
          realizan fuera de la plataforma o por los medios que las partes acuerden, bajo su propio riesgo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">9. Uso permitido</h2>
        <p>Usted se compromete a:</p>
        <ul className="list-inside list-disc space-y-1 text-slate-400">
          <li>Usar la plataforma de buena fe y con datos veraces.</li>
          <li>No suplantar identidades ni cargar documentos falsos.</li>
          <li>No emplear la plataforma para lavado de activos, fraude, acoso, discriminación ilícita o fines delictivos.</li>
          <li>Respetar los derechos de terceros y la propiedad intelectual de {appConfig.name} y de otros usuarios.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">10. Obligaciones del usuario</h2>
        <p>
          Debe mantener la confidencialidad de su cuenta, revisar las versiones del contrato antes de firmar, conservar
          copias propias de los documentos importantes y cumplir la normativa de protección de datos cuando actúe como
          responsable frente a otras personas (por ejemplo, al compartir datos de codeudores o fotos de terceros en
          inventarios).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">11. Documentos generados</h2>
        <p>
          Las plantillas y salidas de la plataforma son ayudas de formalización. La validez frente a terceros y
          autoridades depende del cumplimiento de requisitos legales, de la correspondencia con la realidad y de las
          firmas o solemnidades aplicables. Las versiones quedan identificadas en el sistema cuando la funcionalidad lo
          permita, según la política de firma electrónica.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">12. Plan demo</h2>
        <p>
          El modo demo permite explorar la interfaz con datos ficticios o marcas de agua. No produce contratos válidos
          para uso probatorio ni sustituye el Plan Plus. Detalle en{" "}
          <Link href="/legal/demo" className="text-violet-400 hover:underline">
            Condiciones del modo demo
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">13. Plan Plus</h2>
        <p>
          El Plan Plus u otros planes pagos habilitan funciones adicionales (por ejemplo, expediente real, límites de
          uso y generación de documentos según la configuración vigente). Las condiciones comerciales, precios y
          renovación se muestran al contratar y pueden actualizarse con preaviso razonable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">14. Pagos de la plataforma</h2>
        <p>
          Los cobros de {appConfig.name} corresponden al software y servicios de la plataforma (suscripción u otro
          modelo publicado), no al canon de arrendamiento. Los pagos se procesan a través de proveedores de pago; al
          usarlos acepta también sus términos cuando aplique.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">15. Limitación de responsabilidad</h2>
        <p>
          En la medida permitida por la ley colombiana, {appConfig.name} no responde por lucro cesante, daños indirectos
          o pérdidas derivadas de decisiones de las partes, de indisponibilidad temporal del servicio o de hechos de
          terceros. No se excluyen responsabilidades que la ley considere irrenunciables.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">16. Propiedad intelectual</h2>
        <p>
          Marca, diseño, código, textos de la plataforma y plantillas propias están protegidos. Usted conserva los
          derechos sobre el contenido que cargue; otorga a {appConfig.name} una licencia limitada para alojar,
          procesar y mostrar ese contenido según sea necesario para prestar el servicio.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">17. Suspensión de cuentas</h2>
        <p>
          Podemos suspender o cerrar cuentas ante uso fraudulento, incumplimiento grave de estos términos, requerimiento
          de autoridad competente o riesgo para la seguridad. Cuando sea razonable, se enviará aviso por los canales
          disponibles.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">18. Soporte</h2>
        <p>
          El soporte se presta por los canales habilitados en la aplicación (correo, formulario o chat según
          disponibilidad). Los tiempos de respuesta son orientativos y no incluyen asesoría legal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">19. Modificaciones</h2>
        <p>
          Podemos actualizar estos términos publicando la nueva versión en esta sección. El uso continuado después de
          la publicación puede implicar aceptación, salvo que la ley exija otro procedimiento para cambios sustanciales.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">20. Contacto</h2>
        <p>
          Consultas sobre estos términos: use los canales de contacto publicados en el sitio o en la aplicación. Para
          ejercer derechos sobre datos personales, consulte la{" "}
          <Link href="/legal/privacidad" className="text-violet-400 hover:underline">
            Política de tratamiento de datos personales
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
