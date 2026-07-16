/** Página HTML mínima para acciones de 1 clic por token (sin login). */
export function oneClickPage(title: string, body: string, ok = true): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title} · ArriendoSeguro</title>
    <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px}
    .c{max-width:440px;text-align:center;background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:28px}
    .b{width:48px;height:48px;margin:0 auto 14px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;background:${ok ? "#16a34a" : "#6d28d9"}}
    h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#475569;margin:0}</style></head>
    <body><div class="c"><div class="b">${ok ? "✓" : "ℹ"}</div><h1>${title}</h1><p>${body}</p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
