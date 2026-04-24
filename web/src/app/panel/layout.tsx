import { RequireAuth } from "@/components/auth/require-auth";
import { PanelHeader } from "@/components/layout/panel-header";

export const dynamic = "force-dynamic";

export default function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <PanelHeader />
        <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>
      </div>
    </RequireAuth>
  );
}
