import { GuidedDemoTour } from "@/components/demo/guided-demo-tour";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo guiado Plan Plus",
  description:
    "Recorrido visual con datos ficticios: expediente, contrato, firma, inventario, pagos y anexos. No genera documentos legales ni guarda expedientes reales.",
  // Recorrido interactivo (poco texto rastreable): no indexar, seguir enlaces.
  robots: { index: false, follow: true },
};

export default function DemoPage() {
  return <GuidedDemoTour />;
}
