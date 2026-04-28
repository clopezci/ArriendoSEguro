import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Información legal",
  robots: { index: true, follow: true },
};

export default function LegalSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-10 pb-16 sm:px-6 sm:py-12">{children}</div>
    </div>
  );
}
