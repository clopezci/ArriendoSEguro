import { IngresarForm } from "./ingresar-form";
import { appConfig } from "@/lib/config";
import { Suspense } from "react";

export const metadata = {
  title: "Ingresar",
  description: "Accede a tu panel para el expediente de arriendo en Colombia.",
};

export default function IngresarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold tracking-tight">Ingresar a {appConfig.name}</h1>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-700">
          Usa el mismo correo y contraseña con el que te registras; desde aquí vamos a armar el
          expediente del arriendo paso a paso.
        </p>
        <Suspense
          fallback={
            <p className="mt-6 text-center text-sm text-slate-500">Cargando formulario…</p>
          }
        >
          <IngresarForm />
        </Suspense>
      </div>
    </div>
  );
}
