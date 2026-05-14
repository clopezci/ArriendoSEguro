import Link from "next/link";

/**
 * Bloque 6 del plan de mejoras: oferta opcional de estudio de crédito vía
 * aliado externo. No bloquea el flujo. La URL del aliado se configura en
 * build con `NEXT_PUBLIC_CREDIT_STUDY_PARTNER_URL`; si está vacía, mostramos
 * mensaje de servicio futuro.
 */
export function CreditStudyOfferBlock({
  formCheckboxName,
  defaultChecked,
  subjectLabel,
}: {
  /** Nombre del checkbox en el `FormData` del paso (valor `"on"` si está marcado). */
  formCheckboxName: string;
  defaultChecked?: boolean;
  /** Texto que identifica a quién aplica (arrendatario o codeudor). */
  subjectLabel: string;
}) {
  const partnerUrl = (process.env.NEXT_PUBLIC_CREDIT_STUDY_PARTNER_URL ?? "").trim();
  const partnerLabel =
    (process.env.NEXT_PUBLIC_CREDIT_STUDY_PARTNER_LABEL ?? "").trim() ||
    "Ir al servicio del aliado";

  return (
    <div className="sm:col-span-2 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Estudio de crédito (opcional)</h3>
      <p className="mt-1 text-xs text-slate-600">
        Si quieres complementar la validación con un estudio de crédito sobre{" "}
        <strong>{subjectLabel}</strong>, puedes marcar la casilla. El trámite lo
        gestiona un proveedor especializado; los costos y tiempos dependen de ese
        aliado. ArriendoSeguro no cobra ni ejecuta el estudio desde esta pantalla.
      </p>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          name={formCheckboxName}
          defaultChecked={Boolean(defaultChecked)}
          className="mt-1 h-4 w-4 rounded border-slate-500 accent-violet-600"
        />
        <span>
          Quiero solicitar o gestionar un estudio de crédito para{" "}
          <strong>{subjectLabel}</strong> (opcional, no afecta la generación del
          contrato).
        </span>
      </label>

      <p className="mt-2 text-xs text-slate-600">
        El tratamiento de datos en el estudio lo define el aliado. Puedes revisar
        cómo tratamos los datos en la plataforma en{" "}
        <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
          aviso de privacidad
        </Link>
        .
      </p>

      {partnerUrl ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
          <p>
            Cuando estés listo, abre el enlace del aliado en una ventana aparte,
            completa su proceso y conserva los comprobantes en tu expediente
            (fuera de esta app si aplica).
          </p>
          <a
            href={partnerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            {partnerLabel}
          </a>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-medium text-amber-900">Próximamente con aliado especializado</p>
          <p className="mt-1">
            Estamos cerrando convenio con un proveedor de estudios de crédito en
            Colombia. Mientras tanto, puedes dejar marcado tu interés arriba para
            que quede registrado en el expediente; cuando activemos el enlace, lo
            verás aquí sin tener que volver a diligenciar el contrato.
          </p>
        </div>
      )}
    </div>
  );
}
