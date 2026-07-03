import Link from "next/link";

const MIDATA_URL = "https://www.midatacredito.com/";
const BDME_URL = "https://eris.contaduria.gov.co/BDME/";

/**
 * Bloque 6 (ajustado): orientación al arrendador (dueño) sobre consultas de
 * historial crediticio y deudas con el Estado, sin carga de archivos en la
 * app (información 100 % privada fuera de la plataforma).
 */
export function CreditHistoryGuidanceBlock({
  variant,
  verificationName,
  defaultVerified,
}: {
  variant: "tenant" | "codebtor";
  /** Nombre del grupo de radios en FormData (`yes` | `no`). */
  verificationName: string;
  defaultVerified?: "yes" | "no";
}) {
  const isTenant = variant === "tenant";
  const partyPhrase = isTenant
    ? "del arrendatario (inquilino)"
    : "del codeudor solidario";

  return (
    <div className="sm:col-span-2 space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Historial crediticio y consultas externas
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Estas herramientas son de terceros. ArriendoSeguro no ejecuta la consulta,
          no recibe certificados ni puntajes, y no guarda aquí ningún documento de
          historial crediticio.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-800">
        <h4 className="font-semibold text-slate-900">Consulta en central de riesgos</h4>
        <p className="mt-2 leading-relaxed">
          En Colombia, la consulta de historial crediticio ante centrales de riesgo
          corresponde, en lo general, a la persona titular de los datos o a quien
          cuente con su autorización conforme a la ley. Si tú, como arrendador (dueño
          del inmueble), necesitas evaluar el historial{" "}
          {isTenant ? "del arrendatario (inquilino)" : "del codeudor solidario"}, lo
          razonable es que las partes acuerden que quien titula la información acceda
          por su cuenta (por ejemplo a través del proveedor que corresponda), obtenga
          el reporte y te lo comparta por un canal privado entre ustedes.
        </p>
        <p className="mt-2 leading-relaxed">
          Quien recibe ese tipo de información debe usarla solo para fines relacionados
          con evaluar el arriendo, tratarla con confidencialidad, no difundirla sin
          fundamento legal o sin autorización cuando aplique, y cuando ya no sea
          necesaria para esa finalidad proceder a su supresión o descarte seguro,
          en línea con la Ley 1581 de 2012 (Habeas Data) y las condiciones del
          proveedor. Esto es orientación general; ante dudas conviene asesoría
          profesional.
        </p>
        <a
          href={MIDATA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Ir a MiDatacrédito
        </a>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-800">
        <h4 className="font-semibold text-slate-900">Deudas con el Estado (BDME)</h4>
        <p className="mt-2 leading-relaxed">
          El Boletín de Deudores Morosos del Estado es un servicio de la Contaduría
          General de la República. Úsalo solo para fines lícitos relacionados con el
          arriendo, respeta las reglas de la propia consulta y trata cualquier dato
          personal con cuidado: no lo copies ni lo compartas más allá de lo
          necesario, y cuando deje de ser pertinente para esa finalidad evita
          conservarlo sin justificación.
        </p>
        <a
          href={BDME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Ir al BDME (Contaduría)
        </a>
      </section>

      <fieldset className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
        <legend className="text-sm font-semibold text-slate-900">
          Verificación en tu expediente (sin adjuntar archivos)
        </legend>
        <p className="mt-1 text-xs text-slate-700">
          Marca una opción. Esto solo deja constancia en el expediente de que indicas
          haber verificado o no el historial crediticio {partyPhrase} por medios
          externos a ArriendoSeguro. No sustituye asesoría legal ni certifica
          resultados.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-800">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={verificationName}
              value="yes"
              defaultChecked={defaultVerified === "yes"}
              className="h-4 w-4 accent-violet-600"
            />
            Sí, indiqué o recibí verificación del historial (fuera de esta app)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={verificationName}
              value="no"
              defaultChecked={defaultVerified === "no"}
              className="h-4 w-4 accent-violet-600"
            />
            No
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-slate-600">
        Tratamiento de datos en la plataforma:{" "}
        <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
          aviso de privacidad
        </Link>
        .
      </p>
    </div>
  );
}
