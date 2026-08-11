import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import { formatCop } from "@/lib/product-pricing";

/**
 * Textos PREDETERMINADOS (editables) para las solicitudes del dueño que se
 * pre-cargan con los datos del contrato: "cobro" (requerimiento de pago) y
 * "return" (entrega/restitución del inmueble). Legalmente firmes pero sin
 * amenazas indebidas; el dueño puede ajustarlos antes de enviar. Revisar con
 * abogado antes de producción.
 */
export type RequestTemplate = { title: string; description: string };

export function buildRequestTemplate(
  template: "none" | "charge" | "return",
  payload: ResidentialLeaseContractInput | undefined,
): RequestTemplate | null {
  if (!payload || template === "none") return null;
  const landlord = (payload.landlord?.fullName || "").trim() || "el arrendador";
  const tenant = (payload.tenant?.fullName || "").trim() || "el arrendatario";
  const address = (payload.property?.address || "").trim() || "el inmueble";
  const canon = formatCop(Number(payload.lease?.monthlyRent) || 0);
  const dueDay = Number(payload.lease?.paymentDueDay) || 0;

  if (template === "charge") {
    return {
      title: "Solicitud de pago del canon",
      description:
        `Yo, ${landlord}, en calidad de arrendador del inmueble ubicado en ${address}, requiero al arrendatario ${tenant} ` +
        `el pago del canon de arrendamiento por valor de ${canon}` +
        (dueDay ? `, con vencimiento el día ${dueDay} de cada mes` : "") +
        `, conforme al contrato de arrendamiento. Agradezco realizar el pago a la mayor brevedad y adjuntar el soporte correspondiente. ` +
        `En caso de continuar la mora, el arrendador podrá iniciar las acciones legales previstas en el contrato y en la Ley 820 de 2003.`,
    };
  }

  // return
  return {
    title: "Solicitud de entrega / restitución del inmueble",
    description:
      `Con fundamento en el contrato de arrendamiento del inmueble ubicado en ${address}, y con el preaviso correspondiente, ` +
      `solicito al arrendatario ${tenant} la entrega y restitución del inmueble. ` +
      `Quedo atento para coordinar la fecha y el acta de entrega, dejando constancia del estado del inmueble.`,
  };
}

/** Mapa de plantillas por tipo de solicitud del dueño, listo para el cliente. */
export function buildOwnerTemplates(payload: ResidentialLeaseContractInput | undefined): Record<string, RequestTemplate> {
  const out: Record<string, RequestTemplate> = {};
  const charge = buildRequestTemplate("charge", payload);
  const ret = buildRequestTemplate("return", payload);
  if (charge) out.charge = charge;
  if (ret) out.return = ret;
  return out;
}
