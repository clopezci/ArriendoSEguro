import type { Metadata } from "next";
import { ReadAloudRegion } from "@/components/a11y/read-aloud-region";

export const metadata: Metadata = {
  title: "Información legal",
  robots: { index: true, follow: true },
};

export default function LegalSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-10 pb-16 sm:px-6 sm:py-12">
        <ReadAloudRegion label="Escuchar esta página">{children}</ReadAloudRegion>
      </div>
    </div>
  );
}
