import { z } from "zod";

/** Formulario de validación de mercado: 6 preguntas ajustadas (doc Instrucciones) */
export const leadFormSchema = z.object({
  q1PropertySituation: z.enum([
    "yes_rented_before",
    "yes_first_time",
    "evaluating",
    "no_property",
  ]),
  q2RentalChannel: z.enum([
    "agency",
    "direct",
    "both",
    "never",
  ]),
  q3MainConcern: z.enum([
    "unclear_contract",
    "counterparty_validation",
    "payment_risk",
    "delivery_state",
    "conflict_resolution",
    "all",
  ]),
  q4LowCostApp: z.enum(["yes", "maybe", "no"]),
  q4NoReason: z
    .enum(["price", "hard_to_use", "not_needed", "prefer_agency", "other"])
    .optional(),
  q4NoReasonOther: z.string().trim().max(280).optional(),
  q5WillingToPay: z.enum([
    "under_50",
    "range_50_70",
    "range_70_100",
    "would_not_pay",
  ]),
  q6ValuedModule: z.enum([
    "guided_contract",
    "signature",
    "inventory",
    "payments",
    "evaluation",
    "integrated",
    "other",
  ]),
  q6Other: z.string().trim().max(280).optional(),
  sourcePage: z
    .enum([
      "landing",
      "entiendelo-facil",
      "landing_fase_inicial",
      /** Compatibilidad con envíos previos desde la landing */
      "landing_mvp",
      "landing_comercial_interno",
    ])
    .default("landing"),
  email: z.preprocess(
    (v) => {
      if (typeof v !== "string") return "";
      const t = v.trim();
      if (t === "") return "";
      return t.toLowerCase();
    },
    z
      .string()
      .refine(
        (s) => s === "" || z.string().email().safeParse(s).success,
        { message: "Correo no válido" }
      )
  ),
  contactConsent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.q4LowCostApp !== "no") return;
  if (!data.q4NoReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["q4NoReason"],
      message: "Selecciona por qué no usarías la app",
    });
    return;
  }
  if (data.q4NoReason === "other") {
    const text = data.q4NoReasonOther?.trim() ?? "";
    if (text.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["q4NoReasonOther"],
        message: "Cuéntanos brevemente el motivo",
      });
    }
  }
  if (data.q6ValuedModule === "other") {
    const text = data.q6Other?.trim() ?? "";
    if (text.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["q6Other"],
        message: "Escribe qué debería contener la aplicación",
      });
    }
  }
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;
