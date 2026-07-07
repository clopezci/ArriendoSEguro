import Link from "next/link";

/**
 * Barra superior de navegación para páginas públicas/secundarias: un enlace de
 * "volver" (a inicio o a la sección contenedora) y, si aplica, un acceso directo
 * a "Inicio". Consistente con el header del blog.
 */
export function TopBackNav({
  backHref = "/",
  backLabel = "Volver al inicio",
  homeHref = "/",
}: {
  backHref?: string;
  backLabel?: string;
  homeHref?: string;
}) {
  return (
    <div className="border-b border-slate-200 bg-slate-100/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={backHref} className="text-sm font-medium text-violet-700 hover:underline">
          ← {backLabel}
        </Link>
        {backHref !== homeHref && (
          <Link href={homeHref} className="text-sm text-slate-600 hover:text-violet-700">
            Inicio
          </Link>
        )}
      </div>
    </div>
  );
}
