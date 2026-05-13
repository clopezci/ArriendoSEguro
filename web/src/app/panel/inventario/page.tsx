import Link from "next/link";

export const metadata = {
  title: "Inventario",
};

export default function InventarioPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inventario y actas</h1>
      <p className="text-slate-600 dark:text-slate-700">
        Aquí vamos a dejar fijo qué acompaña al inmueble, con fotos y anotaciones, según el caso
        de vivienda en Colombia. Todavía no está enlazado: primero afinamos el expediente; después
        sigues sin salir de la app.
      </p>
      <p className="text-sm text-amber-800 dark:text-amber-800">
        Módulo en cola. Si necesitas inventario hoy, puedes pasar a papel lo que tengas mientras
        abrimos esta pantalla.
      </p>
      <Link href="/panel" className="inline-block text-sm font-medium text-sky-600 hover:underline">
        ← Volver al panel
      </Link>
    </div>
  );
}
