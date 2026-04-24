import { featureFlags, appConfig } from "@/lib/config";
import Link from "next/link";

export const metadata = {
  title: "Panel",
};

function ModuleCard({
  title,
  description,
  href,
  state,
}: {
  title: string;
  description: string;
  href: string;
  state: "activo" | "proximamente";
}) {
  const isSoon = state === "proximamente";
  return (
    <div
      className={`rounded-2xl border p-5 ${
        isSoon
          ? "border-slate-200/80 bg-white/50 dark:border-slate-700/80 dark:bg-slate-900/20"
          : "border-sky-200/80 bg-sky-50/50 dark:border-sky-800/50 dark:bg-sky-950/20"
      }`}
    >
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      {isSoon ? (
        <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200/90">
          Próximamente: lo estamos conectando al expediente.
        </p>
      ) : (
        <Link
          href={href}
          className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
        >
          Ir a {title.toLowerCase()} →
        </Link>
      )}
    </div>
  );
}

export default function PanelPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu panel en {appConfig.name}</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Acá vamos a ordenar el arriendo con calma, en el orden en que lo estamos armando: primero
          el expediente (datos, borradores, hitos), luego inventario, registro informativo de pagos
          y, al final, reputación. Nada reemplaza al abogado si tu caso lo pide: esto te ayuda a no
          perder papeles ni tiempos.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <ModuleCard
            title="1 · Expediente del arriendo"
            description="Un solo lugar con las partes, el inmueble, fechas, canon (valor del arriendo) y adonde colgamos el contrato y las firmas. Es el pilar de todo lo demás."
            href="/panel/expediente"
            state={featureFlags.leaseFormalization ? "activo" : "proximamente"}
          />
        </li>
        <li>
          <ModuleCard
            title="2 · Inventario y actas"
            description="Lista de qué deja o recibe el inmueble, con fotos si aplica, para entrega y cierre con menos discusiones."
            href="/panel/inventario"
            state={featureFlags.propertyInventory ? "activo" : "proximamente"}
          />
        </li>
        <li>
          <ModuleCard
            title="3 · Registro de pagos (informativo)"
            description="Anotar qué se pagó y cuándo, para que tú y la otra parte tengan el mismo espejo, sin manejar el dinero por acá (eso lo seguís haciendo por PSE, transferencia o el medio que usen en Colombia)."
            href="/panel/pagos"
            state={featureFlags.paymentLog ? "activo" : "proximamente"}
          />
        </li>
        <li>
          <ModuleCard
            title="4 · Reputación y calificaciones"
            description="Cuando el flujo tenga cierre, podrán evaluarse con criterio y reglas claras, para cuidar a quienes arrienda en serio."
            href="/panel"
            state={featureFlags.reviewsAndReputation ? "activo" : "proximamente"}
          />
        </li>
      </ul>
    </div>
  );
}
