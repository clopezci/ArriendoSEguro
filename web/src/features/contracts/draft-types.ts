import type { ColombianNotificationAddressParts } from "@/domain/colombia/structured-address";
import type { PersonParty } from "@/domain/contracts/types";

/**
 * Datos parciales de una persona en borrador + dirección de notificación
 * desglosada (opcional) + aceptación de la declaración bajo gravedad de
 * juramento (opcional para mantener compatibilidad con borradores
 * generados antes de exigirla).
 */
export type PartyDraft = Partial<PersonParty> & {
  notificationAddressParts?: ColombianNotificationAddressParts | null;
  /**
   * `true` cuando la persona aceptó expresamente la declaración bajo
   * gravedad de juramento. Se registra para evidencia y auditoría.
   */
  truthfulnessOathAccepted?: boolean;
  /**
   * Datos opcionales del soporte económico del codeudor solidario
   * (informativos). Solo aplica cuando esta `PartyDraft` corresponde al
   * codeudor; no se imprime en el contrato y no se valida obligatoriedad.
   */
  economicSupport?: CodebtorEconomicSupportDraft;
};

/**
 * Información de respaldo económico del codeudor solidario. Es práctica
 * común en el mercado informal pedir carta laboral, colilla de pago o
 * certificado de libertad y tradición. ArriendoSeguro no custodia los
 * documentos: solo registra qué entregó y los datos básicos para que el
 * arrendador y el equipo de soporte tengan la trazabilidad.
 */
export interface CodebtorEconomicSupportDraft {
  employerName?: string;
  position?: string;
  monthlyIncome?: number;
  /**
   * Tipos de soporte que el codeudor entregó al arrendador. Lista
   * controlada para que la información quede comparable entre expedientes.
   */
  documentsProvided?: Array<
    | "CARTA_LABORAL"
    | "COLILLA_PAGO"
    | "CERTIFICADO_LIBERTAD_TRADICION"
    | "EXTRACTO_BANCARIO"
    | "DECLARACION_RENTA"
    | "OTRO"
  >;
  notes?: string;
  /**
   * El arrendador declara haber recibido y verificado los soportes
   * económicos del codeudor. Queda como evidencia operativa en el
   * expediente.
   */
  landlordVerifiedConsent?: boolean;
}
