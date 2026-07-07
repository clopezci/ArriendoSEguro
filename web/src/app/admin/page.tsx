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
    specialClausePriceCop?: number;
    legalPartnerEmails?: string[];
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
  const [specialPriceInput, setSpecialPriceInput] = useState("");
  const [legalEmailsInput, setLegalEmailsInput] = useState("");
  const [specialMsg, setSpecialMsg] = useState("");
  const [specialBusy, setSpecialBusy] = useState(false);
  const [refConfig, setRefConfig] = useState<{ enabled: boolean; discountPercent: number } | null>(null);
  const [refDiscountInput, setRefDiscountInput] = useState("");
  const [refList, setRefList] = useState<
    { referredUid: string; referredEmail: string; referrerEmail: string; code: string; status: string; createdAt: string }[]
  >([]);
  const [refMsg, setRefMsg] = useState("");
  const [refBusy, setRefBusy] = useState(false);
  const [repFlags, setRepFlags] = useState<
    { id: string; severity: string; status: string; contractId: string; raterEmail: string; subjectEmail: string; signals: { code: string; detail: string }[]; createdAt: string }[]
  >([]);
  const [repFlagsBusy, setRepFlagsBusy] = useState(false);
  const [obsConfig, setObsConfig] = useState<{
    errorAlertEnabled: boolean;
    errorAlertThreshold: number;
    errorAlertWindowMinutes: number;
    errorAlertCooldownMinutes: number;
  } | null>(null);
  const [obsThresholdInput, setObsThresholdInput] = useState("");
  const [incidents, setIncidents] = useState<
    { id: string; title: string; body: string; severity: string; status: string; createdAt: string }[]
  >([]);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentBody, setIncidentBody] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [partners, setPartners] = useState<
    { id: string; name: string; category: string; description: string; websiteUrl: string; contactEmails: string[]; active: boolean }[]
  >([]);
  const [newPartner, setNewPartner] = useState({ name: "", category: "recaudo", websiteUrl: "", contactEmails: "", description: "" });
  const [partnerLeads, setPartnerLeads] = useState<
    {
      id: string;
      partnerName: string;
      clientName: string;
      userEmail: string;
      sentAt: string;
      partnerResponse: string | null;
      userResponse: string | null;
      outcome: { code: string; label: string; commissionEligible: boolean; needsReview: boolean };
      commissionStatus: string;
    }[]
  >([]);
  const [partnerMsg, setPartnerMsg] = useState("");
  const [partnerBusy, setPartnerBusy] = useState(false);
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

  const [ppMode, setPpMode] = useState<"full" | "promo">("promo");
  const [ppPromoType, setPpPromoType] = useState<"fixed" | "percent">("fixed");
  const [ppListCop, setPpListCop] = useState("89900");
  const [ppPromoFixed, setPpPromoFixed] = useState("49900");
  const [ppPromoPercent, setPpPromoPercent] = useState("");
  const [ppPromoName, setPpPromoName] = useState("Lanzamiento");
  const [ppPromoMessage, setPpPromoMessage] = useState("Promoción de lanzamiento por tiempo limitado");
  const [ppResolved, setPpResolved] = useState<{
    checkoutCop: number;
    listCompareCop: number;
    isPromo: boolean;
    promoName: string | null;
    promoMessage: string | null;
  } | null>(null);
  const [ppPricingErr, setPpPricingErr] = useState("");
  const [ppPricingMsg, setPpPricingMsg] = useState("");
  const [ppSaveLoading, setPpSaveLoading] = useState(false);

  // Config del tier gratis (crear contrato gratis o no).
  const [ftEnabled, setFtEnabled] = useState(true);
  const [ftLabel, setFtLabel] = useState("Gratis por tiempo limitado");
  const [ftMessage, setFtMessage] = useState("");
  const [ftErr, setFtErr] = useState("");
  const [ftMsg, setFtMsg] = useState("");
  const [ftSaveLoading, setFtSaveLoading] = useState(false);

  // Config de anuncios (house / adsense / off).
  const [adMode, setAdMode] = useState<"house" | "adsense" | "off">("house");
  const [adClient, setAdClient] = useState("");
  const [adSlots, setAdSlots] = useState<{ blog_article: string; blog_index: string; content: string }>({
    blog_article: "",
    blog_index: "",
    content: "",
  });
  const [adErr, setAdErr] = useState("");
  const [adMsg, setAdMsg] = useState("");
  const [adSaveLoading, setAdSaveLoading] = useState(false);

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
          resolved?: {
            checkoutCop: number;
            listCompareCop: number;
            isPromo: boolean;
            promoName: string | null;
            promoMessage: string | null;
            mode: "full" | "promo";
            promoType: "fixed" | "percent" | null;
            promoPercent: number | null;
          };
          errors?: { message?: string }[];
        };
        const prJson = (await prRes.json()) as PrJson;
        if (prRes.ok && prJson.success && prJson.resolved) {
          const r = prJson.resolved;
          setPpMode(r.mode);
          setPpPromoType(r.promoType ?? "fixed");
          setPpListCop(String(r.listCompareCop));
          setPpPromoFixed(String(r.promoType === "percent" ? "" : r.checkoutCop));
          setPpPromoPercent(r.promoPercent != null ? String(r.promoPercent) : "");
          setPpPromoName(r.promoName ?? "Lanzamiento");
          setPpPromoMessage(r.promoMessage ?? "Precio promocional por tiempo limitado");
          setPpResolved({
            checkoutCop: r.checkoutCop,
            listCompareCop: r.listCompareCop,
            isPromo: r.isPromo,
            promoName: r.promoName,
            promoMessage: r.promoMessage,
          });
          setPpPricingErr("");
        } else {
          setPpPricingErr(prJson.errors?.[0]?.message ?? "No se pudo cargar el precio del Plan Plus.");
        }
      } catch {
        setPpPricingErr("Error de red al cargar precio Plan Plus.");
      }
      try {
        const ftRes = await fetch("/api/admin/free-tier", { headers: { ...(await buildAuthHeaders(user)) } });
        const ftJson = (await ftRes.json()) as {
          success?: boolean;
          resolved?: { enabled: boolean; label: string; message: string };
        };
        if (ftRes.ok && ftJson.success && ftJson.resolved) {
          setFtEnabled(Boolean(ftJson.resolved.enabled));
          setFtLabel(ftJson.resolved.label);
          setFtMessage(ftJson.resolved.message);
          setFtErr("");
        }
      } catch {
        setFtErr("Error de red al cargar el tier gratis.");
      }
      try {
        const adRes = await fetch("/api/admin/ads-config", { headers: { ...(await buildAuthHeaders(user)) } });
        const adJson = (await adRes.json()) as {
          success?: boolean;
          resolved?: { mode: "house" | "adsense" | "off"; adClient: string; slots: Record<string, string> };
        };
        if (adRes.ok && adJson.success && adJson.resolved) {
          setAdMode(adJson.resolved.mode);
          setAdClient(adJson.resolved.adClient);
          setAdSlots({
            blog_article: adJson.resolved.slots.blog_article ?? "",
            blog_index: adJson.resolved.slots.blog_index ?? "",
            content: adJson.resolved.slots.content ?? "",
          });
          setAdErr("");
        }
      } catch {
        setAdErr("Error de red al cargar anuncios.");
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
        setSpecialPriceInput(String(json.config.specialClausePriceCop ?? 50000));
        setLegalEmailsInput((json.config.legalPartnerEmails ?? []).join(", "));
      }
    } catch {
      /* silencioso */
    }
  }, [user]);

  async function saveSpecialClauseConfig() {
    if (!user) return;
    setSpecialBusy(true);
    setSpecialMsg("");
    try {
      const price = Number(specialPriceInput.replace(/[^\d]/g, ""));
      if (!Number.isFinite(price) || price < 0) {
        setSpecialMsg("El precio debe ser un número en pesos (sin puntos ni símbolos).");
        setSpecialBusy(false);
        return;
      }
      const emails = legalEmailsInput
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch("/api/admin/legal-config", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ specialClausePriceCop: price, legalPartnerEmails: emails }),
      });
      const json = (await res.json()) as LegalConfigState & { errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setSpecialMsg(json.errors?.[0]?.message ?? "No se pudo guardar (revisa que los correos sean válidos).");
        return;
      }
      setLegal(json);
      setSpecialMsg("Guardado: precio de cláusula especial y correos del aliado jurídico.");
    } catch {
      setSpecialMsg("Error de red.");
    } finally {
      setSpecialBusy(false);
    }
  }

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

  const loadReferrals = useCallback(async () => {
    if (!user) return;
    try {
      const [cfgRes, listRes] = await Promise.all([
        fetch("/api/admin/referral-config", { headers: { ...(await buildAuthHeaders(user)) } }),
        fetch("/api/admin/referrals", { headers: { ...(await buildAuthHeaders(user)) } }),
      ]);
      const cfgJson = (await cfgRes.json()) as {
        success?: boolean;
        config?: { enabled: boolean; discountPercent: number };
      };
      if (cfgRes.ok && cfgJson.success && cfgJson.config) {
        setRefConfig(cfgJson.config);
        setRefDiscountInput(String(cfgJson.config.discountPercent));
      }
      const listJson = (await listRes.json()) as {
        success?: boolean;
        referrals?: typeof refList;
      };
      if (listRes.ok && listJson.success && Array.isArray(listJson.referrals)) {
        setRefList(listJson.referrals);
      }
    } catch {
      /* silencioso */
    }
  }, [user]);

  async function saveReferralConfig(nextEnabled?: boolean) {
    if (!user) return;
    setRefBusy(true);
    setRefMsg("");
    try {
      const body: Record<string, unknown> = {};
      if (typeof nextEnabled === "boolean") body.enabled = nextEnabled;
      const pct = Number(refDiscountInput.replace(/[^\d]/g, ""));
      if (Number.isInteger(pct) && pct >= 0 && pct <= 100) body.discountPercent = pct;
      const res = await fetch("/api/admin/referral-config", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        config?: { enabled: boolean; discountPercent: number };
        errors?: { message?: string }[];
      };
      if (!res.ok || !json.success || !json.config) {
        setRefMsg(json.errors?.[0]?.message ?? "No se pudo guardar la configuración.");
        return;
      }
      setRefConfig(json.config);
      setRefDiscountInput(String(json.config.discountPercent));
      setRefMsg("Configuración de referidos guardada.");
    } catch {
      setRefMsg("Error de red.");
    } finally {
      setRefBusy(false);
    }
  }

  async function reviewReferral(referredUid: string, action: "approve" | "reject") {
    if (!user) return;
    setRefBusy(true);
    setRefMsg("");
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ referredUid, action }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setRefMsg(json.errors?.[0]?.message ?? "No se pudo actualizar la referencia.");
        return;
      }
      setRefMsg(action === "approve" ? "Referido aprobado: el descuento queda activo." : "Referido rechazado.");
      await loadReferrals();
    } catch {
      setRefMsg("Error de red.");
    } finally {
      setRefBusy(false);
    }
  }

  const loadRepFlags = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/reputation-flags", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; flags?: typeof repFlags };
      if (res.ok && json.success && Array.isArray(json.flags)) setRepFlags(json.flags);
    } catch {
      /* silencioso */
    }
  }, [user]);

  async function reviewRepFlag(id: string, status: "reviewed" | "dismissed") {
    if (!user) return;
    setRepFlagsBusy(true);
    try {
      await fetch("/api/admin/reputation-flags", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ id, status }),
      });
      await loadRepFlags();
    } catch {
      /* silencioso */
    } finally {
      setRepFlagsBusy(false);
    }
  }

  const loadStatusAdmin = useCallback(async () => {
    if (!user) return;
    try {
      const [cfgRes, incRes] = await Promise.all([
        fetch("/api/admin/observability-config", { headers: { ...(await buildAuthHeaders(user)) } }),
        fetch("/api/admin/status-incidents", { headers: { ...(await buildAuthHeaders(user)) } }),
      ]);
      const cfgJson = (await cfgRes.json()) as { success?: boolean; config?: typeof obsConfig };
      if (cfgRes.ok && cfgJson.success && cfgJson.config) {
        setObsConfig(cfgJson.config);
        setObsThresholdInput(String(cfgJson.config.errorAlertThreshold));
      }
      const incJson = (await incRes.json()) as { success?: boolean; incidents?: typeof incidents };
      if (incRes.ok && incJson.success && Array.isArray(incJson.incidents)) setIncidents(incJson.incidents);
    } catch {
      /* silencioso */
    }
  }, [user]);

  async function saveObsConfig(nextEnabled?: boolean) {
    if (!user) return;
    setStatusBusy(true);
    setStatusMsg("");
    try {
      const body: Record<string, unknown> = {};
      if (typeof nextEnabled === "boolean") body.errorAlertEnabled = nextEnabled;
      const thr = Number(obsThresholdInput.replace(/[^\d]/g, ""));
      if (Number.isInteger(thr) && thr >= 1) body.errorAlertThreshold = thr;
      const res = await fetch("/api/admin/observability-config", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; config?: typeof obsConfig; errors?: { message?: string }[] };
      if (!res.ok || !json.success || !json.config) {
        setStatusMsg(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      setObsConfig(json.config);
      setObsThresholdInput(String(json.config.errorAlertThreshold));
      setStatusMsg("Configuración de alertas guardada.");
    } catch {
      setStatusMsg("Error de red.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function createIncident() {
    if (!user || incidentTitle.trim().length < 3) return;
    setStatusBusy(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/admin/status-incidents", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ title: incidentTitle, body: incidentBody }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setStatusMsg(json.errors?.[0]?.message ?? "No se pudo crear el incidente.");
        return;
      }
      setIncidentTitle("");
      setIncidentBody("");
      setStatusMsg("Incidente publicado.");
      await loadStatusAdmin();
    } catch {
      setStatusMsg("Error de red.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function updateIncident(id: string, status: "investigating" | "monitoring" | "resolved") {
    if (!user) return;
    setStatusBusy(true);
    try {
      await fetch("/api/admin/status-incidents", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ id, status }),
      });
      await loadStatusAdmin();
    } catch {
      /* silencioso */
    } finally {
      setStatusBusy(false);
    }
  }

  const loadPartnersAdmin = useCallback(async () => {
    if (!user) return;
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/admin/partners", { headers: { ...(await buildAuthHeaders(user)) } }),
        fetch("/api/admin/partner-leads", { headers: { ...(await buildAuthHeaders(user)) } }),
      ]);
      const pJson = (await pRes.json()) as { success?: boolean; partners?: typeof partners };
      if (pRes.ok && pJson.success && Array.isArray(pJson.partners)) setPartners(pJson.partners);
      const lJson = (await lRes.json()) as { success?: boolean; leads?: typeof partnerLeads };
      if (lRes.ok && lJson.success && Array.isArray(lJson.leads)) setPartnerLeads(lJson.leads);
    } catch {
      /* silencioso */
    }
  }, [user]);

  async function createPartner() {
    if (!user) return;
    setPartnerBusy(true);
    setPartnerMsg("");
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ ...newPartner, contactEmails: newPartner.contactEmails, active: true }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setPartnerMsg(json.errors?.[0]?.message ?? "No se pudo crear el aliado.");
        return;
      }
      setNewPartner({ name: "", category: "recaudo", websiteUrl: "", contactEmails: "", description: "" });
      setPartnerMsg("Aliado creado.");
      await loadPartnersAdmin();
    } catch {
      setPartnerMsg("Error de red.");
    } finally {
      setPartnerBusy(false);
    }
  }

  async function savePartner(p: (typeof partners)[number], patch: Partial<(typeof partners)[number]>) {
    if (!user) return;
    setPartnerBusy(true);
    setPartnerMsg("");
    try {
      const merged = { ...p, ...patch };
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          id: merged.id,
          name: merged.name,
          category: merged.category,
          websiteUrl: merged.websiteUrl,
          description: merged.description,
          contactEmails: merged.contactEmails,
          active: merged.active,
        }),
      });
      const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !json.success) {
        setPartnerMsg(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      await loadPartnersAdmin();
    } catch {
      setPartnerMsg("Error de red.");
    } finally {
      setPartnerBusy(false);
    }
  }

  async function deletePartner(id: string) {
    if (!user) return;
    setPartnerBusy(true);
    try {
      await fetch(`/api/admin/partners?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { ...(await buildAuthHeaders(user)) },
      });
      await loadPartnersAdmin();
    } catch {
      /* silencioso */
    } finally {
      setPartnerBusy(false);
    }
  }

  async function setLeadCommission(id: string, commissionStatus: "open" | "billed" | "paid" | "void") {
    if (!user) return;
    setPartnerBusy(true);
    try {
      await fetch("/api/admin/partner-leads", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ id, commissionStatus }),
      });
      await loadPartnersAdmin();
    } catch {
      /* silencioso */
    } finally {
      setPartnerBusy(false);
    }
  }

  useEffect(() => {
    void load();
    void loadObs();
    void loadLegal();
    void loadReferrals();
    void loadRepFlags();
    void loadStatusAdmin();
    void loadPartnersAdmin();
  }, [load, loadObs, loadLegal, loadReferrals, loadRepFlags, loadStatusAdmin, loadPartnersAdmin]);

  async function savePlanPlusPricing() {
    if (!user) return;
    setPpSaveLoading(true);
    setPpPricingErr("");
    setPpPricingMsg("");
    try {
      const listN = Number(ppListCop.replace(/[^\d]/g, "") || "NaN");
      const fixedN = Number(ppPromoFixed.replace(/[^\d]/g, "") || "NaN");
      const pctN = Number(ppPromoPercent.replace(/[^\d.]/g, "") || "NaN");
      const { min, max } = PLAN_PLUS_CUSTOM_COP_LIMITS;

      if (!Number.isInteger(listN) || listN < min || listN > max) {
        setPpPricingErr(`El precio pleno debe ser un entero entre ${min.toLocaleString("es-CO")} y ${max.toLocaleString("es-CO")} COP.`);
        return;
      }
      const body: {
        mode: "full" | "promo";
        listCop: number;
        promoType?: "fixed" | "percent";
        promoFixedCop?: number;
        promoPercent?: number;
        promoName?: string;
        promoMessage?: string;
      } = { mode: ppMode, listCop: listN };

      if (ppMode === "promo") {
        body.promoType = ppPromoType;
        body.promoName = ppPromoName.trim();
        body.promoMessage = ppPromoMessage.trim();
        if (ppPromoType === "fixed") {
          if (!Number.isInteger(fixedN) || fixedN < min || fixedN > max) {
            setPpPricingErr(`El precio promocional debe ser un entero entre ${min.toLocaleString("es-CO")} y ${max.toLocaleString("es-CO")} COP.`);
            return;
          }
          if (fixedN >= listN) {
            setPpPricingErr("El precio promocional debe ser menor al precio pleno.");
            return;
          }
          body.promoFixedCop = fixedN;
        } else {
          if (!Number.isFinite(pctN) || pctN < 0.1 || pctN > 95) {
            setPpPricingErr("El % de descuento debe estar entre 0,1 y 95.");
            return;
          }
          body.promoPercent = pctN;
        }
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
          isPromo: boolean;
          promoName: string | null;
          promoMessage: string | null;
          mode: "full" | "promo";
          promoType: "fixed" | "percent" | null;
          promoPercent: number | null;
        };
        errors?: { message?: string }[];
      };
      if (!res.ok || !json.success) {
        setPpPricingErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      if (json.resolved) {
        const r = json.resolved;
        setPpResolved({
          checkoutCop: r.checkoutCop,
          listCompareCop: r.listCompareCop,
          isPromo: r.isPromo,
          promoName: r.promoName,
          promoMessage: r.promoMessage,
        });
        setPpMode(r.mode);
        setPpPromoType(r.promoType ?? "fixed");
        setPpPromoPercent(r.promoPercent != null ? String(r.promoPercent) : "");
        setPpPromoFixed(String(r.promoType === "percent" ? "" : r.checkoutCop));
        setPpPricingMsg(
          r.isPromo
            ? `Listo: promoción «${r.promoName}» activa. Nueva orden cobrará ${r.checkoutCop.toLocaleString("es-CO")} COP (precio pleno ${r.listCompareCop.toLocaleString("es-CO")} COP).`
            : `Listo: sin promoción. Nueva orden cobrará el precio pleno ${r.checkoutCop.toLocaleString("es-CO")} COP.`,
        );
      }
    } catch {
      setPpPricingErr("Error de red al guardar.");
    } finally {
      setPpSaveLoading(false);
    }
  }

  async function saveFreeTier() {
    if (!user) return;
    setFtSaveLoading(true);
    setFtErr("");
    setFtMsg("");
    try {
      const res = await fetch("/api/admin/free-tier", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ enabled: ftEnabled, label: ftLabel.trim(), message: ftMessage.trim() }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        resolved?: { enabled: boolean; label: string; message: string };
        errors?: { message?: string }[];
      };
      if (!res.ok || !json.success) {
        setFtErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      if (json.resolved) {
        setFtEnabled(json.resolved.enabled);
        setFtLabel(json.resolved.label);
        setFtMessage(json.resolved.message);
        setFtMsg(
          json.resolved.enabled
            ? "Listo: crear el contrato es GRATIS (con marca de agua). Firma y posventa siguen siendo Plan Plus."
            : "Listo: el tier gratis quedó APAGADO. Crear un contrato ahora requiere Plan Plus.",
        );
      }
    } catch {
      setFtErr("Error de red al guardar.");
    } finally {
      setFtSaveLoading(false);
    }
  }

  async function saveAdsConfig() {
    if (!user) return;
    setAdSaveLoading(true);
    setAdErr("");
    setAdMsg("");
    try {
      const res = await fetch("/api/admin/ads-config", {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          mode: adMode,
          adClient: adClient.trim(),
          slots: {
            blog_article: adSlots.blog_article.trim(),
            blog_index: adSlots.blog_index.trim(),
            content: adSlots.content.trim(),
          },
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        resolved?: { mode: "house" | "adsense" | "off"; adClient: string; slots: Record<string, string> };
        errors?: { message?: string }[];
      };
      if (!res.ok || !json.success) {
        setAdErr(json.errors?.[0]?.message ?? "No se pudo guardar.");
        return;
      }
      if (json.resolved) {
        setAdMode(json.resolved.mode);
        setAdClient(json.resolved.adClient);
        const missing =
          json.resolved.mode === "adsense" &&
          (!json.resolved.slots.blog_article || !json.resolved.slots.blog_index || !json.resolved.slots.content);
        setAdMsg(
          json.resolved.mode === "house"
            ? "Listo: mostrando publicidad interna (house ads)."
            : json.resolved.mode === "off"
              ? "Listo: anuncios desactivados."
              : missing
                ? "Listo: modo AdSense. Faltan slots en algún espacio; esos caen a house ad hasta que pegues su ID."
                : "Listo: mostrando anuncios reales de Google AdSense.",
        );
      }
    } catch {
      setAdErr("Error de red al guardar.");
    } finally {
      setAdSaveLoading(false);
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
                <strong>${ppResolved.checkoutCop.toLocaleString("es-CO")}</strong> COP a cobrar ·{" "}
                {ppResolved.isPromo ? (
                  <>
                    precio pleno <strong>${ppResolved.listCompareCop.toLocaleString("es-CO")}</strong> COP · promoción{" "}
                    <strong>«{ppResolved.promoName}»</strong> ({ppResolved.promoMessage})
                  </>
                ) : (
                  <>sin promoción (precio pleno)</>
                )}
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
            {/* Precio pleno (lista) */}
            <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-800">
              Precio pleno (de lista) COP
              <input
                type="text"
                inputMode="numeric"
                aria-label="Precio pleno COP"
                value={ppListCop}
                onChange={(e) => setPpListCop(e.target.value)}
                className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>

            {/* Modo: con o sin promoción */}
            <fieldset className="mt-3 space-y-2 border-0 p-0 text-xs text-slate-800">
              <legend className="mb-1 font-medium text-slate-700">Promoción</legend>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="plan-plus-mode"
                  className="mt-0.5"
                  checked={ppMode === "full"}
                  onChange={() => setPpMode("full")}
                />
                <span>Sin promoción — se cobra el precio pleno.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="plan-plus-mode"
                  className="mt-0.5"
                  checked={ppMode === "promo"}
                  onChange={() => setPpMode("promo")}
                />
                <span>Con promoción vigente.</span>
              </label>
            </fieldset>

            {ppMode === "promo" && (
              <div className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs text-slate-800">
                <div className="flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="plan-plus-promo-type"
                      checked={ppPromoType === "fixed"}
                      onChange={() => setPpPromoType("fixed")}
                    />
                    Por precio fijo
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="plan-plus-promo-type"
                      checked={ppPromoType === "percent"}
                      onChange={() => setPpPromoType("percent")}
                    />
                    Por % de descuento
                  </label>
                </div>

                {ppPromoType === "fixed" ? (
                  <label className="flex flex-wrap items-center gap-2">
                    Precio promocional COP
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Precio promocional COP"
                      value={ppPromoFixed}
                      onChange={(e) => setPpPromoFixed(e.target.value)}
                      className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </label>
                ) : (
                  <label className="flex flex-wrap items-center gap-2">
                    % de descuento sobre el precio pleno
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Porcentaje de descuento"
                      value={ppPromoPercent}
                      onChange={(e) => setPpPromoPercent(e.target.value)}
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    %
                  </label>
                )}

                <label className="flex flex-wrap items-center gap-2">
                  Nombre de la promoción
                  <input
                    type="text"
                    aria-label="Nombre de la promoción"
                    value={ppPromoName}
                    onChange={(e) => setPpPromoName(e.target.value)}
                    maxLength={60}
                    placeholder="Ej.: Lanzamiento"
                    className="w-48 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block">Mensaje que verá el cliente</span>
                  <input
                    type="text"
                    aria-label="Mensaje de la promoción"
                    value={ppPromoMessage}
                    onChange={(e) => setPpPromoMessage(e.target.value)}
                    maxLength={160}
                    placeholder="Ej.: Precio promocional por tiempo limitado"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
              </div>
            )}

            <p className="mt-2 text-[11px] text-slate-500">
              Montos enteros entre {PLAN_PLUS_CUSTOM_COP_LIMITS.min.toLocaleString("es-CO")} y{" "}
              {PLAN_PLUS_CUSTOM_COP_LIMITS.max.toLocaleString("es-CO")} COP. En «% de descuento», el precio se redondea a
              la centena de peso más cercana. Guarda para ver el precio que quedará vigente.
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

        {data && (
          <section className="mb-6 rounded-xl border border-emerald-400/40 bg-white/95 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Contrato gratis (tier gratis)</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Controla si generar el contrato es gratis. Si lo <strong>apagas</strong>, crear un contrato pasa a requerir
              Plan Plus (su precio y promoción se manejan arriba). Útil si el consumo sube sin ingresos. Se guarda en{" "}
              <code className="text-[11px]">app_settings/free_tier</code>.
            </p>
            {ftErr && (
              <p className="mt-2 rounded border border-rose-400/45 bg-rose-50 px-2 py-1 text-xs text-rose-800">{ftErr}</p>
            )}
            {ftMsg && (
              <p className="mt-2 rounded border border-emerald-400/40 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                {ftMsg}
              </p>
            )}
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-800">
              <input type="checkbox" checked={ftEnabled} onChange={(e) => setFtEnabled(e.target.checked)} />
              <span>
                <strong>Contrato gratis activado</strong> (crear/imprimir contrato sin costo, con marca de agua). Si lo
                desmarcas, crear un contrato exige Plan Plus.
              </span>
            </label>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-800">
              Etiqueta del plan gratis
              <input
                type="text"
                aria-label="Etiqueta del plan gratis"
                value={ftLabel}
                onChange={(e) => setFtLabel(e.target.value)}
                maxLength={60}
                placeholder="Gratis por tiempo limitado"
                className="w-64 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="mt-3 block text-xs text-slate-800">
              <span className="mb-1 block">Mensaje del plan gratis (lo ve el usuario en Planes)</span>
              <textarea
                aria-label="Mensaje del plan gratis"
                value={ftMessage}
                onChange={(e) => setFtMessage(e.target.value)}
                maxLength={400}
                rows={3}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={ftSaveLoading}
              onClick={() => void saveFreeTier()}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {ftSaveLoading ? "Guardando…" : "Guardar tier gratis"}
            </button>
          </section>
        )}

        {data && (
          <section className="mb-6 rounded-xl border border-sky-400/40 bg-white/95 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Anuncios (AdSense / publicidad interna)</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Mientras Google aprueba AdSense, muestra <strong>publicidad interna</strong> (tips y features de
              ArriendoSeguro). Cuando te aprueben, cambia el modo a <strong>AdSense</strong> y pega el ID de cada unidad
              de anuncio. Se guarda en <code className="text-[11px]">app_settings/ads</code>.
            </p>
            {adErr && (
              <p className="mt-2 rounded border border-rose-400/45 bg-rose-50 px-2 py-1 text-xs text-rose-800">{adErr}</p>
            )}
            {adMsg && (
              <p className="mt-2 rounded border border-emerald-400/40 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                {adMsg}
              </p>
            )}
            <fieldset className="mt-3 space-y-2 border-0 p-0 text-xs text-slate-800">
              <legend className="mb-1 font-medium text-slate-700">Modo</legend>
              {(
                [
                  ["house", "Publicidad interna (house ads) — recomendado mientras aprueban"],
                  ["adsense", "AdSense real (requiere pegar los IDs de unidad abajo)"],
                  ["off", "Sin anuncios"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="ads-mode"
                    className="mt-0.5"
                    checked={adMode === value}
                    onChange={() => setAdMode(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-800">
              Publisher ID (ca-pub-…)
              <input
                type="text"
                aria-label="Publisher ID de AdSense"
                value={adClient}
                onChange={(e) => setAdClient(e.target.value)}
                placeholder="ca-pub-7622431410037127"
                className="w-64 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>

            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              <p className="font-medium text-slate-700">
                IDs de unidad de anuncio (data-ad-slot) — solo se usan en modo AdSense
              </p>
              {(
                [
                  ["blog_article", "Artículo del blog"],
                  ["blog_index", "Índice del blog"],
                  ["content", "Contenido (Entiéndelo fácil)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-wrap items-center gap-2">
                  <span className="w-52">{label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`Slot ${label}`}
                    value={adSlots[key]}
                    onChange={(e) => setAdSlots((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder="1234567890"
                    className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
              ))}
              <p className="text-[11px] text-slate-500">
                Si un espacio no tiene ID en modo AdSense, cae a publicidad interna para no dejar hueco.
              </p>
            </div>

            <button
              type="button"
              disabled={adSaveLoading}
              onClick={() => void saveAdsConfig()}
              className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {adSaveLoading ? "Guardando…" : "Guardar anuncios"}
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

        {legal && (
          <section className="mb-6 rounded-xl border border-violet-300 bg-violet-50/40 p-4">
            <h2 className="text-sm font-semibold text-violet-900">Cláusula especial y aliado jurídico</h2>
            <p className="mt-1 text-xs text-slate-600">
              Cuando un usuario elige la cláusula «Otra» (texto libre), se le informa que tiene un cobro adicional y se
              envía una solicitud de revisión a tu aliado jurídico.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-[11px] font-medium text-slate-700">
                Precio de la cláusula especial (COP)
                <input
                  inputMode="numeric"
                  value={specialPriceInput}
                  onChange={(e) => setSpecialPriceInput(e.target.value)}
                  placeholder="50000"
                  className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="min-w-[16rem] flex-1 text-[11px] font-medium text-slate-700">
                Correo(s) del aliado jurídico (separados por coma)
                <input
                  value={legalEmailsInput}
                  onChange={(e) => setLegalEmailsInput(e.target.value)}
                  placeholder="abogado@firma.com, legal@firma.com"
                  className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                />
              </label>
              <button
                type="button"
                disabled={specialBusy}
                onClick={() => void saveSpecialClauseConfig()}
                className="rounded border border-violet-500 bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {specialBusy ? "…" : "Guardar"}
              </button>
            </div>
            {(legal.config.legalPartnerEmails?.length ?? 0) === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Sin correo de aliado jurídico configurado: las solicitudes de revisión de cláusula «Otra» no se enviarán.
              </p>
            )}
            {specialMsg && <p className="mt-2 text-xs text-slate-700">{specialMsg}</p>}
          </section>
        )}

        <section className="mb-6 rounded-xl border border-violet-300 bg-violet-50/40 p-4">
          <h2 className="text-sm font-semibold text-violet-900">Referidos (Invita y gana)</h2>
          <p className="mt-1 text-xs text-slate-600">
            Cada usuario tiene un enlace de invitación. Los invitados quedan <strong>pendientes</strong> hasta que los
            apruebes aquí; al aprobarlos obtienen el descuento configurado en su Plan Plus.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-slate-600">Descuento al referido (%)</span>
              <input
                type="text"
                inputMode="numeric"
                value={refDiscountInput}
                onChange={(e) => setRefDiscountInput(e.target.value)}
                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={refBusy}
              onClick={() => void saveReferralConfig()}
              className="rounded border border-violet-500 bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {refBusy ? "…" : "Guardar descuento"}
            </button>
            <button
              type="button"
              disabled={refBusy}
              onClick={() => void saveReferralConfig(!(refConfig?.enabled ?? true))}
              className="rounded border border-slate-400 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 disabled:opacity-50"
            >
              {refConfig?.enabled ? "Desactivar programa" : "Activar programa"}
            </button>
            <span className="text-[11px] text-slate-600">
              Estado: {refConfig ? (refConfig.enabled ? `activo · ${refConfig.discountPercent}%` : "inactivo") : "…"}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700">
              Invitaciones ({refList.length}) · pendientes: {refList.filter((r) => r.status === "pending").length}
            </p>
            {refList.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Todavía no hay invitaciones registradas.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {refList.map((r) => (
                  <li
                    key={r.referredUid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0">
                      <strong className="text-slate-800">{r.referredEmail || r.referredUid}</strong>
                      <span className="text-slate-500"> · invitó: {r.referrerEmail || "—"}</span>
                      <span className="text-slate-400"> · {r.code}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          r.status === "approved"
                            ? "text-emerald-700"
                            : r.status === "rejected"
                              ? "text-rose-700"
                              : "text-amber-700"
                        }
                      >
                        {r.status}
                      </span>
                      {r.status !== "approved" && (
                        <button
                          type="button"
                          disabled={refBusy}
                          onClick={() => void reviewReferral(r.referredUid, "approve")}
                          className="rounded border border-emerald-500 px-2 py-0.5 text-emerald-700 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          type="button"
                          disabled={refBusy}
                          onClick={() => void reviewReferral(r.referredUid, "reject")}
                          className="rounded border border-rose-400 px-2 py-0.5 text-rose-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {refMsg && <p className="mt-2 text-xs text-slate-700">{refMsg}</p>}
        </section>

        <section className="mb-6 rounded-xl border border-amber-300 bg-amber-50/40 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Señales anti-fraude de reputación ({repFlags.filter((f) => f.status === "open").length} abiertas)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Patrones para revisión humana (no bloquean automáticamente): mismo par calificándose en varios contratos o
            ráfagas de calificaciones.
          </p>
          {repFlags.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Sin señales registradas.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {repFlags.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px]"
                >
                  <span className="min-w-0">
                    <strong
                      className={
                        f.severity === "high" ? "text-rose-700" : f.severity === "medium" ? "text-amber-700" : "text-slate-700"
                      }
                    >
                      {f.severity}
                    </strong>{" "}
                    <span className="text-slate-600">
                      {f.signals.map((s) => s.code).join(", ")} · {f.subjectEmail} ← {f.raterEmail}
                    </span>
                    <span className="text-slate-400"> · {f.status}</span>
                  </span>
                  {f.status === "open" && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={repFlagsBusy}
                        onClick={() => void reviewRepFlag(f.id, "reviewed")}
                        className="rounded border border-slate-400 px-2 py-0.5 text-slate-800 disabled:opacity-50"
                      >
                        Revisado
                      </button>
                      <button
                        type="button"
                        disabled={repFlagsBusy}
                        onClick={() => void reviewRepFlag(f.id, "dismissed")}
                        className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-sky-300 bg-sky-50/40 p-4">
          <h2 className="text-sm font-semibold text-sky-900">Estado y alertas de errores</h2>
          <p className="mt-1 text-xs text-slate-600">
            Aviso por correo cuando hay errores recientes. Umbral mínimo = 1 (alerta desde el primer error). Página
            pública:{" "}
            <a href="/estado" className="text-sky-700 underline" target="_blank" rel="noreferrer">
              /estado
            </a>
            .
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-slate-600">Umbral de errores</span>
              <input
                type="text"
                inputMode="numeric"
                value={obsThresholdInput}
                onChange={(e) => setObsThresholdInput(e.target.value)}
                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => void saveObsConfig()}
              className="rounded border border-sky-500 bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {statusBusy ? "…" : "Guardar umbral"}
            </button>
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => void saveObsConfig(!(obsConfig?.errorAlertEnabled ?? true))}
              className="rounded border border-slate-400 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 disabled:opacity-50"
            >
              {obsConfig?.errorAlertEnabled ? "Desactivar alertas" : "Activar alertas"}
            </button>
            <span className="text-[11px] text-slate-600">
              {obsConfig
                ? `${obsConfig.errorAlertEnabled ? "activas" : "inactivas"} · ventana ${obsConfig.errorAlertWindowMinutes} min`
                : "…"}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700">Publicar incidente</p>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <input
                type="text"
                value={incidentTitle}
                onChange={(e) => setIncidentTitle(e.target.value)}
                placeholder="Título del incidente"
                aria-label="Título del incidente"
                className="min-w-[200px] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={incidentBody}
                onChange={(e) => setIncidentBody(e.target.value)}
                placeholder="Detalle (opcional)"
                aria-label="Detalle del incidente"
                className="min-w-[200px] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              />
              <button
                type="button"
                disabled={statusBusy || incidentTitle.trim().length < 3}
                onClick={() => void createIncident()}
                className="rounded border border-sky-500 bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                Publicar
              </button>
            </div>
            {incidents.length > 0 && (
              <ul className="mt-3 space-y-1">
                {incidents.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0">
                      <strong className="text-slate-800">{i.title}</strong>
                      <span className="text-slate-500"> · {i.status}</span>
                    </span>
                    <span className="flex gap-1">
                      {i.status !== "monitoring" && i.status !== "resolved" && (
                        <button
                          type="button"
                          disabled={statusBusy}
                          onClick={() => void updateIncident(i.id, "monitoring")}
                          className="rounded border border-slate-400 px-2 py-0.5 text-slate-800 disabled:opacity-50"
                        >
                          En seguimiento
                        </button>
                      )}
                      {i.status !== "resolved" && (
                        <button
                          type="button"
                          disabled={statusBusy}
                          onClick={() => void updateIncident(i.id, "resolved")}
                          className="rounded border border-emerald-500 px-2 py-0.5 text-emerald-700 disabled:opacity-50"
                        >
                          Resolver
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {statusMsg && <p className="mt-2 text-xs text-slate-700">{statusMsg}</p>}
        </section>

        <section className="mb-6 rounded-xl border border-violet-300 bg-violet-50/40 p-4">
          <h2 className="text-sm font-semibold text-violet-900">Aliados (servicios de terceros)</h2>
          <p className="mt-1 text-xs text-slate-600">
            Los correos de contacto NO se muestran al usuario; solo se usan para enviarles el lead. Cuando un usuario
            pulsa «Contactar», el aliado y el usuario reciben enlaces para confirmar si el servicio se tomó (control de
            comisiones).
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={newPartner.name}
              onChange={(e) => setNewPartner((s) => ({ ...s, name: e.target.value }))}
              placeholder="Nombre del aliado"
              aria-label="Nombre del aliado"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            />
            <select
              value={newPartner.category}
              onChange={(e) => setNewPartner((s) => ({ ...s, category: e.target.value }))}
              aria-label="Categoría del aliado"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="recaudo">Recaudo del canon</option>
              <option value="seguro">Seguro de arrendamiento</option>
              <option value="estudio_credito">Estudio de crédito</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="juridica">Asesoría jurídica</option>
              <option value="cobranza">Cobranza</option>
              <option value="otro">Otro</option>
            </select>
            <input
              type="text"
              value={newPartner.websiteUrl}
              onChange={(e) => setNewPartner((s) => ({ ...s, websiteUrl: e.target.value }))}
              placeholder="https://enlace-del-aliado.com"
              aria-label="Enlace del aliado"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={newPartner.contactEmails}
              onChange={(e) => setNewPartner((s) => ({ ...s, contactEmails: e.target.value }))}
              placeholder="correos ocultos (separa con coma)"
              aria-label="Correos de contacto del aliado"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={newPartner.description}
              onChange={(e) => setNewPartner((s) => ({ ...s, description: e.target.value }))}
              placeholder="Descripción breve (opcional)"
              aria-label="Descripción del aliado"
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs sm:col-span-2"
            />
          </div>
          <button
            type="button"
            disabled={partnerBusy}
            onClick={() => void createPartner()}
            className="mt-2 rounded border border-violet-500 bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Agregar aliado
          </button>

          {partners.length > 0 && (
            <ul className="mt-3 space-y-1">
              {partners.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px]"
                >
                  <span className="min-w-0">
                    <strong className="text-slate-800">{p.name}</strong>
                    <span className="text-slate-500"> · {p.category}</span>
                    <span className="text-slate-400"> · {p.contactEmails.join(", ")}</span>
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      disabled={partnerBusy}
                      onClick={() => void savePartner(p, { active: !p.active })}
                      className={`rounded border px-2 py-0.5 disabled:opacity-50 ${p.active ? "border-emerald-500 text-emerald-700" : "border-slate-400 text-slate-600"}`}
                    >
                      {p.active ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      type="button"
                      disabled={partnerBusy}
                      onClick={() => void deletePartner(p.id)}
                      className="rounded border border-rose-400 px-2 py-0.5 text-rose-700 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <p className="text-xs font-medium text-slate-700">
              Referidos a aliados ({partnerLeads.length}) · elegibles comisión:{" "}
              {partnerLeads.filter((l) => l.outcome.commissionEligible).length} · en disputa:{" "}
              {partnerLeads.filter((l) => l.outcome.needsReview).length}
            </p>
            {partnerLeads.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">Aún no hay referidos.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {partnerLeads.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0">
                      <strong className="text-slate-800">{l.partnerName}</strong>
                      <span className="text-slate-500"> · {l.clientName} ({l.userEmail})</span>
                      <span
                        className={`ml-1 ${l.outcome.needsReview ? "text-rose-700" : l.outcome.commissionEligible ? "text-emerald-700" : "text-slate-500"}`}
                      >
                        · {l.outcome.label}
                      </span>
                      <span className="text-slate-400"> · comisión: {l.commissionStatus}</span>
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        disabled={partnerBusy}
                        onClick={() => void setLeadCommission(l.id, "billed")}
                        className="rounded border border-slate-400 px-2 py-0.5 text-slate-800 disabled:opacity-50"
                      >
                        Facturada
                      </button>
                      <button
                        type="button"
                        disabled={partnerBusy}
                        onClick={() => void setLeadCommission(l.id, "paid")}
                        className="rounded border border-emerald-500 px-2 py-0.5 text-emerald-700 disabled:opacity-50"
                      >
                        Pagada
                      </button>
                      <button
                        type="button"
                        disabled={partnerBusy}
                        onClick={() => void setLeadCommission(l.id, "void")}
                        className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 disabled:opacity-50"
                      >
                        Anular
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {partnerMsg && <p className="mt-2 text-xs text-slate-700">{partnerMsg}</p>}
        </section>

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
