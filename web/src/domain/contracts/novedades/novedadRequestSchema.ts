import { z } from "zod";
import { NOVEDAD_TIPO_IDS } from "./types";

export const novedadCreateFormSchema = z
  .object({
    contractId: z.string().min(3, "Identificador de expediente inválido."),
    tipo: z.enum(NOVEDAD_TIPO_IDS, { message: "Selecciona un tipo de novedad." }),
    description: z.string().max(2000, "La descripción es demasiado larga.").optional().default(""),
  })
  .superRefine((val, ctx) => {
    const d = val.description.trim();
    if (val.tipo === "OTRA" && d.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Para «Otra» escribe al menos 10 caracteres describiendo la solicitud.",
      });
    }
  });

export type NovedadCreateForm = z.infer<typeof novedadCreateFormSchema>;
