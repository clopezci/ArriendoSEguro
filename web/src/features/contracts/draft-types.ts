import type { ColombianNotificationAddressParts } from "@/domain/colombia/structured-address";
import type { PersonParty } from "@/domain/contracts/types";

/** Datos parciales de una persona en borrador + dirección de notificación desglosada (opcional). */
export type PartyDraft = Partial<PersonParty> & {
  notificationAddressParts?: ColombianNotificationAddressParts | null;
};
