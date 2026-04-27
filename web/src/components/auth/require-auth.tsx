"use client";

import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/dashboard";

  useEffect(() => {
    if (loading || configError) return;
    if (!user) {
      const q = new URLSearchParams();
      q.set("redirect", pathname);
      router.replace(`/ingresar?${q.toString()}`);
    }
  }, [user, loading, configError, pathname, router]);

  if (configError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-950">
        <p className="max-w-md text-slate-700 dark:text-slate-200">
          Falta la configuración de Firebase en el cliente. Añadí en{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm dark:bg-slate-800">
            web/.env.local
          </code>{" "}
          las variables{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm dark:bg-slate-800">
            NEXT_PUBLIC_FIREBASE_*
          </code>{" "}
          del proyecto (Consola de Firebase &gt; Configuración del proyecto &gt; Tus apps &gt; Web).
        </p>
        <Link
          href="/"
          className="mt-6 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <p className="text-sm">Cargando tu sesión…</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
