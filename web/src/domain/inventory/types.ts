export type InventoryType = "initial" | "final";
export type InventoryStatus = "draft" | "completed" | "signed" | "voided";

export type ItemConditionStatus =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "damaged"
  | "not_applicable";

export type ItemCleanlinessStatus = "clean" | "acceptable" | "dirty" | "not_applicable";

export interface Inventory {
  id: string;
  leaseProcessId: string;
  contractId: string;
  contractVersionId: string;
  inventoryType: InventoryType;
  status: InventoryStatus;
  createdByUserId: string;
  completedAt?: string;
  signedAt?: string;
  generatedHtml?: string;
  generatedPdfUrl?: string;
  documentHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  inventoryId: string;
  zone: string;
  itemName: string;
  conditionStatus: ItemConditionStatus;
  cleanlinessStatus: ItemCleanlinessStatus;
  notes: string;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMeterReading {
  id: string;
  inventoryId: string;
  meterType: "water" | "electricity" | "gas" | "other";
  meterNumber: string;
  readingValue: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryKey {
  id: string;
  inventoryId: string;
  keyType: string;
  quantity: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type GuidedZoneStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface InventorySelectedZone {
  id: string;
  inventoryId: string;
  zoneCode: string;
  zoneName: string;
  customZoneName?: string;
  order: number;
  status: GuidedZoneStatus;
  skipReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type ZoneGeneralCondition =
  | "Excelente"
  | "Bueno"
  | "Aceptable"
  | "Regular"
  | "Malo"
  | "No aplica";

export type ZoneCleanlinessStatus = "Limpio" | "Aceptable" | "Sucio" | "No aplica";

export interface InventoryZoneDetail {
  id: string;
  inventoryId: string;
  selectedZoneId: string;
  generalCondition: ZoneGeneralCondition;
  cleanlinessStatus: ZoneCleanlinessStatus;
  observations: string;
  damageDescription: string;
  recommendations: string;
  photoUrls: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryZoneItem {
  id: string;
  inventoryId: string;
  selectedZoneId: string;
  itemName: string;
  conditionStatus: "excellent" | "good" | "fair" | "poor" | "damaged" | "not_applicable";
  notes: string;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
}

