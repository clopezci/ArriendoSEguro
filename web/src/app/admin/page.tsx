"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { PLAN_PLUS_CUSTOM_COP_LIMITS } from "@/domain/platform-payments/plan-plus-pricing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardPayload = {
  success: boolean;
  features?: { manualGrantPlus: boolean };
  summary?: {
    usersRegistered: number | null;
    surveysResponded: number | null;
    demoAccessesActive: number | null;
    plusAccessesActive: number | null;
    expedientesCreados: number | null;
    contractVersions: number | null;
    platformPaymentsApproved: number | null;
    contractsSigned?: number | null;
    funnel?: {
      surveys: number | null;
      registered: number | null;
      contractsCreated: number | null;
      contractsSigned: number | null;
      surveyToRegistered: number | null;
      registeredToContract: number | null;
      contractToSigned: number | null;
    };
    recentErrors: { eventName: string; createdAt: string; metadataSummary: string }[];
  };
  surveys?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
  accesses?: Record<string, unknown>[];
  platformOrders?: Record<string, unknown>[];
  platformPayments?: Record<string, unknown>[];
  expedientes?: Record<string, unknown>[];
  audit?: Record<string, unknown>[];
  errors?: { message: string }[];
};

type ObsReport = {
  id: string;
  category: string;
  message: string;
  reporterEmail: string;
  isAuthenticated: boolean;
  status: string;
  pageUrl: string;
  createdAt: string;
};

type ObsErrorEvent = {
  id: string;
  kind: string;
  message: string;
  source: string;
  count: number;
  resolved: boolean;
  lastPageUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type ObsPayload = {
  success: boolean;
  reports?: ObsReport[];
  errorEvents?: ObsErrorEvent[];
  totals?: { reportsNew: number; errorsUnresolved: number };
};

type LegalConfigState = {
  success: boolean;
  currentYear: number;
  confirmedThisYear: boolean;
  config: {
    ipcPercent: number;
    ipcPreviousYear: number;
    ipcAppliesToYear: number;
    ipcSource: string;
    ipcUpdatedAt: string | null;
    ipcUpdatedByEmail: string | null;
    ipcConfirmedForYear: number | null;
  };
};

function publicAdminHintEmails(): string[] {
  if (typeof window === "undefined") return [];
  const raw = process.env.NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<
    | "resumen"
    | "encuestas"
    | "usuarios"
    | "accesos"
    | "pagos"
    | "expedientes"
    | "auditoria"
    | "reportes"
    | "errores"
  >("resumen");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [obs, setObs] = useState<ObsPayload | null>(null);
  const [legal, setLegal] = useState<LegalConfigState | null>(null);
  const [ipcInput, setIpcInput] = useState("");
  const [ipcYearInput, setIpcYearInput] = useState("");
  const [legalMsg, setLegalMsg] = useState("");
  const [legalBusy, setLegalBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [grantEmail, setGrantEmail] = useState("");
  const [grantMsg, setGrantMsg] = useState("");
  const [grantErr, setGrantErr] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantDetail, setGrantDetail] = useState<{
    status: "created" | "already_exists";
    entitlementId: string;
    userId: string;
    userEmail: string;
  } | null>(null);
  /** Limite inicial de expedientes reales para Plan Plus manual (1–50). */
  const [grantMaxContracts, setGrantMaxContracts] = useState("");
  /** Ajustar cupos de testers con Plus ya creado. */
  const [quotaMaxInput, setQuotaMaxInput] = useState("");
  const [quotaSlotsInput, setQuotaSlotsInput] = useState("1");
  const [quotaMsg, setQuotaMsg] = useState("");
  const [quotaErr, setQuotaErr] = useState("");
  const [quotaLoading, setQuotaLoading] = useState(false);

  // Diagnóstico rápido: dado un email, mostrar el usuario de Auth y todas
  // sus filas en `access_entitlements`. Resuelve el caso típico "le di
  // Plus a alguien pero le sigue pidiendo el plan": basta con escribir
  // el correo y se ve si el entitlement existe, su estado y su uid.
  const [inspectEmail, setInspectEmail] = useState("");
  const [inspectedEmail, setInspectedEmail] = useState("");

  const [ppPreset, setPpPreset] = useState<"promo_49900" | "list_89900" | "custom">("promo_49900");
  const [ppCustom, setPpCustom] = useState("");
  const [ppCustomList, setPpCustomList] = useState("");
  const [ppResolved, setPpResolved] = useState<{ checkoutCop: number; listCompareCop: number } | null>(null);
  const [ppPricingErr, setPpPricingErr] = useState("");
  const [ppPricingMsg, setPpPricingMsg] = useState("");
  const [ppSaveLoading, setPpSaveLoading] = useState(false);

  const hintSet = useMemo(() => new Set(publicAdminHintEmails()), []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/ingresar?redirect=${encodeURIComponent("/admin")}`);
    }
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError("");
    try {
      const res = await fetch("/api/admin/dashboard", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as DashboardPayload;
      if (res.status === 403) {
        setLoadError("No autorizado: tu cuenta no está en la lista de administradores del servidor.");
        setData(null);
        return;
      }
      if (!res.ok || !json.success) {
        setLoadError(json.errors?.[0]?.message ?? "No se pudo cargar el panel.");
        setData(null);
        return;
      }
      setData(json);
      try {
        const prRes = await fetch("/api/admin/plan-plus-pricing", { headers: { ...(await buildAuthHeaders(user)) } });
        type PrJson = {
          success?: boolean;
          resolved?: { checkoutCop: number; listCompareCop: number; preset: "promo_49900" | "list_89900" | "custom" };
          stored?: { customCheckoutCop?: number | null; customListCop?: number | null } | null;
          errors?: { message?: string }[];
        };
        const prJson = (await prRes.json()) as PrJson;
        if (prRes.ok && prJson.success && prJson.resolved) {
          setPpPreset(prJson.resolved.preset);
          const cust = prJson.stored?.customCheckoutCop;
          setPpCustom(String(typeof cust === "number" && Number.isFinite(cust) ? cust : prJson.resolved.checkoutCop));
          const custList = prJson.stored?.customListCop;
          setPpCustomList(
            String(typeof custList === "number" && Number.isFinite(custList) ? custList : prJson.resolved.listCompareCop),
          );
          setPpResolved({ checkoutCop: prJson.resolved.checkoutCop, listCompareCop: prJson.resolved.listCompareCop });
          setPpPricingErr("");
        } else {
          setPpPricingErr(prJson.errors?.[0]?.message ?? "No se pudo cargar el precio del Plan Plus.");
        }
      } catch {
        setPpPricingErr("Error de red al cargar precio Plan Plus.");
      }
    } catch {
      setLoadError("Error de red al cargar el panel.");
      setData(null);
    }
  }, [user]);

  const loadObs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/observability", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as ObsPayload;
      if (res.ok && json.success) setObs(json);
    } catch {
      /* silencioso: la observabilidad no debe romper el panel */
    }
  }, [user]);

  const loadLegal = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/legal-config", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as LegalConfigState;
      if (res.ok && json.success) {
        setLegal(json);
        setIpcInput(String(json.config.ipcPercent));
        setIpcYearInput(String(json.config.ipcPreviousYear));
      }
    } catch {
      /* silencioso */
    }
  }, [user]);

  async function saveIpc(confirmOnly: boolean) {
    if (!user) return;
    setLegalBusy(true);
    setLegalMsg("");
    try {
      const body: Record<string, unknown> = { confirmOnly };
      if (!confirmOnly) {
        const pct = Number(ipcInput.replace(",", "."));
        const yr = Number(ipcYearInput.replace(/[^\d]/g, ""));
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          setLegalMsg("El IPC debe ser un porcentaje entre 0 y 100.");
          setLegalBusy(false);
          return;
        }
        body.ipcPercent = pct;
        if (Number.isInteger(yr) && yr >= 2000) {
          body.ipcPreviousYear = yr;
          body.ipcAppliesToYear = yr + 1;
        }
      }
      const res = await fetch("/api/admin/legal-config", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as LegalConfigState & { errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setLegalMsg(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      setLegal(json);
      setLegalMsg(confirmOnly ? "Confirmado: dejaremos de enviarte el recordatorio este año." : "IPC actualizado y confirmado para este año.");
    } catch {
      setLegalMsg("Error de red.");
    } finally {
      setLegalBusy(false);
    }
  }

  useEffect(() => {
    void load();
    void loadObs();
    void loadLegal();
  }, [load, loadObs, loadLegal]);

  async function savePlanPlusPricing() {
    if (!user) return;
    setPpSaveLoading(true);
    setPpPricingErr("");
    setPpPricingMsg("");
    try {
      const digits = ppCustom.replace(/[^\d]/g, "");
      const n = digits === "" ? NaN : Number(digits);
      const listDigits = ppCustomList.replace(/[^\d]/g, "");
      const listN = listDigits === "" ? NaN : Number(listDigits);
      const body: {
        preset: "promo_49900" | "list_89900" | "custom";
        customCheckoutCop?: number;
        customListCop?: number;
      } =
        ppPreset === "custom"
          ? {
              preset: "custom",
              customCheckoutCop: n,
              ...(Number.isInteger(listN) ? { customListCop: listN } : {}),
            }
          : { preset: ppPreset };
      if (
        ppPreset === "custom" &&
        (!Number.isInteger(n) ||
          n < PLAN_PLUS_CUSTOM_COP_LIMITS.min ||
          n > PLAN_PLUS_CUSTOM_COP_LIMITS.max)
      ) {
        setPpPricingErr(
          `El monto personalizado debe ser un entero entre ${PLAN_PLUS_CUSTOM_COP_LIMITS.min.toLocaleString(
            "es-CO",
          )} y ${PLAN_PLUS_CUSTOM_COP_LIMITS.max.toLocaleString("es-CO")} COP.`,
        );
        return;
      }
      if (
        ppPreset === "custom" &&
        Number.isInteger(listN) &&
        (listN < PLAN_PLUS_CUSTOM_COP_LIMITS.min ||
          listN > PLAN_PLUS_CUSTOM_COP_LIMITS.max ||
          listN < n)
      ) {
        setPpPricingErr(
          `El precio de lista (tachado) debe ser un entero entre ${PLAN_PLUS_CUSTOM_COP_LIMITS.min.toLocaleString(
            "es-CO",
          )} y ${PLAN_PLUS_CUSTOM_COP_LIMITS.max.toLocaleString("es-CO")} COP, y no menor al precio vigente.`,
        );
        return;
      }
      const res = await fetch("/api/admin/plan-plus-pricing", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        resolved?: {
          checkoutCop: number;
          listCompareCop: number;
          preset: "promo_49900" | "list_89900" | "custom";
        };
        errors?: { message?: string }[];
      };
      if (!res.ok || !json.success) {
        setPpPricingErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      if (json.resolved) {
        setPpResolved({ checkoutCop: json.resolved.checkoutCop, listCompareCop: json.resolved.listCompareCop });
        setPpPreset(json.resolved.preset);
        setPpPricingMsg(
          `Listo: nueva orden cobrará ${json.resolved.checkoutCop.toLocaleString("es-CO")} COP (referencia lista ${json.resolved.listCompareCop.toLocaleString("es-CO")} COP).`,
        );
      }
    } catch {
      setPpPricingErr("Error de red al guardar.");
    } finally {
      setPpSaveLoading(false);
    }
  }

  async function downloadSurveysCsv() {
    if (!user) return;
    const res = await fetch("/api/admin/surveys-export", { headers: { ...(await buildAuthHeaders(user)) } });
    if (!res.ok) {
      setLoadError("No se pudo exportar CSV (revisa permisos).");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "encuestas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function adjustTesterQuota(mode: "set_max" | "add_slots") {
    if (!user) return;
    const emailTarget = (inspectedEmail || inspectEmail.trim()).toLowerCase();
    setQuotaErr("");
    setQuotaMsg("");
    if (!emailTarget) {
      setQuotaErr("Escribe el correo arriba (o usa Inspeccionar).");
      return;
    }

    let payload: { mode: string; email: string; maxContractsAllowed?: number; slots?: number };
    if (mode === "set_max") {
      const digits = quotaMaxInput.replace(/[^\d]/g, "");
      const n = digits === "" ? NaN : Number(digits);
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        setQuotaErr("Indica un máximo de expedientes entero entre 1 y 50.");
        return;
      }
      payload = { mode: "set_max", email: emailTarget, maxContractsAllowed: n };
    } else {
      const digits = (quotaSlotsInput.replace(/[^\d]/g, "") || "1").slice(0, 2);
      const s = Number(digits || "1");
      if (!Number.isInteger(s) || s < 1 || s > 20) {
        setQuotaErr("Los cupos a sumar deben ser de 1 a 20.");
        return;
      }
      payload = { mode: "add_slots", email: emailTarget, slots: s };
    }

    setQuotaLoading(true);
    try {
      const res = await fetch("/api/platform-payments/internal/adjust-plus-quota", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        success?: boolean;
        entitlementId?: string;
        contractsUsed?: number;
        newMax?: number;
        previousMax?: number;
        status?: string;
        errors?: { field?: string; message: string }[];
      };
      if (!res.ok || !json.success) {
        setQuotaErr(json.errors?.[0]?.message ?? "No se pudo actualizar.");
        return;
      }
      setQuotaMsg(
        `Listo. Entitlement ${json.entitlementId ?? "—"}: usados ${json.contractsUsed ?? "—"}, máximo ${json.previousMax ?? "—"} → ${json.newMax ?? "—"}. Estado: ${json.status ?? "—"} (pídeles recargar el dashboard).`,
      );
      setInspectEmail(emailTarget);
      setInspectedEmail(emailTarget);
      await load();
    } catch {
      setQuotaErr("Error de red.");
    } finally {
      setQuotaLoading(false);
    }
  }

  async function grantPlus() {
    if (!user) return;
    setGrantLoading(true);
    setGrantMsg("");
    setGrantErr("");
    setGrantDetail(null);
    try {
      let maxContractsAllowed: number | undefined;
      const rawGx = grantMaxContracts.replace(/[^\d]/g, "");
      if (rawGx !== "") {
        const n = Number(rawGx);
        if (!Number.isInteger(n) || n < 1 || n > 50) {
          setGrantErr("Máximo de expedientes inicial: número entero entre 1 y 50 (o déjalo vacío para usar 1).");
          setGrantLoading(false);
          return;
        }
        maxContractsAllowed = n;
      }

      const res = await fetch("/api/platform-payments/internal/grant-plus", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          email: grantEmail.trim(),
          validDays: 365,
          ...(maxContractsAllowed !== undefined ? { maxContractsAllowed } : {}),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        status?: "created" | "already_exists";
        entitlementId?: string;
        userId?: string;
        userEmail?: string;
        emailDelivery?: "ok" | "failed" | "skipped";
        errors?: { field?: string; message: string }[];
      };
      if (!res.ok || !json.success) {
        const issue = json.errors?.[0];
        if (issue?.field === "email") {
          // Caso típico: la persona aún no se registró en Firebase Auth,
          // así que el grant falla y la UI lo dejaba pasar como un mensaje
          // genérico. Aquí lo hacemos muy explícito porque era la causa
          // raíz cuando otorgábamos Plus a correos de prueba.
          setGrantErr(
            `${issue.message} Pídele que entre a "Iniciar sesión" y cree su cuenta con ${grantEmail.trim()}; cuando aparezca en la pestaña Usuarios, vuelve a hacer clic en "Otorgar Plus".`,
          );
        } else {
          setGrantErr(issue?.message ?? "No se pudo otorgar Plus.");
        }
        return;
      }
      if (json.status === "already_exists") {
        setGrantMsg(
          `Ya tenía un Plan Plus sin consumir todos los cupos activos (${json.entitlementId ?? "—"}). No se creó fila nueva. Si necesitas más expedientes para pruebas, usa «Más cupos para testers» abajo.`,
        );
      } else {
        let base = `Plan Plus manual creado para ${json.userEmail ?? grantEmail.trim()} (${maxContractsAllowed ?? 1} expediente(s) máx.). Entitlement ${json.entitlementId ?? "—"}.`;
        if (json.emailDelivery && json.emailDelivery !== "ok") {
          base +=
            " El correo de confirmación no se envió correctamente: revisa la configuración del proveedor y los registros de correo.";
        }
        setGrantMsg(base);
      }
      setGrantDetail({
        status: json.status ?? "created",
        entitlementId: json.entitlementId ?? "",
        userId: json.userId ?? "",
        userEmail: json.userEmail ?? grantEmail.trim(),
      });
      setInspectEmail(json.userEmail ?? grantEmail.trim());
      setInspectedEmail((json.userEmail ?? grantEmail.trim()).toLowerCase());
      setGrantEmail("");
      setGrantMaxContracts("");
      await load();
    } catch {
      setGrantErr("Error de red.");
    } finally {
      setGrantLoading(false);
    }
  }

  /** Inspecciona el estado del correo escrito: usuario Auth + accesos. */
  const inspection = useMemo(() => {
    if (!data || !inspectedEmail) return null;
    const email = inspectedEmail.toLowerCase();
    const users = (data.users ?? []) as Array<{ email: string; uid: string; fechaRegistro: string; disabled: boolean }>;
    const accesses = (data.accesses ?? []) as Array<{
      id: string;
      userEmail: string;
      userId: string;
      planCode: string;
      accessType: string;
      status: string;
      contractsUsed: number;
      maxContractsAllowed: number;
      validUntil: string;
      updatedAt: string;
    }>;
    const matchingUsers = users.filter((u) => (u.email ?? "").toLowerCase() === email);
    const matchingAccesses = accesses.filter(
      (a) => (a.userEmail ?? "").toLowerCase() === email,
    );
    return { email, users: matchingUsers, accesses: matchingAccesses };
  }, [data, inspectedEmail]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-100 text-slate-600">
        <p className="text-sm">Cargando sesión…</p>
      </div>
    );
  }

  const emailLc = user.email?.toLowerCase() ?? "";
  const hintMismatch = mounted && hintSet.size > 0 && !hintSet.has(emailLc);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-400">Herramienta interna</p>
            <h1 className="text-2xl font-bold text-slate-900">Panel administrativo</h1>
            <p className="mt-1 text-xs text-slate-500">
              Acceso validado en el servidor con <code className="text-slate-600">ADMIN_INTERNAL_EMAILS</code>. No
              confíes solo en el navegador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:border-slate-500"
            >
              Actualizar
            </button>
            <Link href="/dashboard" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800">
              Ir al dashboard
            </Link>
          </div>
        </header>

        {hintMismatch && (
          <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-800">
            Aviso: tu correo no coincide con <code>NEXT_PUBLIC_ADMIN_INTERNAL_EMAILS</code> (solo referencia UI). La
            autorización real la define el servidor.
          </p>
        )}

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-800/60 bg-rose-50 p-3 text-sm text-rose-800">
            {loadError}
          </div>
        )}

        {data && (
          <section className="mb-6 rounded-xl border border-sky-400/40 bg-white/95 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Precio vigente Plan Plus</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              La landing principal, Mis planes y el comparativo público usan los mismos montos. Se guarda en Firestore (
              <code className="text-[11px]">app_settings/plan_plus_pricing</code>). Protege la colección: lectura y
              escritura únicamente desde el servidor.
            </p>
            {ppResolved && (
              <p className="mt-2 text-xs text-slate-800">
                Aplicando ahora:{" "}
                <strong>${ppResolved.checkoutCop.toLocaleString("es-CO")}</strong> COP a cobrar · referencia lista{" "}
                <strong>${ppResolved.listCompareCop.toLocaleString("es-CO")}</strong> COP
              </p>
            )}
            {ppPricingErr && (
              <p className="mt-2 rounded border border-rose-400/45 bg-rose-50 px-2 py-1 text-xs text-rose-800">
                {ppPricingErr}
              </p>
            )}
            {ppPricingMsg && (
              <p className="mt-2 rounded border border-emerald-400/40 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                {ppPricingMsg}
              </p>
            )}
            <fieldset className="mt-3 space-y-2 border-0 p-0 text-xs text-slate-800">
              <legend className="sr-only">Modo de precio</legend>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="plan-plus-preset"
                  className="mt-0.5"
                  checked={ppPreset === "promo_49900"}
                  onChange={() => setPpPreset("promo_49900")}
                />
                <span>$49.900 COP (beneficio lanzamiento versus lista)</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="plan-plus-preset"
                  className="mt-0.5"
                  checked={ppPreset === "list_89900"}
                  onChange={() => setPpPreset("list_89900")}
                />
                <span>$89.900 COP (precio de lista sin beneficio lanzamiento)</span>
              </label>
              <label className="flex cursor-pointer flex-wrap items-start gap-2">
                <input
                  type="radio"
                  name="plan-plus-preset"
                  className="mt-0.5"
                  checked={ppPreset === "custom"}
                  onChange={() => setPpPreset("custom")}
                />
                <span className="flex flex-wrap items-center gap-2">
                  Otro: precio vigente (checkout) COP
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Precio vigente COP personalizado"
                    disabled={ppPreset !== "custom"}
                    value={ppCustom}
                    onChange={(e) => setPpCustom(e.target.value)}
                    className="w-36 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  />
                </span>
              </label>
              {ppPreset === "custom" && (
                <label className="flex flex-wrap items-center gap-2 pl-6 text-slate-700">
                  Precio de lista (tachado) COP
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Precio de lista tachado COP personalizado"
                    value={ppCustomList}
                    onChange={(e) => setPpCustomList(e.target.value)}
                    className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
              )}
            </fieldset>
            <p className="mt-1 text-[11px] text-slate-500">
              Otro: enteros entre {PLAN_PLUS_CUSTOM_COP_LIMITS.min.toLocaleString("es-CO")} y{" "}
              {PLAN_PLUS_CUSTOM_COP_LIMITS.max.toLocaleString("es-CO")} COP. El precio de lista (tachado) debe ser{" "}
              mayor o igual al precio vigente; si lo dejas vacío, se usa el de lista por defecto.
            </p>
            <button
              type="button"
              disabled={ppSaveLoading}
              onClick={() => void savePlanPlusPricing()}
              className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {ppSaveLoading ? "Guardando…" : "Guardar precio"}
            </button>
          </section>
        )}

        {legal && (
          <section className="mb-6 rounded-xl border border-amber-400/50 bg-amber-50/60 p-4">
            <h2 className="text-sm font-semibold text-slate-900">IPC para reajuste del canon (Ley 820)</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Este valor alimenta la calculadora de reajuste. Actualízalo cada año con la cifra oficial del DANE. Cada
              enero (2ª semana) recibirás un recordatorio por correo hasta que guardes o confirmes aquí.
            </p>
            <p className="mt-2 text-xs text-slate-800">
              Vigente: <strong>{legal.config.ipcPercent}%</strong> (IPC {legal.config.ipcPreviousYear}) ·{" "}
              {legal.confirmedThisYear ? (
                <span className="text-emerald-700">confirmado para {legal.currentYear}</span>
              ) : (
                <span className="text-amber-800">sin confirmar para {legal.currentYear}</span>
              )}
              {legal.config.ipcUpdatedAt ? ` · últ. cambio ${legal.config.ipcUpdatedAt.slice(0, 10)}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-slate-600">IPC %</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ipcInput}
                  onChange={(e) => setIpcInput(e.target.value)}
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-slate-600">Año del IPC</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ipcYearInput}
                  onChange={(e) => setIpcYearInput(e.target.value)}
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </label>
              <button
                type="button"
                disabled={legalBusy}
                onClick={() => void saveIpc(false)}
                className="rounded border border-violet-500 bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {legalBusy ? "…" : "Guardar y marcar actualizado"}
              </button>
              <button
                type="button"
                disabled={legalBusy}
                onClick={() => void saveIpc(true)}
                className="rounded border border-slate-400 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 disabled:opacity-50"
              >
                Ya está vigente (confirmar {legal.currentYear})
              </button>
            </div>
            {legalMsg && <p className="mt-2 text-xs text-slate-700">{legalMsg}</p>}
          </section>
        )}

        {data?.features?.manualGrantPlus && (
          <section className="mb-6 rounded-xl border border-slate-300 bg-white/95 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Habilitar Plan Plus manual</h2>
            <p className="mt-1 text-xs text-slate-500">
              Requiere <code className="text-slate-600">ADMIN_INTERNAL_ENABLED=true</code> en servidor (o entorno
              desarrollo). El usuario debe existir en Firebase Auth.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="correo@usuario.com"
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={grantLoading || !grantEmail.trim()}
                onClick={() => void grantPlus()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {grantLoading ? "…" : "Otorgar Plus"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="grant-max-contracts" className="text-[11px] text-slate-600">
                Expedientes máx. (nuevos testers, opcional)
              </label>
              <input
                id="grant-max-contracts"
                type="text"
                inputMode="numeric"
                placeholder="1 (predeterminado)"
                value={grantMaxContracts}
                onChange={(e) => setGrantMaxContracts(e.target.value)}
                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
              <span className="text-[10px] text-slate-500">1–50. Vacío = 1 expediente.</span>
            </div>
            {grantMsg && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-semibold">{grantMsg}</p>
                {grantDetail && (
                  <ul className="mt-1 space-y-0.5">
                    <li>
                      <strong>UID:</strong> {grantDetail.userId || "—"}
                    </li>
                    <li>
                      <strong>Entitlement:</strong> {grantDetail.entitlementId || "—"}
                    </li>
                    <li>
                      Pídele a la persona que recargue <em>Mis arriendos</em> con Ctrl+F5; verá
                      &quot;Plan Plus activo&quot;.
                    </li>
                  </ul>
                )}
              </div>
            )}
            {grantErr && (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
                <p className="font-semibold">No se pudo otorgar Plus</p>
                <p className="mt-1">{grantErr}</p>
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-3">
              <h3 className="text-xs font-semibold text-slate-800">
                Inspeccionar accesos de un correo
              </h3>
              <p className="text-[11px] text-slate-500">
                Útil cuando la persona dice &quot;me sigue pidiendo el plan&quot;: aquí ves si su
                cuenta existe en Auth y qué entitlements tiene.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={inspectEmail}
                  onChange={(e) => setInspectEmail(e.target.value)}
                  placeholder="correo@usuario.com"
                  className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setInspectedEmail(inspectEmail.trim().toLowerCase())}
                  className="rounded-lg border border-slate-400 px-3 py-2 text-xs text-slate-800"
                >
                  Inspeccionar
                </button>
                {inspectedEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setInspectEmail("");
                      setInspectedEmail("");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {inspection && (
                <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-800">
                  <p>
                    Resultado para <strong>{inspection.email}</strong>:
                  </p>
                  <p className="mt-1">
                    Cuentas en Firebase Auth:{" "}
                    <strong>{inspection.users.length}</strong>
                  </p>
                  {inspection.users.length === 0 ? (
                    <p className="mt-1 text-rose-700">
                      Esta persona aún no se ha registrado en la plataforma. Pídele que entre a{" "}
                      <code>/ingresar</code>, cree su cuenta con ese correo, refresca este panel y
                      vuelve a otorgar Plus.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {inspection.users.map((u) => (
                        <li key={u.uid}>
                          UID <code>{u.uid}</code> · creado {u.fechaRegistro}{" "}
                          {u.disabled ? "(deshabilitado)" : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-2">
                    Entitlements asociados: <strong>{inspection.accesses.length}</strong>
                  </p>
                  {inspection.accesses.length === 0 ? (
                    <p className="mt-1 text-rose-700">
                      No hay ninguna fila en <code>access_entitlements</code> para este correo. Por
                      eso /dashboard/leases dice &quot;Pendiente de pago&quot;. Si la cuenta sí
                      existe en Auth (ver arriba), basta con hacer clic en{" "}
                      <strong>Otorgar Plus</strong> de nuevo.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {inspection.accesses.map((a) => (
                        <li key={a.id}>
                          <code className="text-[10px]" title="ID en Firestore">
                            {a.id}
                          </code>{" "}
                          · {a.planCode}/{a.accessType} · estado <strong>{a.status}</strong> · usados{" "}
                          {a.contractsUsed}/{a.maxContractsAllowed}
                          {a.validUntil ? ` · vigente hasta ${a.validUntil}` : ""} · UID{" "}
                          <code>{a.userId}</code>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
                    <h4 className="text-xs font-semibold text-slate-800">Más cupos para testers</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Aumenta el máximo de <strong>expedientes reales</strong> sobre un Plan Plus ya creado (manual
                      o pago). Correo usado:{" "}
                      <strong>{(inspectedEmail || inspectEmail.trim().toLowerCase() || "—")}</strong>. Si hay varias
                      filas Plus, el servidor prioriza la que tenga cupo libre o la más reciente.
                    </p>
                    {quotaErr && (
                      <p className="mt-2 rounded border border-rose-400/50 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
                        {quotaErr}
                      </p>
                    )}
                    {quotaMsg && (
                      <p className="mt-2 rounded border border-emerald-400/40 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                        {quotaMsg}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-medium text-slate-600">Fijar máximo total</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={quotaMaxInput}
                          onChange={(e) => setQuotaMaxInput(e.target.value)}
                          placeholder="p. ej. 5"
                          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={quotaLoading}
                        onClick={() => void adjustTesterQuota("set_max")}
                        className="rounded border border-violet-500 bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        {quotaLoading ? "…" : "Aplicar máximo"}
                      </button>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-medium text-slate-600">Sumar cupos</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={quotaSlotsInput}
                          onChange={(e) => setQuotaSlotsInput(e.target.value)}
                          placeholder="1"
                          className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={quotaLoading}
                        onClick={() => void adjustTesterQuota("add_slots")}
                        className="rounded border border-slate-400 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-800 disabled:opacity-50"
                      >
                        {quotaLoading ? "…" : `Sumar (${quotaSlotsInput || "1"})`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <nav className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["resumen", "Resumen"],
              ["encuestas", "Encuestas"],
              ["usuarios", "Usuarios"],
              ["accesos", "Accesos"],
              ["pagos", "Pagos plataforma"],
              ["expedientes", "Expedientes"],
              ["auditoria", "Auditoría"],
              [
                "reportes",
                obs?.totals?.reportsNew ? `Reportes (${obs.totals.reportsNew})` : "Reportes",
              ],
              [
                "errores",
                obs?.totals?.errorsUnresolved ? `Errores (${obs.totals.errorsUnresolved})` : "Errores",
              ],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                tab === id ? "border-violet-500 bg-violet-100/50 text-violet-800" : "border-slate-300 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {!data && !loadError && <p className="text-sm text-slate-500">Cargando datos…</p>}

        {data && tab === "resumen" && <Resumen s={data.summary} />}
        {data && tab === "encuestas" && (
          <Encuestas rows={data.surveys ?? []} onExport={() => void downloadSurveysCsv()} />
        )}
        {data && tab === "usuarios" && <TablaGenerica rows={data.users ?? []} />}
        {data && tab === "accesos" && <TablaGenerica rows={data.accesses ?? []} />}
        {data && tab === "pagos" && (
          <div className="space-y-6">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Órdenes</h3>
            <TablaGenerica rows={data.platformOrders ?? []} />
            <h3 className="text-xs font-semibold uppercase text-slate-500">Pagos</h3>
            <TablaGenerica rows={data.platformPayments ?? []} />
          </div>
        )}
        {data && tab === "expedientes" && <TablaGenerica rows={data.expedientes ?? []} />}
        {data && tab === "auditoria" && <TablaGenerica rows={data.audit ?? []} />}
        {tab === "reportes" && (
          <ReportesTab reports={obs?.reports ?? []} user={user} onChange={() => void loadObs()} />
        )}
        {tab === "errores" && (
          <ErroresTab events={obs?.errorEvents ?? []} user={user} onChange={() => void loadObs()} />
        )}
      </div>
    </div>
  );
}

function ReportesTab({
  reports,
  user,
  onChange,
}: {
  reports: ObsReport[];
  user: ReturnType<typeof useAuth>["user"];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState("");

  async function setStatus(id: string, status: string) {
    if (!user) return;
    setBusy(id);
    try {
      await fetch("/api/admin/observability", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ kind: "report", id, status }),
      });
      onChange();
    } finally {
      setBusy("");
    }
  }

  if (reports.length === 0) {
    return <p className="text-sm text-slate-500">No hay reportes de usuarios todavía.</p>;
  }
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-xl border border-slate-300 bg-white/95 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800">
              {r.category}
            </span>
            <span className="text-[11px] text-slate-500">
              {r.createdAt} · estado: <strong>{r.status}</strong>
              {r.reporterEmail ? ` · ${r.reporterEmail}` : " · anónimo"}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{r.message}</p>
          {r.pageUrl && <p className="mt-1 text-[11px] text-slate-500">Página: {r.pageUrl}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["in_review", "resolved", "dismissed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy === r.id || r.status === s}
                onClick={() => void setStatus(r.id, s)}
                className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-violet-500 disabled:opacity-40"
              >
                {s === "in_review" ? "En revisión" : s === "resolved" ? "Resuelto" : "Descartar"}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ErroresTab({
  events,
  user,
  onChange,
}: {
  events: ObsErrorEvent[];
  user: ReturnType<typeof useAuth>["user"];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState("");

  async function setResolved(id: string, resolved: boolean) {
    if (!user) return;
    setBusy(id);
    try {
      await fetch("/api/admin/observability", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ kind: "error", id, resolved }),
      });
      onChange();
    } finally {
      setBusy("");
    }
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Sin errores capturados. El analizador registra automáticamente los errores del navegador a medida que ocurren.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li
          key={e.id}
          className={`rounded-xl border p-4 ${e.resolved ? "border-slate-200 bg-slate-50" : "border-rose-300 bg-white/95"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
              {e.kind} · {e.count}×
            </span>
            <span className="text-[11px] text-slate-500">
              último: {e.lastSeenAt} {e.resolved ? "· resuelto" : ""}
            </span>
          </div>
          <p className="mt-2 break-words text-sm font-medium text-slate-900">{e.message}</p>
          {e.source && <p className="mt-1 text-[11px] text-slate-500">Origen: {e.source}</p>}
          {e.lastPageUrl && <p className="text-[11px] text-slate-500">Página: {e.lastPageUrl}</p>}
          <div className="mt-3">
            <button
              type="button"
              disabled={busy === e.id}
              onClick={() => void setResolved(e.id, !e.resolved)}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-violet-500 disabled:opacity-40"
            >
              {e.resolved ? "Marcar como no resuelto" : "Marcar como resuelto"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Resumen({ s }: { s?: DashboardPayload["summary"] }) {
  if (!s) return null;
  const cards = [
    ["Usuarios registrados (Auth)", s.usersRegistered],
    ["Encuestas (Firestore)", s.surveysResponded],
    ["Accesos demo activos", s.demoAccessesActive],
    ["Accesos Plus activos", s.plusAccessesActive],
    ["Expedientes / contratos (docs)", s.expedientesCreados],
    ["Versiones de contrato", s.contractVersions],
    ["Pagos plataforma aprobados", s.platformPaymentsApproved],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, val]) => (
          <div key={label} className="rounded-xl border border-slate-300 bg-white/95 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{val ?? "—"}</p>
          </div>
        ))}
      </div>
      {s.funnel && (
        <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
          <p className="text-sm font-semibold text-slate-900">Embudo de conversión (KPIs)</p>
          <p className="mt-1 text-[11px] text-slate-500">
            La visita a la landing se mide en Google Analytics; aquí medimos de encuesta en adelante.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {[
              ["Encuestas", s.funnel.surveys],
              ["Registrados", s.funnel.registered],
              ["Contratos creados", s.funnel.contractsCreated],
              ["Contratos firmados", s.funnel.contractsSigned],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{val ?? "—"}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
            <p className="rounded bg-violet-50 px-2 py-1">
              Encuesta → Registro: <strong>{s.funnel.surveyToRegistered ?? "—"}%</strong>
            </p>
            <p className="rounded bg-violet-50 px-2 py-1">
              Registro → Contrato: <strong>{s.funnel.registeredToContract ?? "—"}%</strong>
            </p>
            <p className="rounded bg-violet-50 px-2 py-1">
              Contrato → Firmado: <strong>{s.funnel.contractToSigned ?? "—"}%</strong>
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
        <p className="text-sm font-semibold text-slate-900">Errores recientes (heurística sobre auditoría)</p>
        {s.recentErrors.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Sin coincidencias en los últimos eventos cargados.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {s.recentErrors.map((e, i) => (
              <li key={i}>
                <span className="text-slate-700">{e.eventName}</span> · {e.createdAt}{" "}
                {e.metadataSummary ? `· ${e.metadataSummary}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Encuestas({ rows, onExport }: { rows: Record<string, unknown>[]; onExport: () => void }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onExport}
        className="rounded-lg border border-violet-600/50 bg-violet-100/50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100/60"
      >
        Exportar CSV
      </button>
      <TablaGenerica rows={rows} tableStyle="surveys" />
    </div>
  );
}

function TablaGenerica({
  rows,
  tableStyle = "default",
}: {
  rows: Record<string, unknown>[];
  tableStyle?: "default" | "surveys";
}) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Sin filas.</p>;
  }
  const keys = Object.keys(rows[0] ?? {});
  const isSurveys = tableStyle === "surveys";
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300">
      <table
        className={`w-full border-collapse text-left text-xs ${isSurveys ? "min-w-[1100px]" : "min-w-[640px]"}`}
      >
        <thead
          className={`border-b border-slate-300 bg-slate-100/80 text-[10px] font-medium ${
            isSurveys ? "normal-case leading-tight text-slate-600" : "uppercase text-slate-500"
          }`}
        >
          <tr>
            {keys.map((k) => (
              <th key={k} className={`px-2 py-2 align-bottom ${isSurveys ? "max-w-[11rem] whitespace-normal" : ""}`}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-300 odd:bg-white/90">
              {keys.map((k) => (
                <td
                  key={k}
                  className={`px-2 py-1.5 align-top text-slate-700 ${
                    isSurveys ? "max-w-[14rem] break-words whitespace-normal" : "max-w-[220px] truncate"
                  }`}
                  title={String(row[k] ?? "")}
                >
                  {formatCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (v == null) return "";
  return String(v);
}
