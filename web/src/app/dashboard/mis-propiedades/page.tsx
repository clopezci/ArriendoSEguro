"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  getMyLandlordProfile,
  listMyProperties,
  deleteMyProperty,
} from "@/features/contracts/saved-entities-client";
import type { SavedLandlordProfile, SavedProperty } from "@/domain/saved-entities/savedEntities";

export default function MisPropiedadesPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SavedLandlordProfile | null>(null);
  const [props, setProps] = useState<SavedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const [p, list] = await Promise.all([getMyLandlordProfile(user), listMyProperties(user)]);
      if (!cancelled) {
        setProfile(p);
        setProps(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onDelete(id: string) {
    if (!user) return;
    setBusyId(id);
    const ok = await deleteMyProperty(user, id);
    if (ok) setProps((prev) => prev.filter((x) => x.id !== id));
    setBusyId("");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Mis datos y propiedades</h1>
        <p className="text-sm text-slate-600">
          Estos datos son <strong>tuyos y solo tú los ves</strong>. Los usamos para agilizar tus próximos contratos
          (Ley 1581 de 2012). Puedes borrarlos cuando quieras.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-600">Cargando…</p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Mis datos de arrendador</h2>
            {profile ? (
              <p className="mt-1 text-sm text-slate-700">
                <strong>{profile.fullName}</strong> · {profile.documentType} {profile.documentNumber}
                {profile.city ? ` · ${profile.city}` : ""}
                <span className="mt-1 block text-xs text-slate-500">
                  Se prellenan al crear un contrato (paso «Arrendador»); ahí puedes ajustarlos y volver a guardar.
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                Aún no has guardado tus datos. Se guardan al crear un contrato (marca «Guardar mis datos»).
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Mis propiedades</h2>
            {props.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">
                Aún no has guardado inmuebles. Se guardan en el paso «Inmueble» de un contrato.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {props.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <strong className="text-slate-800">{p.label}</strong>
                      {p.property?.address ? (
                        <span className="block text-xs text-slate-500">{p.property.address}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void onDelete(p.id)}
                      className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
                    >
                      {busyId === p.id ? "Borrando…" : "Borrar"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/dashboard/contracts/new" className="inline-flex text-sm font-semibold text-violet-700 underline">
            Crear un contrato nuevo →
          </Link>
        </>
      )}
    </main>
  );
}
