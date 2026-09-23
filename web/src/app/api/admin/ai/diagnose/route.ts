import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { pingAllProviders } from "@/lib/ai/providerChain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/diagnose — pinguea cada proveedor de IA configurado y reporta
 * OK/falla (sin exponer llaves). Para confirmar que una API key nueva quedó válida.
 */
export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const providers = await pingAllProviders();
  return NextResponse.json({ success: true, count: providers.length, providers });
}
