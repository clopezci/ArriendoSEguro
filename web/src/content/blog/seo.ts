import { appConfig } from "@/lib/config";

/** URL absoluta para JSON-LD, Open Graph y sitemap. */
export function absoluteUrl(path: string): string {
  const base = appConfig.publicUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
