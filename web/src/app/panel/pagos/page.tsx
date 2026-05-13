import { appConfig } from "@/lib/config";
import Link from "next/link";

export const metadata = {
  title: "Pagos",
};

export default function PagosPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Registro informativo de pagos</h1>
      <p className="text-slate-600 dark:text-slate-700">
        La idea no es manejar el canon por {appConfig.name} (transferencias, PSE, efectivo, lo que
        usen en Colombia sigue en los medios que ustedes elijan), sino dejar anotado qué pago, qué
        cubría, y con qué fecha, para bajar ruido entre arrendatario y arrendador.
      </p>
      <p className="text-sm text-amber-800 dark:text-amber-800">
        Módulo en cola, después de inventario, para que toda la historia quede conectada al mismo
        expediente.
      </p>
      <Link href="/panel" className="inline-block text-sm font-medium text-sky-600 hover:underline">
        ← Volver al panel
      </Link>
    </div>
  );
}
