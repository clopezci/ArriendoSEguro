import type { InventoryItem, InventoryKey, InventoryMeterReading } from "./types";

export type InventoryValidationIssue = { field: string; message: string };

export function validateInventoryDraft(input: {
  leaseProcessId?: string;
  contractId?: string;
  contractVersionId?: string;
}): InventoryValidationIssue[] {
  const issues: InventoryValidationIssue[] = [];
  if (!input.leaseProcessId) issues.push({ field: "leaseProcessId", message: "leaseProcessId es obligatorio." });
  if (!input.contractId) issues.push({ field: "contractId", message: "contractId es obligatorio." });
  if (!input.contractVersionId) {
    issues.push({ field: "contractVersionId", message: "contractVersionId es obligatorio." });
  }
  return issues;
}

export function validateInventoryCompletion(input: {
  items: InventoryItem[];
  meterReadings: InventoryMeterReading[];
  keys: InventoryKey[];
}): InventoryValidationIssue[] {
  const issues: InventoryValidationIssue[] = [];
  if (input.items.length === 0) {
    issues.push({ field: "items", message: "Debe existir al menos un elemento en el inventario." });
  }
  if (!input.items.some((i) => i.zone.trim() && i.itemName.trim())) {
    issues.push({ field: "items", message: "Debe existir al menos una zona y un elemento válido." });
  }
  input.items.forEach((item, idx) => {
    if (!item.conditionStatus) {
      issues.push({ field: `items[${idx}].conditionStatus`, message: "Estado del elemento obligatorio." });
    }
    if (!item.cleanlinessStatus) {
      issues.push({ field: `items[${idx}].cleanlinessStatus`, message: "Estado de limpieza obligatorio." });
    }
  });
  input.keys.forEach((k, idx) => {
    if (k.quantity <= 0) issues.push({ field: `keys[${idx}].quantity`, message: "Cantidad de llaves inválida." });
  });
  void input.meterReadings;
  return issues;
}

