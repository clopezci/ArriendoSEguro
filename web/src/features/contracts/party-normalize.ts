/**
 * Une datos guardados en borrador (incl. dirección estructurada) al formato que esperan los esquemas Zod y el contrato.
 * Los borradores viejos solo tenían `notificationAddress` libre; los nuevos guardan `notificationAddressParts`.
 */

import {
  formatColombianNotificationAddress,
  type ColombianNotificationAddressParts,
} from "@/domain/colombia/structured-address";
import type { PersonParty, ResidentialLeaseContractInput } from "@/domain/contracts/types";
import type { PartyDraft } from "@/features/contracts/draft-types";

export function mergePartyDraftForValidation(draft: PartyDraft): Partial<PersonParty> {
  const { notificationAddressParts, ...rest } = draft;
  if (notificationAddressParts) {
    return {
      ...rest,
      notificationAddress: formatColombianNotificationAddress(
        notificationAddressParts as ColombianNotificationAddressParts,
      ),
    };
  }
  return rest;
}

/** Último paso antes de armar variables del PDF: persona con texto de dirección ya compuesto. */
export function partyDraftToPersonParty(draft: PartyDraft): PersonParty {
  const merged = mergePartyDraftForValidation(draft);
  const docType =
    merged.documentType === "TI" ? "CC" : (merged.documentType ?? "CC");
  return {
    fullName: merged.fullName ?? "",
    documentType: docType as PersonParty["documentType"],
    documentNumber: merged.documentNumber ?? "",
    city: merged.city ?? "",
    email: merged.email ?? "",
    phone: merged.phone ?? "",
    notificationAddress: merged.notificationAddress ?? "",
  };
}

export type PropertyDraftWithParts = Partial<ResidentialLeaseContractInput["property"]> & {
  monthlyRentProposed?: number;
  addressParts?: ColombianNotificationAddressParts | null;
};

/** Compone `address` desde partes urbanas para validar/guardar igual que en las partes. */
export function mergePropertyDraftForValidation(
  property: PropertyDraftWithParts,
): Partial<ResidentialLeaseContractInput["property"]> & { monthlyRentProposed?: number } {
  const { addressParts, ...rest } = property;
  if (addressParts) {
    return {
      ...rest,
      address: formatColombianNotificationAddress(addressParts),
    };
  }
  return rest;
}
