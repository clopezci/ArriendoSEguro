"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PHRASE = "ELIMINAR MI CUENTA";

export default function EliminarCuentaPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [signedCount, setSignedCount] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [step1, setStep1] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      setLoadErr("");
      try {
        const res = await fetch("/api/cuenta/resumen", { headers: { ...(await buildAuthHeaders(user)) } });
        const data = (await res.json()) as { success?: boolean; signedContractsCount?: number };
        if (res.ok && data.success) setSignedCount(Number(data.signedContractsCount ?? 0));
        else setLoadErr("No se pudo consultar el estado de tus contratos firmados.");
      } catch {
        setLoadErr("Error de red al consultar el resumen.");
      }
    })();
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/ingresar?redirect=${encodeURIComponent("/dashboard/cuenta/eliminar")}`);
    }
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!user) return;
    if (!step1) {
      setErr("Marca la casilla de confirmación después de leer el aviso.");
      return;
    }
    if (signedCount !== null && signedCount > 0) {
      setErr(
        "Mientras tengas contratos firmados en la plataforma, la eliminación automática no está disponible. Escríbenos a privacidad@arriendoseguro.com.co.",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ confirmPhrase: phrase.trim() }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        code?: string;
        errors?: { message?: string }[];
      };
      if (res.status === 409 && data.code === "RETENTION_SIGNED_CONTRACTS") {
        setErr(
          data.errors?.[0]?.message ??
            "Existen contratos firmados asociados a tu cuenta. Contacta privacidad@arriendoseguro.com.co.",
        );
        return;
      }
      if (!res.ok || !data.success) {
        setErr(data.errors?.[0]?.message ?? "No se pudo eliminar la cuenta.");
        return;
      }
      setMsg("Cuenta eliminada. Te redirigimos al inicio…");
      await signOut();
      router.replace("/");
    } catch {
      setErr("Error de red. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        <p>Cargando sesión…</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Zona sensible</p>
        <h1 className="text-2xl font-bold">Eliminar mi cuenta</h1>
        <p className="text-sm text-slate-600">
          Esta acción borra tu usuario de acceso y cancela tus planes demo o Plus en el sistema. Los expedientes en
          Firestore pueden conservarse por obligaciones legales cuando ya hubo firma; revisa el aviso de privacidad.
        </p>
        <Link href="/dashboard/account" className="text-sm text-violet-700 underline">
          Volver a mi cuenta
        </Link>
      </header>

      {loadErr && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {loadErr}
        </p>
      )}

      {signedCount !== null && signedCount > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">Eliminación automática no disponible</p>
          <p className="mt-2">
            Detectamos <strong>{signedCount}</strong> contrato(s) firmado(s) en los que participaste con este correo.
            Conservamos la información del expediente conforme a la Ley 1581 de 2012 y la normativa aplicable. Para
            solicitar supresión o anonimización cuando proceda, escribe a{" "}
            <a href="mailto:privacidad@arriendoseguro.com.co" className="font-medium underline">
              privacidad@arriendoseguro.com.co
            </a>
            .
          </p>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="font-medium text-slate-900">Antes de continuar</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Descarga o imprime lo que necesites desde{" "}
            <Link href="/dashboard/leases" className="text-violet-700 underline">
              Mis arriendos
            </Link>{" "}
            y el ZIP de evidencia de cada expediente.
          </li>
          <li>Los borradores guardados solo en tu navegador se pierden si limpias el almacenamiento local.</li>
          <li>Si tienes un pago o plan activo, revisa con soporte si aplica reembolso según las condiciones del producto.</li>
        </ul>
      </section>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={step1}
            onChange={(e) => setStep1(e.target.checked)}
            className="mt-1"
            disabled={busy || (signedCount !== null && signedCount > 0)}
          />
          <span>Entiendo que perderé el acceso con este correo y que pueden conservarse expedientes firmados según ley.</span>
        </label>

        <div>
          <label htmlFor="phrase" className="block text-sm font-medium text-slate-900">
            Escribe en mayúsculas: {PHRASE}
          </label>
          <input
            id="phrase"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            disabled={busy || (signedCount !== null && signedCount > 0)}
          />
        </div>

        {err && (
          <p className="text-sm text-rose-700" role="alert">
            {err}
          </p>
        )}
        {msg && (
          <p className="text-sm text-emerald-700" role="status">
            {msg}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (signedCount !== null && signedCount > 0)}
          className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Procesando…" : "Eliminar cuenta de forma definitiva"}
        </button>
      </form>
    </main>
  );
}
