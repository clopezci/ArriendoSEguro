import { z } from "zod";

/** Formulario de validación de mercado: 6 preguntas ajustadas (doc Instrucciones) */
export const leadFormSchema = z.object({
  q1PropertySituation: z.enum([
    "yes_rented_before",
    "yes_first_time",
    "evaluating",
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
    "all",
  ]),
  q4LowCostApp: z.enum(["yes", "maybe", "no"]),
  q5WillingToPay: z.enum([
    "range_20_40",
    "range_40_60",
    "range_60_80",
  ]),
  q6ValuedModule: z.enum([
    "contract",
    "signature",
    "inventory",
    "payments",
    "evaluation",
    "integrated",
  ]),
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
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;
