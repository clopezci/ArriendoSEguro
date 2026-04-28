import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  action: z.string().max(64).optional(),
});

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ success: true, skipped: true });
    }
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Turnstile no configurado en servidor." }] },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: [{ field: "token", message: "Token Turnstile inválido." }] },
      { status: 422 },
    );
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", parsed.data.token);
  const ip = clientIp(request);
  if (ip) form.set("remoteip", ip);

  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await verify.json().catch(() => ({}))) as {
    success?: boolean;
    action?: string;
    "error-codes"?: string[];
  };

  if (!verify.ok || !json.success) {
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "turnstile", message: "No se pudo validar el control anti-bot." }],
        codes: json["error-codes"] ?? [],
      },
      { status: 403 },
    );
  }

  if (parsed.data.action && json.action && json.action !== parsed.data.action) {
    return NextResponse.json(
      { success: false, errors: [{ field: "turnstile", message: "Acción Turnstile no coincide." }] },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}

